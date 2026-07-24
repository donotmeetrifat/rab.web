import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { useMemlace } from "@/store/useMemlace";
import { useThemeSync } from "@/hooks/useThemeSync";
import { PROVIDERS } from "@/lib/providers";
import {
  counts,
  estimateExportSize,
  exportAll,
  importAll,
  storageEstimate,
} from "@/services/memories";
import type { ProviderId, Settings } from "@/types";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function OptionsApp() {
  useThemeSync();
  const toast = useToast();

  const bootstrap = useMemlace((s) => s.bootstrap);
  const settings = useMemlace((s) => s.settings);
  const updateSettings = useMemlace((s) => s.updateSettings);
  const resetSettings = useMemlace((s) => s.resetSettings);

  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [stats, setStats] = useState<{
    projects: number;
    memories: number;
    trashed: number;
    conversations: number;
    messages: number;
  } | null>(null);
  const [exportSize, setExportSize] = useState<number | null>(null);
  const [restoreSettings, setRestoreSettings] = useState(false);

  useEffect(() => {
    bootstrap();
    void storageEstimate().then(setStorage);
    void counts().then(setStats);
    void estimateExportSize().then(setExportSize).catch(() => setExportSize(null));
  }, [bootstrap]);

  const refreshStats = async () => {
    setStorage(await storageEstimate());
    setStats(await counts());
    try {
      setExportSize(await estimateExportSize());
    } catch {
      setExportSize(null);
    }
  };

  const doExport = async () => {
    try {
      const json = await exportAll();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memlace-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error("Export failed", err instanceof Error ? err.message : undefined);
    }
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
        const res = await importAll(text, { restoreSettings });
        const parts = [
          `${res.projects} project${res.projects === 1 ? "" : "s"}`,
          `${res.memories} memor${res.memories === 1 ? "y" : "ies"}`,
          `${res.conversations} conversation${res.conversations === 1 ? "" : "s"}`,
          `${res.messages} message${res.messages === 1 ? "" : "s"}`,
        ];
        const detailBits: string[] = [];
        if (res.skipped > 0)
          detailBits.push(`${res.skipped} invalid record${res.skipped === 1 ? "" : "s"} skipped`);
        if (res.settingsApplied) detailBits.push("settings restored");
        toast.success(`Imported ${parts.join(", ")}`, detailBits.join(" · ") || undefined);
        await refreshStats();
      } catch (err) {
        toast.error("Import failed", err instanceof Error ? err.message : "Invalid JSON");
      }
    };
    input.click();
  };

  const clearAll = async () => {
    if (!window.confirm("This deletes all Memlace data on this device. Continue?")) return;
    try {
      const { db } = await import("@/lib/db");
      await db.delete();
      toast.success("All data deleted");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      toast.error("Delete failed", err instanceof Error ? err.message : undefined);
    }
  };

  const doResetSettings = async () => {
    if (!window.confirm("Reset all settings to defaults? Your memories are kept.")) return;
    await resetSettings();
    toast.success("Settings reset");
  };

  const openShortcuts = () => {
    chrome.tabs?.create?.({ url: "chrome://extensions/shortcuts" });
  };

  const storagePct = storage && storage.quota
    ? Math.min(100, Math.round((storage.usage / storage.quota) * 100))
    : 0;

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
        <Section title="Appearance" description="Choose how Memlace looks in the popup, side panel, and this page.">
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <Button
                key={t}
                variant={settings.theme === t ? "primary" : "secondary"}
                onClick={() => updateSettings({ theme: t })}
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

        <Section
          title="Conversation capture"
          description="Control what Memlace records when you save an AI chat. Everything stays on this device — nothing is uploaded."
        >
          <div className="space-y-3">
            <Toggle
              label="Auto-save conversations"
              hint="Silently keep saved chats in sync with the AI website as you talk. When off, use the “Save to Memlace” button on the page."
              checked={settings.autoSaveConversations}
              disabled={settings.saveConversationsManualOnly}
              onChange={(v) => updateSettings({ autoSaveConversations: v })}
            />
            <Toggle
              label="Save images"
              hint="Store URLs of images that appear in messages so they render inside Memlace. The image files themselves stay on the provider’s servers."
              checked={settings.saveImages}
              onChange={(v) => updateSettings({ saveImages: v })}
            />
            <Toggle
              label="Save attachments"
              hint="Store filenames and metadata for files you attached in the chat. File contents are not downloaded."
              checked={settings.saveAttachments}
              onChange={(v) => updateSettings({ saveAttachments: v })}
            />
            <Toggle
              label="Show save notifications"
              hint="Get a small system notification whenever a chat is saved to Memlace."
              checked={settings.notificationsEnabled}
              onChange={(v) => updateSettings({ notificationsEnabled: v })}
            />
            <Toggle
              label="Save only manually selected chats"
              hint="Strict privacy mode: Memlace will never save a conversation automatically, even if auto-save is on. Only the “Save to Memlace” button will store anything."
              checked={settings.saveConversationsManualOnly}
              onChange={(v) => updateSettings({ saveConversationsManualOnly: v })}
            />
          </div>
        </Section>

        <Section title="Keyboard shortcuts" description="Trigger Memlace anywhere without leaving the page.">
          <dl className="grid grid-cols-[1fr_auto] gap-y-2 gap-x-6 text-sm max-w-md">
            <dt className="text-muted-foreground">Open Memlace</dt>
            <dd><Kbd>{settings.shortcutOpenPopup}</Kbd></dd>
            <dt className="text-muted-foreground">Save selection</dt>
            <dd><Kbd>{settings.shortcutCapture}</Kbd></dd>
          </dl>
          <div className="mt-3">
            <Button variant="secondary" onClick={openShortcuts}>
              Customize shortcuts
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Opens <code>chrome://extensions/shortcuts</code> where you can rebind or clear any command.
            </p>
          </div>
        </Section>

        <Section title="Storage" description="Everything stays on this device — nothing is ever uploaded.">
          <div className="grid grid-cols-3 gap-3 text-sm sm:grid-cols-5">
            <Stat label="Projects" value={stats?.projects ?? "—"} />
            <Stat label="Memories" value={stats?.memories ?? "—"} />
            <Stat label="Trashed" value={stats?.trashed ?? "—"} />
            <Stat label="Chats" value={stats?.conversations ?? "—"} />
            <Stat label="Messages" value={stats?.messages ?? "—"} />
          </div>
          {storage && storage.quota > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Used {formatBytes(storage.usage)}</span>
                <span>of {formatBytes(storage.quota)} ({storagePct}%)</span>
              </div>
              <div
                className="mt-1 h-2 rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={storagePct}
              >
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#2563eb,#0ea5e9)] transition-[width] duration-500"
                  style={{ width: `${storagePct}%` }}
                />
              </div>
            </div>
          )}
        </Section>

        <Section
          title="Import & export"
          description="Move projects, memories, and saved chats between devices as a single JSON file."
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={doExport}>Export data</Button>
            <Button variant="secondary" onClick={doImport}>Import data</Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
            <BackupStat label="Projects" value={stats?.projects ?? "—"} />
            <BackupStat label="Memories" value={stats?.memories ?? "—"} />
            <BackupStat label="Chats" value={stats?.conversations ?? "—"} />
            <BackupStat
              label="Est. export size"
              value={exportSize == null ? "—" : formatBytes(exportSize)}
            />
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={restoreSettings}
              onChange={(e) => setRestoreSettings(e.target.checked)}
              className="h-3.5 w-3.5 accent-[color:var(--color-primary)]"
            />
            Also restore settings from the imported file
          </label>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Duplicate chats are matched by provider and conversation id — nothing is overwritten unless it's newer.
          </p>
        </Section>

        <Section title="Danger zone" description="These actions can't be undone.">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={doResetSettings}>Reset settings</Button>
            <Button variant="danger" onClick={clearAll}>Delete all data</Button>
          </div>
        </Section>

        <p className="text-[11px] text-muted-foreground pt-4 border-t border-border">
          Memlace v{settings.version} · Local-first · No telemetry
        </p>
      </main>
    </div>
  );
}

function Section({
  title, description, children,
}: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function BackupStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}


function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-mono">
      {children}
    </kbd>
  );
}

export type { Settings };
