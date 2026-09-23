"use client";

import { useRouter } from "next/navigation";

export function Header({
  title,
  user,
}: {
  title: string;
  user: { firstName?: string | null; lastName?: string | null; role: string };
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const name = [user.lastName, user.firstName].filter(Boolean).join(" ") || "Пользователь";

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur px-4 py-2.5">
      <h1 className="text-[15px] font-semibold text-slate-900">{title}</h1>

      <div className="flex items-center gap-2.5">
        <div className="text-right leading-tight">
          <div className="text-[12px] text-slate-700">{name}</div>
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