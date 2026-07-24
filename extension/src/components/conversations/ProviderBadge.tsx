import { providerMeta } from "@/lib/providers";
import type { ProviderId } from "@/types";

export function ProviderBadge({
  provider,
  size = "sm",
}: {
  provider: ProviderId;
  size?: "xs" | "sm";
}) {
  const meta = providerMeta(provider);
  const name = meta?.name ?? "Other";
  const color = meta?.color ?? "#6B7280";
  const cls =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5 gap-1"
      : "text-[11px] px-2 py-0.5 gap-1.5";
  return (
    <span
      className={
        "inline-flex items-center rounded-full border border-border bg-surface font-medium " +
        cls
      }
      style={{ color }}
      aria-label={`Provider ${name}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      <span className="text-foreground/80">{name}</span>
    </span>
  );
}
