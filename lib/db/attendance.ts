// lib/db/attendance.ts
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { nowTS, toTS } from "./utils";

export type AttendanceStatus = "present" | "left" | "denied";
export type AttendanceLogMethod =
    | "google_oauth"
    | "username_password"
    | "cccd"
    | "qr";

export type Attendance = {
    id: string; // userId khi lưu dưới event
    eventId: string;
    userId?: string | null;
    firstCheckInAt?: Timestamp | null;
    lastCheckInAt?: Timestamp | null;
    checkoutAt?: Timestamp | null;
    lastStatus: AttendanceStatus;
    sourceLogId?: string | null;
};

const colEvents = () => adminDb.collection("events");
const colAttendances = (eventId: string) =>
    colEvents().doc(eventId).collection("attendances");
const colLogs = (eventId: string) =>
    colEvents().doc(eventId).collection("attendance_logs");

function toAttendance(
    snap: FirebaseFirestore.DocumentSnapshot,
    eventId: string
): Attendance {
    const d = snap.data()!;
    return {
        id: snap.id,
        eventId,
        userId: d.userId ?? snap.id,
        firstCheckInAt: d.firstCheckinAt ?? null,
        lastCheckInAt: d.lastCheckinAt ?? null,
        checkoutAt: d.checkoutAt ?? null,
        lastStatus: d.lastStatus ?? "present",
        sourceLogId: d.sourceLogId ?? null,
    };
}

export async function listAttendances(eventId: string): Promise<Attendance[]> {
    const snap = await colAttendances(eventId).get();
    return snap.docs.map((d) => toAttendance(d, eventId));
}

export async function upsertAttendance(input: {
    eventId: string;
    userId: string;
    status: AttendanceStatus;
    at?: Date | string | number;
    sourceLogId?: string | null;
}) {
    const at = input.at ? toTS(input.at) : Timestamp.now();
    const ref = colAttendances(input.eventId).doc(input.userId);

    await adminDb.runTransaction(async (trx) => {
        const snap = await trx.get(ref);
        if (!snap.exists) {
            trx.set(ref, {
                userId: input.userId,
                firstCheckInAt: input.status === "present" ? at : null,
                lastCheckInAt: input.status === "present" ? at : null,
                checkoutAt: input.status === "left" ? at : null,
                lastStatus: input.status,
                sourceLogId: input.sourceLogId ?? null,
            });
        } else {
            const d = snap.data()!;
            const patch: Record<string, unknown> = {
                lastStatus: input.status,
                sourceLogId: input.sourceLogId ?? d.sourceLogId ?? null,
            };
            if (input.status === "present") {
                patch.firstCheckInAt = d.firstCheckInAt ?? at;
                patch.lastCheckInAt = at;
            }
            if (input.status === "left") {
                patch.checkoutAt = at;
            }
            trx.update(ref, patch);
        }
    });
}

export async function addAttendanceLog(input: {
    eventId: string;
    userId?: string | null;
    method: AttendanceLogMethod;
    identifierValue?: string | null;
    success?: boolean;
    actorId?: string | null;
    sourceIp?: string | null;
    userAgent?: string | null;
}) {
    const ref = await colLogs(input.eventId).add({
        userId: input.userId ?? null,
        method: input.method,
        identifierValue: input.identifierValue ?? null,
        success: input.success ?? true,
        actorId: input.actorId ?? null,
        sourceIp: input.sourceIp ?? null,
        userAgent: input.userAgent ?? null,
        createdAt: nowTS(),
    });
    return ref.id;
}

/** Dùng cho StatsPage: trả về mảng items với lastStatus + lastCheckInAt giống FE mong đợi */
export async function attendanceSummary(eventId: string) {
    const items = await listAttendances(eventId);
    return items.map((a) => ({
        id: `${eventId}_${a.userId}`,
        userId: a.userId,
        // map "left" -> "absent" nếu FE đang dùng ba trạng thái present/late/absent
        lastStatus:
            a.lastStatus === "present"
                ? "present"
                : a.lastStatus === "left"
                ? "absent"
                : "denied",
        lastCheckInAt: a.lastCheckInAt ?? a.firstCheckInAt ?? null,
    }));
}

export async function writeAttendanceLog(input: {
  eventId: string;
  userId?: string | null;
  method: AttendanceLogMethod;
  identifierValue?: string | null;
  success?: boolean;
  actorId?: string | null;
  sourceIp?: string | null;
  userAgent?: string | null;
}) {
  if (!input?.eventId) throw new Error("eventId is required");
  if (!input?.method) throw new Error("method is required");

  const logId = await addAttendanceLog(input);
  return { logId };
}