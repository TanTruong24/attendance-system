// lib/db/events.ts
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { nowTS, toLowerOrNull, toTS } from "./utils";

export type EventStatus = "draft" | "published" | "closed";

export type EventItem = {
    id: string;
    code: string;
    codeLower: string;
    title: string;
    startAt: Timestamp; // DÙNG CHO logic đúng giờ/trễ/vắng
    endAt: Timestamp; // DÙNG CHO logic đúng giờ/trễ/vắng
    // --- NEW: cửa sổ chấm công được tính ---
    checkinOpenAt?: Timestamp | null; // nếu null => không giới hạn mở
    checkinCloseAt?: Timestamp | null; // nếu null => không giới hạn đóng
    url?: string | null;
    createdBy?: string | null;
    status: EventStatus;
    createdAt: Timestamp;
    updatedAt: Timestamp;
};

const col = () => adminDb.collection("events");
const colAttendances = (eventId: string) =>
    col().doc(eventId).collection("attendances");
const colLogs = (eventId: string) =>
    col().doc(eventId).collection("attendance_logs");

function toEvent(snap: FirebaseFirestore.DocumentSnapshot): EventItem {
    const d = snap.data()!;
    return {
        id: snap.id,
        code: d.code,
        codeLower: d.codeLower,
        title: d.title,
        startAt: d.startAt,
        endAt: d.endAt,
        checkinOpenAt: d.checkinOpenAt ?? null, // NEW
        checkinCloseAt: d.checkinCloseAt ?? null, // NEW
        url: d.url ?? null,
        createdBy: d.createdBy ?? null,
        status: d.status ?? "published",
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
    };
}

export async function listEvents(limit = 50): Promise<EventItem[]> {
    const snap = await col().orderBy("startAt", "desc").limit(limit).get();
    return snap.docs.map(toEvent);
}

export async function getEventById(id: string): Promise<EventItem | null> {
    const doc = await col().doc(id).get();
    return doc.exists ? toEvent(doc) : null;
}

export async function createEvent(input: {
    code: string;
    title: string;
    startAt: Date | string | number;
    endAt: Date | string | number;
    // --- NEW (tuỳ chọn) ---
    checkinOpenAt?: Date | string | number | null;
    checkinCloseAt?: Date | string | number | null;
    createdBy?: string | null;
    status?: EventStatus;
    url?: string | null;
}) {
    if (!input.code?.trim()) throw new Error("Thiếu mã sự kiện.");
    if (!input.title?.trim()) throw new Error("Thiếu tên sự kiện.");

    const codeLower = toLowerOrNull(input.code)!;
    const dup = await col().where("codeLower", "==", codeLower).limit(1).get();
    if (!dup.empty) throw new Error("Mã sự kiện đã tồn tại.");

    const start = toTS(input.startAt);
    const end = toTS(input.endAt);
    if (end.toMillis() <= start.toMillis())
        throw new Error("endAt phải sau startAt.");

    const openAt =
        input.checkinOpenAt == null ? null : toTS(input.checkinOpenAt);
    const closeAt =
        input.checkinCloseAt == null ? null : toTS(input.checkinCloseAt);
    if (openAt && closeAt && closeAt.toMillis() <= openAt.toMillis()) {
        throw new Error("checkinCloseAt phải sau checkinOpenAt.");
    }
    // KHÔNG ép nằm trong [startAt, endAt] để khỏi ảnh hưởng rule cũ

    const ref = await col().add({
        code: input.code.trim(),
        codeLower,
        title: input.title.trim(),
        startAt: start,
        endAt: end,
        checkinOpenAt: openAt ?? null,
        checkinCloseAt: closeAt ?? null,
        url: input.url ?? null,
        createdBy: input.createdBy ?? null,
        status: input.status ?? "published",
        createdAt: nowTS(),
        updatedAt: nowTS(),
    });

    const snap = await ref.get();
    return toEvent(snap);
}

/* ---------- update + delete ---------- */

export async function updateEvent(
    id: string,
    patch: Partial<{
        code: string;
        title: string;
        startAt: Date | string | number;
        endAt: Date | string | number;
        // --- NEW (tuỳ chọn) ---
        checkinOpenAt: Date | string | number | null;
        checkinCloseAt: Date | string | number | null;
        url: string | null;
        createdBy: string | null;
        status: EventStatus;
    }>
) {
    const ref = col().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Sự kiện không tồn tại.");

    const data: any = { updatedAt: nowTS() };

    if (patch.code !== undefined) {
        const codeLower = toLowerOrNull(patch.code);
        if (!patch.code?.trim()) throw new Error("Mã sự kiện không hợp lệ.");
        if (codeLower) {
            const dup = await col()
                .where("codeLower", "==", codeLower)
                .limit(1)
                .get();
            if (!dup.empty && dup.docs[0].id !== id)
                throw new Error("Mã sự kiện đã tồn tại.");
        }
        data.code = patch.code.trim();
        data.codeLower = codeLower;
    }

    if (patch.title !== undefined) {
        if (!patch.title?.trim()) throw new Error("Tên sự kiện không hợp lệ.");
        data.title = patch.title.trim();
    }

    if (patch.startAt !== undefined) data.startAt = toTS(patch.startAt);
    if (patch.endAt !== undefined) data.endAt = toTS(patch.endAt);
    if (
        data.startAt &&
        data.endAt &&
        data.endAt.toMillis() <= data.startAt.toMillis()
    ) {
        throw new Error("endAt phải sau startAt.");
    }

    // --- NEW: cửa sổ chấm công ---
    if (Object.prototype.hasOwnProperty.call(patch, "checkinOpenAt")) {
        data.checkinOpenAt =
            patch.checkinOpenAt == null ? null : toTS(patch.checkinOpenAt);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "checkinCloseAt")) {
        data.checkinCloseAt =
            patch.checkinCloseAt == null ? null : toTS(patch.checkinCloseAt);
    }
    if (
        data.checkinOpenAt !== undefined &&
        data.checkinCloseAt !== undefined &&
        data.checkinOpenAt !== null &&
        data.checkinCloseAt !== null &&
        data.checkinCloseAt.toMillis() <= data.checkinOpenAt.toMillis()
    ) {
        throw new Error("checkinCloseAt phải sau checkinOpenAt.");
    }

    if (patch.url !== undefined) data.url = patch.url;
    if (patch.createdBy !== undefined) data.createdBy = patch.createdBy;
    if (patch.status !== undefined) data.status = patch.status;

    await ref.update(data);
    const after = await ref.get();
    return toEvent(after);
}

export async function deleteEvent(id: string) {
    const ref = col().doc(id);
    const doc = await ref.get();
    if (!doc.exists) return { ok: true };

    const limit = 300;
    // attendances
    while (true) {
        const s = await colAttendances(id).limit(limit).get();
        if (s.empty) break;
        const batch = adminDb.batch();
        s.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
    // logs
    while (true) {
        const s = await colLogs(id).limit(limit).get();
        if (s.empty) break;
        const batch = adminDb.batch();
        s.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }

    await ref.delete();
    return { ok: true };
}

/* ---------- NEW helper: kiểm tra một check-in có được tính hay không ---------- */
export function isCountableCheckin(evt: EventItem, at: Timestamp) {
    // Nếu không cấu hình cửa sổ -> luôn tính (giữ nguyên hành vi cũ)
    const openMs = evt.checkinOpenAt?.toMillis() ?? null;
    const closeMs = evt.checkinCloseAt?.toMillis() ?? null;
    const t = at.toMillis();

    if (openMs == null && closeMs == null) return true;
    if (openMs != null && closeMs == null) return t >= openMs;
    if (openMs == null && closeMs != null) return t <= closeMs;
    return t >= (openMs as number) && t <= (closeMs as number);
}
