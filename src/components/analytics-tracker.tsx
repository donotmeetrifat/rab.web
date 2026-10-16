import { useEffect, useRef } from "react";

const VID_KEY = "rab_visitor_id";

declare global {
  interface Window {
    __rab_tracked?: boolean;
  }
}

export function AnalyticsTracker() {
  const hasSent = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip admin dashboard page
    if (window.location.pathname.startsWith("/admin")) return;

    // Guard against multiple sends within the exact same component mount/render
    if (hasSent.current || window.__rab_tracked) return;
    hasSent.current = true;
    window.__rab_tracked = true;

    try {
      // Safe visitor ID generator with fallback for incognito / disabled storage
      let vid = "";
      let isFirstVisit = false;

      try {
        vid = localStorage.getItem(VID_KEY) || "";
        if (!vid) {
          vid =
            "v_" +
            Math.random().toString(36).substring(2, 10) +
            "_" +
            Date.now().toString(36);
          localStorage.setItem(VID_KEY, vid);
          isFirstVisit = true;
        }
      } catch {
        // Fallback for private browsing mode or storage quotas
        vid = "v_priv_" + Math.random().toString(36).substring(2, 12);
        isFirstVisit = true;
      }

      const screenWidth = typeof window.screen !== "undefined" ? window.screen.width : 0;
      const screenHeight = typeof window.screen !== "undefined" ? window.screen.height : 0;

      const payload = {
        vid,
        path: window.location.pathname || "/",
        ref: typeof document !== "undefined" ? document.referrer || "" : "",
        screen: `${screenWidth}x${screenHeight}`,
        isFirstVisit,
      };

      const bodyStr = JSON.stringify(payload);

      // Primary: High-reliability modern fetch with keepalive & no-store
      if (typeof fetch === "function") {
        fetch("/api/track", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: bodyStr,
          keepalive: true,
          cache: "no-store",
        }).catch(() => {
          // Fallback to sendBeacon if fetch errors
          if (typeof navigator !== "undefined" && navigator.sendBeacon) {
            try {
              navigator.sendBeacon("/api/track", bodyStr);
            } catch {
              // ignore
            }
          }
        });
      } else if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        try {
          navigator.sendBeacon("/api/track", bodyStr);
        } catch {
          // ignore
        }
      }
    } catch {
      // Silently ignore any unexpected client errors
    }
  }, []);

  return null;
}
