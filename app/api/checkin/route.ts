import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuth } from "firebase-admin/auth";

const eventsCol = () => adminDb.collection("events");
const usersCol = () => adminDb.collection("users");
const nowTS = () => new Date();

type Body =
    | { code: string; method: "google"; idToken: string }
    | { code: string; method: "cccd"; cccd: string };

async function findEventByCode(codeLower: string) {
    const snap = await eventsCol()
        .where("codeLower", "==", codeLower)
        .limit(1)
        .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const d = doc.data() as any;
    return {
        id: doc.id,
        checkinOpenAt: d.checkinOpenAt?.toDate?.() ?? null,
        checkinCloseAt: d.checkinCloseAt?.toDate?.() ?? null,
    };
}

async function findUserIdByEmail(email: string) {
    const q = await usersCol()
        .where("emailLower", "==", email.toLowerCase())
        .limit(1)
        .get();
    return q.empty ? null : q.docs[0].id;
}

async function findUserIdByCccd(cccd: string) {
    let q = await usersCol().where("cccd", "==", cccd).limit(1).get();
    if (!q.empty) return q.docs[0].id;
    q = await usersCol().where("cccdFull", "==", cccd).limit(1).get();
    if (!q.empty) return q.docs[0].id;
    const last4 = cccd.slice(-4);
    const q2 = await usersCol().where("cccdLast4", "==", last4).limit(2).get();
    if (q2.empty) return null;
    if (q2.size > 1)
        throw new Error(
            "CCCD trùng last4 với nhiều người dùng, vui lòng dùng Google."
        );
    return q2.docs[0].id;
}

async function writeLog(eventId: string, payload: any) {
    const ref = eventsCol().doc(eventId).collection("attendance_logs").doc();
    await ref.set({ ...payload, createdAt: nowTS() });
    return ref.id;
}

async function hasAttendance(eventId: string, userId: string) {
    const ref = eventsCol().doc(eventId).collection("attendances").doc(userId);
    const snap = await ref.get();
    return snap.exists;
}

async function createOrUpdateAttendance(
    eventId: string,
    userId: string,
    sourceLogId: string
) {
    const ref = eventsCol().doc(eventId).collection("attendances").doc(userId);
    await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            tx.set(ref, {
                firstCheckinAt: nowTS(),
                lastCheckinAt: nowTS(),
                checkoutAt: null,
                lastStatus: "present",
                sourceLogId,
            });
        } else {
            // Giữ nguyên yêu cầu mới: KHÔNG ghi đè nếu đã có
            // -> KHÔNG update nữa
        }
    });
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as Body;
        const codeLower = (body.code ?? "").trim().toLowerCase();
        if (!codeLower)
            return NextResponse.json("Thiếu mã sự kiện.", { status: 400 });

        // Lấy event & kiểm tra cửa sổ check-in
        const evt = await findEventByCode(codeLower);
        if (!evt) return NextResponse.json("Event not found", { status: 404 });

        const now = nowTS().getTime();
        const open = evt.checkinOpenAt ? evt.checkinOpenAt.getTime() : null;
        const close = evt.checkinCloseAt ? evt.checkinCloseAt.getTime() : null;
        const outsideOpen = open != null && now < open;
        const outsideClose = close != null && now > close;
        if (outsideOpen || outsideClose) {
            const reason = outsideOpen
                ? "Cửa sổ điểm danh chưa mở."
                : "Cửa sổ điểm danh đã đóng.";
            await writeLog(evt.id, {
                method: body.method,
                userId: null,
                identifierValue: null,
                success: false,
                reason,
            });
            return NextResponse.json(reason, { status: 403 });
        }

        if (body.method === "google") {
            if (!body.idToken)
                return NextResponse.json("Thiếu idToken.", { status: 400 });
            const decoded = await getAuth().verifyIdToken(body.idToken);
            const email = decoded.email;
            const userId = email ? await findUserIdByEmail(email) : null;
            if (!userId)
                return NextResponse.json(
                    "Không tìm thấy tài khoản người dùng.",
                    { status: 404 }
                );

            // NEW: chặn nếu đã điểm danh
            const info = await getAttendanceInfo(evt.id, userId);
            if (info.exists) {
                await writeLog(evt.id, {
                    method: "google_oauth",
                    userId,
                    identifierValue: email ?? null,
                    success: false,
                    reason: "already_checked_in",
                });
                return NextResponse.json(
                    {
                        message: "Bạn đã điểm danh sự kiện này trước đó.",
                        firstCheckinAt: info.firstCheckinAt
                            ? info.firstCheckinAt.toISOString()
                            : null,
                        lastCheckinAt: info.lastCheckinAt
                            ? info.lastCheckinAt.toISOString()
                            : null,
                    },
                    { status: 409 }
                );
            }

            const logId = await writeLog(evt.id, {
                method: "google_oauth",
                userId,
                identifierValue: email ?? null,
                success: true,
            });
            await createOrUpdateAttendance(evt.id, userId, logId);
            return NextResponse.json({ ok: true, logId });
        }

        if (body.method === "cccd") {
            const raw = (body.cccd ?? "").trim();
            if (!/^\d{12}$/.test(raw))
                return NextResponse.json("CCCD phải gồm đúng 12 chữ số.", {
                    status: 400,
                });

            let userId: string | null = null;
            try {
                userId = await findUserIdByCccd(raw);
            } catch (e: any) {
                return NextResponse.json(e?.message || "CCCD không hợp lệ.", {
                    status: 400,
                });
            }
            if (!userId)
                return NextResponse.json(
                    "Không tìm thấy người dùng với CCCD này.",
                    { status: 404 }
                );

            // NEW: chặn nếu đã điểm danh
            const info2 = await getAttendanceInfo(evt.id, userId);
            if (info2.exists) {
                await writeLog(evt.id, {
                    method: "cccd",
                    userId,
                    identifierValue: `****${raw.slice(-4)}`,
                    success: false,
                    reason: "already_checked_in",
                });
                return NextResponse.json(
                    {
                        message: "Bạn đã điểm danh sự kiện này trước đó.",
                        firstCheckinAt: info2.firstCheckinAt
                            ? info2.firstCheckinAt.toISOString()
                            : null,
                        lastCheckinAt: info2.lastCheckinAt
                            ? info2.lastCheckinAt.toISOString()
                            : null,
                    },
                    { status: 409 }
                );
            }

            const logId = await writeLog(evt.id, {
                method: "cccd",
                userId,
                identifierValue: `****${raw.slice(-4)}`,
                success: true,
            });
            await createOrUpdateAttendance(evt.id, userId, logId);
            return NextResponse.json({ ok: true, logId });
        }

        return NextResponse.json("Method không hỗ trợ.", { status: 400 });
    } catch (e: any) {
        return NextResponse.json(e?.message || "Bad request", { status: 400 });
    }
}

async function getAttendanceInfo(eventId: string, userId: string) {
    const ref = eventsCol().doc(eventId).collection("attendances").doc(userId);
    const snap = await ref.get();
    if (!snap.exists) return { exists: false as const };
    const d = snap.data() as any;
    const toJS = (v: any) => (v?.toDate?.() ? v.toDate() : v); // hỗ trợ cả Timestamp lẫn Date
    return {
        exists: true as const,
        firstCheckinAt: toJS(d.firstCheckinAt) as Date | null,
        lastCheckinAt: toJS(d.lastCheckinAt) as Date | null,
    };
}
