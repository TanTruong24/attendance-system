"use client";

import { useEffect, useState } from "react";

type EventItem = { id: string; code: string; title: string; status: string };

export default function CheckinPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventId, setEventId] = useState("");
  const [method, setMethod] = useState<"google_oauth"|"username_password"|"cccd"|"qr"|"email"|"username">("email");
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{type:"success"|"error"; text:string}|null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/events?limit=100", { cache: "no-store" });
        const d = await r.json();
        setEvents((d.items || []).filter((e:EventItem)=>e.status!=="closed"));
      } finally { setLoading(false); }
    })();
  }, []);

  async function handleCheckin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!eventId || !identifier.trim()) {
      setMsg({ type:"error", text:"Vui lòng chọn sự kiện và nhập thông tin." });
      return;
    }
    try {
      setSubmitting(true);
      // ✅ nếu bạn dùng route /api/attendance thì đổi endpoint dưới cho đúng
      const r = await fetch("/api/attendance-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          method: mapMethod(method),
          identifierValue: identifier.trim(),
          success: true,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setMsg({ type:"success", text:"Điểm danh thành công!" });
      setIdentifier("");
    } catch (e:any) {
      setMsg({ type:"error", text: e?.message || "Điểm danh thất bại." });
    } finally {
      setSubmitting(false);
    }
  }

  function mapMethod(m: string) {
    // khớp với enum method trong backend bạn: ('google_oauth','username_password','cccd','qr')
    if (m === "email") return "google_oauth";
    if (m === "username") return "username_password";
    return m;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-10">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold text-slate-900">Điểm danh</h1>
        <p className="mt-1 text-sm text-slate-600">Chọn sự kiện và nhập thông tin để điểm danh.</p>

        <form onSubmit={handleCheckin} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Sự kiện</label>
              {loading ? (
                <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
              ) : (
                <select
                  value={eventId}
                  onChange={(e)=>setEventId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">— Chọn sự kiện —</option>
                  {events.map(ev=>(
                    <option key={ev.id} value={ev.id}>
                      {ev.code} — {ev.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Phương thức</label>
                <select
                  value={method}
                  onChange={(e)=>setMethod(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-slate-300"
                >
                  <option value="email">Email</option>
                  <option value="username">Username</option>
                  <option value="cccd">CCCD</option>
                  <option value="qr">QR Code</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Thông tin</label>
                <input
                  value={identifier}
                  onChange={(e)=>setIdentifier(e.target.value)}
                  placeholder={method==="email" ? "ví dụ: user@company.com" :
                              method==="username" ? "ví dụ: nva" :
                              method==="cccd" ? "012345678901" : "Nội dung QR"}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? "Đang điểm danh..." : "Điểm danh"}
            </button>

            {msg && (
              <div
                className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
                  msg.type==="success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-rose-200 bg-rose-50 text-rose-900"
                }`}
              >
                {msg.text}
              </div>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
