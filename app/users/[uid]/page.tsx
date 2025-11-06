"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type UserRole = "admin" | "manager" | "attendee";
type UserStatus = "active" | "disabled";
type Role = "admin" | "manager" | "attendee" | undefined;

export default function UserDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const router = useRouter();

  const [currentRole, setCurrentRole] = useState<Role>(undefined);
  const readOnly = currentRole === "manager";

  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    role: "manager" as UserRole,
    status: "active" as UserStatus,
    cccd: "",
    cccdLast4: "",
  });
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // load role hiện tại
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/verify", { cache: "no-store" });
        if (!r.ok) return setCurrentRole(undefined);
        const j = await r.json();
        setCurrentRole(j?.user?.role as Role);
      } catch {
        setCurrentRole(undefined);
      }
    })();
  }, []);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/users/${uid}`, { cache: "no-store" });
      if (!res.ok) {
        setBanner({ type: "error", msg: await res.text() });
        setLoading(false);
        return;
      }
      const u = await res.json();
      setForm({
        name: u.name || "",
        email: u.email || "",
        username: u.username || "",
        role: (u.role as UserRole) || "manager",
        status: (u.status as UserStatus) || "active",
        cccd: "",
        cccdLast4: u.cccdLast4 || "",
      });
      setLoading(false);
    })();
  }, [uid]);

  async function save() {
    if (readOnly) return; // manager không được lưu
    setBanner(null);
    const body: any = {
      name: form.name,
      email: form.email?.trim() ? form.email : null,
      username: form.username?.trim() || null,
      role: form.role,
      status: form.status,
    };
    if (form.cccd.trim()) {
      if (!/^\d{9,12}$/.test(form.cccd)) {
        setBanner({ type: "error", msg: "CCCD chỉ gồm số (9–12 chữ số)." });
        return;
      }
      body.cccd = form.cccd.trim();
    }
    const res = await fetch(`/api/users/${uid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setBanner({ type: "error", msg: await res.text() });
      return;
    }
    setBanner({ type: "success", msg: "Đã lưu thay đổi." });
  }

  async function remove() {
    if (readOnly) return; // manager không xoá
    if (!confirm("Xoá người dùng này?")) return;
    const res = await fetch(`/api/users/${uid}`, { method: "DELETE" });
    if (!res.ok) {
      setBanner({ type: "error", msg: await res.text() });
      return;
    }
    router.push("/users");
  }

  if (loading) return <main className="p-6">Đang tải…</main>;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <button onClick={() => router.push("/users")} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm">
          ← Quay lại
        </button>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Chi tiết người dùng</h1>

        {readOnly && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Bạn đang ở chế độ <b>chỉ xem</b> (manager). Chỉ admin được lưu thay đổi / xoá người dùng.
          </div>
        )}

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
            <Field label="Tên">
              <input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                readOnly={readOnly}
                disabled={readOnly}
              />
            </Field>
            <Field label="Email (có thể để trống)">
              <input
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                readOnly={readOnly}
                disabled={readOnly}
              />
            </Field>
            <Field label="Username">
              <input
                value={form.username}
                onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                readOnly={readOnly}
                disabled={readOnly}
              />
            </Field>
            <Field label="Vai trò">
              <select
                value={form.role}
                onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as UserRole }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-slate-300"
                disabled={readOnly}
              >
                <option value="admin">admin</option>
                <option value="manager">manager</option>
                <option value="attendee">attendee</option>
              </select>
            </Field>
            <Field label="Trạng thái">
              <select
                value={form.status}
                onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as UserStatus }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-slate-300"
                disabled={readOnly}
              >
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </select>
            </Field>
            <Field label={`CCCD  (********${form.cccdLast4 || "••••"})`}>
              <input
                value={form.cccd}
                onChange={(e) => setForm((s) => ({ ...s, cccd: e.target.value }))}
                placeholder="Nhập đủ để cập nhật last4"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-slate-300"
                readOnly={readOnly}
                disabled={readOnly}
              />
            </Field>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <button
              onClick={save}
              disabled={readOnly}
              className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                readOnly ? "border border-slate-200 bg-slate-100 text-slate-400" : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
              title={readOnly ? "Chỉ admin mới được lưu thay đổi" : ""}
            >
              Lưu thay đổi
            </button>
            <div className="ml-auto" />
            <button
              onClick={remove}
              disabled={readOnly}
              className={`rounded-2xl px-4 py-2 text-sm ${
                readOnly ? "border border-slate-200 bg-slate-100 text-slate-400"
                          : "border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
              }`}
              title={readOnly ? "Chỉ admin mới được xoá người dùng" : ""}
            >
              Xoá người dùng
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
