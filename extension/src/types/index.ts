export type ProviderId =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "aistudio"
  | "perplexity"
  | "copilot"
  | "deepseek"
  | "other";

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  archived: boolean;
}

export interface Memory {
  id: string;
  projectId: string | null;
  title: string;
  content: string;
  provider: ProviderId;
  sourceUrl: string | null;
  tags: string[];
  favorite: boolean;
  trashed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  theme: "light" | "dark" | "system";
  defaultProvider: ProviderId;
  shortcutCapture: string;
  shortcutOpenPopup: string;
  telemetryEnabled: false;
  version: string;
}

export type RuntimeMessage =
  | { type: "PING" }
  | { type: "CAPTURE_SELECTION"; payload: { text: string; url: string; title: string } }
  | { type: "OPEN_SIDE_PANEL" }
  | { type: "GET_ACTIVE_PROVIDER" };

export type RuntimeResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };
