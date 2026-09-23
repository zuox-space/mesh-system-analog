import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MESH Web Panel",
  description: "Панель управления токенами МЭШ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="bg-[#F5F7FB] text-slate-900 min-h-screen relative">
        <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(74,158,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(74,158,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="pointer-events-none fixed -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-blue-400/20 blur-[120px]" />
        <div className="pointer-events-none fixed -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-violet-400/15 blur-[120px]" />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}