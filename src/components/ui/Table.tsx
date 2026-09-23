import { ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white w-full">
      <table className="w-full text-[13px]">{children}</table>
    </div>
  );
}

export function Th({ children }: { children?: ReactNode }) {
  return (
    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 font-semibold border-b border-slate-200">
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-3 py-1.5 border-b border-slate-100 text-slate-700 ${className}`}>
      {children}
    </td>
  );
}