import { useEffect, useState } from "react";
import { Check, Circle, Sparkles } from "lucide-react";
import {
  checklistProgress,
  loadOnboarding,
  subscribeOnboarding,
  type ChecklistState,
  type OnboardingState,
} from "@/services/onboarding";

const ITEMS: {
  key: keyof ChecklistState | "install";
  title: string;
  hint: string;
}[] = [
  { key: "install", title: "Install complete", hint: "Memlace is installed and running." },
  { key: "savedConversation", title: "Save your first conversation", hint: "Open ChatGPT (or any supported AI) and hit “Save to Memlace”." },
  { key: "createdProject", title: "Create your first project", hint: "Group related chats and notes into projects from the sidebar." },
  { key: "usedSearch", title: "Try universal search", hint: "Press Ctrl / ⌘ + K anywhere to search everything." },
  { key: "continuedElsewhere", title: "Continue in another AI", hint: "Open a saved chat and pick a different provider to hand off context." },
  { key: "enabledAI", title: "Enable AI (optional)", hint: "Add your own API key to unlock summaries and semantic search." },
];

export function ChecklistPanel({ onJump }: { onJump?: (target: string) => void }) {
  const [state, setState] = useState<OnboardingState | null>(null);

  useEffect(() => {
    void loadOnboarding().then(setState);
    return subscribeOnboarding(setState);
  }, []);

  if (!state) return null;
  const progress = checklistProgress(state.checklist);

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold">Get started</h1>
        <span className="ml-2 text-[10px] text-muted-foreground">
          {progress}% complete
        </span>
      </header>
      <div className="px-4 pt-3">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto scroll-thin px-4 py-4 space-y-2">
        {ITEMS.map((item) => {
          const done =
            item.key === "install" ? true : state.checklist[item.key];
          return (
            <li
              key={item.key}
              className={
                "rounded-xl border p-3 flex gap-3 " +
                (done
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-background")
              }
            >
              <div
                className={
                  "mt-0.5 h-5 w-5 shrink-0 rounded-full grid place-items-center " +
                  (done ? "bg-primary text-white" : "bg-muted text-muted-foreground")
                }
              >
                {done ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.title}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{item.hint}</p>
              </div>
              {!done && item.key === "usedSearch" && (
                <button
                  type="button"
                  onClick={() => onJump?.("search")}
                  className="self-start text-[11px] text-primary hover:underline"
                >
                  Try it
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
