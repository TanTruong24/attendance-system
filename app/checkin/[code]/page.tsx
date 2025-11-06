"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

type EventItem = {
  id: string;
  code: string;
  title: string;
  status: string;
  // NEW:
  checkinOpenAt?: string | null;
  checkinCloseAt?: string | null;
};

export default function CheckinByCodePage() {
  const { code } = useParams<{ code: string }>();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);

  const [cccd, setCccd] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [submittingGoogle, setSubmittingGoogle] = useState(false);
  const [submittingCccd, setSubmittingCccd] = useState(false);

  useEffect(() => {
    if (!code) return;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/events/by-code/${encodeURIComponent(String(code))}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setMsg({ type: "error", text: await res.text() });
        setEvent(null);
      } else {
        setEvent(await res.json());
      }
      setLoading(false);
    })();
  }, [code]);

  // NEW: xác định ngoài/ trong cửa sổ check-in
  const { isBlocked, blockedReason } = useMemo(() => {
    if (!event) return { isBlocked: false, blockedReason: "" };
    const now = Date.now();
    const open = event.checkinOpenAt ? Date.parse(event.checkinOpenAt) : null;
    const close = event.checkinCloseAt ? Date.parse(event.checkinCloseAt) : null;

    if (open != null && now < open) {
      return { isBlocked: true, blockedReason: "Thời gian điểm danh chưa mở." };
    }
    if (close != null && now > close) {
      return { isBlocked: true, blockedReason: "Thời gian điểm danh đã đóng." };
    }
    return { isBlocked: false, blockedReason: "" };
  }, [event]);

  // Helper định dạng thời gian vi-VN
  function fmtVi(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", { hour12: false });
  }

  async function checkinWithGoogle() {
    setMsg(null);
    try {
      setSubmittingGoogle(true);
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();

      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, method: "google", idToken }),
      });

      if (res.status === 409) {
        const payload = await res.json(); // { message, firstCheckinAt?, lastCheckinAt? }
        const when = fmtVi(payload.firstCheckinAt || payload.lastCheckinAt);
        setMsg({
          type: "success",
          text: when ? `${payload.message} Thời điểm trước đó: ${when}.` : payload.message,
        });
        return;
      }
      if (!res.ok) throw new Error(await res.text());

      setMsg({ type: "success", text: "Điểm danh thành công bằng Google." });
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Không thể điểm danh bằng Google." });
    } finally {
      setSubmittingGoogle(false);
    }
  }

  async function checkinWithCccd(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!/^\d{12}$/.test(cccd.trim())) {
      setMsg({ type: "error", text: "CCCD không hợp lệ. Vui lòng nhập đúng 12 chữ số." });
      return;
    }
    try {
      setSubmittingCccd(true);
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, method: "cccd", cccd: cccd.trim() }),
      });

      if (res.status === 409) {
        const payload = await res.json(); // { message, firstCheckinAt?, lastCheckinAt? }
        const when = fmtVi(payload.firstCheckinAt || payload.lastCheckinAt);
        setMsg({
          type: "success",
          text: when ? `${payload.message} Thời điểm trước đó: ${when}.` : payload.message,
        });
        return;
      }
      if (!res.ok) throw new Error(await res.text());

      setMsg({ type: "success", text: "Điểm danh bằng CCCD thành công." });
      setCccd("");
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Điểm danh thất bại." });
    } finally {
      setSubmittingCccd(false);
    }
  }

  if (loading) return <main className="p-6">Đang tải…</main>;
  if (!event)
    return (
      <main className="p-6 text-rose-700">
        Không tìm thấy sự kiện cho code: {String(code)}
      </main>
    );

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-10">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold text-slate-900">Điểm danh — {event.title}</h1>
        <p className="text-sm text-slate-600">
          Mã sự kiện: <span className="font-medium">{event.code}</span>
        </p>

        {/* NEW: cảnh báo cửa sổ check-in */}
        {isBlocked && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {blockedReason}
          </div>
        )}

        {msg && (
          <div
            className={`mt-4 rounded-xl border px-3 py-2 text-sm ${
              msg.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* Google OAuth */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-medium text-slate-900">Phương thức 1: Google</h2>
          <p className="text-xs text-slate-600 mb-3">Đăng nhập tài khoản Google để điểm danh tự động.</p>
          <button
            onClick={checkinWithGoogle}
            disabled={isBlocked || submittingGoogle}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submittingGoogle ? "Đang xử lý..." : "Đăng nhập Google & điểm danh"}
          </button>
        </section>

        {/* CCCD */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-medium text-slate-900">Phương thức 2: CCCD</h2>
          <p className="text-xs text-slate-600 mb-3">Nhập CCCD để điểm danh thủ công.</p>
          <form onSubmit={checkinWithCccd} className="flex gap-2">
            <input
              value={cccd}
              onChange={(e) => setCccd(e.target.value)}
              placeholder="012345678901"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
            />
            <button
              type="submit"
              disabled={isBlocked || submittingCccd}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {submittingCccd ? "Đang điểm danh..." : "Điểm danh"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
