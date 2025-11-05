// app/api/auth/sessionLogout/route.ts
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "session";

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const m = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (m) {
    try {
      const decoded = await adminAuth.verifySessionCookie(m[1], true);
      await adminAuth.revokeRefreshTokens(decoded.sub);
    } catch {}
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
