// components/LogoutButton.tsx
"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function LogoutButton() {
  const onLogout = async () => {
    // xóa session cookie ở server
    await fetch("/api/auth/sessionLogout", { method: "POST" });
    // sign out khỏi Firebase client
    try { await signOut(auth); } catch {}
    // về trang đăng nhập
    window.location.href = "/auth/login";
  };

  return (
    <button
      onClick={onLogout}
      className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
    >
      Đăng xuất
    </button>
  );
}
