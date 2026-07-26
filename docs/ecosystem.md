# Memlace Ecosystem — Phase 14

## packages/core

Pure TypeScript. Zero browser, zero `chrome.*`, zero Node built-ins.
Reusable by every future client without modification.

```
packages/core/src/
├── index.ts              — public surface
├── adapters/             — platform contracts (Storage, Clipboard, …)
├── provider-sdk/         — registerProvider(), ProviderManifest
├── portable/             — import/export archive format
├── plugins/              — sandboxed plugin runtime
└── local-api/            — JSON transport contract
```

Import from any client with:

```ts
import { installPlatform } from "@memlace/core/adapters";
import { registerProvider } from "@memlace/core/provider-sdk";
```

## Platform adapters

Each client provides one file that implements
`PlatformAdapters` and calls `installPlatform()` at startup. The
Chrome/Edge/Firefox implementation lives in
`extension/src/platform/chrome.ts` (~80 LOC).

| Platform          | Storage         | Clipboard      | Notifications        | Navigation      |
|-------------------|-----------------|----------------|----------------------|-----------------|
| Chrome/Edge/FF    | chrome.storage  | navigator.clip | chrome.notifications | chrome.tabs     |
| Desktop (future)  | fs + sqlite     | Electron       | native OS            | shell.openExt.  |
| VS Code (future)  | ExtensionContext| vscode.env     | vscode.window        | vscode.env.open |
| Mobile (future)   | AsyncStorage    | Expo Clipboard | Expo Notifications   | Linking         |

## Provider SDK

Adding a provider is one call — no core changes:

```ts
registerProvider({
  id: "claude",
  displayName: "Claude",
  hostPatterns: ["claude.ai"],
  capabilities: ["capture", "continue", "codeAware"],
  continueAdapter: { newChatUrl: "https://claude.ai/new", maxContextChars: 30_000 },
});
```

Continue Anywhere, Search, Timeline, Knowledge and Projects consult
`listProviders()` — the new provider appears everywhere automatically.
Seven providers registered today; more require no core edits.

## Plugins

Read-only. Permission-controlled. Isolated.

```ts
registerPlugin({
  manifest: {
    id: "obsidian",
    displayName: "Obsidian Vault",
    description: "Search notes from a local vault.",
    version: "0.1.0",
    permissions: ["read.files", "search.contribute"],
    requiresExplicitEnable: true,
  },
  onEnable: async (host) => host.log("obsidian ready"),
  onSearch: async (q, host) => host.contributeSearch(await scanVault(q)),
});
```

Enforcement: `enablePlugin()` rejects any grant missing declared
permissions. Disabled plugins never see queries.

## Import / Export

Portable JSON is the wire format. Markdown, HTML and ZIP are produced
from the same shape.

Supported imports: **Memlace**, **ChatGPT**, **Claude**, **Gemini
(Takeout)**, **Markdown**, generic **JSON**.
Detection: `detectImportKind(payload)`.

Supported exports: **Markdown** (`conversationToMarkdown`), **HTML**
(`conversationToHtml`), **JSON archive** (`archiveToJson`), and via
platform writers: **ZIP bundles**, per-project bundles, knowledge
bundles.

## Local API

One JSON envelope, any transport. Methods:

`ping`, `search`, `ask`, `listConversations`, `getConversation`,
`listProjects`, `getProject`, `buildContext`, `importArchive`,
`exportArchive`, `listProviders`.

Chrome transport: `chrome.runtime.onMessageExternal` — companion
Memlace apps message the extension by ID. No socket is opened.

Future transports: Electron IPC, VS Code webview postMessage, Node
localhost, WebSocket — the contract does not change.

## Cross-device preparation

Storage is fully abstracted (`StorageAdapter`). When encrypted sync
ships, the sync engine plugs in as a decorator around the platform's
`StorageAdapter` — engines above it change nothing.
