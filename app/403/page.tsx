// app/403/page.tsx
export default function Page403() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">403 — Không có quyền</h1>
        <p className="text-slate-600">
          Tài khoản của bạn không có quyền truy cập trang này. Vui lòng dùng tài khoản admin/manager.
        </p>
      </div>
    </main>
  );
}
