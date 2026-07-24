import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";

type Size = "sm" | "md" | "lg";

const sizeClasses: Record<Size, string> = {
  sm: "h-8 rounded-lg px-3 text-xs font-semibold",
  md: "h-11 rounded-[10px] px-5 text-sm font-semibold tracking-tight",
  lg: "h-12 rounded-[12px] px-6 text-sm font-semibold tracking-tight",
};

const base = "btn-3d-primary inline-flex items-center justify-center";

function cx(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

/** Shared visual + interaction classes for the premium blue 3D CTA. */
export function button3dClass(size: Size = "md", className?: string) {
  return cx(base, sizeClasses[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: Size;
  children: ReactNode;
};

export const Button3D = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ size = "md", className, children, type = "button", ...rest }, ref) => (
    <button ref={ref} type={type} className={button3dClass(size, className)} {...rest}>
      {children}
    </button>
  ),
);
Button3D.displayName = "Button3D";

type AnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  size?: Size;
  children: ReactNode;
};

export function Anchor3D({ size = "md", className, children, ...rest }: AnchorProps) {
  return (
    <a className={button3dClass(size, className)} {...rest}>
      {children}
    </a>
  );
}

type LinkButtonProps = LinkProps & { size?: Size; className?: string; children: ReactNode };

export function LinkButton3D({ size = "md", className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={button3dClass(size, className)} {...(rest as LinkProps)}>
      {children}
    </Link>
  );
}
