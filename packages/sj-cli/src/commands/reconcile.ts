import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { compileRepoContext } from "@shrey-junior/sj-core/core/context.js";
import { collectDispatchOutputs, loadLatestDispatchCollection, loadLatestDispatchManifest, writeDispatchCollection } from "@shrey-junior/sj-core/core/dispatch.js";
import { buildChecksToRun, buildSearchGuidance, buildStopConditions, buildWriteTargets, chooseNextFileToRead } from "@shrey-junior/sj-core/core/guidance.js";
import { buildReconcileReport, writeReconcileArtifacts } from "@shrey-junior/sj-core/core/reconcile.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "@shrey-junior/sj-core/core/profiles.js";
import { recommendMcpPack } from "@shrey-junior/sj-core/core/recommendations.js";
import { recommendNextSpecialist } from "@shrey-junior/sj-core/core/specialists.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { updateActiveRoleHints } from "@shrey-junior/sj-core/core/state.js";
import { buildTemplateContext, selectPortableContract } from "@shrey-junior/sj-core/core/router.js";
import { renderDisplayPath } from "@shrey-junior/sj-core/utils/fs.js";

export interface ReconcileOptions {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
  logger: Logger;
}

export async function runReconcile(options: ReconcileOptions): Promise<number> {
  const config = await loadCanonicalConfig(options.repoRoot);
  const overlay = await loadProjectOverlay(options.targetRoot);
  const selection = await resolveProfileSelection(options.targetRoot, config, options.profileName);
  const manifest = await loadLatestDispatchManifest(options.targetRoot);
  if (!manifest) {
    throw new Error("no dispatch manifest found in target repo");
  }

  let collection = await loadLatestDispatchCollection(options.targetRoot, manifest.dispatchId);
  if (!collection) {
    collection = await collectDispatchOutputs(options.targetRoot, manifest);
    await writeDispatchCollection(options.targetRoot, manifest, collection);
  }

  const executionMode = resolveExecutionMode(config, selection, overlay, manifest.mode);
  const context = await compileRepoContext({
    targetRoot: options.targetRoot,
    config,
    profileName: selection.profileName,
    profile: selection.profile,
    overlay,
    executionMode,
    taskType: manifest.routingSummary.taskType,
    fileArea: manifest.routingSummary.fileArea,
    changeSize: manifest.routingSummary.changeSize,
    riskLevel: manifest.routingSummary.riskLevel
  });
  const report = buildReconcileReport(manifest, collection, context);
  const artifacts = await writeReconcileArtifacts({
    targetRoot: options.targetRoot,
    dispatchId: manifest.dispatchId,
    report,
    config,
    profileName: selection.profileName
  });
  const contract = selectPortableContract(
    config,
    buildTemplateContext(options.targetRoot, config, {
      profileName: selection.profileName,
      executionMode,
      projectType: overlay?.bootstrap?.project_type ?? "generic",
      profileSource: selection.source
    })
  );
  await updateActiveRoleHints(options.targetRoot, {
    activeRole: contract.activeRole,
    supportingRoles: contract.supportingRoles,
    authoritySource: selection.source,
    projectType: overlay?.bootstrap?.project_type ?? "generic",
    nextFileToRead: chooseNextFileToRead({
      latestReconcile: ".agent/state/reconcile/latest.json"
    }),
    nextSuggestedCommand:
      report.status === "ready-for-next-phase"
        ? `shrey-junior checkpoint "<milestone>" --target "${options.targetRoot}"`
        : `shrey-junior collect --target "${options.targetRoot}"`,
    checksToRun: buildChecksToRun(context.validationSteps),
    writeTargets: buildWriteTargets(contract, [renderDisplayPath(options.targetRoot, artifacts.jsonPath)]),
    stopConditions: buildStopConditions({
      riskLevel: manifest.routingSummary.riskLevel,
      taskType: manifest.routingSummary.taskType
    }),
    nextAction: report.recommendedNextStep,
    nextRecommendedSpecialist: recommendNextSpecialist({
      config,
      profileName: selection.profileName,
      projectType: overlay?.bootstrap?.project_type ?? "generic",
      taskType: report.status === "ready-for-next-phase" ? "release-readiness" : "review",
      fileArea: "context",
      activeSpecialistId: contract.activeRole,
      blocked: report.status === "blocked"
    }).specialistId,
    nextSuggestedMcpPack: recommendMcpPack({
      projectType: overlay?.bootstrap?.project_type ?? "generic",
      taskType: report.status === "ready-for-next-phase" ? "release-readiness" : "review",
      fileArea: "context"
    }),
    searchGuidance: buildSearchGuidance({
      taskType: manifest.routingSummary.taskType,
      fileArea: manifest.routingSummary.fileArea
    })
  });

  options.logger.info(
    [
      `reconcile status: ${report.status}`,
      `analysis basis: ${report.analysisBasis}`,
      `role status gaps: ${report.roleStatusGaps.join(", ") || "none"}`,
      `malformed roles: ${report.malformedRoles.join(", ") || "none"}`,
      `heuristic fallback roles: ${report.fallbackRoles.join(", ") || "none"}`,
      `reconcile json: ${renderDisplayPath(options.targetRoot, artifacts.jsonPath)}`,
      `reconcile markdown: ${renderDisplayPath(options.targetRoot, artifacts.markdownPath)}`
    ].join("\n")
  );
  return report.status === "blocked" ? 1 : 0;
}
