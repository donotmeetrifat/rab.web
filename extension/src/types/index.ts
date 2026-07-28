export type ProviderId =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "aistudio"
  | "perplexity"
  | "copilot"
  | "deepseek"
  | "other";

export type ProjectIcon =
  | "folder"
  | "sparkles"
  | "bookmark"
  | "beaker"
  | "brain"
  | "code"
  | "heart"
  | "briefcase"
  | "graduation"
  | "rocket";

export interface Project {
  id: string;
  name: string;
  color: string;
  icon: ProjectIcon;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  favorite: boolean;
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
  pinned: boolean;
  archived: boolean;
  trashed: boolean;
  createdAt: number;
  updatedAt: number;
  trashedAt: number | null;
}

export interface TagMeta {
  name: string;
  color: string;
  count: number;
}

export type SortKey =
  | "newest"
  | "oldest"
  | "alphabetical"
  | "provider"
  | "pinned"
  | "favorites";

export interface MemoryFilters {
  view: "recent" | "favorites" | "pinned" | "archived" | "trash" | "projects";
  projectId: string | null;
  provider: ProviderId | "all";
  tag: string | null;
  dateFrom: number | null;
  dateTo: number | null;
  search: string;
}

export interface Settings {
  theme: "light" | "dark" | "system";
  defaultProvider: ProviderId;
  shortcutCapture: string;
  shortcutOpenPopup: string;
  telemetryEnabled: false;
  notificationsEnabled: boolean;
  /** When true, ProviderManager auto-saves every conversation change. */
  autoSaveConversations: boolean;
  /** Persist inline image URLs captured from conversations. */
  saveImages: boolean;
  /** Persist file attachment metadata captured from conversations. */
  saveAttachments: boolean;
  /** When true, disable auto-save even if autoSaveConversations is on — manual button only. */
  saveConversationsManualOnly: boolean;
  sort: SortKey;
  version: string;
}

/* ---------------- Conversations (provider capture) ---------------- */

export interface StoredConversation {
  id: string;
  provider: ProviderId;
  providerConversationId: string;
  title: string;
  url: string;
  model: string | null;
  messageCount: number;
  hash: string;
  createdAt: number;
  updatedAt: number;
  lastSyncAt: number;
  source: "manual" | "auto" | "initial";
}

export interface StoredConvMessage {
  id: string;
  conversationId: string;
  providerMessageId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  markdown: string;
  order: number;
  images: string[];
  attachments: { kind: "image" | "file" | "link"; name?: string; url?: string; mime?: string }[];
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface ExportPayload {
  version: number;
  exportedAt: number;
  projects: Project[];
  memories: Memory[];
  conversations?: StoredConversation[];
  /** Canonical field name in v3+. `convMessages` kept as alias for backward compat. */
  messages?: StoredConvMessage[];
  convMessages?: StoredConvMessage[];
  settings?: Partial<Settings>;
}


// Structural type only — full CapturedConversation lives in providers/base/types
// and is imported by both content script and background worker. Kept loose here
// to avoid pulling provider code into every consumer of RuntimeMessage.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CapturedConversationLike = any;

export type RuntimeMessage =
  | { type: "PING" }
  | { type: "CAPTURE_SELECTION"; payload: { text: string; url: string; title: string } }
  | { type: "OPEN_SIDE_PANEL" }
  | { type: "OPEN_POPUP" }
  | { type: "GET_ACTIVE_PROVIDER" }
  | { type: "REQUEST_SELECTION_CAPTURE" }
  | {
      /**
       * Phase 14.3: content scripts NEVER write IndexedDB directly. They
       * extract a CapturedConversation and hand it to the background service
       * worker, which is the sole writer for the extension-origin database.
       */
      type: "SAVE_CONVERSATION";
      payload: {
        conversation: CapturedConversationLike;
        source: "manual" | "auto" | "initial";
        hash: string;
        options?: { saveImages?: boolean; saveAttachments?: boolean };
      };
    }
  | {
      type: "CONVERSATION_SAVED";
      payload: {
        provider: ProviderId;
        title: string;
        created: boolean;
        source: "manual" | "auto" | "initial";
      };
    };

/** Reply shape for SAVE_CONVERSATION carried inside RuntimeResponse.data. */
export interface SaveConversationAck {
  verified: boolean;
  conversationId: string;
  created: boolean;
  updated: boolean;
  provider: ProviderId;
  messageCount: number;
  hash: string;
  createdAt: number;
  updatedAt: number;
  durationMs: number;
}

export type RuntimeResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };
