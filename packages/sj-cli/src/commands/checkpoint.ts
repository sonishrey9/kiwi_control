import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { compileRepoContext } from "@shrey-junior/sj-core/core/context.js";
import { buildBootstrapNextFileToRead, buildCanonicalReadNext, buildChecksToRun, buildSearchGuidance, buildStopConditions, buildWriteTargets, chooseNextFileToRead } from "@shrey-junior/sj-core/core/guidance.js";
import { inspectGitState } from "@shrey-junior/sj-core/core/git.js";
import { getMemoryPaths, writeOpenRisksRecord } from "@shrey-junior/sj-core/core/memory.js";
import { loadPreparedScope, validateTouchedFilesAgainstAllowedFiles } from "@shrey-junior/sj-core/core/prepared-scope.js";
import { loadLatestReconcileReport } from "@shrey-junior/sj-core/core/reconcile.js";
import { inspectBootstrapTarget } from "@shrey-junior/sj-core/core/project-detect.js";
import { PRODUCT_METADATA } from "@shrey-junior/sj-core/core/product.js";
import { loadProjectOverlay, resolveExecutionMode, resolvePrimaryToolOverride, resolveProfileSelection } from "@shrey-junior/sj-core/core/profiles.js";
import { recommendMcpPack } from "@shrey-junior/sj-core/core/recommendations.js";
import { assessGoalRisk } from "@shrey-junior/sj-core/core/risk.js";
import { buildTemplateContext, resolveRoutingDecision, selectPortableContract } from "@shrey-junior/sj-core/core/router.js";
import { recommendNextSpecialist } from "@shrey-junior/sj-core/core/specialists.js";
import { recordExecutionState } from "@shrey-junior/sj-core/core/execution-state.js";
import { buildPhaseId, loadActiveRoleHints, loadLatestCheckpoint, parseCsvFlag, type CheckpointRecord, type PhaseStatus, type PhaseRecord, updateActiveRoleHints, writeCheckpointArtifacts, writePhaseRecord } from "@shrey-junior/sj-core/core/state.js";
import { loadCurrentPhase } from "@shrey-junior/sj-core/core/state.js";
import { recordPreparedScopeCompletion } from "@shrey-junior/sj-core/core/execution-log.js";
import { syncExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import {
  buildRuntimeDecision,
  buildRuntimeDecisionAction,
  buildRuntimeDecisionRecovery
} from "@shrey-junior/sj-core/core/runtime-decision.js";
import { syncPackSelectionSideEffects } from "./helpers/pack-selection.js";
import { recordRuntimeProgress } from "@shrey-junior/sj-core/core/runtime-lifecycle.js";
import { executeWorkflowStep, loadWorkflowState } from "@shrey-junior/sj-core/core/workflow-engine.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { pathExists, relativeFrom } from "@shrey-junior/sj-core/utils/fs.js";

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
  const preparedScope = await loadPreparedScope(options.targetRoot);
  const scopeValidation = preparedScope
    ? validateTouchedFilesAgainstAllowedFiles(preparedScope.allowedFiles, gitState.changedFiles)
    : null;
  const scopeFailure = scopeValidation && !scopeValidation.ok
    ? `Prepared scope violated by touched files: ${scopeValidation.outOfScopeFiles.slice(0, 5).join(", ")}`
    : null;
  const workflowState = await loadWorkflowState(options.targetRoot).catch(() => null);
  const validationStep = workflowState?.steps.find((step) => step.stepId === "validate-outcome") ?? null;
  const validationFailure = validationStep && validationStep.status !== "success"
    ? `Final validation must pass before checkpointing.`
    : null;
  const latestReconcile = await loadLatestReconcileReport(options.targetRoot);
  const memoryPaths = getMemoryPaths(options.targetRoot);
  const generatedAt = buildTemplateContext(options.targetRoot, config, {
    profileName: selection.profileName,
    executionMode,
    projectType: overlay?.bootstrap?.project_type ?? inspection.projectType,
    profileSource: selection.source
  }).generatedAt;
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
  const nextRecommendedSpecialist = recommendNextSpecialist({
    config,
    profileName: selection.profileName,
    projectType: overlay?.bootstrap?.project_type ?? inspection.projectType,
    fileArea: decision.fileArea,
    taskType: decision.taskType,
    ...(currentActiveRoleHints?.activeRole || contract.activeRole
      ? { activeSpecialistId: currentActiveRoleHints?.activeRole ?? contract.activeRole }
      : {})
  }).specialistId;
  const nextSuggestedMcpPack = recommendMcpPack({
    projectType: overlay?.bootstrap?.project_type ?? inspection.projectType,
    taskType: decision.taskType,
    fileArea: decision.fileArea,
    starterMcpHints: (overlay?.bootstrap?.mcp_policy_hints ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  });
  const validationsRun = dedupeList([
    ...parseCsvFlag(options.validations),
    ...(preparedScope ? ["Prepared scope validation"] : [])
  ]);
  const warnings = dedupeList([
    ...parseCsvFlag(options.warnings),
    ...(scopeFailure ? [scopeFailure] : []),
    ...(validationFailure ? [validationFailure] : [])
  ]);
  const openIssues = dedupeList([
    ...parseCsvFlag(options.openIssues),
    ...(scopeFailure ? [scopeFailure] : []),
    ...(validationFailure ? [validationFailure] : [])
  ]);
  const phaseStatus = scopeFailure || validationFailure ? "blocked" : options.status ?? inferPhaseStatus(options.label);
  const nextRecommendedStep = scopeFailure
    ? "Refresh the prepared scope before recording another checkpoint."
    : validationFailure
      ? "Run final validation before recording a checkpoint."
      : options.nextStep ??
      (decision.requiredRoles.length > 0
        ? `Continue with ${decision.requiredRoles.join(", ")} coverage before closing the work.`
        : `Continue with ${decision.primaryTool} using the latest repo-local packets.`);
  const record: PhaseRecord = {
    artifactType: "shrey-junior/current-phase",
    version: 3,
    timestamp: generatedAt,
    phaseId: buildPhaseId(options.label, generatedAt),
    label: options.label,
    goal,
    profile: selection.profileName,
    mode: executionMode,
    ...(explicitTool ? { tool: explicitTool } : {}),
    status: phaseStatus,
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
    validationsRun,
    warnings,
    openIssues,
    latestMemoryFocus: relativeFrom(options.targetRoot, memoryPaths.currentFocus),
    nextRecommendedSpecialist,
    nextSuggestedMcpPack,
    nextRecommendedStep,
    ...(previousPhase?.tool ? { previousTool: previousPhase.tool } : {}),
    ...(previousPhase?.phaseId ? { previousPhaseId: previousPhase.phaseId } : {})
  };
  const nextSuggestedCommand =
    scopeFailure
      ? `${PRODUCT_METADATA.cli.primaryCommand} prepare "${preparedScope?.task ?? goal}"`
      : validationFailure
        ? `${PRODUCT_METADATA.cli.primaryCommand} validate "${goal}"`
      : record.status === "blocked"
        ? `${PRODUCT_METADATA.cli.primaryCommand} status`
        : record.status === "complete"
        ? `${PRODUCT_METADATA.cli.primaryCommand} push-check`
          : `${PRODUCT_METADATA.cli.primaryCommand} handoff --to ${nextRecommendedSpecialist} --tool ${decision.reviewTool}`;
  await recordExecutionState(options.targetRoot, {
    type: "checkpoint-started",
    lifecycle: "running",
    task: goal,
    sourceCommand: `${PRODUCT_METADATA.cli.primaryCommand} checkpoint "${options.label}"`,
    reason: `Recording checkpoint "${options.label}".`,
    nextCommand: nextSuggestedCommand,
    blockedBy: [],
    reuseOperation: true,
    decision: buildRuntimeDecision({
      currentStepId: "checkpoint",
      currentStepStatus: "running",
      nextCommand: nextSuggestedCommand,
      readinessLabel: "Running",
      readinessTone: "ready",
      readinessDetail: `Recording checkpoint "${options.label}".`,
      nextAction: buildRuntimeDecisionAction(
        "Checkpoint progress",
        `${PRODUCT_METADATA.cli.primaryCommand} checkpoint "${options.label}"`,
        `Recording checkpoint "${options.label}".`,
        "normal"
      ),
      decisionSource: "checkpoint-command"
    })
  }).catch(() => null);
  const workflowExecution = await executeWorkflowStep(options.targetRoot, {
    task: goal,
    stepId: "checkpoint-progress",
    input: options.label,
    expectedOutput: "Checkpoint artifacts are written and continuity is updated.",
    run: async () => {
      await recordPreparedScopeCompletion(options.targetRoot, {
        completionSource: "checkpoint",
        tool: PRODUCT_METADATA.cli.primaryCommand
      }).catch(() => null);
      const paths = await writePhaseRecord(options.targetRoot, record);

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
        checksPassed: scopeFailure ? record.validationsRun.filter((item) => item !== "Prepared scope validation") : record.validationsRun,
        checksFailed: scopeFailure ? [scopeFailure] : [],
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
        latestMemoryFocus: relativeFrom(options.targetRoot, memoryPaths.currentFocus),
        nextRecommendedSpecialist,
        nextSuggestedMcpPack,
        nextRecommendedAction: record.nextRecommendedStep,
        nextSuggestedCommand
      };
      const checkpointArtifacts = await writeCheckpointArtifacts(options.targetRoot, checkpoint);
      const nextFileToRead = chooseNextFileToRead({
        latestTaskPacket: currentActiveRoleHints?.latestTaskPacket ?? null,
        latestHandoff: currentActiveRoleHints?.latestHandoff ?? null,
        latestReconcile: currentActiveRoleHints?.latestReconcile ?? renderRelatedReconcilePointer(latestReconcile?.dispatchId),
        latestCheckpoint: relativeFrom(options.targetRoot, checkpointArtifacts.latestJsonPath)
      });
      await writeOpenRisksRecord(options.targetRoot, "checkpoint", record.openIssues);
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
        nextRecommendedSpecialist,
        nextSuggestedMcpPack,
        searchGuidance: buildSearchGuidance({
          taskType: decision.taskType,
          fileArea: decision.fileArea
        }),
        latestMemoryFocus: relativeFrom(options.targetRoot, memoryPaths.currentFocus),
        latestCheckpoint: relativeFrom(options.targetRoot, checkpointArtifacts.latestJsonPath)
      });

      return {
        scopeFailure,
        checkpointArtifacts,
        nextSuggestedCommand,
        paths
      };
    },
    validate: async (result) => {
      const artifactsWritten =
        await pathExists(result.paths.currentPhasePath) &&
        await pathExists(result.paths.historyPath) &&
        await pathExists(result.checkpointArtifacts.latestJsonPath);
      const ok = !result.scopeFailure && !validationFailure && artifactsWritten;
      return {
        ok,
        validation: ok
          ? "Checkpoint artifacts were written and continuity hints were updated."
          : result.scopeFailure
            ? "Prepared scope validation failed during checkpoint."
            : validationFailure
              ? "Final validation must pass before checkpointing."
            : "Checkpoint artifacts were not fully written.",
        ...(ok
          ? {}
          : {
              failureReason: result.scopeFailure ?? validationFailure ?? "Checkpoint artifacts were not fully written.",
              suggestedFix: result.scopeFailure
                ? `Refresh the prepared scope with ${nextSuggestedCommand} before retrying this checkpoint.`
                : validationFailure
                  ? `Run ${nextSuggestedCommand} before retrying this checkpoint.`
                : `Retry kiwi-control checkpoint "${options.label}" after fixing the artifact write failure.`
            })
      };
    },
    summarize: (result) => ({
      summary: result.scopeFailure
        ? `Checkpoint "${options.label}" detected scope drift.`
        : `Checkpoint "${options.label}" recorded successfully.`,
      files: gitState.changedFiles.slice(0, 12)
    })
  });

  await recordRuntimeProgress(options.targetRoot, {
    type: workflowExecution.ok ? "checkpoint_recorded" : "validation_checkpoint",
    stage: workflowExecution.ok ? "checkpointed" : "blocked",
    status: workflowExecution.ok ? "ok" : "error",
    summary: workflowExecution.ok
      ? `Checkpoint "${options.label}" recorded successfully.`
      : workflowExecution.failureReason ?? `Checkpoint "${options.label}" failed.`,
    task: goal,
    command: workflowExecution.ok ? nextSuggestedCommand : workflowExecution.retryCommand,
    files: gitState.changedFiles.slice(0, 12),
    validation: workflowExecution.validation,
    ...(workflowExecution.failureReason ? { failureReason: workflowExecution.failureReason } : {}),
    validationStatus: workflowExecution.ok ? "ok" : "error",
    nextSuggestedCommand: workflowExecution.ok ? nextSuggestedCommand : workflowExecution.retryCommand,
    nextRecommendedAction: workflowExecution.ok ? record.nextRecommendedStep : (workflowExecution.suggestedFix ?? workflowExecution.validation)
  }).catch(() => null);
  await syncExecutionPlan(options.targetRoot, {
    task: goal,
    forceState: workflowExecution.ok ? "ready" : "blocked"
  }).catch(() => null);
  await recordExecutionState(options.targetRoot, {
    type: workflowExecution.ok ? "checkpoint-completed" : "checkpoint-failed",
    lifecycle: workflowExecution.ok ? "completed" : "blocked",
    task: goal,
    sourceCommand: `${PRODUCT_METADATA.cli.primaryCommand} checkpoint "${options.label}"`,
    reason: workflowExecution.ok
      ? `Checkpoint "${options.label}" recorded successfully.`
      : workflowExecution.failureReason ?? `Checkpoint "${options.label}" failed.`,
    nextCommand: workflowExecution.ok ? nextSuggestedCommand : workflowExecution.retryCommand,
    blockedBy: workflowExecution.ok ? [] : [workflowExecution.failureReason ?? workflowExecution.validation],
    ...(workflowExecution.ok && workflowExecution.result
      ? {
          artifacts: {
            checkpoint: [
              relativeFrom(options.targetRoot, workflowExecution.result.checkpointArtifacts.latestJsonPath),
              relativeFrom(options.targetRoot, workflowExecution.result.paths.currentPhasePath)
            ]
          }
        }
      : {}),
    reuseOperation: true,
    decision: workflowExecution.ok
      ? buildRuntimeDecision({
          currentStepId: "handoff",
          currentStepStatus: "pending",
          nextCommand: workflowExecution.ok ? nextSuggestedCommand : workflowExecution.retryCommand,
          readinessLabel: "Completed",
          readinessTone: "ready",
          readinessDetail: `Checkpoint "${options.label}" recorded successfully.`,
          nextAction: buildRuntimeDecisionAction(
            "Handoff work",
            nextSuggestedCommand,
            record.nextRecommendedStep,
            "normal"
          ),
          decisionSource: "checkpoint-command"
        })
      : buildRuntimeDecision({
          currentStepId: "checkpoint",
          currentStepStatus: "failed",
          nextCommand: workflowExecution.retryCommand,
          readinessLabel: "Workflow blocked",
          readinessTone: "blocked",
          readinessDetail: workflowExecution.failureReason ?? `Checkpoint "${options.label}" failed.`,
          nextAction: buildRuntimeDecisionAction(
            "Fix the blocking execution issue",
            workflowExecution.retryCommand,
            workflowExecution.failureReason ?? workflowExecution.validation,
            "critical"
          ),
          recovery: buildRuntimeDecisionRecovery(
            "blocked",
            workflowExecution.failureReason ?? workflowExecution.validation,
            workflowExecution.retryCommand,
            `${PRODUCT_METADATA.cli.primaryCommand} checkpoint "${options.label}"`
          ),
          decisionSource: "checkpoint-command"
        })
  }).catch(() => null);
  if (!workflowExecution.ok || !workflowExecution.result) {
    options.logger.error(workflowExecution.failureReason ?? `Checkpoint "${options.label}" failed.`);
    return 1;
  }
  await syncPackSelectionSideEffects({
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    ...(options.profileName ? { profileName: options.profileName } : {})
  }).catch(() => null);
  options.logger.info(`checkpoint recorded: ${workflowExecution.result.paths.currentPhasePath}`);
  options.logger.info(`history entry: ${workflowExecution.result.paths.historyPath}`);
  options.logger.info(`latest checkpoint: ${workflowExecution.result.checkpointArtifacts.latestJsonPath}`);
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
