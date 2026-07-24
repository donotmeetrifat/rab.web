import type { ProviderId } from "@/types";
import type { CapturedConversation } from "./types";

/**
 * Every provider adapter implements this contract. Anything provider-specific
 * (selectors, DOM quirks) must live inside the adapter module — never leak out.
 */
export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly name: string;

  /** True when this adapter should handle the given URL. */
  matches(url: string): boolean;

  /** Fast check: is there a conversation currently rendered? */
  detect(): boolean;

  /** Best-effort conversation id from the URL / DOM. Null if not on a chat. */
  getConversationId(): string | null;

  /** Human title for the conversation. Falls back to first user message. */
  getTitle(): string;

  /** Ordered list of messages currently in the DOM. */
  getMessages(): CapturedConversation["messages"];

  /** Full snapshot. Convenience over the individual getters. */
  getConversation(): CapturedConversation | null;

  /**
   * Subscribe to DOM changes. The callback fires (debounced) whenever the
   * conversation likely changed. Returns a disposer.
   */
  observeChanges(onChange: () => void): () => void;

  /**
   * Inject the "Save to Memlace" UI. Idempotent — safe to call repeatedly.
   * Returns a disposer that removes the button.
   */
  injectButton(handlers: SaveButtonHandlers): () => void;

  /** Tear down every listener/observer/DOM node this adapter created. */
  cleanup(): void;
}

export type SaveButtonState = "idle" | "saving" | "saved" | "updated" | "error";

export interface SaveButtonHandlers {
  /** Invoked when the user clicks the button. */
  onSave: () => Promise<void> | void;
  /** Adapter calls this to update the button label/state. */
  getState: () => SaveButtonState;
}
