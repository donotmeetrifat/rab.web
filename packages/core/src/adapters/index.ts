/**
 * Platform adapter contracts.
 *
 * Every client (Chrome, Edge, Firefox, Desktop, VS Code, Cursor,
 * Windsurf, Mobile) provides a concrete implementation of these five
 * interfaces. Nothing else in @memlace/core touches platform APIs.
 */

export interface StorageAdapter {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
}

export interface ClipboardAdapter {
  writeText(text: string): Promise<void>;
  readText(): Promise<string>;
}

export interface NotificationAdapter {
  notify(input: { title: string; body?: string; iconUrl?: string }): Promise<void>;
}

export interface NavigationAdapter {
  /** Open an external URL. Desktop/VS Code implementations shell out. */
  openExternal(url: string): Promise<void>;
  /** Focus/open an internal client surface (popup, side panel, tab). */
  openInternal?(target: string): Promise<void>;
}

export interface BrowserBridgeAdapter {
  /** Capability probe — returns true when the current runtime can
   *  execute content scripts against arbitrary web pages. Desktop and
   *  VS Code return false; extensions return true. */
  canObserveWebPages(): boolean;
}

export interface PlatformAdapters {
  storage: StorageAdapter;
  clipboard: ClipboardAdapter;
  notifications: NotificationAdapter;
  navigation: NavigationAdapter;
  browser: BrowserBridgeAdapter;
  /** Human-readable id: "chrome-extension", "firefox-extension",
   *  "desktop-macos", "vscode", … */
  platformId: string;
}

let installed: PlatformAdapters | null = null;

export function installPlatform(adapters: PlatformAdapters): void {
  installed = adapters;
}

export function platform(): PlatformAdapters {
  if (!installed) {
    throw new Error(
      "[@memlace/core] no platform adapter installed. Call installPlatform() during client startup.",
    );
  }
  return installed;
}

export function hasPlatform(): boolean {
  return installed !== null;
}
