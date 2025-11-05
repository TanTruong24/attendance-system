"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
    id?: string;
    uid?: string;
    name: string;
    cccdLast4?: string | null;
    email?: string | null;
    username?: string | null;
    role: "admin" | "staff" | "attendee";
    group?: string | null; // 👈 thêm
};

type ApiList = { items: User[] };

export default function UsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: "",
        cccd: "",
        email: "",
        username: "",
        password: "",
        role: "staff" as User["role"],
        group: "", // 👈 thêm
    });
    const [showPw, setShowPw] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [banner, setBanner] = useState<{
        type: "success" | "error";
        msg: string;
    } | null>(null);

    const [query, setQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState<"" | User["role"]>("");
    const [groupFilter, setGroupFilter] = useState<string>(""); // 👈 thêm

    async function loadUsers() {
        try {
            setLoading(true);
            setLoadError(null);
            const res = await fetch("/api/users", { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: ApiList = await res.json();
            setUsers(data.items || []);
        } catch (e: any) {
            setLoadError(e?.message || "Không tải được danh sách.");
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        loadUsers();
    }, []);

    function validate() {
        const next: Record<string, string> = {};
        if (!form.name.trim()) next.name = "Vui lòng nhập tên.";
        if (!form.cccd.trim()) next.cccd = "Vui lòng nhập số CCCD.";
        else if (!/^\d{9,12}$/.test(form.cccd))
            next.cccd = "CCCD chỉ gồm số (9–12 chữ số).";
        if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
            next.email = "Email chưa hợp lệ.";
        if (!form.username.trim()) next.username = "Vui lòng nhập username.";
        if (!form.password.trim()) next.password = "Vui lòng nhập mật khẩu.";
        else if (form.password.length < 6)
            next.password = "Mật khẩu tối thiểu 6 ký tự.";
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    async function addUser(e: React.FormEvent) {
        e.preventDefault();
        setBanner(null);
        if (!validate()) return;
        try {
            setSubmitting(true);
            const body = {
                name: form.name.trim(),
                email: form.email.trim() || null, // email có thể null
                username: form.username.trim(),
                role: form.role,
                cccd: form.cccd.trim(), // bắt buộc
                password: form.password, // backend có thể dùng cho identity local
                group: form.group.trim() || null, // 👈 thêm
            };
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(await res.text());
            setBanner({ type: "success", msg: "Thêm người dùng thành công." });
            setForm({
                name: "",
                cccd: "",
                email: "",
                username: "",
                password: "",
                role: "staff",
                group: "",
            });
            setShowPw(false);
            await loadUsers();
        } catch (e: any) {
            setBanner({
                type: "error",
                msg: e?.message || "Thêm người dùng thất bại.",
            });
        } finally {
            setSubmitting(false);
        }
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter((u) => {
            const matchRole = roleFilter ? u.role === roleFilter : true;
            const matchGroup = groupFilter
                ? (u.group || "") === groupFilter
                : true; // 👈 thêm
            const matchQ =
                !q ||
                [u.name, u.email, u.username, u.role, u.group]
                    .filter(Boolean)
                    .some((v) => String(v).toLowerCase().includes(q));
            return matchRole && matchGroup && matchQ;
        });
    }, [users, query, roleFilter, groupFilter]); // 👈 thêm groupFilter

    const uniqueGroups = useMemo(
        () =>
            Array.from(
                new Set(users.map((u) => u.group).filter(Boolean))
            ) as string[],
        [users]
    );

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-8">
            <div className="mx-auto max-w-6xl">
                {/* ✅ Nút quay lại về Dashboard */}
                <button
                    onClick={() => router.push("/dashboard")}
                    className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-100"
                >
                    ← Quay lại Dashboard
                </button>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Quản lý người dùng
                </h1>

                {banner ? (
                    <div
                        className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                            banner.type === "success"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                : "border-rose-200 bg-rose-50 text-rose-900"
                        }`}
                    >
                        {banner.msg}
                    </div>
                ) : null}

                {/* Form */}
                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-base font-medium text-slate-900">
                        Thêm người dùng
                    </h2>
                    <form
                        onSubmit={addUser}
                        className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"
                    >
                        <Field
                            label="Tên *"
                            error={errors.name}
                            input={
                                <input
                                    value={form.name}
                                    onChange={(e) =>
                                        setForm((s) => ({
                                            ...s,
                                            name: e.target.value,
                                        }))
                                    }
                                    placeholder="Nguyễn Văn A"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                                />
                            }
                        />
                        <Field
                            label="CCCD *"
                            error={errors.cccd}
                            input={
                                <input
                                    value={form.cccd}
                                    onChange={(e) =>
                                        setForm((s) => ({
                                            ...s,
                                            cccd: e.target.value,
                                        }))
                                    }
                                    placeholder="012345678901"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                                />
                            }
                        />
                        <Field
                            label="Email (không bắt buộc)"
                            error={errors.email}
                            input={
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) =>
                                        setForm((s) => ({
                                            ...s,
                                            email: e.target.value,
                                        }))
                                    }
                                    placeholder="user@company.com"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                                />
                            }
                        />
                        <Field
                            label="Username *"
                            error={errors.username}
                            input={
                                <input
                                    value={form.username}
                                    onChange={(e) =>
                                        setForm((s) => ({
                                            ...s,
                                            username: e.target.value,
                                        }))
                                    }
                                    placeholder="username"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                                />
                            }
                        />
                        <Field
                            label="Mật khẩu *"
                            error={errors.password}
                            input={
                                <div className="flex gap-2">
                                    <input
                                        type={showPw ? "text" : "password"}
                                        value={form.password}
                                        onChange={(e) =>
                                            setForm((s) => ({
                                                ...s,
                                                password: e.target.value,
                                            }))
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPw((v) => !v)}
                                        className="rounded-xl border border-slate-200 bg-white px-3 text-sm"
                                        aria-label={
                                            showPw
                                                ? "Ẩn mật khẩu"
                                                : "Hiện mật khẩu"
                                        }
                                    >
                                        {showPw ? "Ẩn" : "Hiện"}
                                    </button>
                                </div>
                            }
                        />
                        <Field
                            label="Vai trò"
                            input={
                                <select
                                    value={form.role}
                                    onChange={(e) =>
                                        setForm((s) => ({
                                            ...s,
                                            role: e.target
                                                .value as User["role"],
                                        }))
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-slate-300"
                                >
                                    <option value="admin">admin</option>
                                    <option value="staff">staff</option>
                                    <option value="attendee">attendee</option>
                                </select>
                            }
                        />
                        {/* 👇 Trường Nhóm */}
                        <Field
                            label="Nhóm (tùy chọn)"
                            input={
                                <input
                                    value={form.group}
                                    onChange={(e) =>
                                        setForm((s) => ({
                                            ...s,
                                            group: e.target.value,
                                        }))
                                    }
                                    placeholder="VD: Phòng IT, Kế toán..."
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                                />
                            }
                        />
                        <div className="md:col-span-2">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                            >
                                {submitting
                                    ? "Đang thêm..."
                                    : "Thêm người dùng"}
                            </button>
                        </div>
                    </form>
                </section>

                {/* Toolbar */}
                <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Tìm theo tên, email, username…"
                            className="w-72 rounded-2xl border border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-slate-300"
                        />
                        <select
                            value={roleFilter}
                            onChange={(e) =>
                                setRoleFilter(e.target.value as any)
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-slate-300"
                        >
                            <option value="">Tất cả vai trò</option>
                            <option value="admin">admin</option>
                            <option value="staff">staff</option>
                            <option value="attendee">attendee</option>
                        </select>

                        {/* 👇 Bộ lọc nhóm */}
                        <select
                            value={groupFilter}
                            onChange={(e) => setGroupFilter(e.target.value)}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-slate-300"
                        >
                            <option value="">Tất cả nhóm</option>
                            {uniqueGroups.map((g) => (
                                <option key={g} value={g}>
                                    {g}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="text-sm text-slate-500">
                        Tổng:{" "}
                        <span className="font-medium text-slate-700">
                            {filtered.length}
                        </span>{" "}
                        người dùng
                    </div>
                </div>

                {/* Table – double click row để mở chi tiết */}
                <section className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {loading ? (
                        <TableSkeleton />
                    ) : loadError ? (
                        <div className="p-6 text-sm text-rose-700">
                            {loadError}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-6 text-sm text-slate-600">
                            Không có người dùng phù hợp.
                        </div>
                    ) : (
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr><Th>#</Th><Th>Tên</Th><Th>Email</Th><Th>Username</Th><Th>Vai trò</Th><Th>Nhóm</Th><Th>CCCD (last 4)</Th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map((u, idx) => {
                                    const id = u.id ?? u.uid;
                                    return (
                                        <tr key={
                                                id ??
                                                `${u.email ?? "row"}-${idx}`
                                            }
                                            onDoubleClick={() =>
                                                (u.uid || u.id) &&
                                                router.push(
                                                    `/users/${u.uid || u.id}`
                                                )
                                            }
                                            className="cursor-pointer hover:bg-slate-50/80"
                                            title="Nhấp đúp để mở chi tiết"
                                        >
                                            <Td>{idx + 1}</Td>
                                            <Td className="font-medium text-slate-900">
                                                {u.name}
                                            </Td>
                                            <Td>{u.email || "—"}</Td>
                                            <Td>{u.username}</Td>
                                            <Td>
                                                <RoleBadge role={u.role} />
                                            </Td>
                                            <Td>{u.group || "—"}</Td>{" "}
                                            <Td>{u.cccdLast4 ?? "••••"}</Td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>
        </main>
    );
}

/* ---------- UI helpers ---------- */
function Field({
    label,
    input,
    error,
}: {
    label: string;
    input: React.ReactNode;
    error?: string;
}) {
    return (
        <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
                {label}
            </label>
            {input}
            {error ? (
                <p className="mt-1 text-xs text-rose-600">{error}</p>
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
function RoleBadge({ role }: { role: User["role"] }) {
    const map: Record<User["role"], string> = {
        admin: "bg-amber-100 text-amber-800 border-amber-200",
        staff: "bg-blue-100 text-blue-800 border-blue-200",
        attendee: "bg-emerald-100 text-emerald-800 border-emerald-200",
    };
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[role]}`}
        >
            {role}
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
async function safeText(res: Response) {
    try {
        return await res.text();
    } catch {
        return "";
    }
}
