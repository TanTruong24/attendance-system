"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/** ===== Types ===== */
type UserLite = { id: string; name: string; group?: string | null; cccdLast4?: string | null };
type EventItem = {
  id: string;
  title: string;
  code?: string;
  startAt?: any;
  endAt?: any;
};
type AttendanceSummary = {
  id: string;
  userId: string;
  lastCheckInAt?:
    | { seconds?: number; nanoseconds?: number }
    | { _seconds?: number; _nanoseconds?: number }
    | { toMillis?: () => number; toDate?: () => Date }
    | string
    | number
    | null;
  lastStatus?: "present" | "late" | "absent" | string;
};
type ApiList<T> = { items: T[] };
type Derived = "present" | "late" | "absent";

type Row = {
  eventId: string;
  code?: string;
  title: string;
  startAt?: any;
  endAt?: any;
  checkInAt?: any | null;
  derived: Derived;
};

/** ===== Page ===== */
export default function UserAggregateStatsPage() {
  const router = useRouter();

  const [users, setUsers] = useState<UserLite[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // NEW: filters cho danh sách người dùng
  const [q, setQ] = useState<string>("");
  const [groupFilter, setGroupFilter] = useState<string>("");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load users & events
  useEffect(() => {
    (async () => {
      try {
        const [uRes, eRes] = await Promise.all([
          fetch("/api/users", { cache: "no-store" }),
          fetch("/api/events", { cache: "no-store" }),
        ]);

        const uJson = await uRes.json();
        const eJson = await eRes.json();

        const us: UserLite[] = (uJson?.items ?? []).map((u: any) => ({
          id: String(u.id ?? u.uid ?? ""),
          name: String(u.name ?? ""),
          group: u.group ?? null,
          cccdLast4: u.cccdLast4 ?? u.cccd_last4 ?? null,
        }));
        const evs: EventItem[] = (eJson?.items ?? []).map(normalizeEvent);

        // sort people and events a bit for UX
        us.sort((a, b) => a.name.localeCompare(b.name, "vi"));
        evs.sort((a, b) => (toDate(b.startAt)?.getTime() || 0) - (toDate(a.startAt)?.getTime() || 0));

        setUsers(us);
        setEvents(evs);
      } catch {
        setUsers([]);
        setEvents([]);
      }
    })();
  }, []);

  // Danh sách group duy nhất (để render filter)
  const uniqueGroups = useMemo(
    () => Array.from(new Set(users.map((u) => (u.group || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "vi")),
    [users]
  );

  // Users hiển thị sau khi áp dụng filter q + group
  const visibleUsers = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return users.filter((u) => {
      const gOk = groupFilter ? (u.group || "") === groupFilter : true;
      const qOk =
        !ql ||
        u.name.toLowerCase().includes(ql) ||
        (u.group || "").toLowerCase().includes(ql) ||
        (u.cccdLast4 || "").toLowerCase().includes(ql);
      return gOk && qOk;
    });
  }, [users, q, groupFilter]);

  // Load attendance của user đã chọn
  useEffect(() => {
    if (!selectedUserId) {
      setRows([]);
      setLoadError(null);
      return;
    }
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  async function loadAll() {
    try {
      setLoading(true);
      setLoadError(null);

      const out: Row[] = [];
      for (const ev of events) {
        const res = await fetch("/api/attendances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: ev.id, summary: true }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data: ApiList<AttendanceSummary> = await res.json();
        const found = (data.items || []).find((a) => a.userId === selectedUserId);

        const end = toDate(ev.endAt);
        const check = toDate(found?.lastCheckInAt ?? null);
        const derived = deriveStatus(check, end);

        out.push({
          eventId: ev.id,
          code: ev.code,
          title: ev.title,
          startAt: ev.startAt,
          endAt: ev.endAt,
          checkInAt: found?.lastCheckInAt ?? null,
          derived,
        });
      }
      out.sort((a, b) => (toDate(b.startAt)?.getTime() || 0) - (toDate(a.startAt)?.getTime() || 0));
      setRows(out);
    } catch (e: any) {
      setRows([]);
      setLoadError(e?.message || "Không tải được dữ liệu.");
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    const total = rows.length;
    const present = rows.filter((r) => r.derived === "present").length;
    const late = rows.filter((r) => r.derived === "late").length;
    const absent = rows.filter((r) => r.derived === "absent").length;
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
    return { total, present, late, absent, presentPct: pct(present), latePct: pct(late), absentPct: pct(absent) };
  }, [rows]);

  // CSV
  function exportCSV() {
    if (!selectedUserId || !rows.length) return;
    const userName = users.find((u) => u.id === selectedUserId)?.name || "user";
    const headers = ["code", "title", "startAt", "endAt", "status", "checkInAt"];
    const lines = rows.map((r) => [
      r.code || "",
      r.title,
      formatDateTime(r.startAt) || "",
      formatDateTime(r.endAt) || "",
      labelOf(r.derived),
      formatDateTime(r.checkInAt) || "",
    ]);
    const csv = [headers.join(","), ...lines.map((arr) => arr.map(csvSafe).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_by_user_${userName}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-100"
        >
          ← Quay lại
        </button>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Thống kê theo đảng viên</h1>
        <p className="text-sm text-slate-600">Chọn một người để xem lịch sử điểm danh qua tất cả sự kiện.</p>

        {/* Bộ lọc danh sách người dùng */}
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Tìm theo tên / nhóm / 4 số CCCD</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="vd: nguyena, IT, 1234"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Lọc theo nhóm</label>
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-slate-300"
              >
                <option value="">— Tất cả nhóm —</option>
                {uniqueGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Người dùng</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-slate-300"
              >
                <option value="">— Chọn người dùng —</option>
                {visibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {userLabel(u)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Hiển thị <b>{visibleUsers.length}</b>/<b>{users.length}</b> người dùng
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={loadAll}
              disabled={!selectedUserId || loading}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Đang tải..." : "Xem"}
            </button>
            {/* <button
              onClick={exportCSV}
              disabled={!rows.length}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-50"
            >
              Xuất CSV
            </button> */}
          </div>

          {loadError ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{loadError}</div>
          ) : null}
        </section>

        {/* KPIs */}
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <KPI title="Tổng sự kiện" value={String(summary.total)} />
          <KPI title="Đúng giờ" value={String(summary.present)} hint={`${summary.present}/${summary.total} • ${summary.presentPct}%`} />
          <KPI title="Đi muộn" value={String(summary.late)} hint={`${summary.late}/${summary.total} • ${summary.latePct}%`} />
          <KPI title="Vắng" value={String(summary.absent)} hint={`${summary.absent}/${summary.total} • ${summary.absentPct}%`} />
        </div>

        {/* Bảng chi tiết */}
        <section className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!rows.length ? (
            <div className="p-6 text-sm text-slate-600">{selectedUserId ? "Chưa có dữ liệu." : "Hãy chọn người dùng để xem."}</div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <Th>#</Th>
                  <Th>Mã</Th>
                  <Th>Sự kiện</Th>
                  <Th>Thời gian</Th>
                  <Th>Trạng thái</Th>
                  <Th>Check-in</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, idx) => (
                  <tr key={r.eventId} className="hover:bg-slate-50/80">
                    <Td>{idx + 1}</Td>
                    <Td className="font-medium">{r.code || "—"}</Td>
                    <Td className="font-medium text-slate-900">{r.title}</Td>
                    <Td className="text-xs text-slate-600">
                      {formatDateTime(r.startAt)} → {formatDateTime(r.endAt)}
                    </Td>
                    <Td>
                      <StatusBadge status={r.derived} />
                    </Td>
                    <Td>{formatDateTime(r.checkInAt) || "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}

/** ===== UI helpers ===== */
function KPI({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-700 ${className}`}>{children}</td>;
}
function StatusBadge({ status }: { status: Derived | string }) {
  const low = (status || "").toLowerCase();
  const style =
    low === "present"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : low === "late"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : low === "absent"
      ? "bg-rose-100 text-rose-800 border-rose-200"
      : "bg-slate-200 text-slate-700 border-slate-300";
  const label = low === "present" ? "Đúng giờ" : low === "late" ? "Trễ" : low === "absent" ? "Vắng" : status || "—";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${style}`}>{label}</span>;
}

/** ===== Utils ===== */
function userLabel(u: UserLite) {
  const parts = [u.name];
  if (u.cccdLast4) parts.push(u.cccdLast4);
  if (u.group) parts.push(u.group);
  return parts.join(" — ");
}
function normalizeEvent(e: any): EventItem {
  if (!e) return e;
  return {
    id: String(e.id ?? e.uid ?? ""),
    title: e.title ?? "",
    code: e.code ?? e.codeLower ?? undefined,
    startAt: e.startAt ?? e.start_at ?? e.start ?? undefined,
    endAt: e.endAt ?? e.end_at ?? e.end ?? undefined,
  };
}
function toDate(src: any): Date | null {
  if (!src) return null;
  if (src instanceof Date) return src;
  if (typeof src === "string") {
    const t = Date.parse(src);
    return isNaN(t) ? null : new Date(t);
  }
  if (typeof src === "number") {
    const isSeconds = src < 1e12;
    return new Date(isSeconds ? src * 1000 : src);
  }
  if (typeof src === "object") {
    if (typeof (src as any).toMillis === "function") return new Date((src as any).toMillis());
    if (typeof (src as any).toDate === "function") return (src as any).toDate();
    if ("seconds" in src) {
      const s = (src as any).seconds || 0;
      const ns = (src as any).nanoseconds || 0;
      return new Date(Math.floor(s * 1000 + ns / 1e6));
    }
    if ("_seconds" in src) {
      const s = (src as any)._seconds || 0;
      const ns = (src as any)._nanoseconds || 0;
      return new Date(Math.floor(s * 1000 + ns / 1e6));
    }
  }
  return null;
}
/**
 * Luật tính:
 * - Không có check-in => vắng
 * - Không có endAt => xem là đúng giờ
 * - checkIn < endAt => đúng giờ
 * - checkIn > endAt => trễ
 * - checkIn === endAt => vắng
 */
function deriveStatus(checkIn: Date | null, end: Date | null): Derived {
  if (!checkIn) return "absent";
  if (!end) return "present";
  const t = checkIn.getTime();
  const endMs = end.getTime();
  if (t < endMs) return "present";
  if (t > endMs) return "late";
  return "absent";
}
function formatDateTime(src: any) {
  const d = toDate(src);
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function labelOf(s: Derived) {
  return s === "present" ? "Đúng giờ" : s === "late" ? "Trễ" : "Vắng";
}
function csvSafe(v: unknown) {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}
