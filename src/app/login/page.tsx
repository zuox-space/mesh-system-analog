"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/dashboard/schedule";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) {
      setError(data.detail || "Ошибка входа");
      return;
    }
    router.push(from);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 mb-3" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            MESH Web Panel
          </h1>
          <p className="text-xs uppercase tracking-widest text-slate-500 mt-1">Вход в систему</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl border border-blue-500/15 bg-slate-900/60 backdrop-blur p-6">
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-400">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-400">Пароль</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
          <div className="text-center text-xs text-slate-500 mt-2">
            Нет аккаунта?{" "}
            <Link href="/register" className="text-blue-600 hover:underline">
              Зарегистрироваться
            </Link>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Вхожу..." : "Войти"}
          </Button>
        </form>
      </div>
    </div>
  );
}