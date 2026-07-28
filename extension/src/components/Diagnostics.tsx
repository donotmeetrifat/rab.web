import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { MEMLACE_VERSION } from "@/services/onboarding";
import { loadAISettings } from "@/ai/AISettings";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { exportAll, importAll } from "@/services/memories";
import { PROVIDERS } from "@/lib/providers";
import { collectPieStats } from "@/pie";
import type { PieStats } from "@/pie/types";
import { readLiveEventDiag, subscribeLiveEvents, type LiveEventDiag } from "@/core/liveEvents";


type Stats = {
  memories: number;
  projects: number;
  tags: number;
  conversations: number;
  messages: number;
  knowledge: number;
  entities: number;
  aiSummaries: number;
  aiEmbeddings: number;
  bytesUsed: number | null;
  bytesQuota: number | null;
  aiEnabled: boolean;
  aiProvider: string;
  dbVersion: number;
  userAgent: string;
};

function fmtBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function collect(): Promise<Stats> {
  const [
    memories, projects, tags, conversations, messages,
    knowledge, entities, aiSummaries, aiEmbeddings,
  ] = await Promise.all([
    db.memories.count(),
    db.projects.count(),
    db.memories.orderBy("tags").uniqueKeys().then((keys) => keys.length),
    db.conversations.count(),
    db.convMessages.count(),
    db.knowledge.count(),
    db.entities.count(),
    db.aiSummaries.count(),
    db.aiEmbeddings.count(),
  ]);
  console.log("[Memlace Diagnostics] Conversation count", conversations);
  let bytesUsed: number | null = null;
  let bytesQuota: number | null = null;
  try {
    const est = await navigator.storage?.estimate?.();
    if (est) {
      bytesUsed = est.usage ?? null;
      bytesQuota = est.quota ?? null;
    }
  } catch { /* ignore */ }
  const ai = await loadAISettings();
  return {
    memories, projects, tags, conversations, messages,
    knowledge, entities, aiSummaries, aiEmbeddings,
    bytesUsed, bytesQuota,
    aiEnabled: ai.enabled,
    aiProvider: ai.provider ?? "none",
    dbVersion: (db as unknown as { verno: number }).verno,
    userAgent: navigator.userAgent,
  };
}

export function Diagnostics() {
  const toast = useToast();
  const [s, setS] = useState<Stats | null>(null);
  const [pie, setPie] = useState<PieStats | null>(null);
  const [live, setLive] = useState<LiveEventDiag>(() => readLiveEventDiag());
  const [busy, setBusy] = useState(false);
  const refresh = () => {
    void collect().then(setS);
    void collectPieStats().then(setPie);
    setLive(readLiveEventDiag());
  };
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const unsub = subscribeLiveEvents(() => setLive(readLiveEventDiag()));
    const id = window.setInterval(() => setLive(readLiveEventDiag()), 2000);
    return () => { unsub(); window.clearInterval(id); };
  }, []);


  const backup = async () => {
    setBusy(true);
    try {
      const json = await exportAll();
      const blob = new Blob([json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `memlace-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Backup ready", "Store the file somewhere safe.");
    } catch (err) {
      toast.error("Backup failed", err instanceof Error ? err.message : undefined);
    } finally { setBusy(false); }
  };

  const restore = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setBusy(true);
      try {
        const text = await f.text();
        JSON.parse(text); // integrity: must parse
        const res = await importAll(text, { restoreSettings: true });
        toast.success(
          "Restore complete",
          `Memories +${res.memories} · Chats +${res.conversations}`,
        );
        refresh();
      } catch (err) {
        toast.error("Restore failed", err instanceof Error ? err.message : "Invalid backup file.");
      } finally { setBusy(false); }
    };
    input.click();
  };

  const copyReport = async () => {
    if (!s) return;
    const report = JSON.stringify({ version: MEMLACE_VERSION, ...s, pie }, null, 2);
    await navigator.clipboard.writeText(report);
    toast.success("Diagnostics copied");
  };

  if (!s) return <div className="p-6 text-sm text-muted-foreground">Collecting diagnostics…</div>;

  const rows: Array<[string, string | number]> = [
    ["Extension version", MEMLACE_VERSION],
    ["Database version", `v${s.dbVersion}`],
    ["Browser", s.userAgent.slice(0, 80)],
    ["Storage used", `${fmtBytes(s.bytesUsed)} / ${fmtBytes(s.bytesQuota)}`],
    ["Memories", s.memories],
    ["Projects", s.projects],
    ["Tags", s.tags],
    ["Conversations", s.conversations],
    ["Messages", s.messages],
    ["Knowledge records", s.knowledge],
    ["Entities indexed", s.entities],
    ["AI summaries", s.aiSummaries],
    ["AI embeddings", s.aiEmbeddings],
    ["AI enabled", s.aiEnabled ? "Yes" : "No"],
    ["AI provider", s.aiProvider],
    ["Supported providers", PROVIDERS.length],
  ];

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Diagnostics</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Local-only. Nothing here is sent anywhere — copy the report yourself if you want to share it.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-surface">
        <dl className="divide-y divide-border">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-4 py-2 text-xs">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium text-foreground tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {pie && (
        <section className="rounded-lg border border-border bg-surface">
          <header className="px-4 py-2 border-b border-border">
            <h3 className="text-sm font-semibold">Personal Intelligence</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Learned quietly from your own work. Stays on this device.
            </p>
          </header>
          <dl className="divide-y divide-border">
            {([
              ["Preferences learned", pie.preferences],
              ["Decisions tracked", pie.decisions],
              ["Goals", pie.goals],
              ["Vocabulary shortcuts", pie.vocabulary],
              ["Connections", pie.relationships],
              ["Confident topics", pie.confident],
              ["Most-used AI", pie.topProvider ?? "—"],
              ["Top language", pie.topLanguage ?? "—"],
              ["Top framework", pie.topFramework ?? "—"],
            ] as Array<[string, string | number]>).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-2 text-xs">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium text-foreground tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}


      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Backup</h3>
        <p className="text-xs text-muted-foreground">
          One-click full export and restore. Restore validates the file before applying and skips duplicates.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={backup} disabled={busy}>Download full backup</Button>
          <Button variant="secondary" onClick={restore} disabled={busy}>Restore from file</Button>
          <Button variant="ghost" onClick={copyReport}>Copy diagnostics</Button>
          <Button variant="ghost" onClick={refresh}>Refresh</Button>
        </div>
      </section>
    </div>
  );
}
