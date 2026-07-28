import "@/styles.css";
import { bootstrap } from "@/bootstrap";
import { SidePanelApp } from "./SidePanelApp";

console.log("[Memlace Side Panel] runtime", chrome.runtime.id, window.location.origin);

void bootstrap({
  surface: "sidepanel",
  render: () => <SidePanelApp />,
}).then(async (report) => {
  if (!report.ok) return;
  const { db } = await import("@/lib/db");
  console.log("[Memlace Side Panel] Conversation count", await db.conversations.count());
});
