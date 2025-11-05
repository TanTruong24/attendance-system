"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Users, BarChart3, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

type EventItem = {
    id: string;
    title: string;
    code?: string;
    startAt?: any;
    endAt?: any;
};
type AttendanceItem = {
    id: string;
    userId: string;
    lastStatus?: string;
    lastCheckInAt?:
        | { seconds?: number; nanoseconds?: number }
        | { _seconds?: number; _nanoseconds?: number }
        | { toMillis?: () => number; toDate?: () => Date }
        | string
        | number
        | null;
};
type ApiList<T> = { items: T[] };

type RecentActivity = {
    eventId: string;
    title: string;
    lastUpdatedAt: Date | null;
    checkedCount: number;
    totalUsers: number;
};

export default function Dashboard() {
    const [recent, setRecent] = useState<RecentActivity | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                setError(null);

                // 1) Lấy danh sách sự kiện, chọn sự kiện mới nhất theo startAt (desc)
                const evRes = await fetch("/api/events", { cache: "no-store" });
                const evJson = await evRes.json();
                const events: EventItem[] = (evJson?.items ?? []).map(
                    normalizeEvent
                );

                const sorted = [...events].sort((a, b) => {
                    const ta = toTime(a.startAt);
                    const tb = toTime(b.startAt);
                    return (tb ?? 0) - (ta ?? 0);
                });
                const latest = sorted[0];
                if (!latest) {
                    setRecent(null);
                    return;
                }

                // 2) Tổng users
                const uRes = await fetch("/api/users", { cache: "no-store" });
                const uJson = await uRes.json();
                const totalUsers = (uJson?.items ?? []).length;

                // 3) Attendance summary của sự kiện
                const atRes = await fetch("/api/attendances", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ eventId: latest.id, summary: true }),
                });
                if (!atRes.ok) throw new Error(await atRes.text());
                const atData: ApiList<AttendanceItem> = await atRes.json();
                const items = (atData?.items ?? []).map(normalizeAttendance);

                // Đếm ai đã điểm danh (có lastCheckInAt hợp lệ)
                const times = items
                    .map((a) => toTime(a.lastCheckInAt))
                    .filter((t): t is number => !!t);
                const checkedCount = items.filter(
                    (a) => !!toTime(a.lastCheckInAt)
                ).length;
                const lastUpdatedAt = times.length
                    ? new Date(Math.max(...times))
                    : null;

                setRecent({
                    eventId: latest.id,
                    title: latest.title || latest.code || "Sự kiện",
                    lastUpdatedAt,
                    checkedCount,
                    totalUsers,
                });
            } catch (e: any) {
                setError(e?.message || "Không tải được hoạt động gần đây.");
                setRecent(null);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <div className="mx-auto max-w-6xl px-6 py-8">
                {/* Header */}
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                            Quản trị Hệ thống
                        </h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Quản trị điểm danh, sự kiện và người dùng của bạn
                            trong một nơi.
                        </p>
                    </div>
                </div>

                {/* Primary actions */}
                <div className="mt-8 grid gap-4 md:grid-cols-3">
                    <NavCard
                        href="/events"
                        icon={<CalendarDays className="h-6 w-6" />}
                        title="Quản lý sự kiện"
                        desc="Tạo, chỉnh sửa và theo dõi lịch sự kiện."
                    />
                    <NavCard
                        href="/users"
                        icon={<Users className="h-6 w-6" />}
                        title="Quản lý người dùng"
                        desc="Thêm mới, phân quyền và cập nhật thông tin."
                    />
                    <NavCard
                        href="/stats"
                        icon={<BarChart3 className="h-6 w-6" />}
                        title="Thống kê điểm danh"
                        desc="Báo cáo theo sự kiện, phòng ban hoặc thời gian."
                    />
                </div>

                {/* Recent activity */}
                <section className="mt-10">
                    <h2 className="mb-3 text-base font-medium text-slate-900">
                        Hoạt động gần đây
                    </h2>

                    <div className="divide-y rounded-2xl border border-slate-200 bg-white">
                        {loading ? (
                            <div className="p-4 text-sm text-slate-500">
                                Đang tải...
                            </div>
                        ) : error ? (
                            <div className="p-4 text-sm text-rose-600">
                                {error}
                            </div>
                        ) : !recent ? (
                            <div className="p-4 text-sm text-slate-500">
                                Chưa có dữ liệu.
                            </div>
                        ) : (
                            <Link
                                href={`/stats?eventId=${encodeURIComponent(
                                    recent.eventId
                                )}`}
                                className="block"
                            >
                                <motion.div
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="flex items-center justify-between gap-3 p-4"
                                >
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">
                                            Sự kiện: {recent.title}
                                        </p>
                                        <p className="mt-0.5 text-xs text-slate-500">
                                            {recent.lastUpdatedAt
                                                ? `Cập nhật ${timeAgo(
                                                      recent.lastUpdatedAt
                                                  )} • `
                                                : ""}
                                            {recent.checkedCount}/
                                            {recent.totalUsers} đã điểm danh
                                        </p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-slate-400" />
                                </motion.div>
                            </Link>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}

function NavCard({
    href,
    icon,
    title,
    desc,
}: {
    href: string;
    icon: React.ReactNode;
    title: string;
    desc: string;
}) {
    return (
        <Link href={href} className="group block">
            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-0 transition group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-1 group-hover:ring-slate-200"
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                            {icon}
                        </span>
                        <div>
                            <h3 className="text-base font-medium text-slate-900">
                                {title}
                            </h3>
                            <p className="mt-0.5 text-sm text-slate-600">
                                {desc}
                            </p>
                        </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
                </div>
            </motion.div>
        </Link>
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

function normalizeAttendance(a: any): AttendanceItem {
    if (!a) return a;
    return {
        id: String(a.id ?? a.uid ?? ""),
        userId: String(a.userId ?? a.user_id ?? a.uid ?? ""),
        lastStatus: (a.lastStatus ?? a.status ?? "").toLowerCase(),
        // chấp nhận các biến thể tên field trong DB
        lastCheckInAt:
            a.lastCheckInAt ??
            a.lastCheckinAt ??
            a.last_checkin_at ??
            a.last_check_in_at ??
            a.checkInAt ??
            a.checkinAt ??
            null,
    };
}

function toTime(src: any): number | null {
    if (!src) return null;
    if (src instanceof Date) return src.getTime();
    if (typeof src === "string") {
        const t = Date.parse(src);
        return isNaN(t) ? null : t;
    }
    if (typeof src === "number") {
        const isSeconds = src < 1e12;
        return isSeconds ? src * 1000 : src;
    }
    if (typeof src === "object") {
        if (typeof (src as any).toMillis === "function")
            return (src as any).toMillis();
        if (typeof (src as any).toDate === "function")
            return (src as any).toDate().getTime();
        if ("seconds" in src) {
            const s = (src as any).seconds || 0;
            const ns = (src as any).nanoseconds || 0;
            return Math.floor(s * 1000 + ns / 1e6);
        }
        if ("_seconds" in src) {
            const s = (src as any)._seconds || 0;
            const ns = (src as any)._nanoseconds || 0;
            return Math.floor(s * 1000 + ns / 1e6);
        }
    }
    return null;
}

function timeAgo(date: Date) {
    const diff = Date.now() - date.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "vừa xong";
    if (m < 60) return `${m} phút trước`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} giờ trước`;
    const d = Math.floor(h / 24);
    return `${d} ngày trước`;
}
