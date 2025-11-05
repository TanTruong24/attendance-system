import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuth } from "firebase-admin/auth";

// helpers
const eventsCol = () => adminDb.collection("events");
const usersCol = () => adminDb.collection("users");
const nowTS = () => new Date();

type Body =
  | { code: string; method: "google"; idToken: string }
  | { code: string; method: "cccd"; cccd: string };

async function findEventIdByCode(code: string) {
  const snap = await eventsCol().where("codeLower", "==", code.toLowerCase()).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

async function findUserIdByEmail(email: string) {
  const q = await usersCol().where("emailLower", "==", email.toLowerCase()).limit(1).get();
  return q.empty ? null : q.docs[0].id;
}

// Tìm user theo CCCD. Ưu tiên trường full (cccd / cccdFull), fallback last4 với kiểm tra duy nhất.
async function findUserIdByCccd(cccd: string) {
  // 1) full
  let q = await usersCol().where("cccd", "==", cccd).limit(1).get();
  if (!q.empty) return q.docs[0].id;

  q = await usersCol().where("cccdFull", "==", cccd).limit(1).get();
  if (!q.empty) return q.docs[0].id;

  // 2) fallback last4 (chỉ chấp nhận khi duy nhất)
  const last4 = cccd.slice(-4);
  const q2 = await usersCol().where("cccdLast4", "==", last4).limit(2).get();
  if (q2.empty) return null;
  if (q2.size > 1) throw new Error("CCCD trùng last4 với nhiều người dùng, vui lòng dùng Google.");
  return q2.docs[0].id;
}

async function writeLog(eventId: string, payload: any) {
  const ref = eventsCol().doc(eventId).collection("attendance_logs").doc();
  await ref.set({ ...payload, createdAt: nowTS() });
  return ref.id;
}

async function upsertAttendance(eventId: string, userId: string | null, sourceLogId: string) {
  if (!userId) return;
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
      tx.update(ref, {
        lastCheckinAt: nowTS(),
        lastStatus: "present",
        sourceLogId,
      });
    }
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const codeLower = (body.code ?? "").trim().toLowerCase();
    if (!codeLower) return NextResponse.json("Thiếu mã sự kiện.", { status: 400 });

    const eventId = await findEventIdByCode(codeLower);
    if (!eventId) return NextResponse.json("Event not found", { status: 404 });

    // GOOGLE
    if (body.method === "google") {
      if (!body.idToken) return NextResponse.json("Thiếu idToken.", { status: 400 });
      const decoded = await getAuth().verifyIdToken(body.idToken);
      const email = decoded.email;
      const userId = email ? await findUserIdByEmail(email) : null;

      const logId = await writeLog(eventId, {
        method: "google_oauth",
        userId: userId ?? null,
        identifierValue: email ?? null,
        success: true,
      });
      await upsertAttendance(eventId, userId, logId);
      return NextResponse.json({ ok: true, logId });
    }

    // CCCD
    if (body.method === "cccd") {
      const raw = (body.cccd ?? "").trim();
      if (!/^\d{12}$/.test(raw)) return NextResponse.json("CCCD phải gồm đúng 12 chữ số.", { status: 400 });

      // bắt buộc phải tìm thấy user
      let userId: string | null = null;
      try {
        userId = await findUserIdByCccd(raw);
      } catch (e: any) {
        return NextResponse.json(e?.message || "CCCD không hợp lệ.", { status: 400 });
      }
      if (!userId) return NextResponse.json("Không tìm thấy người dùng với CCCD này.", { status: 404 });

      const logId = await writeLog(eventId, {
        method: "cccd",
        userId,
        identifierValue: `****${raw.slice(-4)}`, // mask hiển thị
        success: true,
      });
      await upsertAttendance(eventId, userId, logId);
      return NextResponse.json({ ok: true, logId });
    }

    return NextResponse.json("Method không hỗ trợ.", { status: 400 });
  } catch (e: any) {
    return NextResponse.json(e?.message || "Bad request", { status: 400 });
  }
}
