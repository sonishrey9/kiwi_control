import path from "node:path";
import type { LoadedConfig } from "./config.js";
import { loadCanonicalConfig } from "./config.js";
import { compileRepoContext } from "./context.js";
import { getMemoryPaths, loadOpenRisks } from "./memory.js";
import { inspectBootstrapTarget } from "./project-detect.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "./profiles.js";
import { getMcpPackDefinition, listMcpPacks, recommendMcpPack } from "./recommendations.js";
import { loadLatestReconcileReport } from "./reconcile.js";
import { listSpecialists, normalizeSpecialistId, recommendNextSpecialist } from "./specialists.js";
import { loadActiveRoleHints, loadContinuitySnapshot, loadLatestTaskPacketSet } from "./state.js";
import type { ValidationIssue } from "./validator.js";
import { validateControlPlane, validateTargetRepo } from "./validator.js";
import { pathExists, renderDisplayPath } from "../utils/fs.js";

export interface RepoControlPanelItem {
  label: string;
  value: string;
  tone?: "default" | "warn";
}

export interface RepoMemoryBankEntry {
  label: string;
  path: string;
  present: boolean;
}

export interface RepoValidationSummary {
  ok: boolean;
  errors: number;
  warnings: number;
  issues: ValidationIssue[];
}

export interface RepoControlState {
  targetRoot: string;
  profileName: string;
  executionMode: string;
  projectType: string;
  repoOverview: RepoControlPanelItem[];
  continuity: RepoControlPanelItem[];
  memoryBank: RepoMemoryBankEntry[];
  specialists: {
    recommendedSpecialist: string;
    available: ReturnType<typeof listSpecialists>;
    handoffTargets: string[];
    safeParallelHint: string;
  };
  mcpPacks: {
    suggestedPack: ReturnType<typeof getMcpPackDefinition>;
    available: ReturnType<typeof listMcpPacks>;
  };
  validation: RepoValidationSummary;
}

export async function buildRepoControlState(options: {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
}): Promise<RepoControlState> {
  const config = await loadCanonicalConfig(options.repoRoot);
  return buildRepoControlStateFromConfig({
    config,
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    ...(options.profileName ? { profileName: options.profileName } : {})
  });
}

export async function buildRepoControlStateFromConfig(options: {
  config: LoadedConfig;
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
}): Promise<RepoControlState> {
  const inspection = await inspectBootstrapTarget(options.targetRoot, options.config);
  const overlay = await loadProjectOverlay(options.targetRoot);
  const selection = await resolveProfileSelection(options.targetRoot, options.config, options.profileName);
  const continuity = await loadContinuitySnapshot(options.targetRoot);
  const activeRoleHints = await loadActiveRoleHints(options.targetRoot);
  const executionMode = resolveExecutionMode(options.config, selection, overlay, continuity.latestPhase?.mode);
  const compiledContext = await compileRepoContext({
    targetRoot: options.targetRoot,
    config: options.config,
    profileName: selection.profileName,
    profile: selection.profile,
    overlay,
    executionMode,
    taskType: continuity.latestPhase?.routingSummary.taskType ?? options.config.global.defaults.default_task_type,
    fileArea: continuity.latestPhase?.routingSummary.fileArea ?? "application",
    changeSize: continuity.latestPhase?.routingSummary.changeSize ?? options.config.global.defaults.default_change_size,
    riskLevel: continuity.latestPhase?.routingSummary.riskLevel ?? "medium"
  });
  const recommendedSpecialist =
    normalizeSpecialistId(options.config, activeRoleHints?.nextRecommendedSpecialist) ??
    normalizeSpecialistId(options.config, continuity.currentFocus?.nextRecommendedSpecialist) ??
    recommendNextSpecialist({
      config: options.config,
      profileName: selection.profileName,
      taskType: compiledContext.taskType,
      fileArea: compiledContext.fileArea,
      projectType: inspection.projectType,
      ...(activeRoleHints?.activeRole ? { activeSpecialistId: activeRoleHints.activeRole } : {})
    }).specialistId;
  const suggestedPackId =
    activeRoleHints?.nextSuggestedMcpPack ??
    continuity.currentFocus?.nextSuggestedMcpPack ??
    recommendMcpPack({
      projectType: inspection.projectType,
      taskType: compiledContext.taskType,
      fileArea: compiledContext.fileArea,
      starterMcpHints: compiledContext.eligibleMcpServers,
      authorityFiles: compiledContext.authorityOrder
    });
  const suggestedPack = getMcpPackDefinition(suggestedPackId);
  const validationIssues = [
    ...(await validateControlPlane(options.repoRoot, options.config)),
    ...(await validateTargetRepo(options.targetRoot, options.config, selection))
  ];
  const openRisks = await loadOpenRisks(options.targetRoot);
  const latestTaskPacketSet = await loadLatestTaskPacketSet(options.targetRoot);
  const memoryPaths = getMemoryPaths(options.targetRoot);
  const memoryEntries: Array<[string, string]> = [
    ["Repo Facts", memoryPaths.repoFacts],
    ["Architecture Decisions", memoryPaths.architectureDecisions],
    ["Domain Glossary", memoryPaths.domainGlossary],
    ["Current Focus", memoryPaths.currentFocus],
    ["Open Risks", memoryPaths.openRisks],
    ["Known Gotchas", memoryPaths.knownGotchas],
    ["Last Successful Patterns", memoryPaths.lastSuccessfulPatterns]
  ];
  const memoryBank: RepoMemoryBankEntry[] = await Promise.all(
    memoryEntries.map(async ([label, filePath]) => ({
      label,
      path: renderDisplayPath(options.targetRoot, filePath),
      present: await pathExists(filePath)
    }))
  );
  const latestReconcile = await loadLatestReconcileReport(options.targetRoot);
  const repoOverview: RepoControlPanelItem[] = [
    { label: "Project type", value: `${inspection.projectType} (${inspection.projectTypeSource})` },
    {
      label: "Active role",
      value:
        normalizeSpecialistId(options.config, activeRoleHints?.activeRole, activeRoleHints?.activeRole) ??
        "none recorded"
    },
    {
      label: "Next file",
      value: activeRoleHints?.nextFileToRead ?? continuity.currentFocus?.nextFileToRead ?? "none recorded"
    },
    {
      label: "Next command",
      value: activeRoleHints?.nextSuggestedCommand ?? continuity.currentFocus?.nextSuggestedCommand ?? "none recorded"
    },
    { label: "Validation state", value: summarizeValidation(validationIssues) },
    {
      label: "Current phase",
      value: continuity.latestPhase ? `${continuity.latestPhase.label} [${continuity.latestPhase.status}]` : "none recorded"
    }
  ];
  const continuityItems: RepoControlPanelItem[] = [
    {
      label: "Latest checkpoint",
      value: continuity.latestCheckpoint ? `${continuity.latestCheckpoint.phase} [${continuity.latestCheckpoint.createdAt}]` : "none recorded"
    },
    {
      label: "Latest handoff",
      value: continuity.latestHandoff ? `${continuity.latestHandoff.summary} -> ${continuity.latestHandoff.toRole}` : "none recorded"
    },
    {
      label: "Latest reconcile",
      value: latestReconcile ? `${latestReconcile.dispatchId} [${latestReconcile.status}]` : "none recorded"
    },
    {
      label: "Current focus",
      value: continuity.currentFocus?.currentFocus ?? "none recorded"
    },
    {
      label: "Open risks",
      value: openRisks?.risks.join("; ") || "none recorded",
      ...(openRisks?.risks.length ? { tone: "warn" as const } : {})
    }
  ];
  const availableSpecialists = listSpecialists({
    config: options.config,
    profileName: selection.profileName
  });
  const validation: RepoValidationSummary = {
    ok: validationIssues.every((issue) => issue.level !== "error"),
    errors: validationIssues.filter((issue) => issue.level === "error").length,
    warnings: validationIssues.filter((issue) => issue.level === "warn").length,
    issues: validationIssues
  };

  return {
    targetRoot: options.targetRoot,
    profileName: selection.profileName,
    executionMode,
    projectType: inspection.projectType,
    repoOverview,
    continuity: continuityItems,
    memoryBank,
    specialists: {
      recommendedSpecialist,
      available: availableSpecialists,
      handoffTargets: availableSpecialists.map((specialist) => specialist.specialistId).slice(0, 8),
      safeParallelHint:
        latestTaskPacketSet?.files.length && latestTaskPacketSet.files.length > 1
          ? "Parallel work is safest when each specialist owns disjoint files and reconcile is already planned."
          : "Keep generic repos quiet. Fan out only when file ownership and reconcile responsibilities are explicit."
    },
    mcpPacks: {
      suggestedPack,
      available: listMcpPacks()
    },
    validation
  };
}

function summarizeValidation(issues: ValidationIssue[]): string {
  const errors = issues.filter((issue) => issue.level === "error").length;
  const warnings = issues.filter((issue) => issue.level === "warn").length;
  if (errors === 0 && warnings === 0) {
    return "passing";
  }
  if (errors === 0) {
    return `${warnings} warning${warnings === 1 ? "" : "s"}`;
  }
  return `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`;
}
