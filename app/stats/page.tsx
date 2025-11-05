"use client";
import { useEffect, useMemo, useState } from "react";

type EventItem = {
    id: string;
    title: string;
    code?: string;
    startAt?: string;
    endAt?: string;
};
type AttendanceItem = {
    id: string;
    userId: string;
    lastStatus: "present" | "absent" | "late" | string;
    lastCheckInAt?:
        | { seconds?: number; nanoseconds?: number }
        | string
        | number
        | null;
};

type ApiList<T> = { items: T[] };

export default function StatsPage() {
    const [events, setEvents] = useState<EventItem[]>([]);
    const [selected, setSelected] = useState<string>("");
    const [attendees, setAttendees] = useState<AttendanceItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [banner, setBanner] = useState<{
        type: "success" | "error";
        msg: string;
    } | null>(null);

    const [statusFilter, setStatusFilter] = useState<
        "" | "present" | "absent" | "late"
    >("");

    useEffect(() => {
        fetch("/api/events", { cache: "no-store" })
            .then((r) => r.json())
            .then((d: ApiList<EventItem>) => setEvents(d.items || []))
            .catch(() => setEvents([]));
    }, []);

    async function loadAttendance() {
        if (!selected) return;
        try {
            setLoading(true);
            setLoadError(null);

            // (Optional) lấy meta sự kiện – giữ lại nếu cần dùng
            await fetch(`/api/events/${selected}`, { cache: "no-store" }).catch(
                () => null
            );

            const res = await fetch(`/api/attendances`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventId: selected, summary: true }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: ApiList<AttendanceItem> = await res.json();
            setAttendees((data.items || []).map(normalizeAttendance));
            setBanner(null);
        } catch (e: any) {
            setLoadError(e?.message || "Không tải được dữ liệu điểm danh.");
            setAttendees([]);
        } finally {
            setLoading(false);
        }
    }

    // Tự động tải khi đổi sự kiện (vẫn giữ nút Xem nếu bạn muốn reload thủ công)
    useEffect(() => {
        if (selected) loadAttendance();
    }, [selected]);

    // ----- Tính toán nhanh
    const summary = useMemo(() => {
        const total = attendees.length;
        const present = attendees.filter(
            (a) => a.lastStatus === "present"
        ).length;
        const late = attendees.filter((a) => a.lastStatus === "late").length;
        const absent = attendees.filter(
            (a) => a.lastStatus === "absent"
        ).length;
        const rate = total ? Math.round((present / total) * 100) : 0;
        return { total, present, late, absent, rate };
    }, [attendees]);

    const filtered = useMemo(() => {
        if (!statusFilter) return attendees;
        return attendees.filter((a) => a.lastStatus === statusFilter);
    }, [attendees, statusFilter]);

    function exportCSV() {
        const headers = ["userId", "status", "checkInAt"];
        const rows = attendees.map((a) => [
            a.userId,
            a.lastStatus,
            formatDateTime(a.lastCheckInAt) || "",
        ]);
        const csv = [
            headers.join(","),
            ...rows.map((r) => r.map(safeCsv).join(",")),
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

                {/* Banner lỗi/thông báo */}
                {banner ? (
                    <div
                        className={[
                            "mt-4 rounded-xl border px-4 py-3 text-sm",
                            banner.type === "success"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                : "border-rose-200 bg-rose-50 text-rose-900",
                        ].join(" ")}
                    >
                        {banner.msg}
                    </div>
                ) : null}

                {/* Bộ lọc & hành động */}
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
                        </div>

                        <div className="flex items-end gap-2">
                            <button
                                onClick={loadAttendance}
                                disabled={!selected || loading}
                                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                            >
                                {loading ? "Đang tải..." : "Xem"}
                            </button>
                            <button
                                onClick={exportCSV}
                                disabled={!attendees.length}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-50"
                            >
                                Xuất CSV
                            </button>
                        </div>
                    </div>
                </section>

                {/* KPI */}
                <div className="mt-6 grid gap-4 sm:grid-cols-4">
                    <KPI title="Tổng tham dự" value={String(summary.total)} />
                    <KPI
                        title="Check-in"
                        value={String(summary.present)}
                        hint="Đúng giờ"
                    />
                    <KPI title="Đi muộn" value={String(summary.late)} />
                    <KPI
                        title="Tỉ lệ điểm danh"
                        value={`${summary.rate}%`}
                        hint={`${summary.present}/${summary.total || 1}`}
                    />
                </div>

                {/* Lọc trạng thái */}
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

                {/* Bảng */}
                <section className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {loadError ? (
                        <div className="p-6 text-sm text-rose-700">
                            {loadError}
                        </div>
                    ) : loading ? (
                        <TableSkeleton />
                    ) : !attendees.length ? (
                        <div className="p-6 text-sm text-slate-600">
                            Chưa có dữ liệu điểm danh.
                        </div>
                    ) : (
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <Th>#</Th>
                                    <Th>User ID</Th>
                                    <Th>Trạng thái</Th>
                                    <Th>Check-in</Th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map((a, idx) => (
                                    <tr
                                        key={a.id}
                                        className="hover:bg-slate-50/80"
                                    >
                                        <Td>{idx + 1}</Td>
                                        <Td className="font-medium text-slate-900">
                                            {a.userId}
                                        </Td>
                                        <Td>
                                            <StatusBadge
                                                status={a.lastStatus}
                                            />
                                        </Td>
                                        <Td>
                                            {formatDateTime(a.lastCheckInAt) ||
                                                "—"}
                                        </Td>
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
function StatusBadge({ status }: { status: string }) {
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
            ? "Đi muộn"
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
function normalizeAttendance(a: AttendanceItem): AttendanceItem {
    return {
        ...a,
        lastStatus: (a.lastStatus || "").toLowerCase() as any,
    };
}

function formatDateTime(src: AttendanceItem["lastCheckInAt"]) {
    if (!src) return "";
    let d: Date | null = null;
    if (typeof src === "string") {
        const t = Date.parse(src);
        if (!isNaN(t)) d = new Date(t);
    } else if (typeof src === "number") {
        d = new Date(src);
    } else if (typeof src === "object" && "seconds" in src!) {
        d = new Date((src.seconds || 0) * 1000);
    }
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
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}
