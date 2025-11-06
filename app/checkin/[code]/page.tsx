"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { isInAppBrowser } from "@/lib/utils/isInApp";

type EventItem = {
  id: string;
  code: string;
  title: string;
  status: string;
  checkinOpenAt?: string | null;
  checkinCloseAt?: string | null;
};

const CCCD_LS_KEY = "cccd_history_v1"; // danh sách tối đa 5 CCCD gần đây

export default function CheckinByCodePage() {
  const { code } = useParams<{ code: string }>();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);

  // CCCD + lịch sử
  const [cccd, setCccd] = useState("");
  const [cccdHistory, setCccdHistory] = useState<string[]>([]);
  const [rememberCccd, setRememberCccd] = useState(true); // nếu muốn luôn lưu, set mặc định true và ẩn checkbox

  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submittingGoogle, setSubmittingGoogle] = useState(false);
  const [submittingCccd, setSubmittingCccd] = useState(false);
  const [inApp, setInApp] = useState(false);

  // NEW: URL tuyệt đối & host+path cho intent (an toàn SSR) + detect Android
  const [absUrl, setAbsUrl] = useState<string>("");
  const [hostPath, setHostPath] = useState<string>("");
  const isAndroid = useMemo(
    () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent),
    []
  );

  // Load trạng thái webview + kết quả redirect
  useEffect(() => {
    setInApp(isInAppBrowser());

    // build URL an toàn phía client
    if (typeof window !== "undefined") {
      const { protocol, host, pathname, search } = window.location;
      setAbsUrl(`${protocol}//${host}${pathname}${search}`);
      setHostPath(`${host}${pathname}${search}`);
    }

    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!result) return;
        const idToken = await result.user.getIdToken();
        await doCheckinWithIdToken(idToken);
      } catch (e: any) {
        setMsg({ type: "error", text: e?.message || "Không thể đăng nhập Google." });
      }
    })();
  }, []);

  // Load event + lịch sử CCCD
  useEffect(() => {
    // load history
    try {
      const raw = localStorage.getItem(CCCD_LS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setCccdHistory(arr.filter((x) => typeof x === "string"));
      }
    } catch {} // ignore

    if (!code) return;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/events/by-code/${encodeURIComponent(String(code))}`, { cache: "no-store" });
      if (!res.ok) {
        setMsg({ type: "error", text: await res.text() });
        setEvent(null);
      } else {
        setEvent(await res.json());
      }
      setLoading(false);
    })();
  }, [code]);

  // Thêm 1 CCCD vào lịch sử (tối đa 5, không trùng, chỉ khi đúng 12 số)
  function pushCccdToHistory(v: string) {
    const val = (v || "").trim();
    if (!/^\d{12}$/.test(val)) return;
    setCccdHistory((prev) => {
      const next = [val, ...prev.filter((x) => x !== val)].slice(0, 2);
      try {
        localStorage.setItem(CCCD_LS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  // NEW: xác định ngoài/ trong cửa sổ check-in
  const { isBlocked, blockedReason } = useMemo(() => {
    if (!event) return { isBlocked: false, blockedReason: "" };
    const now = Date.now();
    const open = event.checkinOpenAt ? Date.parse(event.checkinOpenAt) : null;
    const close = event.checkinCloseAt ? Date.parse(event.checkinCloseAt) : null;

    if (open != null && now < open) return { isBlocked: true, blockedReason: "Thời gian điểm danh chưa mở." };
    if (close != null && now > close) return { isBlocked: true, blockedReason: "Thời gian điểm danh đã đóng." };
    return { isBlocked: false, blockedReason: "" };
  }, [event]);

  // Helper định dạng thời gian vi-VN
  function fmtVi(src?: string | number | Date | null) {
    if (!src) return "";
    const d = new Date(src);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("vi-VN", { hour12: false });
  }

  // Gọi API checkin chung sau khi có idToken
  async function doCheckinWithIdToken(idToken: string) {
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, method: "google", idToken }),
    });

    if (res.status === 409) {
      const payload = await res.json();
      const when = fmtVi(payload.firstCheckinAt || payload.lastCheckinAt);
      setMsg({ type: "success", text: when ? `${payload.message} Thời điểm trước đó: ${when}.` : payload.message });
      return;
    }
    if (!res.ok) throw new Error(await res.text());
    setMsg({ type: "success", text: "Điểm danh thành công bằng Google." });
  }

  async function checkinWithGoogle() {
    setMsg(null);
    try {
      setSubmittingGoogle(true);
      const provider = new GoogleAuthProvider();

      if (inApp) {
        await signInWithRedirect(auth, provider);
        return;
      }

      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();
      await doCheckinWithIdToken(idToken);
    } catch (e: any) {
      const msgStr = String(e?.message || "");
      if (!inApp && /popup|blocked|operation-not-supported/i.test(msgStr)) {
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider());
          return;
        } catch (er2: any) {
          setMsg({ type: "error", text: er2?.message || "Không thể chuyển sang đăng nhập dạng redirect." });
        }
      } else {
        setMsg({ type: "error", text: e?.message || "Không thể điểm danh bằng Google." });
      }
    } finally {
      setSubmittingGoogle(false);
    }
  }

  async function checkinWithCccd(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const value = cccd.trim();
    if (!/^\d{12}$/.test(value)) {
      setMsg({ type: "error", text: "CCCD không hợp lệ. Vui lòng nhập đúng 12 chữ số." });
      return;
    }
    try {
      setSubmittingCccd(true);
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, method: "cccd", cccd: value }),
      });

      // lưu lịch sử nếu được phép
      if (rememberCccd) pushCccdToHistory(value);

      if (res.status === 409) {
        const payload = await res.json();
        const when = fmtVi(payload.firstCheckinAt || payload.lastCheckinAt);
        setMsg({ type: "success", text: when ? `${payload.message} Thời điểm trước đó: ${when}.` : payload.message });
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

  // cũng lưu khi blur nếu đủ 12 số
  function handleCccdBlur() {
    if (rememberCccd) pushCccdToHistory(cccd);
  }

  if (loading) return <main className="p-6">Đang tải…</main>;
  if (!event) {
    return (
      <main className="p-6 text-rose-700">
        Không tìm thấy sự kiện cho code: {String(code)}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-10">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold text-slate-900">Điểm danh — {event.title}</h1>
        <p className="text-sm text-slate-600">
          Mã sự kiện: <span className="font-medium">{event.code}</span>
        </p>

        {/* Cảnh báo cửa sổ check-in */}
        {isBlocked && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {blockedReason}
          </div>
        )}

        {/* Cảnh báo in-app */}
        {inApp && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Bạn đang mở trong ứng dụng (Zalo/Facebook...). Popup có thể bị chặn.
            <div className="mt-2 text-slate-700">
              Hệ thống sẽ chuyển sang <b>đăng nhập bằng Redirect</b>. Nếu vẫn không được, vui lòng mở trang này bằng
              <b> Chrome/Safari</b> (Menu → Mở bằng trình duyệt).
            </div>
            <div className="mt-2 flex gap-2 flex-wrap">
              {/* Chỉ render khi đã có absUrl để tránh lỗi SSR/SSG */}
              {absUrl && (
                <>
                  <a
                    className="inline-block rounded-xl bg-slate-900 px-3 py-1.5 text-white text-xs"
                    href={absUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Mở trong trình duyệt ngoài
                  </a>
                  {isAndroid && hostPath && (
                    <a
                      className="inline-block rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
                      href={`intent://${hostPath}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(
                        absUrl
                      )};end`}
                    >
                      Mở bằng Chrome (Android)
                    </a>
                  )}
                </>
              )}
            </div>
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
            {submittingGoogle ? "Đang xử lý..." : inApp ? "Đăng nhập Google (Redirect)" : "Đăng nhập Google & điểm danh"}
          </button>
        </section>

        {/* CCCD */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-medium text-slate-900">Phương thức 2: CCCD</h2>
          <p className="text-xs text-slate-600 mb-3">
            Nhập CCCD để điểm danh thủ công. (Thiết bị có thể gợi ý số đã dùng gần đây)
          </p>

          {/* Checkbox nhớ CCCD (nếu muốn luôn lưu, bạn có thể ẩn phần này và để rememberCccd = true) */}
          <label className="mb-2 flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={rememberCccd}
              onChange={(e) => setRememberCccd(e.target.checked)}
            />
            Nhớ CCCD trên thiết bị này
          </label>

          <form onSubmit={checkinWithCccd} className="flex gap-2">
            <input
              value={cccd}
              onChange={(e) => setCccd(e.target.value)}
              onBlur={handleCccdBlur}
              list="cccd-options"              // 👈 datalist gợi ý từ lịch sử
              inputMode="numeric"
              pattern="\d*"
              autoComplete="off"
              placeholder="012345678901"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
            />
            <datalist id="cccd-options">
              {cccdHistory.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>

            <button
              type="submit"
              disabled={isBlocked || submittingCccd}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {submittingCccd ? "Đang điểm danh..." : "Điểm danh"}
            </button>
          </form>

          <p className="mt-2 text-[11px] text-slate-500">
            Lưu cục bộ trên thiết bị, không gửi lên máy chủ.
          </p>
        </section>
      </div>
    </main>
  );
}
