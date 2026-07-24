import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

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
          <span className="text-[15px] font-semibold tracking-tight">Universal AI Workspace</span>
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
              Local-first. Free forever.
            </div>
            <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              One brain.
              <br />
              <span className="text-primary">Every AI.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              A browser extension that gives you a permanent workspace across every AI assistant.
              Your projects, memory, and context stay with you — not with any single provider.
            </p>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={download}
                disabled={state === "loading"}
                className="inline-flex h-11 items-center justify-center rounded-[10px] bg-foreground px-5 text-sm font-medium text-background shadow-[var(--shadow-soft)] transition-all duration-150 hover:opacity-90 disabled:opacity-60"
              >
                {state === "loading" ? "Preparing…" : "Download for Chrome"}
                <span className="ml-2 text-background/60">·</span>
                <span className="ml-2 text-background/70">.zip</span>
              </button>
              <a
                href="#install"
                className="inline-flex h-11 items-center justify-center rounded-[10px] border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-[color:var(--surface)]"
              >
                Install guide
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
          <div className="flex items-center gap-2">
            <Mark />
            <span>Universal AI Workspace</span>
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
    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground">
      <div className="h-2.5 w-2.5 rounded-[3px] bg-primary" />
    </div>
  );
}

function PreviewFrame() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-1.5 border-b border-border bg-background/50 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--hairline)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--hairline)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--hairline)]" />
        <span className="ml-4 font-mono text-[11px] text-muted-foreground">
          extension · popup
        </span>
      </div>
      <div className="grid gap-px bg-border md:grid-cols-[220px_1fr]">
        <aside className="bg-background p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-foreground" />
            <span className="text-xs font-medium">Workspace</span>
          </div>
          <nav className="space-y-1 text-sm">
            {["Home", "Projects", "Search", "Recent", "Settings"].map((item, i) => (
              <div
                key={item}
                className={
                  "flex items-center gap-2 rounded-md px-2 py-1.5 " +
                  (i === 1
                    ? "bg-[color:var(--surface)] text-foreground"
                    : "text-muted-foreground")
                }
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                {item}
              </div>
            ))}
          </nav>
          <div className="mt-6">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Projects
            </p>
            <div className="space-y-1 text-sm">
              {[
                ["Thesis research", "bg-primary"],
                ["Product launch", "bg-[oklch(0.7_0.15_150)]"],
                ["Trip to Kyoto", "bg-[oklch(0.75_0.15_60)]"],
              ].map(([name, dot]) => (
                <div key={name} className="flex items-center gap-2 rounded-md px-2 py-1.5">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  <span className="truncate">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
        <section className="bg-background p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Project
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight">Thesis research</h3>
            </div>
            <button className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground">
              Continue in Claude →
            </button>
          </div>
          <div className="mt-5 space-y-2">
            {[
              ["ChatGPT", "Literature review — genomic drift", "2h ago"],
              ["Claude", "Draft: methods section v3", "yesterday"],
              ["Gemini", "Chart: results comparison", "3d ago"],
              ["Perplexity", "Citations for section 4", "1w ago"],
            ].map(([provider, title, when]) => (
              <div
                key={title}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:bg-[color:var(--surface)]"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-[color:var(--surface)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {provider}
                  </span>
                  <span className="text-sm">{title}</span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">{when}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
