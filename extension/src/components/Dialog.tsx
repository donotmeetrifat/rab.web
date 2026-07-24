import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md";
}

export function Dialog({ open, onOpenChange, title, description, children, footer, size = "sm" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const width = size === "md" ? "max-w-lg" : "max-w-sm";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[1000] grid place-items-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        ref={ref}
        className={`relative w-full ${width} rounded-2xl border border-border bg-surface p-5 shadow-2xl animate-scale-in`}
      >
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/** Trivial dropdown menu closable on outside click. */
export function useOutsideClick<T extends HTMLElement>(
  onClose: () => void,
): { ref: React.RefObject<T | null> } {
  const ref = useRef<T>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);
  return { ref };
}

export function useHotkey(key: string, handler: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const combo = [
        e.ctrlKey || e.metaKey ? "mod+" : "",
        e.shiftKey ? "shift+" : "",
        e.altKey ? "alt+" : "",
        e.key.toLowerCase(),
      ].join("");
      if (combo === key.toLowerCase()) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, handler, enabled]);
}

export function useState2<T>(initial: T): [T, (v: T) => void] {
  const [v, set] = useState(initial);
  return [v, set];
}
