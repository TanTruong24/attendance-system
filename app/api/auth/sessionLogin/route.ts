// app/api/auth/sessionLogin/route.ts
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { findActiveAdminByEmailLower } from "@/lib/db/users";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "session";
const MAX_DAYS = Number(process.env.SESSION_COOKIE_MAX_DAYS || "5");
const IS_PROD = process.env.NODE_ENV === "production";

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json().catch(() => ({}));
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    // Decode để lấy email (KHÔNG ghi DB)
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const email = decoded.email ?? null;

    // Chỉ cho admin active
    const adminUser = await findActiveAdminByEmailLower(email);
    if (!adminUser) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    // Tạo session cookie
    const expiresIn = MAX_DAYS * 24 * 60 * 60 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const res = NextResponse.json({
      ok: true,
      user: {
        id: adminUser.id,
        email: adminUser.email ?? null,
        name: adminUser.name,
        role: adminUser.role,       // "admin"
        status: adminUser.status,   // "active"
      },
    });

    res.cookies.set({
      name: COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: IS_PROD,   // local HTTP: false; production: true
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(expiresIn / 1000),
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
