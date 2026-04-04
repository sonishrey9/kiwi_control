import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { loadLatestDispatchCollection, loadLatestDispatchManifest } from "@shrey-junior/sj-core/core/dispatch.js";
import { writeTaskPackets, summarizeWrites } from "@shrey-junior/sj-core/core/executor.js";
import { buildCanonicalReadNext, buildChecksToRun, buildSearchGuidance, buildStopConditions, buildWriteTargets, chooseNextFileToRead } from "@shrey-junior/sj-core/core/guidance.js";
import { buildRunPackets } from "@shrey-junior/sj-core/core/planner.js";
import { compileRepoContext } from "@shrey-junior/sj-core/core/context.js";
import { evaluatePolicyPoint } from "@shrey-junior/sj-core/core/policies.js";
import { buildTemplateContext, resolveRoutingDecision, selectPortableContract } from "@shrey-junior/sj-core/core/router.js";
import { assessGoalRisk } from "@shrey-junior/sj-core/core/risk.js";
import { loadLatestReconcileReport } from "@shrey-junior/sj-core/core/reconcile.js";
import { loadProjectOverlay, resolveExecutionMode, resolvePrimaryToolOverride, resolveProfileSelection } from "@shrey-junior/sj-core/core/profiles.js";
import { inspectBootstrapTarget } from "@shrey-junior/sj-core/core/project-detect.js";
import { PRODUCT_METADATA } from "@shrey-junior/sj-core/core/product.js";
import { loadContinuitySnapshot, updateActiveRoleHints } from "@shrey-junior/sj-core/core/state.js";
import { resolveSpecialist } from "@shrey-junior/sj-core/core/specialists.js";
import { recordRuntimeProgress } from "@shrey-junior/sj-core/core/runtime-lifecycle.js";
import { executeWorkflowStep } from "@shrey-junior/sj-core/core/workflow-engine.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface RunOptions {
  repoRoot: string;
  targetRoot: string;
  goal: string;
  profileName?: string;
  mode?: "assisted" | "guarded" | "inline";
  tool?: "codex" | "claude" | "copilot";
  logger: Logger;
}

export async function runRun(options: RunOptions): Promise<number> {
  const risk = assessGoalRisk(options.goal);
  if (risk.level === "high") {
    options.logger.warn(`high-risk goal detected: ${risk.reasons.join(", ")}`);
  }

  const config = await loadCanonicalConfig(options.repoRoot);
  const overlay = await loadProjectOverlay(options.targetRoot);
  const selection = await resolveProfileSelection(options.targetRoot, config, options.profileName);
  const inspection = await inspectBootstrapTarget(options.targetRoot, config);
  const executionMode = resolveExecutionMode(config, selection, overlay, options.mode);
  const context = buildTemplateContext(options.targetRoot, config, {
    profileName: selection.profileName,
    executionMode,
    projectType: overlay?.bootstrap?.project_type ?? inspection.projectType,
    profileSource: selection.source
  });
  const contract = selectPortableContract(config, context);
  const explicitTool = resolvePrimaryToolOverride(overlay, options.tool);
  const decision = resolveRoutingDecision(config, {
    goal: options.goal,
    profile: selection,
    executionMode,
    riskLevel: risk.level,
    ...(explicitTool ? { explicitTool } : {})
  });
  const specialist = resolveSpecialist({
    config,
    profileName: selection.profileName,
    taskType: decision.taskType,
    fileArea: decision.fileArea,
    tool: explicitTool ?? decision.primaryTool
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
    riskLevel: decision.riskLevel,
    specialistId: specialist.specialistId
  });
  const continuity = await loadContinuitySnapshot(options.targetRoot, decision.primaryTool);
  const latestDispatch = await loadLatestDispatchManifest(options.targetRoot);
  const latestCollection = await loadLatestDispatchCollection(options.targetRoot, latestDispatch?.dispatchId);
  const latestReconcile = await loadLatestReconcileReport(options.targetRoot, latestDispatch?.dispatchId);
  const policy = evaluatePolicyPoint("pre-run", {
    config,
    selection,
    overlay,
    compiledContext,
    specialist,
    taskType: decision.taskType,
    fileArea: decision.fileArea,
    tool: decision.primaryTool,
    latestPhase: continuity.latestPhase,
    latestDispatch,
    latestCollection,
    latestReconcile
  });
  if (policy.result !== "allowed") {
    options.logger.warn(`pre-run policy: ${policy.result}`);
    for (const finding of policy.findings) {
      options.logger.warn(`- ${finding.message}`);
    }
  }
  let packets: Awaited<ReturnType<typeof buildRunPackets>> = [];
  let results: Awaited<ReturnType<typeof writeTaskPackets>> = [];
  const workflowExecution = await executeWorkflowStep(options.targetRoot, {
    task: options.goal,
    stepId: "generate-run-packets",
    input: options.goal,
    expectedOutput: "One or more run packets are written for execution.",
    run: async () => {
      packets = await buildRunPackets(options.repoRoot, config, context, options.goal, decision, compiledContext, continuity, specialist);
      results = await writeTaskPackets(options.targetRoot, packets);
      return { packets, results };
    },
    validate: ({ packets, results }) => ({
      ok: packets.length > 0 && results.length > 0,
      validation:
        packets.length > 0 && results.length > 0
          ? "Run packet generation completed and packet artifacts were written."
          : "Run packet generation did not produce any packet artifacts.",
      ...(packets.length > 0 && results.length > 0
        ? {}
        : { failureReason: "No run packets were generated for the requested goal." })
    }),
    summarize: ({ packets, results }) => ({
      summary: `Generated ${results.length} task packet${results.length === 1 ? "" : "s"} for "${options.goal}".`,
      files: packets.map((packet) => packet.relativePath).slice(0, 12)
    })
  });
  if (!workflowExecution.ok) {
    await recordRuntimeProgress(options.targetRoot, {
      type: "packets_generated",
      stage: "blocked",
      status: "error",
      summary: workflowExecution.failureReason ?? "Run packet generation failed.",
      task: options.goal,
      command: `${PRODUCT_METADATA.cli.primaryCommand} run "${options.goal}"`,
      files: packets.map((packet) => packet.relativePath).slice(0, 12),
      validation: workflowExecution.validation,
      ...(workflowExecution.failureReason ? { failureReason: workflowExecution.failureReason } : {}),
      validationStatus: "error",
      nextSuggestedCommand: `${PRODUCT_METADATA.cli.primaryCommand} status`,
      nextRecommendedAction: workflowExecution.validation
    }).catch(() => null);
    options.logger.error(workflowExecution.failureReason ?? "Run packet generation failed.");
    return 1;
  }
  await updateActiveRoleHints(options.targetRoot, {
    activeRole: specialist?.specialistId ?? contract.activeRole,
    supportingRoles:
      specialist?.specialistId && specialist.specialistId !== contract.activeRole
        ? [...new Set([contract.activeRole, ...contract.supportingRoles].filter((role) => role !== specialist.specialistId))]
        : contract.supportingRoles,
    authoritySource: selection.source,
    projectType: context.projectType,
    readNext: buildCanonicalReadNext({
      targetRoot: options.targetRoot,
      authorityOrder: compiledContext.authorityOrder,
      promotedAuthorityDocs: compiledContext.promotedAuthorityDocs,
      contract
    }),
    nextFileToRead: chooseNextFileToRead({
      latestTaskPacket: packets[0]?.relativePath ?? null
    }),
    nextSuggestedCommand: `${PRODUCT_METADATA.cli.primaryCommand} checkpoint "<milestone>"`,
    writeTargets: buildWriteTargets(contract, packets.map((packet) => packet.relativePath)),
    checksToRun: buildChecksToRun(compiledContext.validationSteps),
    stopConditions: buildStopConditions({
      riskLevel: decision.riskLevel,
      taskType: decision.taskType
    }),
    nextAction: `Open .agent/state/latest-task-packets.json and execute the ${decision.primaryTool} run packet before expanding scope.`,
    searchGuidance: buildSearchGuidance({
      taskType: decision.taskType,
      fileArea: decision.fileArea
    })
  });
  await recordRuntimeProgress(options.targetRoot, {
    type: "packets_generated",
    stage: "packetized",
    status: "ok",
    summary: `Generated ${results.length} task packet${results.length === 1 ? "" : "s"} for "${options.goal}".`,
    task: options.goal,
    command: `${PRODUCT_METADATA.cli.primaryCommand} checkpoint "<milestone>"`,
    files: packets.map((packet) => packet.relativePath).slice(0, 12),
    estimatedTokens: null,
    validation: "Run packet generation completed and packet artifacts were written.",
    validationStatus: risk.level === "high" ? "warn" : "ok",
    nextSuggestedCommand: `${PRODUCT_METADATA.cli.primaryCommand} checkpoint "<milestone>"`,
    nextRecommendedAction: `Execute the generated ${decision.primaryTool} packet and checkpoint progress before widening scope.`
  }).catch(() => null);
  options.logger.info(summarizeWrites(results, options.targetRoot));
  return 0;
}
