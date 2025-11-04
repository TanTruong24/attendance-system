import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

type Params = { params: { uid: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const doc = await adminDb.doc(`users/${params.uid}`).get();
    if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ uid: doc.id, ...doc.data() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const body = await req.json();
    await adminDb.doc(`users/${params.uid}`).set(
      { ...body, updatedAt: new Date() },
      { merge: true }
    );
    const updated = await adminDb.doc(`users/${params.uid}`).get();
    return NextResponse.json({ uid: updated.id, ...updated.data() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await adminDb.doc(`users/${params.uid}`).delete();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
