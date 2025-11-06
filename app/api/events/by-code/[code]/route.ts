// app/api/events/by-code/[code]/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const codeLower = (code ?? "").trim().toLowerCase();
  if (!codeLower) return NextResponse.json("Missing code", { status: 400 });

  const snap = await adminDb
    .collection("events")
    .where("codeLower", "==", codeLower)
    .limit(1)
    .get();

  if (snap.empty) return NextResponse.json("Event not found", { status: 404 });

  const doc = snap.docs[0];
  const d = doc.data() as any;

  return NextResponse.json({
    id: doc.id,
    code: d.code,
    title: d.title,
    status: d.status ?? "published",
    startAt: d.startAt?.toDate?.()?.toISOString?.() ?? null,
    endAt: d.endAt?.toDate?.()?.toISOString?.() ?? null,
    // NEW:
    checkinOpenAt: d.checkinOpenAt?.toDate?.()?.toISOString?.() ?? null,
    checkinCloseAt: d.checkinCloseAt?.toDate?.()?.toISOString?.() ?? null,
  });
}
