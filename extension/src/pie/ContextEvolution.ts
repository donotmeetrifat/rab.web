/**
 * ContextEvolution — sits on top of the ContextEngine to bias what gets
 * bundled based on the user's actual patterns:
 *   - active goal for the project
 *   - active decisions
 *   - preferred AI / preferred style
 *   - freshness weighting on knowledge items
 *
 * Returns a plain object the caller merges into ContextEngine output.
 */
import { listActiveDecisions } from "./DecisionMemory";
import { listGoals } from "./GoalEvolution";
import { topPreferences, preferredProvider } from "./PreferenceEngine";

export interface EvolvedContext {
  activeGoals: string[];
  activeDecisions: Array<{ topic: string; current: string }>;
  preferredProvider: string | null;
  preferredResponseFormat: string | null;
  preferredStyle: string | null;
  preferredLanguages: string[];
  preferredFrameworks: string[];
}

export async function buildEvolvedContext(): Promise<EvolvedContext> {
  const [decisions, goals, provider, formats, styles, langs, fws] = await Promise.all([
    listActiveDecisions(),
    listGoals("active"),
    preferredProvider(),
    topPreferences("responseFormat", 1),
    topPreferences("style", 1),
    topPreferences("language", 3),
    topPreferences("framework", 3),
  ]);
  return {
    activeGoals: goals.slice(0, 3).map((g) => g.label),
    activeDecisions: decisions.slice(0, 6).map((d) => ({ topic: d.topic, current: d.current })),
    preferredProvider: provider,
    preferredResponseFormat: formats[0]?.value ?? null,
    preferredStyle: styles[0]?.value ?? null,
    preferredLanguages: langs.map((l) => l.value),
    preferredFrameworks: fws.map((f) => f.value),
  };
}

/** Human-readable, drop-in preamble for context transfers. */
export function renderPreamble(ctx: EvolvedContext): string {
  const lines: string[] = [];
  if (ctx.activeGoals.length) lines.push(`Current goals: ${ctx.activeGoals.join("; ")}`);
  if (ctx.activeDecisions.length) {
    const items = ctx.activeDecisions.map((d) => `${d.topic}=${d.current}`).join(", ");
    lines.push(`Active stack decisions: ${items}`);
  }
  if (ctx.preferredLanguages.length) lines.push(`Preferred languages: ${ctx.preferredLanguages.join(", ")}`);
  if (ctx.preferredFrameworks.length) lines.push(`Preferred frameworks: ${ctx.preferredFrameworks.join(", ")}`);
  if (ctx.preferredResponseFormat) lines.push(`Preferred answer style: ${ctx.preferredResponseFormat}`);
  if (ctx.preferredStyle) lines.push(`Coding style: ${ctx.preferredStyle}`);
  return lines.length ? `# Personal context\n${lines.map((l) => `- ${l}`).join("\n")}` : "";
}
