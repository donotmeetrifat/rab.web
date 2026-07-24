import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Loader2, Send } from "lucide-react";
import type { StoredConversation, StoredConvMessage } from "@/types";
import {
  CONTINUATION_PROVIDERS,
  buildContinuationContext,
  copyToClipboard,
  openProviderTab,
  type ContinuationProviderId,
} from "@/lib/continuation";
import { useToast } from "@/components/Toast";

interface Props {
  conversation: StoredConversation;
  messages: StoredConvMessage[] | null;
}

const PROVIDER_DOT: Record<ContinuationProviderId, string> = {
  chatgpt: "#10a37f",
  claude: "#d97757",
  gemini: "#4285f4",
  deepseek: "#4d6bfe",
  copilot: "#0078d4",
  perplexity: "#20b8cd",
};

export function ContinueButton({ conversation, messages }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<ContinuationProviderId | null>(null);
  const [justSent, setJustSent] = useState<ContinuationProviderId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const disabled = !messages || messages.length === 0;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleContinue = useCallback(
    async (target: ContinuationProviderId) => {
      if (!messages || messages.length === 0) {
        toast.error("Nothing to continue", "This conversation has no saved messages.");
        return;
      }
      setPending(target);
      try {
        const built = buildContinuationContext({ target, conversation, messages });
        await copyToClipboard(built.prompt);

        const adapter = CONTINUATION_PROVIDERS.find((p) => p.id === target)!;
        openProviderTab(adapter.newChatUrl);

        setJustSent(target);
        setTimeout(() => setJustSent(null), 1600);
        setOpen(false);

        const parts = [
          `Context copied · ${built.chars.toLocaleString()} chars`,
          built.truncated
            ? `${built.includedMessages}/${built.totalMessages} messages (older trimmed)`
            : `${built.includedMessages} messages`,
        ];
        toast.success(`Opened ${adapter.name}`, `${parts.join(" · ")}. Paste to continue.`);
      } catch (err) {
        toast.error(
          "Continue failed",
          err instanceof Error ? err.message : "Could not copy or open the target.",
        );
      } finally {
        setPending(null);
      }
    },
    [conversation, messages, toast],
  );

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-8 rounded-lg border border-primary/30 bg-primary text-primary-foreground px-3 text-xs font-semibold shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
        title={disabled ? "No messages to continue" : "Continue this conversation in another AI"}
      >
        <Send className="h-3.5 w-3.5" />
        Continue in
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1.5 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-lg ring-1 ring-black/5"
        >
          <div className="px-3 py-2 border-b border-border/60">
            <p className="text-[11px] font-medium text-foreground">Continue in another AI</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Copies an optimized context and opens a fresh chat.
            </p>
          </div>
          <ul className="p-1 max-h-72 overflow-y-auto scroll-thin">
            {CONTINUATION_PROVIDERS.map((p) => {
              const isPending = pending === p.id;
              const isDone = justSent === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleContinue(p.id)}
                    disabled={pending !== null}
                    className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    <span
                      className="h-6 w-6 shrink-0 rounded-md grid place-items-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: PROVIDER_DOT[p.id] }}
                      aria-hidden
                    >
                      {p.name.charAt(0)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-medium text-foreground truncate">
                        {p.name}
                      </span>
                      <span className="block text-[10px] text-muted-foreground truncate">
                        Copy · open new chat
                      </span>
                    </span>
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
                    ) : isDone ? (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
