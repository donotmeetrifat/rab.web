/**
 * Memlace OS — subscriber bridges (Phase 13).
 *
 * Import this once from the extension entry points (popup, side panel,
 * options, background) to wire existing engines into the Event Bus
 * without them having to know about it. Keeps engines independent and
 * makes wiring auditable in one place.
 */

import { on } from "./EventBus";
import { installChromePlatform } from "@/platform/chrome";

// Install the platform adapter contract so any @memlace/core code can
// call platform() without knowing which client it's running inside.
installChromePlatform();

on("workspace.updated", async () => {
  try {
    const { invalidateWorkspace } = await import("@/services/smartWorkspace");
    invalidateWorkspace();
  } catch {
    /* module not loaded yet */
  }
});

on("project.updated", async () => {
  try {
    const { invalidateProjectBrain } = await import("@/services/projectBrain");
    invalidateProjectBrain();
  } catch {
    /* module not loaded yet */
  }
});

on("conversation.saved", () => {
  void import("@/services/onboarding")
    .then((m) => m.markChecklist("savedConversation"))
    .catch(() => {});
});
