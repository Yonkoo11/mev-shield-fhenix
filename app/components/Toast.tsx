"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onRemove, 200);
    }, 4800);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const colors = {
    success: "border-shield-accent/30 bg-shield-accent/8 text-shield-accent",
    error: "border-shield-pink/30 bg-shield-pink/8 text-shield-pink",
    info: "border-shield-border bg-shield-card text-shield-text",
  };

  const icons = {
    success: "✓",
    error: "✕",
    info: "i",
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded border text-sm backdrop-blur-sm transition-all duration-200 ease-out font-mono ${
        colors[toast.type]
      } ${visible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}
    >
      <span className="text-xs font-bold shrink-0">{icons[toast.type]}</span>
      <span className="text-xs line-clamp-2">{toast.message}</span>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((type: ToastType, message: string) => {
    const id = ++nextId;
    setToasts((prev) => [...prev.slice(-2), { id, type, message }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: useCallback((msg: string) => add("success", msg), [add]),
    error: useCallback((msg: string) => add("error", msg), [add]),
    info: useCallback((msg: string) => add("info", msg), [add]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={() => remove(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
