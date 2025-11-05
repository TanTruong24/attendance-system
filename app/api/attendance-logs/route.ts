// app/api/attendance-logs/route.ts
import { NextResponse } from "next/server";
import { writeAttendanceLog } from "@/lib/db/attendance";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // body: { eventId, userId?, method, identifierValue?, success?, actorId?, sourceIp?, userAgent? }
    const { logId } = await writeAttendanceLog(body);
    return NextResponse.json({ ok: true, logId }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
