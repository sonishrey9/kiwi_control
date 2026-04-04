import { contextSelector } from "@shrey-junior/sj-core/core/context-selector.js";
import type { ContextConfidence } from "@shrey-junior/sj-core/core/context-selector.js";
import { generateInstructions, persistInstructions } from "@shrey-junior/sj-core/core/instruction-generator.js";
import { estimateTokens, persistTokenUsage } from "@shrey-junior/sj-core/core/token-estimator.js";
import type { CostEstimates } from "@shrey-junior/sj-core/core/token-estimator.js";
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
  confidence: ContextConfidence;
  filesSelected: number;
  filesExcluded: number;
  selectedTokens: number;
  fullRepoTokens: number;
  savingsPercent: number;
  estimationMethod: string;
  topDirectories: Array<{ directory: string; tokens: number; fileCount: number }>;
  costEstimates: CostEstimates;
  instructionPath: string;
  reason: string;
  constraintCount: number;
  validationStepCount: number;
  stopConditionCount: number;
}

export async function runPrepare(options: PrepareOptions): Promise<number> {
  const { targetRoot, task, logger } = options;

  logger.info(`Preparing context for: "${task}"`);

  const selection = await contextSelector(task, targetRoot);
  logger.info(`Context selected: ${selection.include.length} files [confidence=${selection.confidence}]`);

  const instructions = generateInstructions(task, selection);
  const instructionPath = await persistInstructions(targetRoot, instructions);
  logger.info(`Instructions written to: ${instructionPath}`);

  const tokenEstimate = await estimateTokens(targetRoot, selection.include, task);
  await persistTokenUsage(targetRoot, task, tokenEstimate);

  const result: PrepareResult = {
    task,
    confidence: selection.confidence,
    filesSelected: selection.include.length,
    filesExcluded: selection.exclude.length,
    selectedTokens: tokenEstimate.selectedTokens,
    fullRepoTokens: tokenEstimate.fullRepoTokens,
    savingsPercent: tokenEstimate.savingsPercent,
    estimationMethod: tokenEstimate.estimationMethod,
    topDirectories: tokenEstimate.directoryBreakdown.slice(0, 5).map((d) => ({
      directory: d.directory,
      tokens: d.tokens,
      fileCount: d.fileCount
    })),
    costEstimates: tokenEstimate.costEstimates,
    instructionPath,
    reason: selection.reason,
    constraintCount: instructions.constraints.length,
    validationStepCount: instructions.validationSteps.length,
    stopConditionCount: instructions.stopConditions.length
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
  logger.info("╚═══════════════════════════════════════════��══╝");
  logger.info("");
  logger.info(`  Task:            ${result.task}`);
  logger.info(`  Confidence:      ${result.confidence.toUpperCase()}`);
  logger.info(`  Files selected:  ${result.filesSelected}`);
  logger.info(`  Files excluded:  ${result.filesExcluded} patterns`);
  logger.info("");
  logger.info("  Token Usage:");
  logger.info(`    Selected:      ${formatTokens(result.selectedTokens)}`);
  logger.info(`    Full repo:     ${formatTokens(result.fullRepoTokens)}`);
  logger.info(`    Savings:       ${result.savingsPercent}%`);
  logger.info(`    Method:        ${result.estimationMethod}`);
  logger.info("");

  if (result.topDirectories.length > 0) {
    logger.info("  Token Hotspots:");
    for (const dir of result.topDirectories.slice(0, 5)) {
      logger.info(`    ${dir.directory.padEnd(40)} ${formatTokens(dir.tokens).padStart(12)}  (${dir.fileCount} files)`);
    }
    logger.info("");
  }

  if (result.costEstimates.tiers.length > 0) {
    logger.info("  Cost Savings (per AI call):");
    for (const tier of result.costEstimates.tiers) {
      logger.info(`    ${tier.model.padEnd(12)} ${tier.selectedCost} selected / ${tier.fullRepoCost} full repo / ${tier.savingsCost} saved`);
    }
    logger.info("");
  }

  logger.info("  Instructions:");
  logger.info(`    Path:          ${result.instructionPath}`);
  logger.info(`    Constraints:   ${result.constraintCount}`);
  logger.info(`    Validations:   ${result.validationStepCount}`);
  logger.info(`    Stop guards:   ${result.stopConditionCount}`);
  logger.info("");
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
