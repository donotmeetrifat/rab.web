import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { useMemlace } from "@/store/useMemlace";
import { PROVIDERS } from "@/lib/providers";
import { exportAll, importAll, storageEstimate } from "@/services/memories";
import type { ProviderId, Settings } from "@/types";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function OptionsApp() {
  const bootstrap = useMemlace((s) => s.bootstrap);
  const settings = useMemlace((s) => s.settings);
  const updateSettings = useMemlace((s) => s.updateSettings);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    bootstrap();
    storageEstimate().then(setStorage);
  }, [bootstrap]);

  const setTheme = (theme: Settings["theme"]) => {
    updateSettings({ theme });
    document.documentElement.classList.toggle(
      "dark",
      theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches),
    );
  };

  useEffect(() => {
    setTheme(settings.theme);
    // only when settings.theme changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.theme]);

  const doExport = async () => {
    const json = await exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memlace-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Export downloaded.");
  };

  const doImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const { projects, memories } = await importAll(text);
        setMessage(`Imported ${projects} project(s) and ${memories} memor${memories === 1 ? "y" : "ies"}.`);
      } catch (err) {
        setMessage(err instanceof Error ? `Import failed: ${err.message}` : "Import failed.");
      }
    };
    input.click();
  };

  const clearAll = async () => {
    if (!window.confirm("This deletes all Memlace data on this device. Continue?")) return;
    const { db } = await import("@/lib/db");
    await db.delete();
    window.location.reload();
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-6 py-4">
          <Logo size={28} />
          <div>
            <h1 className="text-base font-semibold tracking-tight">Memlace settings</h1>
            <p className="text-xs text-muted-foreground">A place for your AI memory.</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {message && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
            {message}
          </div>
        )}

        <Section title="Theme" description="Choose how Memlace looks in the popup, side panel, and this page.">
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <Button
                key={t}
                variant={settings.theme === t ? "primary" : "secondary"}
                onClick={() => setTheme(t)}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </Button>
            ))}
          </div>
        </Section>

        <Section title="Default provider" description="Used when a captured memory has no known source.">
          <select
            value={settings.defaultProvider}
            onChange={(e) => updateSettings({ defaultProvider: e.target.value as ProviderId })}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Section>

        <Section title="Shortcuts" description="Trigger Memlace anywhere without leaving the page.">
          <dl className="grid grid-cols-[1fr_auto] gap-y-2 gap-x-6 text-sm max-w-md">
            <dt className="text-muted-foreground">Capture selection</dt>
            <dd><Kbd>{settings.shortcutCapture}</Kbd></dd>
            <dt className="text-muted-foreground">Open popup</dt>
            <dd><Kbd>{settings.shortcutOpenPopup}</Kbd></dd>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            You can rebind the popup shortcut in <code>chrome://extensions/shortcuts</code>.
          </p>
        </Section>

        <Section title="Import & export" description="Move your memories between devices as a JSON file.">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={doExport}>Export data</Button>
            <Button variant="secondary" onClick={doImport}>Import data</Button>
          </div>
        </Section>

        <Section title="Privacy" description="Memlace stores everything on this device. Nothing is sent to a server.">
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>All memories live in IndexedDB on your machine.</li>
            <li>Settings live in <code>chrome.storage.local</code>.</li>
            <li>No analytics, no accounts, no cloud sync.</li>
          </ul>
        </Section>

        <Section title="Storage" description="Local usage on this device.">
          {storage ? (
            <div className="max-w-md">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{formatBytes(storage.usage)} used</span>
                <span>{formatBytes(storage.quota)} available</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, storage.quota ? (storage.usage / storage.quota) * 100 : 0)}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Storage estimate unavailable.</p>
          )}
          <div className="mt-4">
            <Button variant="danger" onClick={clearAll}>Delete all local data</Button>
          </div>
        </Section>

        <footer className="pt-6 border-t border-border text-xs text-muted-foreground">
          Memlace · Version {settings.version} · Local · Private · Free
        </footer>
      </main>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground">
      {children}
    </kbd>
  );
}
