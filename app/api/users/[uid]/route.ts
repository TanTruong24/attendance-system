import { NextResponse } from "next/server";
import { deleteUser, updateUser } from "@/lib/db/users";
import { adminDb } from "@/lib/firebase/admin";

const usersCol = () => adminDb.collection("users");

// Kiểu context: params là Promise<{ uid: string }>
type Ctx = { params: Promise<{ uid: string }> };

export async function GET(_req: Request, ctx: Ctx) {
    const { uid } = await ctx.params; // 👈 phải await
    const id = (uid ?? "").trim();
    if (!id)
        return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    const doc = await usersCol().doc(id).get();
    if (!doc.exists)
        return NextResponse.json({ error: "Not found" }, { status: 404 });

    const d = doc.data()!;
    return NextResponse.json({
        uid: doc.id,
        id: doc.id,
        name: d.name,
        email: d.email ?? null,
        username: d.username ?? null,
        role: d.role,
        status: d.status ?? "active",
        cccdLast4: d.cccdLast4 ?? null,
        groupId: d.groupId ?? null,
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? null,
        updatedAt: d.updatedAt?.toDate?.()?.toISOString?.() ?? null,
    });
}

export async function PUT(req: Request, ctx: Ctx) {
    const { uid } = await ctx.params; // 👈 phải await
    const id = (uid ?? "").trim();
    if (!id)
        return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    const body = await req.json();
    const u = await updateUser(id, body);
    return NextResponse.json({
        uid: u.id,
        name: u.name,
        email: u.email,
        username: u.username,
        role: u.role,
        status: u.status,
        cccdLast4: u.cccdLast4 ?? null,
        groupId: u.groupId ?? null,
    });
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const { uid } = await ctx.params; // 👈 phải await
    const id = (uid ?? "").trim();
    if (!id)
        return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    const ok = await deleteUser(id);
    return NextResponse.json(ok);
}
