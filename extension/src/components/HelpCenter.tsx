import { useState, type ReactNode } from "react";
import {
  BookOpen,
  Keyboard,
  HelpCircle,
  ShieldCheck,
  Wrench,
  ChevronDown,
  Sparkles,
  Info,
} from "lucide-react";
import { MEMLACE_VERSION, CHANGELOG_LINK } from "@/services/onboarding-help";
import { CHANGELOG } from "@/components/onboarding/WhatsNew";

interface Section {
  id: string;
  title: string;
  icon: typeof BookOpen;
  body: ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "getting-started",
    title: "Getting started",
    icon: BookOpen,
    body: (
      <ol className="list-decimal pl-4 space-y-1.5 text-xs text-muted-foreground">
        <li>Open any supported AI (ChatGPT, Claude, Gemini, …).</li>
        <li>Look for the <b>Save to Memlace</b> pill in the composer.</li>
        <li>Your conversation is saved locally and appears in the Chats tab.</li>
        <li>Group chats into projects, search with ⌘K, or continue in another AI.</li>
      </ol>
    ),
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts",
    icon: Keyboard,
    body: (
      <ul className="space-y-1.5 text-xs">
        {[
          ["Alt+Shift+S", "Save current conversation"],
          ["Alt+Shift+P", "Open Memlace popup"],
          ["Ctrl / ⌘ + K", "Universal search"],
          ["Esc", "Close dialogs / palette"],
        ].map(([k, l]) => (
          <li key={k} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{l}</span>
            <kbd className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px]">
              {k}
            </kbd>
          </li>
        ))}
      </ul>
    ),
  },
  {
    id: "supported",
    title: "Supported AI",
    icon: Sparkles,
    body: (
      <p className="text-xs text-muted-foreground">
        ChatGPT, Claude, Gemini, DeepSeek, Perplexity, Microsoft Copilot and
        Google AI Studio. Each has a native <em>Save to Memlace</em> button.
      </p>
    ),
  },
  {
    id: "faq",
    title: "FAQ",
    icon: HelpCircle,
    body: (
      <div className="space-y-3 text-xs">
        <div>
          <b>Where are my conversations stored?</b>
          <p className="text-muted-foreground mt-0.5">
            Locally in this browser's IndexedDB. Nothing leaves your device
            unless you enable optional AI features with your own key.
          </p>
        </div>
        <div>
          <b>Does Memlace need an account?</b>
          <p className="text-muted-foreground mt-0.5">No account, no login, no cloud sync.</p>
        </div>
        <div>
          <b>How do I back up my data?</b>
          <p className="text-muted-foreground mt-0.5">
            Open Settings → Import / Export to download a JSON backup.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "troubleshoot",
    title: "Troubleshooting",
    icon: Wrench,
    body: (
      <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
        <li>“Save” button missing? Refresh the AI tab — SPA nav sometimes hides it briefly.</li>
        <li>Shortcut not firing? Reassign it at <code>chrome://extensions/shortcuts</code>.</li>
        <li>Storage almost full? Export a backup, then clear old items from Trash.</li>
        <li>AI features failing? Re-check your API key in Settings → AI.</li>
      </ul>
    ),
  },
  {
    id: "privacy",
    title: "Privacy",
    icon: ShieldCheck,
    body: (
      <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
        <li>All data is stored locally in your browser.</li>
        <li>No telemetry, no analytics, no crash reporting.</li>
        <li>AI calls (when enabled) go directly from your browser to the provider you chose.</li>
        <li>Uninstalling the extension deletes all local data.</li>
      </ul>
    ),
  },
  {
    id: "version",
    title: "Version & changelog",
    icon: Info,
    body: (
      <div className="space-y-2 text-xs">
        <div className="text-muted-foreground">
          You’re on Memlace <b>v{MEMLACE_VERSION}</b>.
        </div>
        <div className="space-y-2">
          {CHANGELOG.map((e) => (
            <div key={e.version} className="rounded-lg border border-border p-2.5">
              <div className="text-[11px] font-semibold">
                v{e.version} · <span className="text-muted-foreground font-normal">{e.date}</span>
              </div>
              <ul className="mt-1 space-y-1">
                {e.highlights.map((h) => (
                  <li key={h} className="text-muted-foreground flex gap-1.5">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <a
          href={CHANGELOG_LINK}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline text-[11px]"
        >
          Full changelog →
        </a>
      </div>
    ),
  },
];

export function HelpCenter() {
  const [openId, setOpenId] = useState<string>("getting-started");

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <HelpCircle className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold">Help Center</h1>
      </header>
      <div className="flex-1 overflow-y-auto scroll-thin px-4 py-4 space-y-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const open = openId === s.id;
          return (
            <section
              key={s.id}
              className="rounded-xl border border-border bg-background"
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? "" : s.id)}
                aria-expanded={open}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
              >
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium flex-1">{s.title}</span>
                <ChevronDown
                  className={
                    "h-3.5 w-3.5 text-muted-foreground transition-transform " +
                    (open ? "rotate-180" : "")
                  }
                />
              </button>
              {open && (
                <div className="px-3 pb-3 pt-1 border-t border-border">
                  {s.body}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
