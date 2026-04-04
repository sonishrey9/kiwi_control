import path from "node:path";
import { contextSelector } from "@shrey-junior/sj-core/core/context-selector.js";
import type { ContextConfidence } from "@shrey-junior/sj-core/core/context-selector.js";
import type { ContextTraceState, IndexingState } from "@shrey-junior/sj-core/core/context-trace.js";
import { generateInstructions, persistInstructions } from "@shrey-junior/sj-core/core/instruction-generator.js";
import { matchSkillsForTask } from "@shrey-junior/sj-core/core/skills-registry.js";
import type { SkillRegistryState } from "@shrey-junior/sj-core/core/skills-registry.js";
import { recordRuntimeProgress } from "@shrey-junior/sj-core/core/runtime-lifecycle.js";
import type { MeasuredUsageState } from "@shrey-junior/sj-core/core/token-intelligence.js";
import type { TokenBreakdownState } from "@shrey-junior/sj-core/core/token-estimator.js";
import { estimateTokens, persistTokenUsage } from "@shrey-junior/sj-core/core/token-estimator.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { readJson } from "@shrey-junior/sj-core/utils/fs.js";

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
  estimateNote: string;
  topDirectories: Array<{ directory: string; tokens: number; fileCount: number }>;
  instructionPath: string;
  reason: string;
  constraintCount: number;
  validationStepCount: number;
  stopConditionCount: number;
  contextTrace: ContextTraceState;
  indexing: IndexingState;
  tokenBreakdown: TokenBreakdownState;
  measuredUsage: MeasuredUsageState;
  skills: Pick<SkillRegistryState, "activeSkills" | "suggestedSkills">;
}

export async function runPrepare(options: PrepareOptions): Promise<number> {
  const { targetRoot, task, logger } = options;

  logger.info(`Preparing context for: "${task}"`);

  const selection = await contextSelector(task, targetRoot);
  const skillRegistry = await matchSkillsForTask(targetRoot, task).catch(() => ({
    activeSkills: [],
    suggestedSkills: []
  }));
  logger.info(`Context selected: ${selection.include.length} files [confidence=${selection.confidence}]`);

  const instructions = generateInstructions(task, selection, skillRegistry);
  const instructionPath = await persistInstructions(targetRoot, instructions);
  logger.info(`Instructions written to: ${instructionPath}`);

  const tokenEstimate = await estimateTokens(targetRoot, selection.include, task);
  await persistTokenUsage(targetRoot, task, tokenEstimate);
  await recordRuntimeProgress(targetRoot, {
    type: "prepare_completed",
    stage: "prepared",
    status: selection.confidence === "low" ? "warn" : "ok",
    summary: `Prepared ${selection.include.length} selected files for "${task}".`,
    task,
    files: selection.include,
    skillsApplied: skillRegistry.activeSkills.map((skill) => skill.skillId),
    estimatedTokens: tokenEstimate.selectedTokens,
    validation: "Prepared scope exists and selected files are bounded.",
    nextRecommendedAction: "Open the generated instructions and work inside the prepared scope.",
    validationStatus: selection.confidence === "low" ? "warn" : "ok"
  }).catch(() => null);
  const contextTrace = await readJson<ContextTraceState>(path.join(targetRoot, ".agent", "state", "context-trace.json"));
  const indexing = await readJson<IndexingState>(path.join(targetRoot, ".agent", "state", "indexing.json"));
  const tokenBreakdown = await readJson<TokenBreakdownState>(path.join(targetRoot, ".agent", "state", "token-breakdown.json"));

  const result: PrepareResult = {
    task,
    confidence: selection.confidence,
    filesSelected: selection.include.length,
    filesExcluded: selection.exclude.length,
    selectedTokens: tokenEstimate.selectedTokens,
    fullRepoTokens: tokenEstimate.fullRepoTokens,
    savingsPercent: tokenEstimate.savingsPercent,
    estimationMethod: tokenEstimate.estimationMethod,
    estimateNote: tokenEstimate.estimateNote,
    topDirectories: tokenEstimate.directoryBreakdown.slice(0, 5).map((d) => ({
      directory: d.directory,
      tokens: d.tokens,
      fileCount: d.fileCount
    })),
    instructionPath,
    reason: selection.reason,
    constraintCount: instructions.constraints.length,
    validationStepCount: instructions.validationSteps.length,
    stopConditionCount: instructions.stopConditions.length,
    contextTrace,
    indexing,
    tokenBreakdown,
    measuredUsage: tokenEstimate.measuredUsage,
    skills: {
      activeSkills: skillRegistry.activeSkills,
      suggestedSkills: skillRegistry.suggestedSkills
    }
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
  logger.info("  Measured Scope:");
  logger.info(`    Selected files:${String(result.filesSelected).padStart(10)}  (measured)`);
  logger.info(`    Exclusions:    ${String(result.filesExcluded).padStart(10)}  patterns`);
  logger.info("");
  logger.info("  Token Usage:");
  if (result.measuredUsage.available) {
    logger.info(`    Measured:      ${formatTokens(result.measuredUsage.totalTokens)}  (${result.measuredUsage.totalRuns} runs, ${result.measuredUsage.source})`);
  } else {
    logger.info("    Measured:      unavailable");
  }
  logger.info(`    Selected:      ~${formatTokens(result.selectedTokens)}`);
  logger.info(`    Full repo:     ~${formatTokens(result.fullRepoTokens)}`);
  logger.info(`    Savings:       ~${result.savingsPercent}%`);
  logger.info(`    Method:        ${result.estimationMethod}`);
  logger.info(`    Note:          ${result.estimateNote}`);
  logger.info("");

  logger.info("  Skills:");
  logger.info(`    Active:        ${result.skills.activeSkills.length > 0 ? result.skills.activeSkills.map((skill) => skill.name).join(", ") : "none"}`);
  logger.info(`    Suggested:     ${result.skills.suggestedSkills.length > 0 ? result.skills.suggestedSkills.map((skill) => skill.name).join(", ") : "none"}`);
  logger.info("");

  logger.info("  How It Works:");
  logger.info(`    Total files:   ${String(result.contextTrace.fileAnalysis.totalFiles).padStart(10)}`);
  logger.info(`    Scanned files: ${String(result.contextTrace.fileAnalysis.scannedFiles).padStart(10)}`);
  logger.info(`    Skipped files: ${String(result.contextTrace.fileAnalysis.skippedFiles).padStart(10)}`);
  logger.info(`    Selected files:${String(result.contextTrace.fileAnalysis.selectedFiles).padStart(10)}`);
  logger.info(`    Excluded files:${String(result.contextTrace.fileAnalysis.excludedFiles).padStart(10)}`);
  logger.info(`    Honesty:       ${buildHonestyLine(result)}`);
  logger.info("");

  logger.info("  File Analysis:");
  for (const entry of result.contextTrace.fileAnalysis.selected.slice(0, 4)) {
    logger.info(`    selected  ${entry.file} — ${entry.reasons.join(", ")}`);
  }
  for (const entry of result.contextTrace.fileAnalysis.excluded.slice(0, 4)) {
    logger.info(`    excluded  ${entry.file} — ${(entry.note ?? entry.reasons.join(", "))}`);
  }
  for (const entry of result.contextTrace.fileAnalysis.skipped.slice(0, 3)) {
    logger.info(`    skipped   ${entry.path} — ${entry.reason}`);
  }
  logger.info("");

  logger.info("  Context Trace:");
  for (const step of result.contextTrace.expansionSteps) {
    logger.info(`    ${step.step}: ${step.summary}`);
  }
  logger.info("");

  logger.info("  Indexing:");
  logger.info(`    Visited dirs:  ${String(result.indexing.visitedDirectories).padStart(10)}`);
  logger.info(`    Depth reached: ${String(result.indexing.maxDepthExplored).padStart(10)}`);
  logger.info(`    Files found:   ${String(result.indexing.discoveredFiles).padStart(10)}`);
  logger.info(`    Files analyzed:${String(result.indexing.analyzedFiles).padStart(10)}`);
  logger.info(`    Index reused:  ${String(result.indexing.indexReusedFiles ?? 0).padStart(10)}`);
  logger.info(`    Index updated: ${String(result.indexing.indexUpdatedFiles ?? 0).padStart(10)}`);
  logger.info(`    Impact files:  ${String(result.indexing.impactFiles ?? 0).padStart(10)}`);
  logger.info(`    Ignore rules:  ${result.indexing.ignoreRulesApplied.join(", ") || "none"}`);
  logger.info("");

  if (result.topDirectories.length > 0) {
    logger.info("  Token Hotspots:");
    for (const dir of result.topDirectories.slice(0, 5)) {
      logger.info(`    ${dir.directory.padEnd(40)} ${formatTokens(dir.tokens).padStart(12)}  (${dir.fileCount} files)`);
    }
    logger.info("");
  }

  logger.info("  Token Breakdown:");
  for (const category of result.tokenBreakdown.categories) {
    logger.info(
      `    ${category.category.padEnd(16)} ~${formatTokens(category.estimated_tokens_avoided).padStart(12)}  [${category.basis}] ${category.note}`
    );
  }
  logger.info("");

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

function buildHonestyLine(result: PrepareResult): string {
  const labels = ["heuristic"];
  if (result.contextTrace.honesty.lowConfidence) {
    labels.push("low confidence");
  }
  if (result.contextTrace.honesty.partialScan || result.indexing.partialScan || result.tokenBreakdown.partial_scan) {
    labels.push("partial scan");
  }
  return labels.join(", ");
}
