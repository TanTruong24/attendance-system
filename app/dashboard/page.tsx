'use client'

import Link from 'next/link'
import { CalendarDays, Users, BarChart3, ArrowRight, Plus } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Attendance Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">Quản trị điểm danh, sự kiện và người dùng của bạn trong một nơi.</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/users"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <Users className="h-4 w-4" />
              Quản lý người dùng
            </Link>
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
          <h2 className="mb-3 text-base font-medium text-slate-900">Hoạt động gần đây</h2>
          <div className="divide-y rounded-2xl border border-slate-200 bg-white">
            {[
              {
                title: 'Sự kiện: An toàn Lao động tháng 11',
                meta: 'Cập nhật 10 phút trước • 45/50 đã điểm danh',
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.02 * idx }}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.meta}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function KPI({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </motion.div>
  )
}

function NavCard({
  href,
  icon,
  title,
  desc,
}: {
  href: string
  icon: React.ReactNode
  title: string
  desc: string
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
              <h3 className="text-base font-medium text-slate-900">{title}</h3>
              <p className="mt-0.5 text-sm text-slate-600">{desc}</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
        </div>
      </motion.div>
    </Link>
  )
}
