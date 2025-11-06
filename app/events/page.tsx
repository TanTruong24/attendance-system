"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, RefreshCcw } from "lucide-react";

type Role = "admin" | "manager" | "attendee" | undefined;

export default function EventsPage() {
    const router = useRouter();
    const [role, setRole] = useState<Role>(undefined);

    const [events, setEvents] = useState<any[]>([]);
    const [code, setCode] = useState("");
    const [title, setTitle] = useState("");
    const [startAt, setStartAt] = useState("");
    const [endAt, setEndAt] = useState("");

    // NEW
    const [checkinOpenAt, setCheckinOpenAt] = useState("");
    const [checkinCloseAt, setCheckinCloseAt] = useState("");

    const isAdmin = role === "admin";
    const isManager = role === "manager";
    const readOnly = isManager; // ⬅️ chỉ xem

    async function loadRole() {
        try {
            const r = await fetch("/api/auth/verify", { cache: "no-store" });
            if (!r.ok) return setRole(undefined);
            const j = await r.json();
            setRole(j?.user?.role as Role);
        } catch {
            setRole(undefined);
        }
    }
    async function loadEvents() {
        const res = await fetch("/api/events");
        const data = await res.json();
        setEvents(data.items || []);
    }

    useEffect(() => {
        loadRole();
        loadEvents();
    }, []);

    function generateCodeFromTitle() {
        if (!title.trim()) {
            alert("Vui lòng nhập tên sự kiện trước.");
            return;
        }
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = now.getFullYear();
        const initials = title
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .split(" ")
            .map((w) => w[0]?.toUpperCase() || "")
            .join("");
        setCode(`${initials}-${year}-${month}`);
    }

    async function createEvent() {
        if (readOnly) return; // ⬅️ manager không được tạo
        if (!code.trim() || !title.trim()) {
            alert("Vui lòng nhập đầy đủ mã và tên sự kiện.");
            return;
        }
        await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                code,
                title,
                startAt: startAt ? new Date(startAt) : new Date(),
                endAt: endAt
                    ? new Date(endAt)
                    : new Date(Date.now() + 2 * 3600 * 1000),
                checkinOpenAt: checkinOpenAt ? new Date(checkinOpenAt) : null,
                checkinCloseAt: checkinCloseAt
                    ? new Date(checkinCloseAt)
                    : null,
            }),
        });
        setCode("");
        setTitle("");
        setStartAt("");
        setEndAt("");
        setCheckinOpenAt("");
        setCheckinCloseAt("");
        loadEvents();
    }

    function fmtRange(ev: any) {
        const f = (v?: string) => (v ? new Date(v).toLocaleString() : "—");
        if (!ev.checkinOpenAt && !ev.checkinCloseAt) return "Không giới hạn";
        return `${f(ev.checkinOpenAt)} → ${f(ev.checkinCloseAt)}`;
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-8">
            <div className="mx-auto max-w-6xl">
                <button
                    onClick={() => router.push("/dashboard")}
                    className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-100"
                >
                    ← Quay lại Dashboard
                </button>

                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Quản lý sự kiện
                </h1>
                <p className="text-sm text-slate-500 mb-6">
                    Tạo mới và theo dõi tình trạng sự kiện.
                </p>

                {/* Banner chế độ chỉ xem cho manager */}
                {readOnly && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        Bạn đang ở chế độ <b>chỉ xem</b> (manager). Chỉ tài
                        khoản admin mới được tạo/sửa/xoá sự kiện.
                    </div>
                )}

                {/* Form tạo sự kiện (bị khóa nếu manager) */}
                <div
                    className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${
                        readOnly ? "opacity-60" : ""
                    }`}
                >
                    <h2 className="text-base font-medium text-slate-900">
                        Tạo sự kiện
                    </h2>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* Mã sự kiện */}
                        <div className="relative">
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                Mã sự kiện *
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="VD: SĐKT1-2025-11"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                                    disabled={readOnly}
                                    readOnly={readOnly}
                                />
                                <button
                                    type="button"
                                    onClick={generateCodeFromTitle}
                                    className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
                                    title="Tạo mã tự động từ tên sự kiện"
                                    disabled={readOnly}
                                >
                                    <RefreshCcw className="h-4 w-4 text-slate-600" />
                                </button>
                            </div>
                        </div>

                        {/* Tên sự kiện */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                Tên sự kiện *
                            </label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="SHCB định kỳ tháng 11/2025"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                                disabled={readOnly}
                                readOnly={readOnly}
                            />
                        </div>

                        {/* Bắt đầu */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                Thời điểm bắt đầu sự kiện*
                            </label>
                            <p className="text-[11px] text-slate-500 mb-1">
                                Dùng để tính giờ đúng/trễ/vắng.
                            </p>
                            <input
                                type="datetime-local"
                                value={startAt}
                                onChange={(e) => setStartAt(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                                disabled={readOnly}
                                readOnly={readOnly}
                            />
                        </div>

                        {/* Kết thúc */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                Thời điểm kết thúc sự kiện*
                            </label>
                            <p className="text-[11px] text-slate-500 mb-1">
                                Dùng để xác định giới hạn giờ trễ/vắng.
                            </p>
                            <input
                                type="datetime-local"
                                value={endAt}
                                onChange={(e) => setEndAt(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                                disabled={readOnly}
                                readOnly={readOnly}
                            />
                        </div>

                        {/* OPEN */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                Bắt đầu tính điểm danh
                            </label>
                            <p className="text-[11px] text-slate-500 mb-1">
                                Từ mốc này, điểm danh mới được tính hợp lệ.
                            </p>
                            <input
                                type="datetime-local"
                                value={checkinOpenAt}
                                onChange={(e) =>
                                    setCheckinOpenAt(e.target.value)
                                }
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                                disabled={readOnly}
                                readOnly={readOnly}
                            />
                        </div>

                        {/* CLOSE */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                Ngừng tính điểm danh
                            </label>
                            <p className="text-[11px] text-slate-500 mb-1">
                                Sau mốc này, điểm danh sẽ không còn được tính.
                            </p>
                            <input
                                type="datetime-local"
                                value={checkinCloseAt}
                                onChange={(e) =>
                                    setCheckinCloseAt(e.target.value)
                                }
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                                disabled={readOnly}
                                readOnly={readOnly}
                            />
                        </div>
                    </div>

                    {/* Nút tạo (ẩn/khóa với manager) */}
                    <button
                        onClick={createEvent}
                        disabled={!isAdmin}
                        className={`mt-5 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium shadow-sm ${
                            isAdmin
                                ? "bg-slate-900 text-white hover:bg-slate-800"
                                : "border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                        }`}
                        title={isAdmin ? "" : "Chỉ admin được tạo sự kiện"}
                    >
                        <PlusCircle className="h-4 w-4" /> Tạo sự kiện
                    </button>
                </div>

                {/* Danh sách sự kiện */}
                <section className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex gap-2">
                            <input
                                placeholder="Tìm theo mã hoặc tên..."
                                className="w-72 rounded-2xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                            />
                            <select className="rounded-2xl border border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-slate-300">
                                <option>Tất cả trạng thái</option>
                                <option value="published">Đã xuất bản</option>
                                <option value="draft">Nháp</option>
                                <option value="closed">Đã kết thúc</option>
                            </select>
                        </div>
                        <span className="text-sm text-slate-500">
                            Tổng: {events.length} sự kiện
                        </span>
                    </div>

                    {events.length === 0 ? (
                        <div className="p-6 text-sm text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm">
                            Chưa có sự kiện phù hợp.
                        </div>
                    ) : (
                        <table className="min-w-full border-collapse border border-slate-200 rounded-xl overflow-hidden">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs text-slate-600">
                                        Mã
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs text-slate-600">
                                        Tên
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs text-slate-600">
                                        Trạng thái
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs text-slate-600">
                                        Cửa sổ chấm công
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((ev) => (
                                    <tr
                                        key={ev.id}
                                        onDoubleClick={() =>
                                            router.push(`/events/${ev.id}`)
                                        }
                                        className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                                        title="Nhấp đúp để mở chi tiết"
                                    >
                                        <td className="px-4 py-2">{ev.code}</td>
                                        <td className="px-4 py-2">
                                            {ev.title}
                                        </td>
                                        <td className="px-4 py-2">
                                            {ev.status}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-slate-600">
                                            {fmtRange(ev)}
                                        </td>
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
