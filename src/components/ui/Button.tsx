import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: Props) {
  const base =
    "inline-flex items-center justify-center rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400/40";

  const sizes = {
    sm: "px-2.5 py-1 text-[12px]",
    md: "px-3 py-1.5 text-[13px]",
    lg: "px-4 py-2 text-sm",
  };

  const variants = {
    primary:
      "bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-sm shadow-blue-500/20 hover:shadow-md hover:shadow-blue-500/30",
    secondary:
      "bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 hover:border-blue-300",
    danger:
      "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}