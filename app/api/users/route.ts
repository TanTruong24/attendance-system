import { NextResponse } from "next/server";
import { listUsers, createUser } from "@/lib/db/users";

export async function GET() {
    try {
        const users = await listUsers(100);
        const items = users.map((u) => ({
            uid: u.id,
            id: u.id,
            name: u.name,
            email: u.email ?? null,
            username: u.username ?? null,
            role: u.role,
            group: u.group ?? null, // 👈 thêm group
            cccdLast4: u.cccdLast4 ?? null,
            status: u.status,
        }));
        return NextResponse.json({ items });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const created = await createUser({
            name: (body.name ?? "").trim(),
            email: body.email ? String(body.email).trim() : null,
            username: (body.username ?? "").trim(),
            role: body.role ?? "staff",
            group: body.group ? String(body.group).trim() : null, // 👈
            cccd: String(body.cccd ?? ""),
        });
        return NextResponse.json({ uid: created.id }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }
}
