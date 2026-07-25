/**
 * Ask Memlace — RAG chat over the user's saved conversations.
 */
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, MessageSquare, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { askMemlace, type AskAnswer } from "@/ai/AskMemlace";
import { isAIEnabled, providerLabel } from "@/ai/AIManager";
import { formatCost } from "@/ai/CostEstimator";
import { aiQueue } from "@/ai/AIQueue";

interface Turn {
  id: string;
  question: string;
  answer?: AskAnswer;
  error?: string;
  pending: boolean;
}

export function AskMemlacePanel({
  onOpenConversation,
}: { onOpenConversation?: (id: string) => void }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { void isAIEnabled().then(setEnabled); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns]);

  const submit = async () => {
    const q = input.trim();
    if (!q) return;
    if (!enabled) {
      toast.error("Enable AI in Settings first");
      return;
    }
    const id = `t_${Date.now()}`;
    setTurns((t) => [...t, { id, question: q, pending: true }]);
    setInput("");

    try {
      const ans = await aiQueue.enqueue({
        kind: "ask",
        label: `Ask: ${q.slice(0, 60)}`,
        estInputTokens: 3000,
        estOutputTokens: 500,
        runner: ({ signal }) => askMemlace(q, { signal }),
      });
      setTurns((t) => t.map((x) => x.id === id ? { ...x, answer: ans, pending: false } : x));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTurns((t) => t.map((x) => x.id === id ? { ...x, error: msg, pending: false } : x));
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-semibold">Ask Memlace</h1>
          <span className="ml-2 text-[10px] text-muted-foreground">
            Questions run against your own saved chats — never the open web.
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {turns.length === 0 && (
          <div className="mx-auto max-w-md text-center text-xs text-muted-foreground py-8">
            <p>Ask a natural-language question about anything you've saved.</p>
            <ul className="mt-3 space-y-1 text-left inline-block text-foreground/80">
              <li>• Where did I discuss Supabase auth?</li>
              <li>• What React optimisation tips have I collected?</li>
              <li>• What did Claude recommend for Docker on Apple Silicon?</li>
            </ul>
          </div>
        )}

        {turns.map((t) => (
          <div key={t.id} className="space-y-2">
            <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">You</div>
              {t.question}
            </div>
            {t.pending && (
              <div className="rounded-xl border border-border bg-primary/5 px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                Searching your saved chats…
              </div>
            )}
            {t.answer && (
              <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 flex justify-between gap-2">
                  <span>Memlace · {providerLabel(t.answer.provider)} · {t.answer.model}</span>
                  <span>{t.answer.cached ? "cached" : formatCost(t.answer.costUSD)}</span>
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{t.answer.answer}</div>
                {t.answer.citations.length > 0 && (
                  <div className="mt-2 border-t border-border pt-2">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Sources</div>
                    <ul className="space-y-1">
                      {t.answer.citations.map((c) => (
                        <li key={c.conversationId}>
                          <button
                            type="button"
                            onClick={() => onOpenConversation?.(c.conversationId)}
                            className="w-full flex items-center gap-2 text-left rounded-md px-2 py-1 hover:bg-muted text-xs"
                          >
                            <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate flex-1">{c.title}</span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {(c.score * 100).toFixed(0)}%
                            </span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {t.error && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-sm text-rose-500">
                {t.error}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
        className="border-t border-border p-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={enabled ? "Ask about your saved conversations…" : "Enable AI in Settings to ask questions"}
          disabled={!enabled}
          className="flex-1 h-9 rounded-lg border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:opacity-60"
        />
        <Button type="submit" variant="primary" disabled={!enabled || !input.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
