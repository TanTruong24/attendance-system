// middleware.ts (root)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname, origin, search } = req.nextUrl;

  // Các route yêu cầu đăng nhập (admin hoặc manager)
  const PROTECTED_PREFIXES = ["/dashboard", "/users", "/events", "/stats"];
  if (!PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Xác thực phiên đăng nhập
  const resp = await fetch(`${origin}/api/auth/verify`, {
    headers: { cookie: req.headers.get("cookie") || "" },
  });

  // Chưa đăng nhập → chuyển về trang login (giữ lại đích đến)
  if (!resp.ok) {
    const login = new URL("/auth/login", origin);
    login.searchParams.set("next", pathname + (search || ""));
    return NextResponse.redirect(login);
  }

  // Cho phép: admin hoặc manager
  const data = await resp.json();
  const role: string | undefined = data?.user?.role;

  if (!data?.ok || !role || !["admin", "manager"].includes(role)) {
    // attendee hoặc user không hợp lệ → 403
    return NextResponse.redirect(new URL("/403", origin));
  }

  // Hợp lệ
  return NextResponse.next();
}

// Các đường dẫn cần bảo vệ
export const config = {
  matcher: ["/dashboard/:path*", "/users/:path*", "/events/:path*", "/stats/:path*"],
};
