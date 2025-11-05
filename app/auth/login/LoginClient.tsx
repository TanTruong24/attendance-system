"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import Image from "next/image";

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = async () => {
    const user = auth.currentUser;
    const idToken = user ? await user.getIdToken() : null;
    if (!idToken) throw new Error("Không lấy được token đăng nhập.");

    const res = await fetch("/api/auth/sessionLogin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (res.status === 403) {
      try { await signOut(auth); } catch {}
      throw new Error("Tài khoản không có quyền quản trị (admin).");
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error || "Đăng nhập thất bại.");
    }
  };

  const onLoginGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      await createSession();
      router.replace(next);
    } catch (err: any) {
      setError(err?.message || "Đăng nhập Google thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
        {/* Logo của bạn – giữ tỉ lệ, không cố định size */}
        <div className="mb-4 flex justify-center">
          <div className="relative h-24 w-24 sm:h-20 sm:w-20">
            <Image
              src="/co-dang.jpg"
              alt="Đảng Cộng sản Việt Nam"
              fill
              sizes="100%"
              className="rounded-md object-contain"
              priority
            />
          </div>
        </div>

        <h1 className="text-center text-2xl font-extrabold tracking-tight text-slate-900">
          Đăng nhập
        </h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Chỉ đăng nhập với Google. Tài khoản phải là <b>admin</b> để truy cập.
        </p>

        <button
          onClick={onLoginGoogle}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
        >
          {/* dùng icon local để tránh cấu hình domain ảnh */}
          {loading ? "Đang xử lý..." : "Đăng nhập với Google"}
        </button>

        {error && (
          <p className="mt-4 text-center text-sm text-rose-600">{error}</p>
        )}
      </div>
    </div>
  );
}
