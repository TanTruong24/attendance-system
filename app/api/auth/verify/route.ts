// app/api/auth/verify/route.ts
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
// ⬇️ đổi sang finder admin|manager
import { findActiveAdminOrManagerByEmailLower } from "@/lib/db/users";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "session";

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function GET(req: Request) {
  try {
    const cookie = getCookieValue(req.headers.get("cookie"), COOKIE_NAME);
    if (!cookie) return NextResponse.json({ ok: false }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    const user = await findActiveAdminOrManagerByEmailLower(decoded.email ?? null);
    if (!user) return NextResponse.json({ ok: false }, { status: 403 });

    return NextResponse.json({
      ok: true,
      admin: user.role === "admin", // ⬅️ manager vẫn ok nhưng không phải admin
      user: {
        id: user.id,
        email: user.email ?? null,
        name: user.name,
        role: user.role,     // "admin" | "manager"
        status: user.status,
      },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
