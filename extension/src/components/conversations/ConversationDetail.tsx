import { memo, useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import {
  ArrowLeft,
  Bot,
  Check,
  Cog,
  Copy,
  ExternalLink,
  Paperclip,
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import type { StoredConversation, StoredConvMessage } from "@/types";
import {
  deleteConversation,
  getConversationMessages,
} from "@/services/conversations";
import { ProviderBadge } from "./ProviderBadge";
import { ContinueButton } from "./ContinueButton";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";

type Role = StoredConvMessage["role"];

const ROLE_ICON: Record<Role, typeof User> = {
  user: User,
  assistant: Bot,
  tool: Wrench,
  system: Cog,
};

const ROLE_LABEL: Record<Role, string> = {
  user: "You",
  assistant: "Assistant",
  tool: "Tool",
  system: "System",
};

const ROLE_BADGE: Record<Role, string> = {
  user: "bg-primary/10 text-primary border-primary/20",
  assistant: "bg-muted text-foreground/80 border-border",
  tool: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  system: "bg-muted text-muted-foreground border-border",
};

function formatConversationText(
  conversation: StoredConversation,
  messages: StoredConvMessage[],
): string {
  const header = [
    `# ${conversation.title || "Untitled conversation"}`,
    `Provider: ${conversation.provider}`,
    conversation.model ? `Model: ${conversation.model}` : null,
    `Saved: ${new Date(conversation.updatedAt).toLocaleString()}`,
    conversation.url ? `Source: ${conversation.url}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const body = messages
    .map(
      (m) =>
        `\n---\n\n## ${ROLE_LABEL[m.role] ?? m.role}\n\n${m.markdown || m.content}`,
    )
    .join("");
  return `${header}\n${body}\n`;
}

const MarkdownBody = memo(function MarkdownBody({ source }: { source: string }) {
  return (
    <div className="memlace-md text-[13px] leading-relaxed text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          a: ({ node: _n, ...p }) => (
            <a {...p} target="_blank" rel="noreferrer" className="text-primary hover:underline" />
          ),
          img: ({ node: _n, ...p }) => (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img
              {...p}
              loading="lazy"
              className="my-2 rounded-md border border-border max-w-full h-auto"
            />
          ),
          table: ({ node: _n, ...p }) => (
            <div className="my-2 overflow-x-auto scroll-thin rounded-md border border-border">
              <table {...p} className="w-full text-xs" />
            </div>
          ),
          th: ({ node: _n, ...p }) => (
            <th {...p} className="bg-muted/60 px-2 py-1.5 text-left font-medium" />
          ),
          td: ({ node: _n, ...p }) => (
            <td {...p} className="border-t border-border px-2 py-1.5 align-top" />
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
});

function CopyButton({
  getText,
  label = "Copy",
  size = "sm",
}: {
  getText: () => string;
  label?: string;
  size?: "xs" | "sm";
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const onClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      toast.error("Copy failed", err instanceof Error ? err.message : undefined);
    }
  }, [getText, toast]);

  if (size === "xs") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
      >
        {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : label}
      </button>
    );
  }
  return (
    <Button size="sm" variant="secondary" onClick={onClick}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

const MessageCard = memo(function MessageCard({ m }: { m: StoredConvMessage }) {
  const Icon = ROLE_ICON[m.role] ?? Bot;
  const source = m.markdown?.trim() || m.content || "";
  const getText = useCallback(() => source, [source]);

  return (
    <article
      className="group rounded-xl border border-border bg-surface p-3.5 hover:border-primary/30 transition-colors"
      data-role={m.role}
    >
      <header className="flex items-center gap-2 mb-2">
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${ROLE_BADGE[m.role]}`}
        >
          <Icon className="h-3 w-3" />
          {ROLE_LABEL[m.role] ?? m.role}
        </span>
        <span className="text-[10px] text-muted-foreground">#{m.order + 1}</span>
        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton getText={getText} size="xs" label="Copy" />
        </div>
      </header>

      {source ? (
        <MarkdownBody source={source} />
      ) : (
        <p className="text-xs text-muted-foreground italic">Empty message.</p>
      )}

      {m.images.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {m.images.map((src, i) => (
            <a
              key={i}
              href={src}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-md border border-border"
            >
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img src={src} loading="lazy" className="w-full h-auto object-cover" />
            </a>
          ))}
        </div>
      )}

      {m.attachments.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {m.attachments.map((a, i) => (
            <li key={i}>
              <a
                href={a.url ?? "#"}
                target={a.url ? "_blank" : undefined}
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground/80 hover:border-primary/40"
              >
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                <span className="truncate max-w-[180px]">
                  {a.name || a.url || a.mime || a.kind}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
});

export function ConversationDetail({
  conversation,
  onClose,
  onDeleted,
}: {
  conversation: StoredConversation;
  onClose?: () => void;
  onDeleted?: () => void;
}) {
  const toast = useToast();
  const [messages, setMessages] = useState<StoredConvMessage[] | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const getAllText = useCallback(
    () => formatConversationText(conversation, messages ?? []),
    [conversation, messages],
  );

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Delete conversation “${conversation.title}”? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteConversation(conversation.id);
      toast.success("Conversation deleted");
      onDeleted?.();
      onClose?.();
    } catch (err) {
      toast.error("Delete failed", err instanceof Error ? err.message : undefined);
    } finally {
      setDeleting(false);
    }
  }, [conversation.id, conversation.title, onClose, onDeleted, toast]);

  const savedAt = useMemo(
    () => new Date(conversation.updatedAt).toLocaleString(),
    [conversation.updatedAt],
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <header className="border-b border-border bg-surface/60 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Back to conversations"
              className="h-8 w-8 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold truncate text-foreground">
              {conversation.title || "Untitled conversation"}
            </h2>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <ProviderBadge provider={conversation.provider} size="xs" />
              {conversation.model && (
                <span className="text-[11px] text-muted-foreground">{conversation.model}</span>
              )}
              <span className="text-[11px] text-muted-foreground">
                {conversation.messageCount} messages · saved {savedAt}
              </span>
            </div>
            {conversation.url && (
              <a
                href={conversation.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline truncate max-w-full"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="truncate">{conversation.url}</span>
              </a>
            )}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <CopyButton getText={getAllText} label="Copy conversation" />
          {conversation.url && (
            <a
              href={conversation.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 h-8 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open original
            </a>
          )}
          <ContinueButton conversation={conversation} messages={messages} />
          <div className="ml-auto">
            <Button size="sm" variant="danger" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scroll-thin px-4 py-4 space-y-3">
        {messages === null ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="grid place-items-center h-full text-center px-6">
            <div>
              <div className="mx-auto h-12 w-12 grid place-items-center rounded-xl bg-muted text-muted-foreground">
                <Bot className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold">No captured messages</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">
                This conversation was saved without message content. Reopen the source and try
                capturing again.
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => <MessageCard key={m.id} m={m} />)
        )}
      </div>
    </div>
  );
}
