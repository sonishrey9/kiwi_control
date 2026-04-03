import { loadCanonicalConfig } from "../core/config.js";
import { compileRepoContext } from "../core/context.js";
import { buildBootstrapNextFileToRead, buildCanonicalReadNext, buildChecksToRun, buildSearchGuidance, buildStopConditions, buildWriteTargets } from "../core/guidance.js";
import { inspectGitState } from "../core/git.js";
import { loadLatestReconcileReport } from "../core/reconcile.js";
import { inspectBootstrapTarget } from "../core/project-detect.js";
import { loadProjectOverlay, resolveExecutionMode, resolvePrimaryToolOverride, resolveProfileSelection } from "../core/profiles.js";
import { assessGoalRisk } from "../core/risk.js";
import { buildTemplateContext, resolveRoutingDecision, selectPortableContract } from "../core/router.js";
import { buildPhaseId, loadActiveRoleHints, loadLatestCheckpoint, parseCsvFlag, type CheckpointRecord, type PhaseStatus, type PhaseRecord, updateActiveRoleHints, writeCheckpointArtifacts, writePhaseRecord } from "../core/state.js";
import { loadCurrentPhase } from "../core/state.js";
import type { Logger } from "../core/logger.js";
import { relativeFrom } from "../utils/fs.js";

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
  const previousCheckpoint = await loadLatestCheckpoint(options.targetRoot);
  const selection = await resolveProfileSelection(options.targetRoot, config, options.profileName);
  const inspection = await inspectBootstrapTarget(options.targetRoot, config);
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
  const latestReconcile = await loadLatestReconcileReport(options.targetRoot);
  const generatedAt = buildTemplateContext(options.targetRoot, config, {
    profileName: selection.profileName,
    executionMode,
    projectType: overlay?.bootstrap?.project_type ?? inspection.projectType,
    profileSource: selection.source
  }).generatedAt;
  const record: PhaseRecord = {
    artifactType: "shrey-junior/current-phase",
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
  const currentActiveRoleHints = await loadActiveRoleHints(options.targetRoot);
  const contract = selectPortableContract(
    config,
    buildTemplateContext(options.targetRoot, config, {
      profileName: selection.profileName,
      executionMode,
      projectType: overlay?.bootstrap?.project_type ?? inspection.projectType,
      profileSource: selection.source
    })
  );
  const nextSuggestedCommand =
    record.status === "blocked"
      ? `shrey-junior status --target "${options.targetRoot}"`
      : record.status === "complete"
        ? `shrey-junior push-check --target "${options.targetRoot}"`
        : `shrey-junior handoff --target "${options.targetRoot}" --to-tool ${decision.reviewTool}`;
  const checkpoint: CheckpointRecord = {
    artifactType: "shrey-junior/checkpoint",
    schemaVersion: 1,
    createdAt: generatedAt,
    checkpointId: buildPhaseId(options.label, generatedAt),
    phase: record.label,
    activeRole: currentActiveRoleHints?.activeRole ?? contract.activeRole,
    supportingRoles: currentActiveRoleHints?.supportingRoles ?? contract.supportingRoles,
    authoritySource: selection.source,
    summary: record.nextRecommendedStep,
    taskContext: {
      goal,
      taskType: decision.taskType,
      fileArea: decision.fileArea,
      changeSize: decision.changeSize,
      riskLevel: decision.riskLevel,
      ...(explicitTool ? { primaryTool: explicitTool } : { primaryTool: decision.primaryTool }),
      reviewTool: decision.reviewTool
    },
    filesTouched: gitState.changedFiles.slice(0, 20),
    filesCreated: gitState.createdFiles?.slice(0, 20) ?? [],
    filesDeleted: gitState.deletedFiles?.slice(0, 20) ?? [],
    checksRun: record.validationsRun,
    checksPassed: record.validationsRun,
    checksFailed: [],
    gitBranch: gitState.branch ?? null,
    gitCommitBefore: previousCheckpoint?.gitCommitAfter ?? gitState.headCommit ?? null,
    gitCommitAfter: gitState.headCommit ?? null,
    dirtyState: {
      isGitRepo: gitState.isGitRepo,
      clean: gitState.clean,
      ...(gitState.branch ? { branch: gitState.branch } : {}),
      stagedCount: gitState.stagedCount,
      unstagedCount: gitState.unstagedCount,
      untrackedCount: gitState.untrackedCount
    },
    stagedFiles: gitState.stagedFiles?.slice(0, 20) ?? [],
    relatedTaskPacket: currentActiveRoleHints?.latestTaskPacket ?? null,
    relatedHandoff: currentActiveRoleHints?.latestHandoff ?? null,
    relatedReconcile: currentActiveRoleHints?.latestReconcile ?? renderRelatedReconcilePointer(latestReconcile?.dispatchId),
    nextRecommendedAction: record.nextRecommendedStep,
    nextSuggestedCommand
  };
  const checkpointArtifacts = await writeCheckpointArtifacts(options.targetRoot, checkpoint);
  const nextFileToRead =
    currentActiveRoleHints?.latestTaskPacket ??
    currentActiveRoleHints?.latestHandoff ??
    currentActiveRoleHints?.latestReconcile ??
    buildBootstrapNextFileToRead();
  await updateActiveRoleHints(options.targetRoot, {
    activeRole: currentActiveRoleHints?.activeRole ?? contract.activeRole,
    supportingRoles: currentActiveRoleHints?.supportingRoles ?? contract.supportingRoles,
    authoritySource: selection.source,
    projectType: overlay?.bootstrap?.project_type ?? inspection.projectType,
    readNext: buildCanonicalReadNext({
      targetRoot: options.targetRoot,
      authorityOrder: compiledContext.authorityOrder,
      promotedAuthorityDocs: compiledContext.promotedAuthorityDocs,
      contract
    }),
    writeTargets: buildWriteTargets(contract, [".agent/state/current-phase.json"]),
    checksToRun: buildChecksToRun(record.validationsRun),
    stopConditions: buildStopConditions({
      riskLevel: decision.riskLevel,
      taskType: decision.taskType
    }),
    nextFileToRead,
    nextSuggestedCommand,
    nextAction: record.nextRecommendedStep,
    searchGuidance: buildSearchGuidance({
      taskType: decision.taskType,
      fileArea: decision.fileArea
    }),
    latestCheckpoint: relativeFrom(options.targetRoot, checkpointArtifacts.latestJsonPath)
  });
  options.logger.info(`checkpoint recorded: ${paths.currentPhasePath}`);
  options.logger.info(`history entry: ${paths.historyPath}`);
  options.logger.info(`latest checkpoint: ${checkpointArtifacts.latestJsonPath}`);
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

function renderRelatedReconcilePointer(dispatchId?: string): string | null {
  if (!dispatchId) {
    return null;
  }
  return `.agent/state/dispatch/${dispatchId}/reconcile-latest.json`;
}
