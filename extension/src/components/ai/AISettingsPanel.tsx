/**
 * AI Settings panel — rendered inside the Options page.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import {
  loadAISettings,
  saveAISettings,
  clearAIKey,
} from "@/ai/AISettings";
import { DEFAULT_AI_SETTINGS, type AISettings, type AIProviderId } from "@/ai/types";
import { validateKey, providerLabel } from "@/ai/AIManager";
import { isLocalProvider } from "@/ai/CostEstimator";
import {
  createAnthropic, createCustom, createGemini, createLMStudio,
  createOllama, createOpenAI, createOpenRouter,
} from "@/ai/AIProvider";
import { embedAllConversations, embeddingStats, clearEmbeddings } from "@/ai/EmbeddingEngine";

const PROVIDERS: { id: AIProviderId; label: string; requiresKey: boolean; localOnly: boolean; hint: string }[] = [
  { id: "openai", label: "OpenAI", requiresKey: true, localOnly: false, hint: "Uses api.openai.com" },
  { id: "anthropic", label: "Anthropic (Claude)", requiresKey: true, localOnly: false, hint: "Uses api.anthropic.com" },
  { id: "gemini", label: "Google Gemini", requiresKey: true, localOnly: false, hint: "Uses generativelanguage.googleapis.com" },
  { id: "openrouter", label: "OpenRouter", requiresKey: true, localOnly: false, hint: "Unified router across hundreds of models" },
  { id: "ollama", label: "Ollama (local)", requiresKey: false, localOnly: true, hint: "Default: http://localhost:11434" },
  { id: "lmstudio", label: "LM Studio (local)", requiresKey: false, localOnly: true, hint: "Default: http://localhost:1234/v1" },
  { id: "custom", label: "Custom OpenAI-compatible", requiresKey: false, localOnly: false, hint: "Paste any OpenAI-shaped base URL" },
];

function providerModels(id: AIProviderId, cfg: Pick<AISettings, "apiKey" | "baseUrl" | "chatModel" | "embeddingModel" | "temperature" | "maxTokens">) {
  switch (id) {
    case "openai": return createOpenAI(cfg).models();
    case "anthropic": return createAnthropic(cfg).models();
    case "gemini": return createGemini(cfg).models();
    case "openrouter": return createOpenRouter(cfg).models();
    case "ollama": return createOllama(cfg).models();
    case "lmstudio": return createLMStudio(cfg).models();
    case "custom": return createCustom(cfg).models();
  }
}

export function AISettingsPanel() {
  const toast = useToast();
  const [s, setS] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [ready, setReady] = useState(false);
  const [testing, setTesting] = useState(false);
  const [embedState, setEmbedState] = useState<{ vectors: number; tokens: number; model: string | null } | null>(null);
  const [reindexing, setReindexing] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void loadAISettings().then((v) => {
      if (!alive) return;
      setS(v);
      setReady(true);
    });
    void embeddingStats().then((v) => alive && setEmbedState(v));
    return () => { alive = false; };
  }, []);

  const update = async (patch: Partial<AISettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    await saveAISettings(next);
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await validateKey();
      if (res.ok) toast.success("Connection OK");
      else toast.error("Connection failed", res.error);
    } finally {
      setTesting(false);
    }
  };

  const rebuildEmbeddings = async () => {
    if (!s.enabled) { toast.error("Enable AI first"); return; }
    setReindexing({ done: 0, total: 0 });
    try {
      const res = await embedAllConversations((done, total) => setReindexing({ done, total }));
      toast.success(`Embedded ${res.embedded}, skipped ${res.skipped}`);
      setEmbedState(await embeddingStats());
    } catch (err) {
      toast.error("Reindex failed", err instanceof Error ? err.message : undefined);
    } finally {
      setReindexing(null);
    }
  };

  if (!ready) return <div className="text-xs text-muted-foreground">Loading AI settings…</div>;
  const meta = PROVIDERS.find((p) => p.id === s.provider)!;
  const models = providerModels(s.provider, s);
  const chatOptions = models.filter((m) => !m.supportsEmbeddings);
  const embedOptions = models.filter((m) => m.supportsEmbeddings);
  const localBlocked = isLocalProvider(s.provider) && !s.allowLocalModels;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-background/60 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[color:var(--color-primary)]"
            checked={s.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          <span>
            <span className="block text-sm font-medium">Enable AI features</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Optional. When off, Memlace stays fully offline. Turning it on lets Memlace send
              prompts directly to <em>your</em> chosen provider — never to Memlace.
            </span>
          </span>
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Provider</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => update({ provider: p.id })}
              className={
                "rounded-lg border px-3 py-2 text-left text-xs transition-colors " +
                (s.provider === p.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted")
              }
            >
              <div className="text-sm font-medium">{p.label}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{p.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {isLocalProvider(s.provider) && (
        <label className="flex items-start gap-3 rounded-lg border border-border bg-background/60 p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[color:var(--color-primary)]"
            checked={s.allowLocalModels}
            onChange={(e) => update({ allowLocalModels: e.target.checked })}
          />
          <span>
            <span className="block text-sm font-medium">Allow local models</span>
            <span className="text-xs text-muted-foreground">
              Extra confirmation for {providerLabel(s.provider)} — reachable only from this machine.
            </span>
          </span>
        </label>
      )}

      {meta.requiresKey && (
        <Field label="API key" hint="Stored only in this browser's chrome.storage.local. Never sent to Memlace.">
          <div className="flex gap-2">
            <input
              type="password"
              autoComplete="off"
              value={s.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder={`Paste your ${meta.label} API key…`}
              className="flex-1 h-9 rounded-lg border border-border bg-surface px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            />
            <Button variant="secondary" onClick={async () => { await clearAIKey(); const v = await loadAISettings(); setS(v); }}>
              Clear
            </Button>
          </div>
        </Field>
      )}

      <Field label="Base URL" hint="Only override if you know what you're doing (proxy, self-hosted gateway, …).">
        <input
          value={s.baseUrl}
          onChange={(e) => update({ baseUrl: e.target.value })}
          placeholder={meta.hint}
          className="w-full h-9 rounded-lg border border-border bg-surface px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Chat model">
          <select
            value={s.chatModel}
            onChange={(e) => update({ chatModel: e.target.value })}
            className="w-full h-9 rounded-lg border border-border bg-surface px-2 text-sm"
          >
            {chatOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
            <option value={s.chatModel}>{s.chatModel} (custom)</option>
          </select>
        </Field>
        <Field label="Embedding model">
          <select
            value={s.embeddingModel}
            onChange={(e) => update({ embeddingModel: e.target.value })}
            className="w-full h-9 rounded-lg border border-border bg-surface px-2 text-sm"
          >
            {embedOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
            <option value={s.embeddingModel}>{s.embeddingModel} (custom)</option>
          </select>
        </Field>
        <Field label={`Temperature (${s.temperature.toFixed(2)})`}>
          <input
            type="range" min={0} max={1} step={0.05}
            value={s.temperature}
            onChange={(e) => update({ temperature: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
        <Field label={`Max tokens (${s.maxTokens})`}>
          <input
            type="range" min={128} max={4096} step={64}
            value={s.maxTokens}
            onChange={(e) => update({ maxTokens: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-border bg-background/60 p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[color:var(--color-primary)]"
          checked={s.autoEnrich}
          onChange={(e) => update({ autoEnrich: e.target.checked })}
        />
        <span>
          <span className="block text-sm font-medium">Auto-enrich new conversations</span>
          <span className="text-xs text-muted-foreground">
            Automatically summarise, tag, and embed each newly saved chat. Off by default — every enrichment costs tokens.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button variant="primary" onClick={testConnection} disabled={testing || localBlocked}>
          {testing ? "Testing…" : "Test connection"}
        </Button>
        <Button variant="secondary" onClick={rebuildEmbeddings} disabled={!s.enabled || Boolean(reindexing) || localBlocked}>
          {reindexing ? `Embedding ${reindexing.done}/${reindexing.total || "?"}` : "Rebuild embeddings"}
        </Button>
        <Button variant="secondary" onClick={async () => { await clearEmbeddings(); setEmbedState(await embeddingStats()); toast.success("Embeddings cleared"); }}>
          Clear embeddings
        </Button>
      </div>

      {embedState && (
        <p className="text-[11px] text-muted-foreground">
          {embedState.vectors === 0
            ? "No embeddings stored yet."
            : `${embedState.vectors} vectors · ~${embedState.tokens.toLocaleString()} tokens · model ${embedState.model ?? "—"}`}
        </p>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
