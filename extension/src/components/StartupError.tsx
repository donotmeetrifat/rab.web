import { useState } from "react";
import { AlertTriangle, RotateCw, Copy, Check } from "lucide-react";
import type { BootReport, BootStageReport } from "@/bootstrap";
import { collectedStartupErrors } from "@/bootstrap";

interface Props {
  surface: "popup" | "sidepanel" | "options";
  report: BootReport;
  failedStage: BootStageReport;
}

export function StartupError({ surface, report, failedStage }: Props) {
  const [copied, setCopied] = useState(false);

  const diagnostics = () => {
    const lines: string[] = [];
    lines.push(`Memlace startup failure`);
    lines.push(`Surface: ${surface}`);
    lines.push(`When: ${new Date().toISOString()}`);
    lines.push(`Total boot: ${report.totalMs}ms`);
    lines.push("");
    lines.push("Stages:");
    for (const s of report.stages) {
      lines.push(`  ${s.ok ? "✓" : "✗"} ${s.name} (${s.durationMs}ms)${s.error ? " — " + s.error.message : ""}`);
    }
    lines.push("");
    lines.push(`Failed stage: ${failedStage.name}`);
    if (failedStage.error?.stack) {
      lines.push("Stack:");
      lines.push(failedStage.error.stack);
    }
    const globals = collectedStartupErrors();
    if (globals.length) {
      lines.push("");
      lines.push("Global errors:");
      for (const g of globals) {
        lines.push(`  [${g.where}] ${g.message}`);
      }
    }
    try {
      const nav = (typeof navigator !== "undefined" ? navigator.userAgent : "n/a");
      lines.push("");
      lines.push(`UA: ${nav}`);
    } catch { /* ignore */ }
    return lines.join("\n");
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(diagnostics());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const onReload = () => {
    try { location.reload(); } catch { /* ignore */ }
  };

  const onResetDb = async () => {
    if (!confirm("Reset local Memlace database? Saved conversations will be lost.")) return;
    try {
      const req = indexedDB.deleteDatabase("memlace");
      req.onsuccess = () => location.reload();
      req.onerror = () => alert("Could not reset database. Try uninstalling and reinstalling the extension.");
    } catch (err) {
      alert("Reset failed: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#FAFAF9", color: "#0F172A", padding: 20, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: 10, background: "#FEE2E2", color: "#B91C1C" }}>
            <AlertTriangle size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Memlace failed to start</div>
            <div style={{ fontSize: 11, color: "#64748B" }}>Stage: {failedStage.name}</div>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 12, fontSize: 12, color: "#334155" }}>
          <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
            {failedStage.error?.message ?? "Unknown error"}
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button onClick={onReload} style={btnPrimary}>
            <RotateCw size={13} /> Retry
          </button>
          <button onClick={onCopy} style={btnSecondary}>
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy diagnostics"}
          </button>
          <button onClick={onResetDb} style={{ ...btnSecondary, gridColumn: "1 / -1", color: "#B91C1C", borderColor: "#FECACA" }}>
            Reset local database
          </button>
        </div>

        <details style={{ marginTop: 14, fontSize: 11, color: "#64748B" }}>
          <summary style={{ cursor: "pointer" }}>Startup log ({report.totalMs}ms)</summary>
          <ul style={{ margin: "8px 0 0 0", padding: 0, listStyle: "none" }}>
            {report.stages.map((s) => (
              <li key={s.name} style={{ padding: "3px 0", fontFamily: "ui-monospace, monospace" }}>
                {s.ok ? "✓" : "✗"} {s.name} · {s.durationMs}ms{s.error ? ` — ${s.error.message}` : ""}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}

const btnBase: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  height: 34, padding: "0 12px", borderRadius: 10, fontSize: 12, fontWeight: 500,
  cursor: "pointer", border: "1px solid transparent",
};
const btnPrimary: React.CSSProperties = { ...btnBase, background: "#2563EB", color: "#fff" };
const btnSecondary: React.CSSProperties = { ...btnBase, background: "#fff", color: "#0F172A", borderColor: "#E2E8F0" };
