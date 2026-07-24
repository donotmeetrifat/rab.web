import type { ProviderId } from "@/types";
import type { ProviderAdapter } from "./ProviderAdapter";
import type { CapturedConversation, CapturedMessage } from "./types";

/**
 * Minimal adapter for providers whose full DOM integration is not yet built.
 * It detects the site and reports its identity, but never captures messages
 * or injects UI. This keeps the ProviderManager stable while additional
 * adapters land one by one — all with the same interface.
 */
export class PlaceholderAdapter implements ProviderAdapter {
  constructor(
    public readonly id: ProviderId,
    public readonly name: string,
    private readonly hostPattern: RegExp,
  ) {}

  matches(url: string): boolean {
    try {
      return this.hostPattern.test(new URL(url).hostname);
    } catch {
      return false;
    }
  }
  detect(): boolean { return false; }
  getConversationId(): string | null { return null; }
  getTitle(): string { return this.name; }
  getMessages(): CapturedMessage[] { return []; }
  getConversation(): CapturedConversation | null { return null; }
  observeChanges(): () => void { return () => undefined; }
  injectButton(): () => void { return () => undefined; }
  cleanup(): void { /* nothing to clean */ }
}
