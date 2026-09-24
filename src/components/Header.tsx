// src/components/Header.tsx
"use client";

import { useRouter } from "next/navigation";

export function Header({
  title,
  user,
  onMenuClick,
}: {
  title: string;
  user: { firstName?: string | null; lastName?: string | null; role: string };
  onMenuClick?: () => void;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const name =
    [user.lastName, user.firstName].filter(Boolean).join(" ") || "Пользователь";

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur px-4 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        {/* Гамбургер — только мобилка */}
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden -ml-1 w-8 h-8 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition"
          aria-label="Открыть меню"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <h1 className="text-[15px] font-semibold text-slate-900 truncate">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="text-right leading-tight hidden sm:block">
          <div className="text-[12px] text-slate-700 truncate max-w-[140px]">
            {name}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-slate-400">
            {user.role}
          </div>
        </div>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-[12px] font-bold text-white shadow-sm shadow-blue-500/20">
          {(user.firstName?.[0] || "?").toUpperCase()}
        </div>
        <button
          onClick={logout}
          className="text-[11px] text-slate-500 hover:text-red-500 transition"
        >
          Выйти
        </button>
      </div>
    </header>
  );
}