import { NextResponse } from "next/server";
import { listUsers, createUser } from "@/lib/db/users";

export async function GET() {
    try {
        const users = await listUsers(100);
        // FE sẽ dùng u.uid nhất quán
        const items = users.map((u) => ({
            uid: u.id,
            id: u.id, // giữ cả id cho tiện debug
            name: u.name,
            email: u.email ?? null,
            username: u.username ?? null,
            role: u.role,
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
        // backend đã yêu cầu cccd bắt buộc, email có thể null
        const created = await createUser(body);
        return NextResponse.json({ uid: created.id }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }
}
