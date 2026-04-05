import path from "node:path";
import { contextSelector } from "@shrey-junior/sj-core/core/context-selector.js";
import type { ContextConfidence, ContextSelection } from "@shrey-junior/sj-core/core/context-selector.js";
import type { ContextTraceState, IndexingState } from "@shrey-junior/sj-core/core/context-trace.js";
import { generateInstructions, persistInstructions } from "@shrey-junior/sj-core/core/instruction-generator.js";
import type { GeneratedInstructions } from "@shrey-junior/sj-core/core/instruction-generator.js";
import { matchSkillsForTask } from "@shrey-junior/sj-core/core/skills-registry.js";
import type { SkillRegistryState } from "@shrey-junior/sj-core/core/skills-registry.js";
import { recordRuntimeProgress } from "@shrey-junior/sj-core/core/runtime-lifecycle.js";
import { syncExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import type { MeasuredUsageState } from "@shrey-junior/sj-core/core/token-intelligence.js";
import type { TokenBreakdownState, TokenEstimate } from "@shrey-junior/sj-core/core/token-estimator.js";
import { estimateTokens, persistTokenUsage } from "@shrey-junior/sj-core/core/token-estimator.js";
import { executeWorkflowStep } from "@shrey-junior/sj-core/core/workflow-engine.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { pathExists, readJson } from "@shrey-junior/sj-core/utils/fs.js";

export interface PrepareOptions {
  repoRoot: string;
  targetRoot: string;
  task: string;
  expand?: boolean;
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

  const selectionStatePath = path.join(targetRoot, ".agent", "state", "context-selection.json");
  let selection: ContextSelection | null = null;
  let skillRegistry: Pick<SkillRegistryState, "activeSkills" | "suggestedSkills"> = {
    activeSkills: [],
    suggestedSkills: []
  };
  let instructions: GeneratedInstructions | null = null;
  let instructionPath: string | null = null;
  let tokenUsagePath: string | null = null;
  let tokenEstimate: TokenEstimate | null = null;

  const workflowExecution = await executeWorkflowStep(targetRoot, {
    task,
    stepId: "prepare-context",
    input: task,
    expectedOutput: "Prepared scope and generated instructions are ready.",
    run: async () => {
      selection = await contextSelector(task, targetRoot, {
        ...(options.expand !== undefined ? { expand: options.expand } : {})
      });
      skillRegistry = await matchSkillsForTask(targetRoot, task).catch(() => ({
        activeSkills: [],
        suggestedSkills: []
      }));
      instructions = generateInstructions(task, selection, skillRegistry);
      instructionPath = await persistInstructions(targetRoot, instructions);
      tokenEstimate = await estimateTokens(targetRoot, selection.include, task);
      tokenUsagePath = await persistTokenUsage(targetRoot, task, tokenEstimate);
      return {
        selection,
        skillRegistry,
        instructions,
        instructionPath,
        tokenEstimate,
        tokenUsagePath
      };
    },
    validate: async (result) => {
      const artifactsReady =
        await pathExists(selectionStatePath) &&
        await pathExists(result.instructionPath) &&
        await pathExists(result.tokenUsagePath);
      const hasScope = result.selection.include.length > 0;
      const ok = artifactsReady && hasScope;
      return {
        ok,
        validation: ok
          ? "Prepared scope exists, instructions were written, and token state was recorded."
          : "Prepare did not produce a usable prepared scope and its required artifacts.",
        ...(ok
          ? {}
          : {
              failureReason: !artifactsReady
                ? "Required prepare artifacts were not written to .agent/state."
                : "No files were selected into the prepared scope.",
              suggestedFix: `Refine the task wording or inspect ignored files, then rerun kiwi-control prepare "${task}".`
            })
      };
    },
    summarize: (result) => ({
      summary: `Prepared ${result.selection.include.length} selected files for "${task}".${options.expand ? " Expanded scope mode was active." : ""}`,
      files: result.selection.include,
      skillsApplied: result.skillRegistry.activeSkills.map((skill) => skill.skillId),
      estimatedTokens: result.tokenEstimate.selectedTokens
    })
  });

  if (!workflowExecution.ok || !selection || !instructions || !instructionPath || !tokenEstimate) {
    await recordRuntimeProgress(targetRoot, {
      type: "prepare_completed",
      stage: "blocked",
      status: "error",
      summary: workflowExecution.failureReason ?? `Prepare failed for "${task}".`,
      task,
      validation: workflowExecution.validation,
      ...(workflowExecution.failureReason ? { failureReason: workflowExecution.failureReason } : {}),
      nextSuggestedCommand: workflowExecution.retryCommand,
      nextRecommendedAction: workflowExecution.suggestedFix ?? workflowExecution.validation,
      validationStatus: "error"
    }).catch(() => null);
    await syncExecutionPlan(targetRoot, {
      task,
      forceState: "failed"
    }).catch(() => null);
    logger.error(workflowExecution.failureReason ?? `Prepare failed for "${task}".`);
    return 1;
  }

  const finalSelection: ContextSelection = selection;
  const finalInstructions: GeneratedInstructions = instructions;
  const finalInstructionPath: string = instructionPath;
  const finalTokenEstimate: TokenEstimate = tokenEstimate;

  logger.info(`Context selected: ${finalSelection.include.length} files [confidence=${finalSelection.confidence}]${options.expand ? " [expanded]" : ""}`);
  logger.info(`Instructions written to: ${finalInstructionPath}`);

  await recordRuntimeProgress(targetRoot, {
    type: "prepare_completed",
    stage: "prepared",
    status: finalSelection.confidence === "low" ? "warn" : "ok",
    summary: `Prepared ${finalSelection.include.length} selected files for "${task}".`,
    task,
    files: finalSelection.include,
    skillsApplied: skillRegistry.activeSkills.map((skill) => skill.skillId),
    estimatedTokens: finalTokenEstimate.selectedTokens,
    validation: workflowExecution.validation,
    nextSuggestedCommand: `kiwi-control run "${task}"`,
    nextRecommendedAction: "Open the generated instructions and work inside the prepared scope.",
    validationStatus: finalSelection.confidence === "low" ? "warn" : "ok"
  }).catch(() => null);
  await syncExecutionPlan(targetRoot, {
    task,
    forceState: "ready"
  }).catch(() => null);
  const contextTrace = await readJson<ContextTraceState>(path.join(targetRoot, ".agent", "state", "context-trace.json"));
  const indexing = await readJson<IndexingState>(path.join(targetRoot, ".agent", "state", "indexing.json"));
  const tokenBreakdown = await readJson<TokenBreakdownState>(path.join(targetRoot, ".agent", "state", "token-breakdown.json"));

  const result: PrepareResult = {
    task,
    confidence: finalSelection.confidence,
    filesSelected: finalSelection.include.length,
    filesExcluded: finalSelection.exclude.length,
    selectedTokens: finalTokenEstimate.selectedTokens,
    fullRepoTokens: finalTokenEstimate.fullRepoTokens,
    savingsPercent: finalTokenEstimate.savingsPercent,
    estimationMethod: finalTokenEstimate.estimationMethod,
    estimateNote: finalTokenEstimate.estimateNote,
    topDirectories: finalTokenEstimate.directoryBreakdown.slice(0, 5).map((d) => ({
      directory: d.directory,
      tokens: d.tokens,
      fileCount: d.fileCount
    })),
    instructionPath: finalInstructionPath,
    reason: finalSelection.reason,
    constraintCount: finalInstructions.constraints.length,
    validationStepCount: finalInstructions.validationSteps.length,
    stopConditionCount: finalInstructions.stopConditions.length,
    contextTrace,
    indexing,
    tokenBreakdown,
    measuredUsage: finalTokenEstimate.measuredUsage,
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
