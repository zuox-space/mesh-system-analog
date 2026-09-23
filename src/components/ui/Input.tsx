import { InputHTMLAttributes } from "react";

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-md bg-white border border-slate-200 px-2.5 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200/60 transition ${className}`}
      {...rest}
    />
  );
}