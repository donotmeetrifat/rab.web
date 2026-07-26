/**
 * Memlace — resilient startup bootstrap (Phase 14.2).
 *
 * Every UI entry point (popup, side panel, options) runs through this
 * pipeline. Each stage is wrapped so a failure in any single module
 * never leaves the surface blank — the user always sees either the
 * app, or a diagnostic screen with recovery actions.
 *
 * Stages:
 *   1. install global error listeners
 *   2. open Dexie database
 *   3. install platform adapters + subscribers
 *   4. mount React (with ErrorBoundary)
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";
import { StartupError } from "@/components/StartupError";

export interface BootStageReport {
  name: string;
  ok: boolean;
  durationMs: number;
  error?: { message: string; stack?: string };
}

export interface BootReport {
  ok: boolean;
  totalMs: number;
  stages: BootStageReport[];
}

const listenersInstalled = { value: false };
const collectedErrors: Array<{ where: string; message: string; stack?: string }> = [];

export function collectedStartupErrors() {
  return collectedErrors.slice();
}

function installGlobalErrorListeners() {
  if (listenersInstalled.value) return;
  listenersInstalled.value = true;

  try {
    window.addEventListener("error", (ev) => {
      const err = ev.error as Error | undefined;
      console.error("[Memlace] window.onerror", err ?? ev.message);
      collectedErrors.push({
        where: "window.onerror",
        message: err?.message ?? String(ev.message ?? "unknown"),
        stack: err?.stack,
      });
    });
    window.addEventListener("unhandledrejection", (ev) => {
      const reason = ev.reason as Error | undefined;
      console.error("[Memlace] unhandledrejection", reason);
      collectedErrors.push({
        where: "unhandledrejection",
        message: reason?.message ?? String(reason ?? "unknown"),
        stack: reason?.stack,
      });
    });
  } catch (err) {
    console.warn("[Memlace] failed to install global error listeners", err);
  }
}

async function runStage(
  name: string,
  fn: () => Promise<void> | void,
): Promise<BootStageReport> {
  const t0 = performance.now();
  try {
    await fn();
    return { name, ok: true, durationMs: Math.round(performance.now() - t0) };
  } catch (err) {
    const e = err as Error;
    console.error(`[Memlace][boot] stage "${name}" FAILED`, e);
    return {
      name,
      ok: false,
      durationMs: Math.round(performance.now() - t0),
      error: { message: e?.message ?? String(err), stack: e?.stack },
    };
  }
}

export async function bootstrap(options: {
  surface: "popup" | "sidepanel" | "options";
  rootId?: string;
  render: () => React.ReactNode;
}): Promise<BootReport> {
  const t0 = performance.now();
  const stages: BootStageReport[] = [];

  stages.push(await runStage("global-error-listeners", () => {
    installGlobalErrorListeners();
  }));

  stages.push(await runStage("open-database", async () => {
    // Import lazily so a module-load failure surfaces as a stage error
    // rather than a top-level import crash.
    const { db } = await import("@/lib/db");
    // Force Dexie to open now so schema errors are attributed here.
    await db.open();
  }));

  stages.push(await runStage("install-platform", async () => {
    // Subscribers module installs platform adapters + local API + wires
    // event bus listeners. All calls inside are idempotent.
    await import("@/core/subscribers");
  }));

  const container = document.getElementById(options.rootId ?? "root");
  if (!container) {
    stages.push({
      name: "mount-react",
      ok: false,
      durationMs: 0,
      error: { message: `Root element #${options.rootId ?? "root"} not found` },
    });
    return { ok: false, totalMs: Math.round(performance.now() - t0), stages };
  }

  const failed = stages.find((s) => !s.ok);
  const report: BootReport = {
    ok: !failed,
    totalMs: Math.round(performance.now() - t0),
    stages,
  };

  stages.push(await runStage("mount-react", () => {
    const root = createRoot(container);
    if (failed) {
      root.render(
        <React.StrictMode>
          <StartupError
            surface={options.surface}
            report={report}
            failedStage={failed}
          />
        </React.StrictMode>,
      );
      return;
    }
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <ToastProvider>{options.render()}</ToastProvider>
        </ErrorBoundary>
      </React.StrictMode>,
    );
  }));

  // If React mount itself failed, replace with a plain-DOM fallback so
  // the popup is never blank.
  const mountStage = stages[stages.length - 1];
  if (!mountStage.ok) {
    try {
      container.innerHTML = `
        <div style="font:13px system-ui;padding:16px;color:#0f172a;background:#fafaf9;min-height:100dvh">
          <strong>Memlace failed to start.</strong>
          <div style="margin-top:8px;color:#64748b">${escapeHtml(mountStage.error?.message ?? "Unknown error")}</div>
          <button onclick="location.reload()" style="margin-top:12px;padding:6px 12px;border-radius:8px;border:0;background:#2563eb;color:#fff;font-size:12px;cursor:pointer">Reload</button>
        </div>`;
    } catch {
      /* nothing more we can do */
    }
  }

  report.ok = stages.every((s) => s.ok);
  report.totalMs = Math.round(performance.now() - t0);
  return report;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] as string));
}
