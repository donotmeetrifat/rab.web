import { createFileRoute } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, Command } from "lucide-react";
import { Button3D, button3dClass } from "@/components/ui/button-3d";

/** Shared focus-ring class — visible only on keyboard focus. */
const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background";


export const Route = createFileRoute("/")({
  component: LandingPage,
});

const providers = ["ChatGPT", "Claude", "Gemini", "DeepSeek", "Perplexity", "Copilot"];

const features = [
  {
    title: "Projects",
    body: "Group chats, files, and context into projects you actually own. Not stored in any AI. Ever.",
  },
  {
    title: "Universal Search",
    body: "One keystroke searches every conversation across every AI. Local, instant, private.",
  },
  {
    title: "Continue in Another AI",
    body: "Move your current chat from ChatGPT to Claude to Gemini in one click. Context comes with you.",
  },
  {
    title: "100% Local",
    body: "No account. No cloud. No telemetry. Your workspace lives on your machine and nowhere else.",
  },
];

const steps = [
  "Download and unzip the extension.",
  "Open chrome://extensions in your browser.",
  "Enable Developer mode in the top-right corner.",
  "Click Load unpacked and choose the unzipped folder.",
];

function LandingPage() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const download = () => {
    setState("loading");
    setError(null);
    fetch("/universal-ai-workspace.zip")
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "universal-ai-workspace.zip";
        a.click();
        URL.revokeObjectURL(a.href);
        setState("idle");
      })
      .catch((err: Error) => {
        setError(err.message);
        setState("error");
      });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <Mark />
          <span className="text-[15px] font-semibold tracking-tight">Memlace</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#install" className="transition-colors hover:text-foreground">
            Install
          </a>
          <a href="#principles" className="transition-colors hover:text-foreground">
            Principles
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-[color:var(--surface)] px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              A place for your AI memory.
            </div>
            <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              Your AI memory,
              <br />
              <span className="text-primary">all in one place.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              Memlace is a private, local-first workspace that keeps your AI conversations,
              projects, and context organized across ChatGPT, Claude, Gemini, DeepSeek, Perplexity,
              Copilot, and future AI assistants.
            </p>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={download}
                disabled={state === "loading"}
                className="btn-3d-primary inline-flex h-12 items-center justify-center rounded-[12px] px-6 text-sm font-semibold tracking-tight"
              >
                {state === "loading" ? "Preparing…" : "Download for Chrome"}
              </button>
              <a
                href="#install"
                className="inline-flex h-11 items-center justify-center rounded-[10px] border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-[color:var(--surface)]"
              >
                Installation Guide
              </a>
            </div>

            {error && (
              <p className="mt-4 text-xs text-destructive">{error}</p>
            )}

            <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Works with
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {providers.map((p) => (
                <span key={p} className="transition-colors hover:text-foreground">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Product frame preview */}
        <section className="pb-24">
          <PreviewFrame />
        </section>

        {/* Features */}
        <section id="features" className="border-t border-border py-20">
          <div className="mb-14 max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Phase 1
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Four things, done properly.
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="bg-background p-8">
                <h3 className="text-base font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Install */}
        <section id="install" className="border-t border-border py-20">
          <div className="grid gap-12 md:grid-cols-[1fr_1.2fr] md:gap-16">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Install
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Four steps. One minute.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Works in any Chromium browser — Chrome, Edge, Brave, Arc, Opera. The Web Store
                listing is on its way.
              </p>
            </div>
            <ol className="space-y-4">
              {steps.map((s, i) => (
                <li
                  key={s}
                  className="flex items-start gap-4 rounded-xl border border-border bg-background p-4"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface)] font-mono text-[11px] text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Principles */}
        <section id="principles" className="border-t border-border py-20">
          <div className="grid gap-10 md:grid-cols-3">
            {[
              ["Everything is local.", "No cloud, no backend, no account. Your data never leaves your device."],
              ["You own everything.", "Projects belong to you — not to OpenAI, not to Anthropic, not to us."],
              ["AI is replaceable.", "Switch providers whenever you want. Your workspace comes with you."],
            ].map(([title, body]) => (
              <div key={title}>
                <h3 className="text-base font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm text-muted-foreground md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <Mark />
            <div className="flex flex-col leading-tight">
              <span className="text-foreground font-semibold tracking-tight">Memlace</span>
              <span className="text-xs">A place for your AI memory.</span>
            </div>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-widest">
            Local · Private · Free
          </p>
        </div>
      </footer>
    </div>
  );
}

function Mark() {
  return (
    <div
      aria-label="Memlace"
      className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-primary font-semibold text-primary-foreground text-[13px] leading-none tracking-tight"
    >
      M
    </div>
  );
}

type Project = {
  id: string;
  name: string;
  dot: string;
  chats: { provider: string; title: string; when: string }[];
};

const PROJECTS: Project[] = [
  {
    id: "thesis",
    name: "Thesis research",
    dot: "bg-primary",
    chats: [
      { provider: "ChatGPT", title: "Literature review — genomic drift", when: "2h ago" },
      { provider: "Claude", title: "Draft: methods section v3", when: "yesterday" },
      { provider: "Gemini", title: "Chart: results comparison", when: "3d ago" },
      { provider: "Perplexity", title: "Citations for section 4", when: "1w ago" },
    ],
  },
  {
    id: "launch",
    name: "Product launch",
    dot: "bg-[oklch(0.7_0.15_150)]",
    chats: [
      { provider: "Claude", title: "Landing page copy — v4", when: "22m ago" },
      { provider: "ChatGPT", title: "Pricing tier rationale", when: "4h ago" },
      { provider: "DeepSeek", title: "Cold email variants", when: "2d ago" },
    ],
  },
  {
    id: "kyoto",
    name: "Trip to Kyoto",
    dot: "bg-[oklch(0.75_0.15_60)]",
    chats: [
      { provider: "Perplexity", title: "Ryokan recommendations, Higashiyama", when: "1h ago" },
      { provider: "Gemini", title: "7-day itinerary, cherry blossom", when: "yesterday" },
      { provider: "ChatGPT", title: "Vegetarian kaiseki spots", when: "4d ago" },
      { provider: "Claude", title: "Kanji phrasebook essentials", when: "1w ago" },
    ],
  },
];

const NAV = ["Home", "Projects", "Search", "Recent", "Settings"];
const PROVIDERS = ["Claude", "Gemini", "ChatGPT", "Perplexity", "DeepSeek"];

function PreviewFrame() {
  const [activeNav, setActiveNav] = useState("Projects");
  const [activeProjectId, setActiveProjectId] = useState(PROJECTS[0].id);
  const [providerIdx, setProviderIdx] = useState(0);



  const project = useMemo(
    () => PROJECTS.find((p) => p.id === activeProjectId) ?? PROJECTS[0],
    [activeProjectId],
  );

  const cycleProvider = useCallback(() => {
    setProviderIdx((prev) => (prev + 1) % PROVIDERS.length);
  }, []);


  return (
    <div
      role="region"
      aria-label="Memlace popup preview"
      className="group/frame relative overflow-hidden rounded-2xl border border-border bg-[color:var(--surface)] shadow-[var(--shadow-soft)] transition-shadow duration-500 focus-within:shadow-[0_2px_4px_oklch(0_0_0/0.04),0_24px_56px_-16px_oklch(0_0_0/0.18)] hover:shadow-[0_2px_4px_oklch(0_0_0/0.04),0_24px_56px_-16px_oklch(0_0_0/0.14)]"
    >


      {/* Chrome */}
      <div className="flex items-center gap-1.5 border-b border-border bg-background/60 px-4 py-3 backdrop-blur">
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--hairline)] transition-colors group-hover/frame:bg-[oklch(0.75_0.18_25)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--hairline)] transition-colors group-hover/frame:bg-[oklch(0.82_0.16_85)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--hairline)] transition-colors group-hover/frame:bg-[oklch(0.78_0.16_145)]" />
        <span className="ml-4 font-mono text-[11px] text-muted-foreground">
          extension · popup
        </span>
        <div className="ml-auto flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Live
          </span>
        </div>
      </div>

      <div className="grid gap-px bg-border md:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside className="bg-background p-4" aria-label="Workspace sidebar">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-primary text-primary-foreground text-[11px] font-semibold leading-none tracking-tight transition-transform duration-300 hover:rotate-6">
              M
            </div>
            <span className="text-xs font-medium">Memlace</span>
            <kbd className="ml-auto hidden items-center gap-1 rounded border border-border bg-[color:var(--surface)] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline-flex">
              <Command className="h-2.5 w-2.5" aria-hidden />K
            </kbd>
          </div>

          {/* Fake search */}
          <button
            type="button"
            onClick={() => setActiveNav("Search")}
            aria-label="Open universal search"

            className={
              "mb-4 flex w-full items-center gap-2 rounded-md border border-border bg-[color:var(--surface)]/60 px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:bg-[color:var(--surface)] " +
              focusRing
            }
          >
            <Search className="h-3 w-3" aria-hidden />
            <span>Search everything…</span>
          </button>

          <nav aria-label="Primary">
            <ul
              role="menu"
              aria-label="Sections"
              className="space-y-0.5 text-sm"
            >

              {NAV.map((item, i) => {
                const active = item === activeNav;
                return (
                  <li key={item} role="none">
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setActiveNav(item)}

                      className={
                        "group/nav flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all duration-200 " +
                        focusRing +
                        " " +
                        (active
                          ? "bg-[color:var(--surface)] text-foreground"
                          : "text-muted-foreground hover:bg-[color:var(--surface)]/70 hover:text-foreground")
                      }
                    >
                      <span
                        aria-hidden
                        className={
                          "h-1.5 w-1.5 rounded-full transition-all duration-300 " +
                          (active ? "bg-primary scale-100" : "bg-current opacity-40 scale-75")
                        }
                      />
                      <span>{item}</span>
                      <ArrowRight
                        aria-hidden
                        className={
                          "ml-auto h-3 w-3 transition-all duration-200 " +
                          (active
                            ? "opacity-60 translate-x-0"
                            : "opacity-0 -translate-x-1 group-hover/nav:opacity-40 group-hover/nav:translate-x-0")
                        }
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-6">
            <div
              id="projects-heading"
              className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              <span>Projects</span>
              <span className="opacity-60" aria-label={`${PROJECTS.length} projects`}>
                {PROJECTS.length}
              </span>
            </div>
            <ul
              role="listbox"
              aria-labelledby="projects-heading"
              aria-activedescendant={`project-${activeProjectId}`}
              className="space-y-0.5 text-sm"
            >
              {PROJECTS.map((p) => {
                const active = p.id === activeProjectId;
                return (
                  <li key={p.id} role="none">
                    <button
                      type="button"
                      id={`project-${p.id}`}
                      role="option"
                      aria-selected={active}
                      onClick={() => setActiveProjectId(p.id)}

                      className={
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all duration-200 " +
                        focusRing +
                        " " +
                        (active
                          ? "bg-[color:var(--surface)] text-foreground"
                          : "text-muted-foreground hover:bg-[color:var(--surface)]/70 hover:text-foreground")
                      }
                    >
                      <span
                        aria-hidden
                        className={
                          `h-2 w-2 rounded-full ${p.dot} transition-transform duration-200 ` +
                          (active
                            ? "scale-110 ring-2 ring-offset-1 ring-offset-background ring-current/20"
                            : "")
                        }
                      />
                      <span className="truncate">{p.name}</span>
                      <span
                        className="ml-auto font-mono text-[10px] text-muted-foreground/70"
                        aria-label={`${p.chats.length} chats`}
                      >
                        {p.chats.length}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Main pane */}
        <section
          className="relative bg-background p-6"
          aria-labelledby="active-project-heading"
        >
          <div className="flex items-start justify-between gap-4">
            <div key={project.id} className="animate-fade-in">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Project · {project.chats.length} chats
              </p>
              <h3
                id="active-project-heading"
                className="mt-1 text-lg font-semibold tracking-tight"
              >
                {project.name}
              </h3>
            </div>
            <button
              type="button"
              onClick={cycleProvider}
              aria-label={`Continue in ${PROVIDERS[providerIdx]}. Press to cycle provider.`}
              className={
                "btn-3d-primary group/cta inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold " +
                focusRing
              }
            >
              <span className="relative">
                Continue in{" "}
                <span
                  key={PROVIDERS[providerIdx]}
                  className="inline-block animate-fade-in font-semibold"
                >
                  {PROVIDERS[providerIdx]}
                </span>
              </span>
              <ArrowRight
                aria-hidden
                className="h-3 w-3 transition-transform duration-200 group-hover/cta:translate-x-0.5"
              />
            </button>
          </div>

          <ul
            aria-label={`Chats in ${project.name}`}
            className="mt-5 space-y-1.5 [contain:layout_paint]"
          >
            {project.chats.map((c, i) => (
              <ChatRow
                key={`${project.id}-${c.title}`}
                chat={c}
                index={i}
              />
            ))}
          </ul>


          {/* Ambient gradient wash */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent"
          />
        </section>
      </div>

      
    </div>
  );
}

const PROVIDER_TONES: Record<string, string> = {
  ChatGPT: "text-[oklch(0.55_0.14_160)]",
  Claude: "text-[oklch(0.55_0.15_45)]",
  Gemini: "text-[oklch(0.55_0.18_255)]",
  Perplexity: "text-[oklch(0.55_0.13_215)]",
  DeepSeek: "text-[oklch(0.5_0.18_285)]",
  Copilot: "text-[oklch(0.5_0.02_260)]",
};

const ProviderChip = memo(function ProviderChip({ name }: { name: string }) {
  const tone = PROVIDER_TONES[name] ?? "text-muted-foreground";
  return (
    <span
      className={
        "rounded-md bg-[color:var(--surface)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider " +
        tone
      }
    >
      {name}
    </span>
  );
});

type ChatRowProps = {
  chat: { provider: string; title: string; when: string };
  index: number;
};

/** Memoized row. Cap entrance-animation stagger at 10 rows so long lists
 *  don't queue up seconds of transitions, and use content-visibility so
 *  off-screen rows skip layout/paint entirely. */
const ChatRow = memo(function ChatRow({ chat, index }: ChatRowProps) {
  const staggered = index < 10;
  return (
    <li
      role="none"
      className="[content-visibility:auto] [contain-intrinsic-size:auto_44px]"
    >
      <button
        type="button"
        aria-label={`${chat.title}, from ${chat.provider}, ${chat.when}`}
        style={
          staggered
            ? { animationDelay: `${index * 40}ms`, animationFillMode: "backwards" }
            : undefined
        }
        className={
          "group/row flex w-full transform-gpu items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-px hover:border-primary/30 hover:bg-[color:var(--surface)] hover:shadow-[0_2px_10px_-6px_oklch(0_0_0/0.15)] " +
          (staggered ? "animate-fade-in " : "") +
          focusRing
        }
      >
        <span className="flex min-w-0 items-center gap-3">
          <ProviderChip name={chat.provider} />
          <span className="truncate text-sm">{chat.title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">{chat.when}</span>
          <ArrowRight
            aria-hidden
            className="h-3 w-3 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-200 group-hover/row:translate-x-0 group-hover/row:opacity-100 group-focus-visible/row:translate-x-0 group-focus-visible/row:opacity-100"
          />
        </span>
      </button>
    </li>
  );
});


