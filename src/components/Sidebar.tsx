// src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const teacherNav = [
  { href: "/dashboard", label: "Критерии" },
  { href: "/dashboard/token", label: "Токен" },
  { href: "/dashboard/schedule", label: "Расписание" },
  { href: "/dashboard/ktp", label: "КТП" },
    { href: "/dashboard/launch", label: "Запуск уроков" },

  { href: "/dashboard/homework", label: "Домашние задания" },
  { href: "/dashboard/extension", label: "Расширение" },
];

const adminNav = [
  { href: "/admin", label: "Сводка" },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/tokens", label: "Токены" },
  { href: "/admin/logs", label: "Логи" },
];

export function Sidebar({
  role,
  open,
  onClose,
}: {
  role: "TEACHER" | "ADMIN";
  open?: boolean;
  onClose?: () => void;
}) {
  const path = usePathname();
  const items = role === "ADMIN" ? [...teacherNav, ...adminNav] : teacherNav;

  // Закрытие по Esc
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Блокируем скролл body при открытом сайдбаре на мобилке
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const navContent = (
    <>
      <Link
        href="/"
        className="flex items-center gap-2 mb-4 px-1"
        onClick={onClose}
      >
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
              onClick={onClose}
              className={`block px-2.5 py-1.5 rounded-md text-[13px] transition ${
                active
                  ? "bg-blue-50 text-blue-700 font-medium border border-blue-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
              }`}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* ===== Десктоп: постоянный сайдбар ===== */}
      <aside className="hidden lg:flex flex-col w-52 shrink-0 border-r border-slate-200 bg-white p-3 min-h-screen">
        {navContent}
      </aside>

      {/* ===== Мобилка: выезжающий сайдбар ===== */}
      {/* Затемнение */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Панель */}
      <aside
        className={`lg:hidden fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200 p-3 shadow-2xl overflow-y-auto transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>
    </>
  );
}