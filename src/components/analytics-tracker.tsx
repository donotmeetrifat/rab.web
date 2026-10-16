import { useEffect, useRef } from "react";

const VID_KEY = "rab_visitor_id";
const SESSION_SENT_KEY = "rab_session_sent";

export function AnalyticsTracker() {
  const hasSent = useRef(false);

  useEffect(() => {
    // Only track once per page session and skip admin page tracking
    if (typeof window === "undefined" || hasSent.current) return;
    if (window.location.pathname.startsWith("/admin")) return;

    // Check if session already tracked in this browser session
    const sessionSent = sessionStorage.getItem(SESSION_SENT_KEY);
    if (sessionSent === "1") return;

    hasSent.current = true;
    sessionStorage.setItem(SESSION_SENT_KEY, "1");

    try {
      // Get or create anonymous visitor ID
      let vid = localStorage.getItem(VID_KEY);
      let isFirstVisit = false;

      if (!vid) {
        vid =
          "v_" +
          Math.random().toString(36).substring(2, 10) +
          "_" +
          Date.now().toString(36);
        localStorage.setItem(VID_KEY, vid);
        isFirstVisit = true;
      }

      const payload = {
        vid,
        path: window.location.pathname,
        ref: document.referrer || "",
        screen: `${window.screen.width}x${window.screen.height}`,
        isFirstVisit,
      };

      // Non-blocking beacon or fetch
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/track", blob);
      } else {
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Ignore client storage/network errors silently
    }
  }, []);

  return null;
}
