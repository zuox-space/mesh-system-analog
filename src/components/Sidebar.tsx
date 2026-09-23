"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const teacherNav = [
  { href: "/dashboard/token", label: "Токен" },
  { href: "/dashboard/schedule", label: "Расписание" },
  { href: "/dashboard/ktp", label: "КТП" },          // ← новый пункт

  { href: "/dashboard/extension", label: "Расширение" },
];

const adminNav = [
  { href: "/admin", label: "Сводка" },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/tokens", label: "Токены" },

  { href: "/admin/logs", label: "Логи" },
];

export function Sidebar({ role }: { role: "TEACHER" | "ADMIN" }) {
  const path = usePathname();

  // Админ видит всё: dashboard-пункты + admin-пункты
  // Учитель — только teacherNav (без «Обзор»)
  const items = role === "ADMIN" ? [...teacherNav, ...adminNav] : teacherNav;

  return (
    <aside className="w-52 shrink-0 border-r border-slate-200 bg-white p-3 min-h-screen">
      <Link href="/" className="flex items-center gap-2 mb-4 px-1">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-violet-500 shadow-sm shadow-blue-500/30" />
        <div>
          <div className="text-[13px] font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent leading-none">
            MESH
          </div>
          <div className="text-[9px] uppercase tracking-widest text-slate-400 mt-0.5">
            Web Panel
          </div>
        </div>
      </Link>

      <nav className="space-y-0.5">
        {items.map((it) => {
          const active =
            path === it.href ||
            (it.href !== "/dashboard" &&
              it.href !== "/admin" &&
              path.startsWith(it.href));

          return (
            <Link
              key={it.href}
              href={it.href}
              className={`block px-2.5 py-1.5 rounded-md text-[13px] transition ${active
                ? "bg-blue-50 text-blue-700 font-medium border border-blue-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
                }`}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}