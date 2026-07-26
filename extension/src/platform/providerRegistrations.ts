/**
 * Provider SDK registrations for the seven built-in adapters.
 *
 * Each entry publishes a ProviderManifest to @memlace/core so that
 * future clients (Desktop, VS Code, Mobile) know the same capabilities
 * without having to depend on the browser-only adapter classes in
 * `@/providers/*`.
 */

import { registerProvider } from "@memlace/core/provider-sdk";

registerProvider({
  id: "chatgpt",
  displayName: "ChatGPT",
  hostPatterns: ["chatgpt.com", "chat.openai.com"],
  capabilities: ["capture", "continue", "import", "codeAware", "images", "attachments"],
  continueAdapter: { newChatUrl: "https://chatgpt.com/", maxContextChars: 24_000 },
});

registerProvider({
  id: "claude",
  displayName: "Claude",
  hostPatterns: ["claude.ai"],
  capabilities: ["capture", "continue", "import", "codeAware", "attachments"],
  continueAdapter: { newChatUrl: "https://claude.ai/new", maxContextChars: 30_000 },
});

registerProvider({
  id: "gemini",
  displayName: "Gemini",
  hostPatterns: ["gemini.google.com"],
  capabilities: ["capture", "continue", "import", "images"],
  continueAdapter: { newChatUrl: "https://gemini.google.com/app", maxContextChars: 20_000 },
});

registerProvider({
  id: "deepseek",
  displayName: "DeepSeek",
  hostPatterns: ["chat.deepseek.com"],
  capabilities: ["capture", "continue", "codeAware"],
  continueAdapter: { newChatUrl: "https://chat.deepseek.com/", maxContextChars: 16_000 },
});

registerProvider({
  id: "perplexity",
  displayName: "Perplexity",
  hostPatterns: ["perplexity.ai"],
  capabilities: ["capture", "continue"],
  continueAdapter: { newChatUrl: "https://www.perplexity.ai/", maxContextChars: 12_000 },
});

registerProvider({
  id: "copilot",
  displayName: "Microsoft Copilot",
  hostPatterns: ["copilot.microsoft.com"],
  capabilities: ["capture", "continue"],
  continueAdapter: { newChatUrl: "https://copilot.microsoft.com/", maxContextChars: 12_000 },
});

registerProvider({
  id: "aistudio",
  displayName: "Google AI Studio",
  hostPatterns: ["aistudio.google.com"],
  capabilities: ["capture", "continue", "codeAware"],
  continueAdapter: { newChatUrl: "https://aistudio.google.com/", maxContextChars: 30_000 },
});
