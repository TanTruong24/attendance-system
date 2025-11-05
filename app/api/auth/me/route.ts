// app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { findActiveAdminByEmailLower } from "@/lib/db/users";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "session";

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function GET(req: Request) {
  try {
    const cookie = getCookieValue(req.headers.get("cookie"), COOKIE_NAME);
    if (!cookie) return NextResponse.json({ user: null });

    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    const adminUser = await findActiveAdminByEmailLower(decoded.email ?? null);

    return NextResponse.json({ user: adminUser ?? null });
  } catch {
    return NextResponse.json({ user: null });
  }
}
