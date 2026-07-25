import type { ProviderId, StoredConversation, StoredConvMessage } from "@/types";

export type ContinuationProviderId =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "deepseek"
  | "copilot"
  | "perplexity"
  | "aistudio";


export type InputMethod =
  | "clipboard"       // open new chat; user pastes
  | "query-param";    // pass prompt via ?q= (short prompts only)

export interface ContinuationAdapter {
  id: ContinuationProviderId;
  name: string;
  /** URL for a fresh chat. */
  newChatUrl: string;
  /** Primary input method for the continuation prompt. */
  inputMethod: InputMethod;
  /** Approximate safe character limit for the pasted prompt. */
  maxChars: number;
  /** Some providers accept a `?q=` param on a search URL. */
  queryUrl?: (prompt: string) => string;
  /** Optional per-provider tweaks to the shared formatter output. */
  formatContext?: (base: string, conversation: StoredConversation) => string;
}

export const CONTINUATION_ADAPTERS: Record<ContinuationProviderId, ContinuationAdapter> = {
  chatgpt: {
    id: "chatgpt",
    name: "ChatGPT",
    newChatUrl: "https://chatgpt.com/",
    inputMethod: "clipboard",
    maxChars: 24000,
  },
  claude: {
    id: "claude",
    name: "Claude",
    newChatUrl: "https://claude.ai/new",
    inputMethod: "clipboard",
    maxChars: 30000,
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    newChatUrl: "https://gemini.google.com/app",
    inputMethod: "clipboard",
    maxChars: 24000,
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    newChatUrl: "https://chat.deepseek.com/",
    inputMethod: "clipboard",
    maxChars: 20000,
  },
  copilot: {
    id: "copilot",
    name: "Copilot",
    newChatUrl: "https://copilot.microsoft.com/",
    inputMethod: "clipboard",
    maxChars: 16000,
    queryUrl: (prompt) =>
      `https://copilot.microsoft.com/?q=${encodeURIComponent(prompt)}`,
  },
  perplexity: {
    id: "perplexity",
    name: "Perplexity",
    newChatUrl: "https://www.perplexity.ai/",
    inputMethod: "clipboard",
    maxChars: 18000,
    queryUrl: (prompt) =>
      `https://www.perplexity.ai/search/new?q=${encodeURIComponent(prompt)}`,
  },
};

export const CONTINUATION_PROVIDERS: ContinuationAdapter[] = [
  CONTINUATION_ADAPTERS.chatgpt,
  CONTINUATION_ADAPTERS.claude,
  CONTINUATION_ADAPTERS.gemini,
  CONTINUATION_ADAPTERS.deepseek,
  CONTINUATION_ADAPTERS.copilot,
  CONTINUATION_ADAPTERS.perplexity,
];

const PROVIDER_LABEL: Record<ProviderId, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  aistudio: "AI Studio",
  perplexity: "Perplexity",
  copilot: "Copilot",
  deepseek: "DeepSeek",
  other: "another AI",
};

const ROLE_LABEL: Record<StoredConvMessage["role"], string> = {
  user: "User",
  assistant: "Assistant",
  tool: "Tool",
  system: "System",
};

interface BuildOptions {
  target: ContinuationProviderId;
  conversation: StoredConversation;
  messages: StoredConvMessage[];
}

export interface BuiltContext {
  prompt: string;
  truncated: boolean;
  includedMessages: number;
  totalMessages: number;
  chars: number;
}

/**
 * Convert the saved conversation into a prompt-ready context block for another
 * AI. Keeps the most recent messages, elides older ones with a summary marker,
 * and prepends a short instruction so the receiving model continues the thread.
 */
export function buildContinuationContext({
  target,
  conversation,
  messages,
}: BuildOptions): BuiltContext {
  const adapter = CONTINUATION_ADAPTERS[target];
  const sourceLabel = PROVIDER_LABEL[conversation.provider] ?? "another AI";
  const targetLabel = adapter.name;
  const title = conversation.title?.trim() || "Untitled conversation";

  const intro = [
    `I'm continuing a conversation originally started in ${sourceLabel}.`,
    `Please read the transcript below, keep the same tone and goals, and then continue helping me from where it leaves off.`,
    "",
    `# ${title}`,
  ].join("\n");

  const outro = [
    "",
    "---",
    "",
    `Continue from the last message above. If anything is unclear, ask me before proceeding.`,
  ].join("\n");

  const budget = Math.max(1000, adapter.maxChars - intro.length - outro.length - 200);

  // Serialize each message, newest last.
  const serialized = messages.map((m) => {
    const body = (m.markdown?.trim() || m.content || "").trim();
    return `\n## ${ROLE_LABEL[m.role] ?? m.role}\n\n${body || "_(empty)_"}\n`;
  });

  // Fit as many recent messages as possible within the budget.
  let running = 0;
  const kept: string[] = [];
  for (let i = serialized.length - 1; i >= 0; i--) {
    const chunk = serialized[i];
    if (running + chunk.length > budget && kept.length > 0) break;
    kept.unshift(chunk);
    running += chunk.length;
  }

  const omitted = serialized.length - kept.length;
  const truncated = omitted > 0;
  const elision = truncated
    ? `\n> _[Earlier ${omitted} message${omitted === 1 ? "" : "s"} omitted to fit ${targetLabel}'s input limit.]_\n`
    : "";

  const raw = `${intro}\n${elision}${kept.join("")}${outro}`;
  const prompt = adapter.formatContext ? adapter.formatContext(raw, conversation) : raw;

  return {
    prompt,
    truncated,
    includedMessages: kept.length,
    totalMessages: serialized.length,
    chars: prompt.length,
  };
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/** Open the target provider in a new tab, using chrome.tabs when available. */
export function openProviderTab(url: string): void {
  const chromeApi = (globalThis as { chrome?: { tabs?: { create?: (opts: { url: string }) => void } } })
    .chrome;
  if (chromeApi?.tabs?.create) {
    chromeApi.tabs.create({ url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
