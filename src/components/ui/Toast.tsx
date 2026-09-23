// src/components/ui/Toast.tsx
"use client";

import { useEffect, useState } from "react";

export type ToastItem = {
    id: number;
    text: string;
    type: "ok" | "err";
};

let toastId = 0;

/** Хук для управления тостами */
export function useToast() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    function push(text: string, type: "ok" | "err" = "ok") {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, text, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }

    function remove(id: number) {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }

    return { toasts, push, remove };
}

/** Контейнер тостов */
export function ToastContainer({
    toasts,
    onRemove,
}: {
    toasts: ToastItem[];
    onRemove: (id: number) => void;
}) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
            {toasts.map((t) => (
                <Toast key={t.id} toast={t} onClose={() => onRemove(t.id)} />
            ))}
        </div>
    );
}

function Toast({
    toast,
    onClose,
}: {
    toast: ToastItem;
    onClose: () => void;
}) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // лёгкая анимация появления
        const t = setTimeout(() => setVisible(true), 10);
        return () => clearTimeout(t);
    }, []);

    const isOk = toast.type === "ok";

    return (
        <div
            className={`pointer-events-auto min-w-[260px] max-w-[360px] rounded-lg border shadow-lg backdrop-blur px-3 py-2.5 flex items-start gap-2 transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                } ${isOk
                    ? "bg-emerald-50/95 border-emerald-200 text-emerald-800"
                    : "bg-red-50/95 border-red-200 text-red-800"
                }`}
        >
            <span className="text-[14px] leading-none mt-0.5 shrink-0">
                {isOk ? "✓" : "✕"}
            </span>
            <span className="text-[13px] flex-1 leading-snug">{toast.text}</span>
            <button
                type="button"
                onClick={onClose}
                className="text-[12px] opacity-60 hover:opacity-100 shrink-0 ml-1"
                aria-label="Закрыть"
            >
                ✕
            </button>
        </div>
    );
}