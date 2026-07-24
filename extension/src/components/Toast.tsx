import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastContextValue {
  push: (kind: ToastKind, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let idSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback(
    (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  const push = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = ++idSeq;
      setToasts((prev) => [...prev.slice(-4), { id, kind, title, description }]);
      window.setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (t, d) => push("success", t, d),
      error: (t, d) => push("error", t, d),
      info: (t, d) => push("info", t, d),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="pointer-events-none fixed bottom-3 right-3 z-[9999] flex flex-col gap-2 max-w-[300px]"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const tone =
    toast.kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100 dark:border-emerald-900"
      : toast.kind === "error"
        ? "border-red-200 bg-red-50 text-red-900 dark:bg-red-950/60 dark:text-red-100 dark:border-red-900"
        : "border-border bg-surface text-foreground";

  const Icon =
    toast.kind === "success" ? CheckCircle2 : toast.kind === "error" ? AlertCircle : Info;

  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className={[
        "pointer-events-auto relative flex gap-2 rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur",
        "transition-all duration-200 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        tone,
      ].join(" ")}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-[11px] leading-snug opacity-90">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="ml-1 h-5 w-5 -mr-1 -mt-0.5 grid place-items-center rounded-md hover:bg-black/5 dark:hover:bg-white/10"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
