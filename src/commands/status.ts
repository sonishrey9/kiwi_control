import { loadCanonicalConfig } from "../core/config.js";
import { compileRepoContext } from "../core/context.js";
import { listDispatchManifests, loadLatestDispatchCollection } from "../core/dispatch.js";
import { assessPushReadiness, inspectGitState } from "../core/git.js";
import { inspectBootstrapTarget } from "../core/project-detect.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "../core/profiles.js";
import { loadLatestReconcileReport } from "../core/reconcile.js";
import { listTaskPacketDirectories, loadActiveRoleHints, loadContinuitySnapshot, loadLatestTaskPacketSet } from "../core/state.js";
import type { Logger } from "../core/logger.js";
import { renderDisplayPath } from "../utils/fs.js";

export interface StatusOptions {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
  logger: Logger;
}

export async function runStatus(options: StatusOptions): Promise<number> {
  const config = await loadCanonicalConfig(options.repoRoot);
  const overlay = await loadProjectOverlay(options.targetRoot);
  const selection = await resolveProfileSelection(options.targetRoot, config, options.profileName);
  const inspection = await inspectBootstrapTarget(options.targetRoot, config);
  const continuity = await loadContinuitySnapshot(options.targetRoot);
  const activeRoleHints = await loadActiveRoleHints(options.targetRoot);
  const executionMode = resolveExecutionMode(config, selection, overlay, continuity.latestPhase?.mode);
  const context = await compileRepoContext({
    targetRoot: options.targetRoot,
    config,
    profileName: selection.profileName,
    profile: selection.profile,
    overlay,
    executionMode,
    taskType: continuity.latestPhase?.routingSummary.taskType ?? config.global.defaults.default_task_type,
    fileArea: continuity.latestPhase?.routingSummary.fileArea ?? "application",
    changeSize: continuity.latestPhase?.routingSummary.changeSize ?? config.global.defaults.default_change_size,
    riskLevel: continuity.latestPhase?.routingSummary.riskLevel ?? "medium"
  });
  const taskDirectories = await listTaskPacketDirectories(options.targetRoot);
  const latestTaskPacketSet = await loadLatestTaskPacketSet(options.targetRoot);
  const gitState = await inspectGitState(options.targetRoot);
  const push = assessPushReadiness(gitState, continuity.latestPhase);
  const dispatches = await listDispatchManifests(options.targetRoot);
  const latestDispatch = dispatches[0] ?? null;
  const latestBlockedDispatch = dispatches.find((dispatch) => dispatch.status === "blocked") ?? null;
  const latestCollection = await loadLatestDispatchCollection(options.targetRoot, latestDispatch?.dispatchId);
  const latestReconcile = await loadLatestReconcileReport(options.targetRoot);
  const dispatchCounts = {
    pending: dispatches.filter((dispatch) => dispatch.status === "pending").length,
    active: dispatches.filter((dispatch) => dispatch.status === "active").length,
    blocked: dispatches.filter((dispatch) => dispatch.status === "blocked").length,
    complete: dispatches.filter((dispatch) => dispatch.status === "complete").length
  };

  const lines = [
    `profile: ${selection.profileName} (${selection.source})`,
    `project type: ${inspection.projectType} (${inspection.projectTypeSource})`,
    `execution mode: ${executionMode}`,
    activeRoleHints
      ? `active role hints: ${activeRoleHints.activeRole}${activeRoleHints.supportingRoles.length > 0 ? ` | supporting=${activeRoleHints.supportingRoles.join(", ")}` : ""}`
      : "active role hints: none recorded",
    activeRoleHints?.nextFileToRead ? `next file: ${activeRoleHints.nextFileToRead}` : "next file: none recorded",
    activeRoleHints?.nextSuggestedCommand ? `next command: ${activeRoleHints.nextSuggestedCommand}` : "next command: none recorded",
    activeRoleHints?.nextAction ? `next action: ${activeRoleHints.nextAction}` : "next action: none recorded",
    activeRoleHints?.readNext?.length
      ? `read next: ${activeRoleHints.readNext.slice(0, 5).join(" -> ")}`
      : "read next: none recorded",
    activeRoleHints?.checksToRun?.length
      ? `checks to run: ${activeRoleHints.checksToRun.slice(0, 4).join(" | ")}`
      : "checks to run: none recorded",
    continuity.latestPhase
      ? `current phase: ${continuity.latestPhase.label} [${continuity.latestPhase.status}]`
      : "current phase: none recorded",
    continuity.latestCheckpoint
      ? `latest checkpoint: ${continuity.latestCheckpoint.phase} [${continuity.latestCheckpoint.createdAt}]`
      : "latest checkpoint: none recorded",
    continuity.latestPhase?.tool ? `previous tool: ${continuity.latestPhase.tool}` : "previous tool: none recorded",
    continuity.latestHandoff
      ? `latest handoff: ${continuity.latestHandoff.summary} -> ${continuity.latestHandoff.toTool} [${continuity.latestHandoff.status}]`
      : "latest handoff: none recorded",
    latestDispatch
      ? `latest dispatch: ${latestDispatch.dispatchId} [${latestDispatch.status}]`
      : "latest dispatch: none recorded",
    `dispatch counts: pending=${dispatchCounts.pending} active=${dispatchCounts.active} blocked=${dispatchCounts.blocked} complete=${dispatchCounts.complete}`,
    latestBlockedDispatch && latestBlockedDispatch.dispatchId !== latestDispatch?.dispatchId
      ? `latest blocked dispatch: ${latestBlockedDispatch.dispatchId} [${latestBlockedDispatch.status}]`
      : latestBlockedDispatch
        ? "latest blocked dispatch: same as latest dispatch"
        : "latest blocked dispatch: none recorded",
    latestCollection
      ? `latest collect: completed=${latestCollection.completedRoles.join(", ") || "none"} missing=${latestCollection.missingRoles.join(", ") || "none"}`
      : "latest collect: none recorded",
    latestReconcile
      ? `latest reconcile: ${latestReconcile.dispatchId} [${latestReconcile.status}, ${latestReconcile.analysisBasis}]`
      : "latest reconcile: none recorded",
    `task packet sets: ${taskDirectories.length}`,
    latestTaskPacketSet
      ? `latest task packet set: ${latestTaskPacketSet.packetSet} (${latestTaskPacketSet.files.length} files)`
      : "latest task packet set: none recorded",
    activeRoleHints?.latestCheckpoint ? `active latest checkpoint pointer: ${activeRoleHints.latestCheckpoint}` : "active latest checkpoint pointer: none recorded",
    activeRoleHints?.latestTaskPacket ? `active latest task packet pointer: ${activeRoleHints.latestTaskPacket}` : "active latest task packet pointer: none recorded",
    activeRoleHints?.latestHandoff ? `active latest handoff pointer: ${activeRoleHints.latestHandoff}` : "active latest handoff pointer: none recorded",
    activeRoleHints?.latestDispatchManifest ? `active latest dispatch pointer: ${activeRoleHints.latestDispatchManifest}` : "active latest dispatch pointer: none recorded",
    activeRoleHints?.latestReconcile ? `active latest reconcile pointer: ${activeRoleHints.latestReconcile}` : "active latest reconcile pointer: none recorded",
    activeRoleHints?.writeTargets?.length
      ? `write targets: ${activeRoleHints.writeTargets.slice(0, 4).join(" | ")}`
      : "write targets: none recorded",
    ...taskDirectories.slice(0, 3).map((entry) => `- packet set: ${entry.name} (${entry.fileCount} files)`),
    inspection.authorityOptOut
      ? `authority precedence: repo-local authority requests repo-local-only behavior (${inspection.authorityOptOut})`
      : context.authorityOrder.length
        ? "authority precedence: repo-local authority and promoted docs override global preference layers"
        : "authority precedence: no repo-local authority found; global guidance only assists until repo-local state exists",
    ...(context.promotedAuthorityDocs.length > 0
      ? ["promoted canonical docs:", ...context.promotedAuthorityDocs.slice(0, 4).map((authority) => `- ${renderDisplayPath(options.targetRoot, authority)}`)]
      : []),
    "authority files:",
    ...context.authorityOrder.slice(0, 6).map((authority) => `- ${renderDisplayPath(options.targetRoot, authority)}`),
    continuity.latestPhase?.warnings.length
      ? `warnings: ${continuity.latestPhase.warnings.join("; ")}`
      : "warnings: none recorded",
    gitState.isGitRepo
      ? `git: branch=${gitState.branch ?? "detached"} staged=${gitState.stagedCount} unstaged=${gitState.unstagedCount} untracked=${gitState.untrackedCount}`
      : "git: target is not a git repository",
    `push readiness: ${push.result}`
  ];

  options.logger.info(lines.join("\n"));
  return 0;
}
