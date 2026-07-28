import "@/styles.css";
import { bootstrap } from "@/bootstrap";
import { PopupApp } from "./PopupApp";

console.log("[Memlace Popup] runtime", chrome.runtime.id, window.location.origin);

void bootstrap({
  surface: "popup",
  render: () => <PopupApp />,
}).then(async (report) => {
  if (!report.ok) return;
  const { db } = await import("@/lib/db");
  console.log("[Memlace Popup] Conversation count", await db.conversations.count());
});
