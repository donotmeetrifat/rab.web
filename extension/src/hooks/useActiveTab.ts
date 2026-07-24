import { useEffect, useState } from "react";
import { detectProvider } from "@/lib/providers";
import type { ProviderId } from "@/types";

export interface ActiveTabInfo {
  url: string | null;
  title: string | null;
  provider: ProviderId;
}

export function useActiveTab(): ActiveTabInfo {
  const [info, setInfo] = useState<ActiveTabInfo>({ url: null, title: null, provider: "other" });

  useEffect(() => {
    let cancelled = false;
    const query = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (cancelled) return;
        setInfo({
          url: tab?.url ?? null,
          title: tab?.title ?? null,
          provider: detectProvider(tab?.url),
        });
      } catch {
        // no-op — chrome APIs unavailable in some contexts
      }
    };
    query();
    const onActivated = () => query();
    const onUpdated = (_id: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
      if (changeInfo.url || changeInfo.title || changeInfo.status === "complete") query();
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      cancelled = true;
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  return info;
}
