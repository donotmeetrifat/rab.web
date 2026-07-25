/**
 * ProviderOptimizer — turns a provider-agnostic ContextPackage into a
 * final prompt string. Provider-specific formatting stays here so the
 * core ContextEngine never learns provider names.
 *
 * The formatters share a common Markdown-ish spine; per-provider
 * tweaks are limited to intro/outro voice and heading style. Everything
 * else is derived from the ContextItem list.
 */
import type { ProviderId } from "@/types";
import type { ContextItem, ContextPackage } from "./types";
import {
  CONTINUATION_ADAPTERS,
  type ContinuationProviderId,
} from "@/lib/continuation";

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

function isContinuationTarget(id: ProviderId): id is ContinuationProviderId {
  return id in CONTINUATION_ADAPTERS;
}

export function charBudgetFor(target: ProviderId): number {
  if (isContinuationTarget(target)) return CONTINUATION_ADAPTERS[target].maxChars;
  return 16000;
}

function groupByKind(items: ContextItem[]): Map<ContextItem["kind"], ContextItem[]> {
  const m = new Map<ContextItem["kind"], ContextItem[]>();
  for (const it of items) {
    const arr = m.get(it.kind) ?? [];
    arr.push(it);
    m.set(it.kind, arr);
  }
  return m;
}

const SECTION_ORDER: ContextItem["kind"][] = [
  "goal",
  "project",
  "decision",
  "constraint",
  "summary",
  "knowledge",
  "code",
  "file",
  "related-conversation",
  "session",
  "current-conversation",
  "recent-message",
];

const SECTION_TITLE: Record<ContextItem["kind"], string> = {
  goal: "Active Goals",
  project: "Project",
  decision: "Key Decisions",
  constraint: "Constraints",
  summary: "Summary of Prior Work",
  knowledge: "Relevant Knowledge",
  code: "Important Code",
  file: "Referenced Files",
  "related-conversation": "Related Conversations",
  session: "Current Session",
  "current-conversation": "Current Conversation",
  "recent-message": "Recent Messages",
};

function providerVoice(target: ProviderId): { intro: string; outro: string } {
  const label = PROVIDER_LABEL[target] ?? "the assistant";
  const shared = {
    intro: `I'm continuing work I've been doing with another AI. Please read the context below, keep the same objectives and constraints, and continue from where it leaves off.`,
    outro: `Ask a clarifying question first if any part of the context is ambiguous, then continue.`,
  };
  if (target === "claude") {
    return {
      intro: `Hi Claude — I'm resuming a project from a different AI session. Below is the current state: goals, decisions, and the latest thread. Please pick up naturally without repeating what's already settled.`,
      outro: shared.outro,
    };
  }
  if (target === "gemini") {
    return {
      intro: `You are joining an ongoing project. Everything you need is below (goals, decisions, recent messages). Be concise; do not re-explain prior decisions unless I ask.`,
      outro: shared.outro,
    };
  }
  if (target === "perplexity") {
    return {
      intro: `Context from a prior AI session on this project. Use it as background for the follow-up question I'll ask next.`,
      outro: `Wait for my next question before searching.`,
    };
  }
  if (target === "copilot") {
    return {
      intro: `Continuing a project from another AI. Context below — keep answers focused on the active goals.`,
      outro: shared.outro,
    };
  }
  void label;
  return shared;
}

export function renderPackage(pkg: Omit<ContextPackage, "prompt" | "chars">): {
  prompt: string;
  chars: number;
} {
  const voice = providerVoice(pkg.target);
  const grouped = groupByKind(pkg.items);

  const sections: string[] = [];
  for (const kind of SECTION_ORDER) {
    const arr = grouped.get(kind);
    if (!arr || arr.length === 0) continue;
    sections.push(`## ${SECTION_TITLE[kind]}`);
    for (const item of arr) sections.push(item.text.trim());
    sections.push("");
  }

  const body = sections.join("\n\n").trim();
  const prompt = [voice.intro, "", body, "", "---", voice.outro].join("\n");
  return { prompt, chars: prompt.length };
}
