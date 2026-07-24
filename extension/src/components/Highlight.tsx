import { Fragment, memo, type ReactNode } from "react";

export const Highlight = memo(function Highlight({
  text,
  query,
  className = "bg-primary/20 text-primary rounded-sm px-0.5",
}: {
  text: string;
  query?: string | null;
  className?: string;
}) {
  const q = (query || "").trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lower.indexOf(qLower, i);
    if (idx < 0) {
      parts.push(<Fragment key={key++}>{text.slice(i)}</Fragment>);
      break;
    }
    if (idx > i) parts.push(<Fragment key={key++}>{text.slice(i, idx)}</Fragment>);
    parts.push(
      <mark key={key++} className={className}>
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
  }
  return <>{parts}</>;
});
