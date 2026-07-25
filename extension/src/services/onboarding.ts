// Local-first onboarding + checklist + "what's new" tracking.
// All state lives in chrome.storage.local — no network, no telemetry.

export const MEMLACE_VERSION = "1.0.0";

export interface ChecklistState {
  savedConversation: boolean;
  createdProject: boolean;
  usedSearch: boolean;
  continuedElsewhere: boolean;
  enabledAI: boolean;
}

export interface OnboardingState {
  completed: boolean;
  completedAt?: number;
  experience?: "offline" | "byo-ai";
  lastSeenVersion?: string;
  checklist: ChecklistState;
}

const KEY = "memlace.onboarding";

const DEFAULT_CHECKLIST: ChecklistState = {
  savedConversation: false,
  createdProject: false,
  usedSearch: false,
  continuedElsewhere: false,
  enabledAI: false,
};

const DEFAULT_STATE: OnboardingState = {
  completed: false,
  checklist: { ...DEFAULT_CHECKLIST },
};

export async function loadOnboarding(): Promise<OnboardingState> {
  try {
    const v = await chrome.storage.local.get(KEY);
    const raw = v[KEY] as Partial<OnboardingState> | undefined;
    return {
      ...DEFAULT_STATE,
      ...(raw ?? {}),
      checklist: { ...DEFAULT_CHECKLIST, ...(raw?.checklist ?? {}) },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function saveOnboarding(next: OnboardingState): Promise<void> {
  try {
    await chrome.storage.local.set({ [KEY]: next });
  } catch {
    // ignore quota errors — onboarding is best-effort
  }
}

export async function completeOnboarding(
  experience: "offline" | "byo-ai",
): Promise<OnboardingState> {
  const prev = await loadOnboarding();
  const next: OnboardingState = {
    ...prev,
    completed: true,
    completedAt: Date.now(),
    experience,
    lastSeenVersion: MEMLACE_VERSION,
  };
  await saveOnboarding(next);
  return next;
}

export async function resetOnboarding(): Promise<void> {
  await saveOnboarding({ ...DEFAULT_STATE });
}

export async function markChecklist(key: keyof ChecklistState): Promise<void> {
  const prev = await loadOnboarding();
  if (prev.checklist[key]) return;
  const next: OnboardingState = {
    ...prev,
    checklist: { ...prev.checklist, [key]: true },
  };
  await saveOnboarding(next);
}

export async function acknowledgeVersion(): Promise<void> {
  const prev = await loadOnboarding();
  await saveOnboarding({ ...prev, lastSeenVersion: MEMLACE_VERSION });
}

export function checklistProgress(c: ChecklistState): number {
  const total = Object.keys(c).length;
  const done = Object.values(c).filter(Boolean).length;
  return Math.round((done / total) * 100);
}

export function subscribeOnboarding(
  cb: (s: OnboardingState) => void,
): () => void {
  const listener = (
    changes: { [k: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) => {
    if (area !== "local" || !changes[KEY]) return;
    const raw = changes[KEY].newValue as Partial<OnboardingState> | undefined;
    cb({
      ...DEFAULT_STATE,
      ...(raw ?? {}),
      checklist: { ...DEFAULT_CHECKLIST, ...(raw?.checklist ?? {}) },
    });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
