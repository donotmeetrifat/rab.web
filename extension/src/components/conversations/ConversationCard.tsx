import { memo } from "react";
import { MessagesSquare, Trash2, ExternalLink } from "lucide-react";
import type { StoredConversation } from "@/types";
import { ProviderBadge } from "./ProviderBadge";

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export const ConversationCard = memo(function ConversationCard({
  conversation,
  active,
  onOpen,
  onDelete,
  compact = false,
}: {
  conversation: StoredConversation;
  active?: boolean;
  onOpen?: (c: StoredConversation) => void;
  onDelete?: (c: StoredConversation) => void;
  compact?: boolean;
}) {
  const c = conversation;
  return (
    <li>
      <div
        className={
          "group relative rounded-lg border bg-surface transition-colors " +
          (active
            ? "border-primary/50 ring-1 ring-primary/30"
            : "border-border hover:border-primary/30")
        }
      >
        <button
          type="button"
          onClick={() => onOpen?.(c)}
          className="w-full text-left px-3 py-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <div className="flex items-center gap-2 min-w-0">
            <MessagesSquare className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
            <span className="text-[13px] font-medium truncate flex-1">
              {c.title || "Untitled conversation"}
            </span>
            {!compact && (
              <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                {relTime(c.updatedAt)}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <ProviderBadge provider={c.provider} size="xs" />
            <span className="text-[10px] text-muted-foreground">
              {c.messageCount} {c.messageCount === 1 ? "message" : "messages"}
            </span>
            {c.model && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                · {c.model}
              </span>
            )}
            {compact && (
              <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                {relTime(c.updatedAt)}
              </span>
            )}
          </div>
        </button>

        {(onDelete || c.url) && (
          <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {c.url && (
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                aria-label="Open source conversation"
                onClick={(e) => e.stopPropagation()}
                className="h-6 w-6 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {onDelete && (
              <button
                type="button"
                aria-label="Delete conversation"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c);
                }}
                className="h-6 w-6 grid place-items-center rounded-md text-muted-foreground hover:text-red-600 hover:bg-muted"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
});
