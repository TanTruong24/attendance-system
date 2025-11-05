// middleware.ts (đặt ở root)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // Các route cần admin
  const needAdmin = ["/dashboard", "/users", "/events", "/stats"];
  if (!needAdmin.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const resp = await fetch(`${origin}/api/auth/verify`, {
    headers: { cookie: req.headers.get("cookie") || "" },
  });

  if (!resp.ok) {
    const login = new URL("/auth/login", origin);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const data = await resp.json();
  if (!data?.admin) return NextResponse.redirect(new URL("/403", origin));

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/users/:path*", "/events/:path*", "/stats/:path*"],
};
