// app/api/users/route.ts
import { NextResponse } from "next/server";
import { listUsers, createUser } from "@/lib/db/users";

function serializeTS(ts: any): number | null {
    if (!ts) return null;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if ("seconds" in ts && "nanoseconds" in ts) {
        return Math.floor(
            (ts.seconds as number) * 1000 + (ts.nanoseconds as number) / 1e6
        );
    }
    const d = new Date(ts as any);
    return isNaN(d.getTime()) ? null : d.getTime();
}

export async function GET() {
    try {
        const users = await listUsers(100);
        // Chỉ trả ra trường public, KHÔNG trả cccdHash
        const items = users.map((u) => ({
            uid: u.id,
            id: u.id,
            name: u.name,
            email: u.email ?? null,
            username: u.username ?? null,
            role: u.role,
            group: u.group ?? null,
            cccdLast4: u.cccdLast4 ?? null,
            status: u.status,
            createdAt: serializeTS(u.createdAt),
            updatedAt: serializeTS(u.updatedAt),
        }));
        return NextResponse.json({ items });
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message || "Server error" },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const created = await createUser({
            name: (body.name ?? "").trim(),
            email: body.email ? String(body.email).trim() : null,
            username:
                typeof body.username === "string"
                    ? body.username.trim()
                    : undefined,
            role: body.role ?? "staff",
            group: body.group ? String(body.group).trim() : null,
            cccd: String(body.cccd ?? ""), // createUser sẽ validate + băm + check trùng
            status: body.status, // nếu muốn cho phép set lúc tạo
        });

        // Trả về tối thiểu để FE điều hướng, không lộ nhạy cảm
        return NextResponse.json(
            {
                uid: created.id,
                id: created.id,
            },
            { status: 201 }
        );
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message || "Bad Request" },
            { status: 400 }
        );
    }
}
