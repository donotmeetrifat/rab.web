import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-3.5 text-sm",
};

const variants: Record<Variant, string> = {
  primary:
    "text-white shadow-[0_1px_0_rgb(255_255_255/0.3)_inset,0_1px_2px_rgb(30_58_138/0.35),0_6px_16px_-6px_rgb(37_99_235/0.5)] bg-[linear-gradient(180deg,#2f7bff_0%,#2563eb_55%,#1d4ed8_100%)] hover:brightness-105 active:brightness-95 active:scale-[0.985]",
  secondary:
    "bg-surface text-foreground border border-border hover:bg-muted",
  ghost: "text-foreground/80 hover:bg-muted hover:text-foreground",
  danger:
    "text-white bg-[linear-gradient(180deg,#ef4444_0%,#dc2626_100%)] hover:brightness-105 active:brightness-95",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", size = "md", className = "", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
});
