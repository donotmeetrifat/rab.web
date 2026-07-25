import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import {
  MEMLACE_VERSION,
  acknowledgeVersion,
  loadOnboarding,
} from "@/services/onboarding";

interface ChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "2026-07-25",
    highlights: [
      "First-run onboarding, setup checklist, and Help Center.",
      "Universal ⌘K search across memories, chats and projects.",
      "Continue in another AI — one-click context handoff.",
      "Optional AI layer: summaries, tags, semantic search, Ask Memlace.",
    ],
  },
];

export function WhatsNew() {
  const [open, setOpen] = useState(false);
  const entry = CHANGELOG[0];

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await loadOnboarding();
      if (cancelled) return;
      // Only shown after onboarding is complete AND the version changed.
      if (s.completed && s.lastSeenVersion !== MEMLACE_VERSION) setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function close() {
    await acknowledgeVersion();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`What's new in Memlace ${entry.version}`}
      className="fixed inset-0 z-[1100] grid place-items-center p-4"
    >
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={close} />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl animate-scale-in">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold">What’s new · v{entry.version}</div>
            <div className="text-[10px] text-muted-foreground">{entry.date}</div>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5">
          {entry.highlights.map((h) => (
            <li key={h} className="flex gap-2 text-xs text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" size="sm" onClick={close}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
