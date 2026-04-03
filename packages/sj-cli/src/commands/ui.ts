import { buildRepoControlState } from "@shrey-junior/sj-core/core/ui-state.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface UiOptions {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
  json?: boolean;
  logger: Logger;
}

export async function runUi(options: UiOptions): Promise<number> {
  const state = await buildRepoControlState({
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    ...(options.profileName ? { profileName: options.profileName } : {})
  });

  if (options.json) {
    options.logger.info(JSON.stringify(state, null, 2));
    return state.validation.ok ? 0 : 1;
  }

  const lines = [
    "repo overview:",
    ...state.repoOverview.map((item) => `- ${item.label}: ${item.value}`),
    "continuity:",
    ...state.continuity.map((item) => `- ${item.label}: ${item.value}`),
    "memory bank:",
    ...state.memoryBank.map((entry) => `- ${entry.label}: ${entry.present ? "present" : "missing"} (${entry.path})`),
    "specialists:",
    `- recommended: ${state.specialists.recommendedSpecialist}`,
    `- handoff targets: ${state.specialists.handoffTargets.join(", ")}`,
    `- safe parallel hint: ${state.specialists.safeParallelHint}`,
    "mcp packs:",
    `- suggested: ${state.mcpPacks.suggestedPack.id}`,
    ...state.mcpPacks.available.map((pack) => `- ${pack.id}: ${pack.realismNotes[0]}`),
    "validation:",
    `- ok: ${state.validation.ok}`,
    `- errors: ${state.validation.errors}`,
    `- warnings: ${state.validation.warnings}`
  ];

  options.logger.info(lines.join("\n"));
  return state.validation.ok ? 0 : 1;
}
