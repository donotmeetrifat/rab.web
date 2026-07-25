import { cloneElement, isValidElement, type ReactElement } from "react";

/**
 * Lightweight tooltip: uses the browser's native `title` attribute so it
 * degrades gracefully across popup, sidepanel, and options surfaces without
 * pulling in a heavy overlay library. Wrap any focusable element.
 */
export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactElement<Record<string, unknown>>;
}) {
  if (!isValidElement(children)) return children;
  return cloneElement(children, {
    title: label,
    "aria-label":
      (children.props as { "aria-label"?: string })["aria-label"] ?? label,
  });
}
