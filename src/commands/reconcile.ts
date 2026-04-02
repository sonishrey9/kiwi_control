import { loadCanonicalConfig } from "../core/config.js";
import { compileRepoContext } from "../core/context.js";
import { collectDispatchOutputs, loadLatestDispatchCollection, loadLatestDispatchManifest, writeDispatchCollection } from "../core/dispatch.js";
import { buildChecksToRun, buildSearchGuidance, buildStopConditions, buildWriteTargets } from "../core/guidance.js";
import { buildReconcileReport, writeReconcileArtifacts } from "../core/reconcile.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "../core/profiles.js";
import type { Logger } from "../core/logger.js";
import { updateActiveRoleHints } from "../core/state.js";
import { buildTemplateContext, selectPortableContract } from "../core/router.js";
import { renderDisplayPath } from "../utils/fs.js";

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
  const artifacts = await writeReconcileArtifacts(options.targetRoot, manifest.dispatchId, report);
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
    checksToRun: buildChecksToRun(context.validationSteps),
    writeTargets: buildWriteTargets(contract, [renderDisplayPath(options.targetRoot, artifacts.jsonPath)]),
    stopConditions: buildStopConditions({
      riskLevel: manifest.routingSummary.riskLevel,
      taskType: manifest.routingSummary.taskType
    }),
    nextAction: report.recommendedNextStep,
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
