// app/api/attendances/route.ts
import { NextResponse } from "next/server";
import { attendanceSummary } from "@/lib/db/attendance";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const eventId = body?.eventId as string;
    const isSummary = !!body?.summary;
    if (!eventId) throw new Error("eventId is required");

    if (!isSummary) {
      return NextResponse.json({ error: "Unsupported operation" }, { status: 400 });
    }

    const items = (await attendanceSummary(eventId)).map((a) => ({
      id: a.id,
      userId: a.userId,
      lastStatus: a.lastStatus,
      lastCheckInAt: a.lastCheckInAt instanceof Timestamp
        ? { seconds: a.lastCheckInAt.seconds, nanoseconds: a.lastCheckInAt.nanoseconds }
        : null,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
