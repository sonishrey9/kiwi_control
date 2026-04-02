import { loadCanonicalConfig } from "../core/config.js";
import { compileRepoContext } from "../core/context.js";
import { inspectGitState } from "../core/git.js";
import { loadProjectOverlay, resolveExecutionMode, resolvePrimaryToolOverride, resolveProfileSelection } from "../core/profiles.js";
import { assessGoalRisk } from "../core/risk.js";
import { buildTemplateContext, resolveRoutingDecision } from "../core/router.js";
import { buildPhaseId, parseCsvFlag, type PhaseStatus, type PhaseRecord, writePhaseRecord } from "../core/state.js";
import { loadCurrentPhase } from "../core/state.js";
import type { Logger } from "../core/logger.js";

export interface CheckpointOptions {
  repoRoot: string;
  targetRoot: string;
  label: string;
  goal?: string;
  profileName?: string;
  mode?: "assisted" | "guarded" | "inline";
  tool?: "codex" | "claude" | "copilot";
  status?: PhaseStatus;
  validations?: string;
  warnings?: string;
  openIssues?: string;
  nextStep?: string;
  logger: Logger;
}

export async function runCheckpoint(options: CheckpointOptions): Promise<number> {
  const config = await loadCanonicalConfig(options.repoRoot);
  const overlay = await loadProjectOverlay(options.targetRoot);
  const previousPhase = await loadCurrentPhase(options.targetRoot);
  const selection = await resolveProfileSelection(options.targetRoot, config, options.profileName);
  const executionMode = resolveExecutionMode(config, selection, overlay, options.mode);
  const goal = options.goal ?? previousPhase?.goal ?? options.label;
  const risk = assessGoalRisk(goal);
  const explicitTool = resolvePrimaryToolOverride(overlay, options.tool);
  const decision = resolveRoutingDecision(config, {
    goal,
    profile: selection,
    executionMode,
    riskLevel: risk.level,
    ...(explicitTool ? { explicitTool } : {})
  });
  const compiledContext = await compileRepoContext({
    targetRoot: options.targetRoot,
    config,
    profileName: selection.profileName,
    profile: selection.profile,
    overlay,
    executionMode,
    taskType: decision.taskType,
    fileArea: decision.fileArea,
    changeSize: decision.changeSize,
    riskLevel: decision.riskLevel
  });
  const gitState = await inspectGitState(options.targetRoot);
  const generatedAt = buildTemplateContext(options.targetRoot, config, {
    profileName: selection.profileName,
    executionMode
  }).generatedAt;
  const record: PhaseRecord = {
    version: 1,
    timestamp: generatedAt,
    phaseId: buildPhaseId(options.label, generatedAt),
    label: options.label,
    goal,
    profile: selection.profileName,
    mode: executionMode,
    ...(explicitTool ? { tool: explicitTool } : {}),
    status: options.status ?? inferPhaseStatus(options.label),
    routingSummary: {
      taskType: decision.taskType,
      primaryTool: decision.primaryTool,
      reviewTool: decision.reviewTool,
      riskLevel: decision.riskLevel,
      fileArea: decision.fileArea,
      changeSize: decision.changeSize,
      requiredRoles: decision.requiredRoles
    },
    authorityFiles: compiledContext.authorityOrder,
    changedFilesSummary: {
      isGitRepo: gitState.isGitRepo,
      ...(gitState.branch ? { branch: gitState.branch } : {}),
      stagedCount: gitState.stagedCount,
      unstagedCount: gitState.unstagedCount,
      untrackedCount: gitState.untrackedCount,
      changedFiles: gitState.changedFiles.slice(0, 20)
    },
    validationsRun: dedupeList(parseCsvFlag(options.validations)),
    warnings: dedupeList(parseCsvFlag(options.warnings)),
    openIssues: dedupeList(parseCsvFlag(options.openIssues)),
    nextRecommendedStep:
      options.nextStep ??
      (decision.requiredRoles.length > 0
        ? `Continue with ${decision.requiredRoles.join(", ")} coverage before closing the work.`
        : `Continue with ${decision.primaryTool} using the latest repo-local packets.`),
    ...(previousPhase?.tool ? { previousTool: previousPhase.tool } : {}),
    ...(previousPhase?.phaseId ? { previousPhaseId: previousPhase.phaseId } : {})
  };
  const paths = await writePhaseRecord(options.targetRoot, record);
  options.logger.info(`checkpoint recorded: ${paths.currentPhasePath}`);
  options.logger.info(`history entry: ${paths.historyPath}`);
  return 0;
}

function inferPhaseStatus(label: string): PhaseStatus {
  if (/\b(blocked|blocker|stalled)\b/i.test(label)) {
    return "blocked";
  }
  if (/\b(done|complete|completed|ready)\b/i.test(label)) {
    return "complete";
  }
  return "in-progress";
}

function dedupeList(items: string[]): string[] {
  return [...new Set(items.filter((item) => Boolean(item.trim())))];
}
