import { useEffect, useState } from "react";
import { X, ExternalLink, User, Bot, Wrench, Cog } from "lucide-react";
import type { StoredConversation, StoredConvMessage } from "@/types";
import { getConversationMessages } from "@/services/conversations";
import { ProviderBadge } from "./ProviderBadge";
import { Skeleton } from "@/components/Skeleton";

const ROLE_ICON = {
  user: User,
  assistant: Bot,
  tool: Wrench,
  system: Cog,
} as const;

const ROLE_LABEL = {
  user: "You",
  assistant: "Assistant",
  tool: "Tool",
  system: "System",
} as const;

export function ConversationDetail({
  conversation,
  onClose,
}: {
  conversation: StoredConversation;
  onClose?: () => void;
}) {
  const [messages, setMessages] = useState<StoredConvMessage[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMessages(null);
    getConversationMessages(conversation.id).then((rows) => {
      if (!cancelled) setMessages(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [conversation.id]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-start gap-2 px-4 py-3 border-b border-border">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold truncate">
            {conversation.title || "Untitled conversation"}
          </h2>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <ProviderBadge provider={conversation.provider} size="xs" />
            <span className="text-[11px] text-muted-foreground">
              {conversation.messageCount} messages · saved{" "}
              {new Date(conversation.updatedAt).toLocaleString()}
            </span>
          </div>
        </div>
        {conversation.url && (
          <a
            href={conversation.url}
            target="_blank"
            rel="noreferrer"
            aria-label="Open source"
            className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {onClose && (
          <button
            type="button"
            aria-label="Close conversation"
            onClick={onClose}
            className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-4 py-3 space-y-3">
        {messages === null ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-14 w-2/3" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            This conversation has no captured messages.
          </p>
        ) : (
          messages.map((m) => {
            const Icon = ROLE_ICON[m.role] ?? Bot;
            return (
              <article
                key={m.id}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <header className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
                  <Icon className="h-3 w-3" />
                  <span className="font-medium text-foreground/80">
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                </header>
                <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans text-foreground/90">
                  {m.markdown || m.content}
                </pre>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
