import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import bcrypt from "bcryptjs";

export async function GET() {
    try {
        const snap = await adminDb.collection("users").get();
        const items = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        return NextResponse.json({ items });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { name, cccd, email, username, password, role } =
            await req.json();

        if (!name || !cccd || !email || !username || !password || !role) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const hashed = await bcrypt.hash(password, 10);

        const ref = await adminDb.collection("users").add({
            name,
            cccd,
            email,
            username,
            password: hashed,
            role,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        return NextResponse.json(
            { uid: ref.id, name, username, email, role },
            { status: 201 }
        );
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
