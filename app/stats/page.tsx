"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/** ----- Types ----- */
type EventItem = {
    id: string;
    title: string;
    code?: string;
    startAt?: any; // ISO string | {seconds,...} | number | Timestamp-like
    endAt?: any;
};

type UserLite = {
    id: string;
    name: string;
    group?: string | null;
};

type AttendanceItem = {
    id: string;
    userId: string;
    lastStatus?: "present" | "absent" | "late" | string;
    lastCheckInAt?:
        | { seconds?: number; nanoseconds?: number }
        | { _seconds?: number; _nanoseconds?: number }
        | { toMillis?: () => number; toDate?: () => Date }
        | string
        | number
        | null;
};

type ApiList<T> = { items: T[] };
type DerivedStatus = "present" | "late" | "absent";

/** ----- Page ----- */
export default function StatsPage() {
    const router = useRouter();

    const [events, setEvents] = useState<EventItem[]>([]);
    const [selected, setSelected] = useState<string>("");
    const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

    // danh sách “hiển thị” sau khi merge users + attendance
    const [rows, setRows] = useState<
        (UserLite & {
            derivedStatus: DerivedStatus;
            lastCheckInAt?: AttendanceItem["lastCheckInAt"];
        })[]
    >([]);

    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<
        "" | "present" | "absent" | "late"
    >("");

    // ----- Load events list
    useEffect(() => {
        (async () => {
            try {
                const r = await fetch("/api/events", { cache: "no-store" });
                const j = await r.json();
                const items: EventItem[] = (j?.items ?? []).map(normalizeEvent);
                setEvents(items);
            } catch {
                setEvents([]);
            }
        })();
    }, []);

    // ----- Load users + attendance khi event thay đổi
    useEffect(() => {
        if (!selected) {
            setSelectedEvent(null);
            setRows([]);
            setLoadError(null);
            return;
        }
        void loadUsersAndAttendance();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected]);

    async function loadUsersAndAttendance() {
        try {
            setLoading(true);
            setLoadError(null);

            // 1) event meta
            const evRes = await fetch(`/api/events/${selected}`, {
                cache: "no-store",
            });
            if (!evRes.ok)
                throw new Error(
                    `Không lấy được sự kiện (HTTP ${evRes.status})`
                );
            const evJson = await evRes.json();
            const ev = normalizeEvent(evJson?.item ?? evJson);
            setSelectedEvent(ev);

            // 2) all users (để hiển thị full list)
            const userRes = await fetch(`/api/users`, { cache: "no-store" });
            if (!userRes.ok)
                throw new Error(
                    `Không lấy được users (HTTP ${userRes.status})`
                );
            const userJson = await userRes.json();
            const users: UserLite[] = (userJson?.items ?? []).map((u: any) => ({
                id: String(u.id ?? u.uid ?? ""),
                name: String(u.name ?? ""),
                group: u.group ?? null,
            }));

            // 3) attendance summary của event
            const atRes = await fetch(`/api/attendances`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventId: selected, summary: true }),
            });
            if (!atRes.ok) throw new Error(await atRes.text());
            const atData: ApiList<AttendanceItem> = await atRes.json();
            const atByUser = new Map<string, AttendanceItem>();
            for (const a of atData.items ?? []) atByUser.set(a.userId, a);

            // 4) merge users + attendance; mặc định absent nếu không có attendance
            const end = toDate(ev.endAt);

            const merged = users.map((u) => {
                const att = atByUser.get(u.id);
                const checkIn = toDate(att?.lastCheckInAt ?? null);
                const derived: DerivedStatus = deriveStatus(checkIn, end);
                return {
                    ...u,
                    derivedStatus: att ? derived : "absent", // không có attendance => absent
                    lastCheckInAt: att?.lastCheckInAt,
                };
            });

            setRows(merged);
        } catch (e: any) {
            setSelectedEvent(null);
            setRows([]);
            setLoadError(e?.message || "Không tải được dữ liệu.");
        } finally {
            setLoading(false);
        }
    }

    // ----- KPIs & filters
    const summary = useMemo(() => {
        const total = rows.length;
        const present = rows.filter(
            (r) => r.derivedStatus === "present"
        ).length;
        const late = rows.filter((r) => r.derivedStatus === "late").length;
        const absent = rows.filter((r) => r.derivedStatus === "absent").length;

        const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

        return {
            total,
            present,
            late,
            absent,
            // phần trăm theo tổng
            presentPct: pct(present),
            latePct: pct(late),
            absentPct: pct(absent),
        };
    }, [rows]);

    const filtered = useMemo(() => {
        if (!statusFilter) return rows;
        return rows.filter((r) => r.derivedStatus === statusFilter);
    }, [rows, statusFilter]);

    // Nhóm theo group, sort group & sort name
    const grouped = useMemo(() => {
        const map = new Map<string, typeof rows>();
        for (const r of filtered) {
            const key = (r.group || "Khác").trim() || "Khác";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(r);
        }
        const entries = Array.from(map.entries()).map(([g, items]) => {
            items.sort((a, b) => a.name.localeCompare(b.name, "vi"));
            return [g, items] as const;
        });
        entries.sort(([a], [b]) => a.localeCompare(b, "vi"));
        return entries;
    }, [filtered]);

    function exportCSV() {
        const headers = ["group", "name", "status", "checkInAt"];
        const rowsCsv = rows.map((r) => [
            r.group ?? "",
            r.name,
            r.derivedStatus,
            formatDateTime(r.lastCheckInAt) || "",
        ]);
        const csv = [
            headers.join(","),
            ...rowsCsv.map((r) => r.map(safeCsv).join(",")),
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `attendance_${selected}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-8">
            <div className="mx-auto max-w-6xl">
                {/* 🔙 Back */}
                <button
                    onClick={() => router.push("/dashboard")}
                    className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-100"
                >
                    ← Quay lại Dashboard
                </button>

                {/* Header */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                            Thống kê điểm danh
                        </h1>
                        <p className="text-sm text-slate-600">
                            Chọn sự kiện để xem số liệu và danh sách tham dự.
                        </p>
                    </div>
                </div>

                {/* Error inline */}
                {loadError ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                        {loadError}
                    </div>
                ) : null}

                {/* Bộ lọc & actions */}
                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Chọn sự kiện
                            </label>
                            <select
                                onChange={(e) => setSelected(e.target.value)}
                                value={selected}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                            >
                                <option value="">— Chọn sự kiện —</option>
                                {events.map((ev) => (
                                    <option key={ev.id} value={ev.id}>
                                        {ev.code
                                            ? `${ev.code} — ${ev.title}`
                                            : ev.title}
                                    </option>
                                ))}
                            </select>
                            {selectedEvent ? (
                                <p className="mt-2 text-xs text-slate-500">
                                    Thời gian:{" "}
                                    <strong>
                                        {formatDateTime(selectedEvent.startAt)}
                                    </strong>{" "}
                                    →{" "}
                                    <strong>
                                        {formatDateTime(selectedEvent.endAt)}
                                    </strong>
                                </p>
                            ) : null}
                        </div>

                        <div className="flex items-end gap-2">
                            <button
                                onClick={loadUsersAndAttendance}
                                disabled={!selected || loading}
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
                    </div>
                </section>

                {/* KPIs */}
                <div className="mt-6 grid gap-4 sm:grid-cols-4">
                    <KPI title="Tổng người" value={String(summary.total)} />
                    <KPI
                        title="Đúng giờ"
                        value={String(summary.present)}
                        hint={`${summary.present}/${summary.total} • ${summary.presentPct}%`}
                    />
                    <KPI
                        title="Đi muộn"
                        value={String(summary.late)}
                        hint={`${summary.late}/${summary.total} • ${summary.latePct}%`}
                    />
                    <KPI
                        title="Vắng"
                        value={String(summary.absent)}
                        hint={`${summary.absent}/${summary.total} • ${summary.absentPct}%`}
                    />
                </div>

                {/* Filter */}
                <div className="mt-6 flex items-center gap-3">
                    <span className="text-sm text-slate-600">Lọc:</span>
                    <FilterPill
                        label="Tất cả"
                        active={statusFilter === ""}
                        onClick={() => setStatusFilter("")}
                    />
                    <FilterPill
                        label="Đúng giờ"
                        active={statusFilter === "present"}
                        onClick={() => setStatusFilter("present")}
                    />
                    <FilterPill
                        label="Đi muộn"
                        active={statusFilter === "late"}
                        onClick={() => setStatusFilter("late")}
                    />
                    <FilterPill
                        label="Vắng"
                        active={statusFilter === "absent"}
                        onClick={() => setStatusFilter("absent")}
                    />
                    <div className="ml-auto text-sm text-slate-500">
                        Hiển thị:{" "}
                        <span className="font-medium text-slate-700">
                            {filtered.length}
                        </span>{" "}
                        người
                    </div>
                </div>

                {/* Tables grouped by group */}
                <div className="mt-3 space-y-6">
                    {loading ? (
                        <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <TableSkeleton />
                        </section>
                    ) : !filtered.length ? (
                        <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="p-6 text-sm text-slate-600">
                                Chưa có dữ liệu.
                            </div>
                        </section>
                    ) : (
                        grouped.map(([groupName, items]) => (
                            <section
                                key={groupName}
                                className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
                            >
                                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                                    Nhóm: {groupName}
                                </div>
                                <table className="min-w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-600">
                                        <tr>
                                            <Th>#</Th>
                                            <Th>Họ tên</Th>
                                            <Th>Trạng thái</Th>
                                            <Th>Check-in</Th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {items.map((r, idx) => (
                                            <tr
                                                key={r.id}
                                                className="hover:bg-slate-50/80"
                                            >
                                                <Td>{idx + 1}</Td>
                                                <Td className="font-medium text-slate-900">
                                                    {r.name}
                                                </Td>
                                                <Td>
                                                    <StatusBadge
                                                        status={r.derivedStatus}
                                                    />
                                                </Td>
                                                <Td>
                                                    {formatDateTime(
                                                        r.lastCheckInAt
                                                    ) || "—"}
                                                </Td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </section>
                        ))
                    )}
                </div>
            </div>
        </main>
    );
}

/* ---------- UI helpers ---------- */
function KPI({
    title,
    value,
    hint,
}: {
    title: string;
    value: string;
    hint?: string;
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{title}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                {value}
            </p>
            {hint ? (
                <p className="mt-1 text-xs text-slate-500">{hint}</p>
            ) : null}
        </div>
    );
}
function Th({ children }: { children: React.ReactNode }) {
    return (
        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">
            {children}
        </th>
    );
}
function Td({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <td className={`px-4 py-3 text-slate-700 ${className}`}>{children}</td>
    );
}
function FilterPill({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={[
                "rounded-full border px-3 py-1 text-xs transition",
                active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
            ].join(" ")}
        >
            {label}
        </button>
    );
}
function StatusBadge({ status }: { status: DerivedStatus | string }) {
    const low = (status || "").toLowerCase();
    const style =
        low === "present"
            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
            : low === "late"
            ? "bg-amber-100 text-amber-800 border-amber-200"
            : low === "absent"
            ? "bg-rose-100 text-rose-800 border-rose-200"
            : "bg-slate-200 text-slate-700 border-slate-300";
    const label =
        low === "present"
            ? "Đúng giờ"
            : low === "late"
            ? "Trễ"
            : low === "absent"
            ? "Vắng"
            : status || "—";
    return (
        <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${style}`}
        >
            {label}
        </span>
    );
}
function TableSkeleton() {
    return (
        <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
                <div
                    key={i}
                    className="h-10 w-full animate-pulse rounded-xl bg-slate-100"
                />
            ))}
        </div>
    );
}

/* ---------- Utils ---------- */
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
        if (typeof (src as any).toMillis === "function")
            return new Date((src as any).toMillis());
        if (typeof (src as any).toDate === "function")
            return (src as any).toDate();
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
 * Luật mới:
 * - Không có check-in => vắng
 * - Không có endAt => xem là đúng giờ (không có mốc so sánh)
 * - checkIn < endAt => đúng giờ
 * - checkIn > endAt => trễ
 * - checkIn === endAt => vắng
 */
function deriveStatus(checkIn: Date | null, end: Date | null): DerivedStatus {
    if (!checkIn) return "absent";
    if (!end) return "present";
    const t = checkIn.getTime();
    const endMs = end.getTime();
    if (t < endMs) return "present";
    if (t > endMs) return "late";
    return "absent"; // bằng endAt
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
function safeCsv(v: unknown) {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n"))
        return `"${s.replace(/"/g, '""')}"`;
    return s;
}
