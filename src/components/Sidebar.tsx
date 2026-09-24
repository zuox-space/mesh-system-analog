// src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

/* ============ Иконки ============ */

function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 4 4 6-6" />
    </svg>
  );
}

function IconCalendar({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      {active && <circle cx="12" cy="15" r="2" fill="currentColor" />}
    </svg>
  );
}

function IconHome() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4h-2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function IconExtension() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <line x1="16" y1="8" x2="2" y2="22" />
      <line x1="17.5" y1="15" x2="9" y2="15" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function IconToken() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

const mainNav: NavItem[] = [
  { href: "/dashboard", label: "Критерии", icon: () => <IconChart /> },
  { href: "/dashboard/schedule", label: "Расписание", icon: (a) => <IconCalendar active={a} /> },
];

const actionsNav: NavItem[] = [
  { href: "/dashboard/homework", label: "Домашние задания", icon: () => <IconHome /> },
  { href: "/dashboard/launch", label: "Запуск уроков", icon: () => <IconPlay /> },
  { href: "/dashboard/ktp", label: "КТП", icon: (a) => <IconCalendar active={a} /> },
];

const serviceNav: NavItem[] = [
  { href: "/dashboard/token", label: "Токен", icon: () => <IconKey /> },
  { href: "/dashboard/extension", label: "Расширение", icon: () => <IconExtension /> },
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "Сводка", icon: () => <IconStar /> },
  { href: "/admin/users", label: "Пользователи", icon: () => <IconUsers /> },
  { href: "/admin/tokens", label: "Токены", icon: () => <IconToken /> },
  { href: "/admin/logs", label: "Логи", icon: () => <IconList /> },
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

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

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

  function isActive(href: string): boolean {
    if (href === "/dashboard" || href === "/admin") return path === href;
    return path === href || path.startsWith(href + "/");
  }

  const navContent = (
    <>
      {/* Логотип */}
      <Link
        href="/"
        className="flex items-center gap-2 mb-5 px-1 h-7 overflow-hidden"
        onClick={onClose}
      >
        <div className="w-7 h-7 shrink-0 rounded-md bg-gradient-to-br from-blue-400 to-violet-500 shadow-sm shadow-blue-500/40" />
        <div className="lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          <div className="text-[13px] font-bold text-white leading-none">
            MESH
          </div>
          <div className="text-[9px] uppercase tracking-widest text-white/40 mt-0.5">
            Web Panel
          </div>
        </div>
      </Link>

      <NavGroup title="Основное" items={mainNav} isActive={isActive} onClose={onClose} />
      <NavGroup title="Действия" items={actionsNav} isActive={isActive} onClose={onClose} />

      {role === "ADMIN" && (
        <NavGroup title="Админ" items={adminNav} isActive={isActive} onClose={onClose} />
      )}

      <div className="mt-auto pt-4 border-t border-white/10">
        <NavGroup
          title="Настройки"
          items={serviceNav}
          isActive={isActive}
          onClose={onClose}
          noMarginTop
        />
      </div>
    </>
  );

  return (
    <>
      {/* ===== Десктоп: collapsed → expanded при наведении ===== */}
      <aside
        className="hidden lg:flex flex-col w-14 hover:w-56 shrink-0 min-h-screen p-2 hover:p-3 border-r border-white/10 backdrop-blur-xl relative overflow-hidden group/sidebar transition-all duration-300 ease-out z-30"
        style={{ backgroundColor: "rgba(35, 45, 69, 0.9)" }}
      >
        {/* Мягкие свечения */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-0 -right-20 w-72 h-72 rounded-full bg-violet-500/15 blur-3xl" />
        </div>

        <div className="relative flex flex-col flex-1">
          {navContent}
        </div>
      </aside>

      {/* ===== Мобилка ===== */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        onClick={onClose}
      />

      <aside
        className={`lg:hidden fixed top-0 bottom-0 left-0 z-50 w-64 p-3 shadow-2xl overflow-y-auto flex flex-col border-r border-white/10 backdrop-blur-xl transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"
          }`}
        style={{ backgroundColor: "rgba(35, 45, 69, 0.95)" }}
      >
        {navContent}
      </aside>
    </>
  );
}

/* ============ Группа навигации ============ */

function NavGroup({
  title,
  items,
  isActive,
  onClose,
  noMarginTop,
}: {
  title: string;
  items: NavItem[];
  isActive: (href: string) => boolean;
  onClose?: () => void;
  noMarginTop?: boolean;
}) {
  return (
    <div className={noMarginTop ? "" : "mt-4 first:mt-0"}>
      {/* Заголовок группы — скрыт на десктопе в collapsed, виден на мобилке */}
      <div className="text-[9px] uppercase tracking-widest text-white/40 font-semibold px-2.5 mb-1.5 whitespace-nowrap lg:h-3 lg:overflow-hidden lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-200">
        {title}
      </div>
      <nav className="space-y-0.5">
        {items.map((it) => {
          const active = isActive(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={onClose}
              title={it.label}
              className={`relative flex items-center gap-2 px-2 py-2 rounded-md text-[13px] transition ${active
                  ? "bg-white/10 text-white font-medium border border-white/10 shadow-sm shadow-black/20"
                  : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
            >
              {active && (
                <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-gradient-to-b from-blue-400 to-violet-500" />
              )}
              <span
                className={`w-6 flex items-center justify-center shrink-0 ${active ? "text-blue-300" : "text-white/50"
                  }`}
              >
                {it.icon(active)}
              </span>
              {/* Текст — скрыт на десктопе в collapsed, виден на мобилке и при ховере на десктопе */}
              <span className="truncate whitespace-nowrap lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-200">
                {it.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}