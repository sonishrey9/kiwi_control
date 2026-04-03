import { contextSelector } from "@shrey-junior/sj-core/core/context-selector.js";
import { generateInstructions, persistInstructions } from "@shrey-junior/sj-core/core/instruction-generator.js";
import { estimateTokens, persistTokenUsage } from "@shrey-junior/sj-core/core/token-estimator.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface PrepareOptions {
  repoRoot: string;
  targetRoot: string;
  task: string;
  json?: boolean;
  logger: Logger;
}

export interface PrepareResult {
  task: string;
  filesSelected: number;
  filesExcluded: number;
  selectedTokens: number;
  fullRepoTokens: number;
  savingsPercent: number;
  instructionPath: string;
  reason: string;
}

export async function runPrepare(options: PrepareOptions): Promise<number> {
  const { targetRoot, task, logger } = options;

  logger.info(`Preparing context for: "${task}"`);

  const selection = await contextSelector(task, targetRoot);
  logger.info(`Context selected: ${selection.include.length} files (${selection.reason})`);

  const instructions = generateInstructions(task, selection);
  const instructionPath = await persistInstructions(targetRoot, instructions);
  logger.info(`Instructions written to: ${instructionPath}`);

  const tokenEstimate = await estimateTokens(targetRoot, selection.include);
  await persistTokenUsage(targetRoot, task, tokenEstimate);

  const result: PrepareResult = {
    task,
    filesSelected: selection.include.length,
    filesExcluded: selection.exclude.length,
    selectedTokens: tokenEstimate.selectedTokens,
    fullRepoTokens: tokenEstimate.fullRepoTokens,
    savingsPercent: tokenEstimate.savingsPercent,
    instructionPath,
    reason: selection.reason
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printPrepareReport(result, logger);
  }

  return 0;
}

function printPrepareReport(result: PrepareResult, logger: Logger): void {
  logger.info("");
  logger.info("╔══════════════════════════════════════════════╗");
  logger.info("║          Kiwi Control — prepare              ║");
  logger.info("╚══════════════════════════════════════════════╝");
  logger.info("");
  logger.info(`  Task:            ${result.task}`);
  logger.info(`  Files selected:  ${result.filesSelected}`);
  logger.info(`  Files excluded:  ${result.filesExcluded} patterns`);
  logger.info("");
  logger.info("  Token Usage:");
  logger.info(`    Selected:      ${formatTokens(result.selectedTokens)}`);
  logger.info(`    Full repo:     ${formatTokens(result.fullRepoTokens)}`);
  logger.info(`    Savings:       ${result.savingsPercent}%`);
  logger.info("");
  logger.info(`  Instructions:    ${result.instructionPath}`);
  logger.info(`  Reason:          ${result.reason}`);
  logger.info("");
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M tokens`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K tokens`;
  }
  return `${count} tokens`;
}
