import { useEffect, useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  Keyboard,
  Rocket,
  Wifi,
  Cpu,
  Check,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/Button";
import {
  completeOnboarding,
  loadOnboarding,
  saveOnboarding,
  MEMLACE_VERSION,
} from "@/services/onboarding";
import wordmark from "@/../public/wordmark.png";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const PROVIDERS = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "DeepSeek",
  "Perplexity",
  "Copilot",
  "AI Studio",
];

export function OnboardingFlow({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [experience, setExperience] = useState<"offline" | "byo-ai">("offline");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await loadOnboarding();
      if (!cancelled && !s.completed) setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function skip() {
    await saveOnboarding({
      completed: true,
      completedAt: Date.now(),
      experience: "offline",
      lastSeenVersion: MEMLACE_VERSION,
      checklist: {
        savedConversation: false,
        createdProject: false,
        usedSearch: false,
        continuedElsewhere: false,
        enabledAI: false,
      },
    });
    setOpen(false);
    onDone?.();
  }

  async function finish() {
    await completeOnboarding(experience);
    setOpen(false);
    onDone?.();
  }

  if (!open) return null;

  const next = () => setStep((s) => (Math.min(5, s + 1) as Step));
  const prev = () => setStep((s) => (Math.max(0, s - 1) as Step));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Memlace"
      className="fixed inset-0 z-[1200] grid place-items-center p-4"
    >
      <div className="absolute inset-0 bg-black/50 animate-fade-in" />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl animate-scale-in overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <span className="tabular-nums">Step {step + 1} of 6</span>
          </div>
          <button
            type="button"
            onClick={skip}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
        </div>

        <div className="h-1 mx-5 mt-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / 6) * 100}%` }}
          />
        </div>

        <div className="px-6 py-6 min-h-[260px]">
          {step === 0 && (
            <div className="text-center space-y-3">
              <img
                src={wordmark}
                alt="Memlace"
                className="mx-auto h-8 object-contain"
                onError={(e) => ((e.currentTarget.style.display = "none"))}
              />
              <h2 className="text-lg font-semibold">Welcome to Memlace</h2>
              <p className="text-sm text-muted-foreground">
                A place for your AI memory. Save conversations across every
                assistant, search them instantly, and pick up where you left off
                — in any AI.
              </p>
              <div className="mt-2 grid place-items-center">
                <div className="h-24 w-24 rounded-2xl bg-primary/10 grid place-items-center">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold">Works everywhere</h2>
              <p className="text-xs text-muted-foreground">
                Memlace captures conversations from every major AI. Your chats
                stay on this device unless you turn on optional AI features.
              </p>
              <ul className="grid grid-cols-2 gap-1.5">
                {PROVIDERS.map((p) => (
                  <li
                    key={p}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-xs"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold">Choose your experience</h2>
              <div className="space-y-2">
                <label
                  className={
                    "flex gap-3 rounded-xl border p-3 cursor-pointer transition " +
                    (experience === "offline"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50")
                  }
                >
                  <input
                    type="radio"
                    name="experience"
                    value="offline"
                    checked={experience === "offline"}
                    onChange={() => setExperience("offline")}
                    className="mt-1 accent-[color:var(--color-primary)]"
                  />
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      <Wifi className="h-3.5 w-3.5" /> Offline only
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      100% local. No API keys, no network requests. Save, search
                      and organize on your device.
                    </p>
                  </div>
                </label>
                <label
                  className={
                    "flex gap-3 rounded-xl border p-3 cursor-pointer transition " +
                    (experience === "byo-ai"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50")
                  }
                >
                  <input
                    type="radio"
                    name="experience"
                    value="byo-ai"
                    checked={experience === "byo-ai"}
                    onChange={() => setExperience("byo-ai")}
                    className="mt-1 accent-[color:var(--color-primary)]"
                  />
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5" /> Connect your own AI
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Bring your OpenAI, Claude, Gemini, OpenRouter or local
                      Ollama key for summaries, tags and semantic search.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
              <ul className="space-y-2 text-sm">
                {[
                  ["Alt+Shift+S", "Save current conversation"],
                  ["Alt+Shift+P", "Open Memlace popup"],
                  ["Ctrl / ⌘ + K", "Universal search"],
                ].map(([k, label]) => (
                  <li
                    key={k}
                    className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <kbd className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px]">
                      {k}
                    </kbd>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                You can change shortcuts in <span className="font-medium">chrome://extensions/shortcuts</span>.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold">Private by default</h2>
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {[
                  "Everything is stored locally on your device.",
                  "No Memlace account required.",
                  "No telemetry. No analytics.",
                  "No hidden uploads or background sync.",
                  "AI features are opt-in and use your own keys.",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 5 && (
            <div className="text-center space-y-3">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 grid place-items-center">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">You're ready</h2>
              <p className="text-sm text-muted-foreground">
                Open any AI, look for the “Save to Memlace” pill in the composer,
                and your chat lands here instantly.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3 bg-background/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={step === 0}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          {step < 5 ? (
            <Button variant="primary" size="sm" onClick={next}>
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={finish}>
              Open workspace <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
