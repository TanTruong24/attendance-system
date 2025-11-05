// lib/db.ts
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

/* ================== Types ================== */
export type UserRole = "admin" | "staff" | "attendee";
export type UserStatus = "active" | "disabled";

export type User = {
  id: string;
  name: string;
  email?: string | null;
  username?: string | null;
  role: UserRole;
  groupId?: string | null;
  cccdLast4?: string | null;
  status: UserStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type EventStatus = "draft" | "published" | "closed";
export type EventItem = {
  id: string;
  code: string;
  codeLower: string;
  title: string;
  startAt: Timestamp;
  endAt: Timestamp;
  url?: string | null;
  createdBy?: string | null;
  status: EventStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type AttendanceLogMethod = "google_oauth" | "username_password" | "cccd" | "qr";
export type AttendanceLog = {
  id: string;
  eventId: string;
  userId?: string | null;
  method: AttendanceLogMethod;
  identifierValue?: string | null;
  success: boolean;
  actorId?: string | null;
  sourceIp?: string | null;
  userAgent?: string | null;
  createdAt: Timestamp;
};

export type AttendanceStatus = "present" | "left" | "denied";
export type Attendance = {
  id: string; // = userId trong subcollection
  eventId: string;
  userId?: string | null;
  firstCheckInAt?: Timestamp | null;
  lastCheckInAt?: Timestamp | null;
  checkoutAt?: Timestamp | null;
  lastStatus: AttendanceStatus;
  sourceLogId?: string | null;
};

/* ================== Collections ================== */
const colUsers = () => adminDb.collection("users");
const colEvents = () => adminDb.collection("events");
const eventAttendances = (eventId: string) => colEvents().doc(eventId).collection("attendances");
const eventLogs = (eventId: string) => colEvents().doc(eventId).collection("attendance_logs");

/* ================== Helpers ================== */
const nowTS = () => FieldValue.serverTimestamp();

function toUser(snap: FirebaseFirestore.DocumentSnapshot): User {
  const d = snap.data()!;
  return {
    id: snap.id,
    name: d.name,
    email: d.email ?? null,
    username: d.username ?? null,
    role: d.role,
    groupId: d.groupId ?? null,
    cccdLast4: d.cccdLast4 ?? null,
    status: d.status ?? "active",
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}
function toEvent(snap: FirebaseFirestore.DocumentSnapshot): EventItem {
  const d = snap.data()!;
  return {
    id: snap.id,
    code: d.code,
    codeLower: d.codeLower,
    title: d.title,
    startAt: d.startAt,
    endAt: d.endAt,
    url: d.url ?? null,
    createdBy: d.createdBy ?? null,
    status: d.status ?? "published",
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}
function toAttendance(snap: FirebaseFirestore.DocumentSnapshot, eventId: string): Attendance {
  const d = snap.data()!;
  return {
    id: snap.id,
    eventId,
    userId: d.userId ?? snap.id,
    firstCheckInAt: d.firstCheckInAt ?? null,
    lastCheckInAt: d.lastCheckInAt ?? null,
    checkoutAt: d.checkoutAt ?? null,
    lastStatus: d.lastStatus ?? "present",
    sourceLogId: d.sourceLogId ?? null,
  };
}
function ts(v: Date | string | number): Timestamp {
  if (v instanceof Date) return Timestamp.fromDate(v);
  if (typeof v === "string" || typeof v === "number") return Timestamp.fromDate(new Date(v));
  return Timestamp.now();
}

/* ================== USERS ================== */
export async function listUsers(): Promise<User[]> {
  const snap = await colUsers().orderBy("createdAt", "desc").get();
  return snap.docs.map(toUser);
}

export async function createUser(input: {
  name: string;
  email?: string;
  username?: string;
  role: UserRole;
  groupId?: string | null;
  cccd?: string;
  status?: UserStatus;
}) {
  const emailLower = input.email ? input.email.toLowerCase() : null;
  const usernameLower = input.username ? input.username.toLowerCase() : null;

  if (emailLower) {
    const dup = await colUsers().where("emailLower", "==", emailLower).limit(1).get();
    if (!dup.empty) throw new Error("Email đã tồn tại.");
  }
  if (usernameLower) {
    const dup = await colUsers().where("usernameLower", "==", usernameLower).limit(1).get();
    if (!dup.empty) throw new Error("Username đã tồn tại.");
  }

  const ref = await colUsers().add({
    name: input.name,
    email: input.email ?? null,
    emailLower,
    username: input.username ?? null,
    usernameLower,
    role: input.role,
    groupId: input.groupId ?? null,
    cccdLast4: input.cccd ? input.cccd.slice(-4) : null,
    status: input.status ?? "active",
    createdAt: nowTS(),
    updatedAt: nowTS(),
  });
  const snap = await ref.get();
  return toUser(snap);
}

/* ================== EVENTS ================== */
export async function listEvents(): Promise<EventItem[]> {
  const snap = await colEvents().orderBy("startAt", "desc").get();
  return snap.docs.map(toEvent);
}

export async function getEventById(id: string): Promise<EventItem | null> {
  const doc = await colEvents().doc(id).get();
  return doc.exists ? toEvent(doc) : null;
}

export async function createEvent(input: {
  code: string;
  title: string;
  startAt: Date | string | number;
  endAt: Date | string | number;
  createdBy?: string | null;
  status?: EventStatus;
  url?: string | null;
}) {
  const codeLower = input.code.toLowerCase();
  const dup = await colEvents().where("codeLower", "==", codeLower).limit(1).get();
  if (!dup.empty) throw new Error("Mã sự kiện đã tồn tại.");

  const start = ts(input.startAt);
  const end = ts(input.endAt);
  if (end.toMillis() <= start.toMillis()) throw new Error("endAt phải sau startAt.");

  const ref = await colEvents().add({
    code: input.code,
    codeLower,
    title: input.title,
    startAt: start,
    endAt: end,
    url: input.url ?? null,
    createdBy: input.createdBy ?? null,
    status: input.status ?? "published",
    createdAt: nowTS(),
    updatedAt: nowTS(),
  });
  const snap = await ref.get();
  return toEvent(snap);
}

/* ================== ATTENDANCE LOGS ================== */
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
  const ref = await eventLogs(input.eventId).add({
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

/* ================== ATTENDANCES (per event) ================== */
export async function upsertAttendance(input: {
  eventId: string;
  userId: string;
  status: AttendanceStatus;
  at?: Date | string | number;
  sourceLogId?: string | null;
}) {
  const at = input.at ? ts(input.at) : Timestamp.now();
  const ref = eventAttendances(input.eventId).doc(input.userId);

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

export async function listAttendances(eventId: string) {
  const snap = await eventAttendances(eventId).get();
  return snap.docs.map((d) => toAttendance(d, eventId));
}

/* ======== Summary cho StatsPage (trả về format FE đang dùng) ======== */
export async function attendanceSummary(eventId: string) {
  const items = await listAttendances(eventId);
  return items.map((a) => ({
    id: `${eventId}_${a.userId}`,
    userId: a.userId,
    // FE đang hiểu: present/late/absent. Ở đây map "left" -> "absent" cho đơn giản.
    lastStatus: a.lastStatus === "present" ? "present" : a.lastStatus === "left" ? "absent" : "denied",
    lastCheckInAt: a.lastCheckInAt ?? a.firstCheckInAt ?? null,
  }));
}
