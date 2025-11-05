// app/api/users/[uid]/route.ts
import { NextResponse } from "next/server";
import { getUserById, updateUser, deleteUser } from "@/lib/db/users";

type Ctx = { params: Promise<{ uid: string }> };

export async function GET(_req: Request, ctx: Ctx) {
    const { uid } = await ctx.params;
    const id = (uid ?? "").trim();
    if (!id)
        return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    try {
        const user = await getUserById(id);
        if (!user)
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(user);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request, ctx: Ctx) {
    const { uid } = await ctx.params;
    const id = (uid ?? "").trim();
    if (!id)
        return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    try {
        const body = await req.json();
        const updated = await updateUser(id, {
            name: body.name?.trim(),
            email: body.email ? String(body.email).trim() : null,
            username: body.username?.trim(),
            role: body.role,
            group: body.group ? String(body.group).trim() : null, // 👈
            status: body.status,
            cccd: typeof body.cccd === "string" ? body.cccd : undefined, // 👈 thêm cccd (nếu có)
        });
        return NextResponse.json(updated);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const { uid } = await ctx.params;
    const id = (uid ?? "").trim();
    if (!id)
        return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    try {
        await deleteUser(id);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }
}
