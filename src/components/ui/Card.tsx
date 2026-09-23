import { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">
      {children}
    </h3>
  );
}