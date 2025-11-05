"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import QRCode from "qrcode";

type EventStatus = "draft" | "published" | "closed";

export default function EventDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [form, setForm] = useState({
        code: "",
        title: "",
        startAt: "",
        endAt: "",
        status: "published" as EventStatus,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [banner, setBanner] = useState<{
        type: "success" | "error";
        msg: string;
    } | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string>("");

    // Lấy base URL ưu tiên từ env, fallback origin (client)
    const [origin, setOrigin] = useState<string>(
        process.env.NEXT_PUBLIC_BASE_URL ?? ""
    );
    useEffect(() => {
        if (!origin && typeof window !== "undefined") {
            setOrigin(window.location.origin);
        }
    }, [origin]);

    // URL điểm danh tự sinh theo code
    const checkinUrl =
        form.code && origin
            ? `${origin}/checkin/${encodeURIComponent(form.code)}`
            : "";

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!checkinUrl) {
                setQrDataUrl("");
                return;
            }
            try {
                const dataUrl = await QRCode.toDataURL(checkinUrl, {
                    errorCorrectionLevel: "M",
                    margin: 2,
                    scale: 6, // chất lượng xuất ảnh
                });
                if (!cancelled) setQrDataUrl(dataUrl);
            } catch {
                if (!cancelled) setQrDataUrl("");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [checkinUrl]);

    useEffect(() => {
        if (!id) return;
        (async () => {
            setLoading(true);
            const res = await fetch(`/api/events/${id}`, { cache: "no-store" });
            if (!res.ok) {
                setBanner({ type: "error", msg: await res.text() });
                setLoading(false);
                return;
            }
            const ev = await res.json();
            setForm({
                code: ev.code ?? "",
                title: ev.title ?? "",
                startAt: toInput(ev.startAt),
                endAt: toInput(ev.endAt),
                status: (ev.status as EventStatus) ?? "published",
            });
            setLoading(false);
        })();
    }, [id]);

    function toInput(iso?: string) {
        if (!iso) return "";
        const d = new Date(iso);
        const p = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
            d.getHours()
        )}:${p(d.getMinutes())}`;
    }
    const fromInput = (v: string) => (v ? new Date(v) : null);

    function genCodeFromTitle() {
        if (!form.title.trim()) {
            setBanner({
                type: "error",
                msg: "Vui lòng nhập tên sự kiện trước.",
            });
            return;
        }
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = now.getFullYear();
        const initials = form.title
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .split(" ")
            .map((w) => w[0]?.toUpperCase() || "")
            .join("");
        setForm((s) => ({ ...s, code: `${initials}-${year}-${month}` }));
    }

    async function save() {
        setBanner(null);
        if (!form.code.trim() || !form.title.trim()) {
            setBanner({
                type: "error",
                msg: "Vui lòng nhập đủ mã & tên sự kiện.",
            });
            return;
        }
        try {
            setSaving(true);
            const body: any = {
                code: form.code.trim(),
                title: form.title.trim(),
                startAt: fromInput(form.startAt),
                endAt: fromInput(form.endAt),
                status: form.status,
            };
            const res = await fetch(`/api/events/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(await res.text());
            setBanner({ type: "success", msg: "Đã lưu thay đổi." });
        } catch (e: any) {
            setBanner({ type: "error", msg: e?.message || "Lưu thất bại." });
        } finally {
            setSaving(false);
        }
    }

    async function remove() {
        if (!confirm("Xoá sự kiện này?")) return;
        const r = await fetch(`/api/events/${id}`, { method: "DELETE" });
        if (r.ok) router.push("/events");
        else setBanner({ type: "error", msg: await r.text() });
    }

    if (loading) return <main className="p-6">Đang tải…</main>;

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-8">
            <div className="mx-auto max-w-4xl">
                {/* nút quay lại trang trước */}
                <button
                    onClick={() => router.back()}
                    className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-100"
                >
                    ← Quay lại
                </button>

                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Chi tiết sự kiện
                </h1>

                {banner && (
                    <div
                        className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                            banner.type === "success"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                : "border-rose-200 bg-rose-50 text-rose-900"
                        }`}
                    >
                        {banner.msg}
                    </div>
                )}

                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* Mã sự kiện + tạo từ title */}
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Mã sự kiện *
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    value={form.code}
                                    onChange={(e) =>
                                        setForm((s) => ({
                                            ...s,
                                            code: e.target.value,
                                        }))
                                    }
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                                />
                                <button
                                    type="button"
                                    onClick={genCodeFromTitle}
                                    className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100"
                                    title="Tạo mã từ tên sự kiện"
                                >
                                    <RefreshCcw className="h-4 w-4 text-slate-600" />
                                </button>
                            </div>
                        </div>

                        {/* Tên sự kiện */}
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Tên sự kiện *
                            </label>
                            <input
                                value={form.title}
                                onChange={(e) =>
                                    setForm((s) => ({
                                        ...s,
                                        title: e.target.value,
                                    }))
                                }
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                            />
                        </div>

                        {/* Bắt đầu */}
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Bắt đầu *
                            </label>
                            <input
                                type="datetime-local"
                                value={form.startAt}
                                onChange={(e) =>
                                    setForm((s) => ({
                                        ...s,
                                        startAt: e.target.value,
                                    }))
                                }
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                            />
                        </div>

                        {/* Kết thúc */}
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Kết thúc *
                            </label>
                            <input
                                type="datetime-local"
                                value={form.endAt}
                                onChange={(e) =>
                                    setForm((s) => ({
                                        ...s,
                                        endAt: e.target.value,
                                    }))
                                }
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                            />
                        </div>

                        {/* Trạng thái */}
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Trạng thái
                            </label>
                            <select
                                value={form.status}
                                onChange={(e) =>
                                    setForm((s) => ({
                                        ...s,
                                        status: e.target.value as EventStatus,
                                    }))
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-slate-300"
                            >
                                <option value="published">Đã xuất bản</option>
                                <option value="draft">Nháp</option>
                                <option value="closed">Đã kết thúc</option>
                            </select>
                        </div>

                        {/* URL điểm danh (tự sinh từ code) */}
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                URL điểm danh (tự sinh từ mã sự kiện)
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    value={checkinUrl}
                                    readOnly
                                    placeholder="Chưa có mã sự kiện hoặc BASE_URL"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-700 bg-slate-50"
                                />
                                <button
                                    type="button"
                                    disabled={!checkinUrl}
                                    onClick={() =>
                                        checkinUrl &&
                                        navigator.clipboard.writeText(
                                            checkinUrl
                                        )
                                    }
                                    className="whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                                    title="Sao chép URL"
                                >
                                    Sao chép
                                </button>
                                <a
                                    href={checkinUrl || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-disabled={!checkinUrl}
                                    className={`whitespace-nowrap rounded-xl border px-3 py-2 text-sm ${
                                        checkinUrl
                                            ? "border-slate-200 bg-white hover:bg-slate-50"
                                            : "pointer-events-none border-slate-100 bg-slate-100 text-slate-400"
                                    }`}
                                    title="Mở URL điểm danh"
                                >
                                    Mở
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* QR code từ URL điểm danh */}
                    <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                            QR code link điểm danh
                        </label>

                        <div className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                            {qrDataUrl ? (
                                <>
                                    <img
                                        src={qrDataUrl}
                                        alt="QR Check-in"
                                        className="h-44 w-44 rounded-lg border border-slate-200 bg-white p-2"
                                    />
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const a =
                                                    document.createElement("a");
                                                a.href = qrDataUrl;
                                                a.download = `checkin-${
                                                    form.code || "event"
                                                }.png`;
                                                a.click();
                                            }}
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                                        >
                                            Tải ảnh QR
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                // Regenerate thủ công nếu cần
                                                if (!checkinUrl) return;
                                                const dataUrl =
                                                    await QRCode.toDataURL(
                                                        checkinUrl,
                                                        {
                                                            errorCorrectionLevel:
                                                                "M",
                                                            margin: 2,
                                                            scale: 6,
                                                        }
                                                    );
                                                setQrDataUrl(dataUrl);
                                            }}
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                                        >
                                            Tạo lại
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-slate-500">
                                    Chưa thể tạo QR — hãy nhập{" "}
                                    <span className="font-medium">
                                        Mã sự kiện
                                    </span>{" "}
                                    và đảm bảo
                                    <code className="mx-1">
                                        NEXT_PUBLIC_BASE_URL
                                    </code>{" "}
                                    hợp lệ.
                                </p>
                            )}
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                            QR trỏ tới:{" "}
                            <code className="break-all">
                                {checkinUrl || "(trống)"}
                            </code>
                        </p>
                    </div>

                    <div className="mt-5 flex items-center gap-2">
                        <button
                            onClick={save}
                            disabled={saving}
                            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                            {saving ? "Đang lưu..." : "Lưu thay đổi"}
                        </button>
                        <button
                            onClick={() => router.push("/events")}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                        >
                            Về danh sách sự kiện
                        </button>
                        <div className="ml-auto" />
                        <button
                            onClick={remove}
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800 hover:bg-rose-100"
                        >
                            Xoá sự kiện
                        </button>
                    </div>
                </section>
            </div>
        </main>
    );
}
