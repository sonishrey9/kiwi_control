import path from "node:path";
import { promises as fs } from "node:fs";
import type { ExecutionMode, ToolName } from "./config.js";
import type { DispatchCollection, DispatchManifest } from "./dispatch.js";
import type { GitState, PushAssessment } from "./git.js";
import type { PolicyEvaluation } from "./policies.js";
import type { ReconcileReport } from "./reconcile.js";
import type { SpecialistSelection } from "./specialists.js";
import type { PhaseRecord } from "./state.js";
import { getStatePaths } from "./state.js";
import { ensureDir, isIgnoredArtifactName, pathExists, readJson, renderDisplayPath, writeText } from "../utils/fs.js";

export interface ReleaseCheckReport {
  version: number;
  createdAt: string;
  profile: string;
  mode: ExecutionMode;
  status: "ready-for-release" | "review-required" | "blocked" | "not-applicable";
  phaseLabel: string;
  validationsRun: string[];
  missingValidations: string[];
  unresolvedRisks: string[];
  reconcileStatus?: ReconcileReport["status"];
  pushSuitability: PushAssessment["result"];
  policyResult: PolicyEvaluation["result"];
  policyFindings: string[];
  activeSpecialists: string[];
  recommendedNextStep: string;
}

export interface CommitPlanGroup {
  title: string;
  files: string[];
  rationale: string;
}

export interface CommitPlan {
  phaseLabel: string;
  groups: CommitPlanGroup[];
  validationsRun: string[];
  warnings: string[];
  suggestedCommitNotes: string[];
}

export interface PhaseCloseRecord {
  version: number;
  createdAt: string;
  label: string;
  goal: string;
  profile: string;
  mode: ExecutionMode;
  status: "complete" | "blocked";
  tool?: ToolName;
  checkpointPath?: string;
  reconcileStatus?: ReconcileReport["status"];
  policyResult: PolicyEvaluation["result"];
  policyFindings: string[];
  recommendedNextTool?: ToolName;
  recommendedNextSpecialist?: string;
  recommendedNextStep: string;
}

export function getReleasePaths(targetRoot: string): {
  releaseRoot: string;
  releaseHistoryDir: string;
  releaseLatestJson: string;
  releaseLatestMarkdown: string;
  phaseCloseRoot: string;
  phaseCloseHistoryDir: string;
  phaseCloseLatestJson: string;
  phaseCloseLatestMarkdown: string;
} {
  const stateRoot = getStatePaths(targetRoot).root;
  const releaseRoot = path.join(stateRoot, "release");
  const phaseCloseRoot = path.join(stateRoot, "phase-close");
  return {
    releaseRoot,
    releaseHistoryDir: path.join(releaseRoot, "history"),
    releaseLatestJson: path.join(releaseRoot, "latest.json"),
    releaseLatestMarkdown: path.join(releaseRoot, "latest.md"),
    phaseCloseRoot,
    phaseCloseHistoryDir: path.join(phaseCloseRoot, "history"),
    phaseCloseLatestJson: path.join(phaseCloseRoot, "latest.json"),
    phaseCloseLatestMarkdown: path.join(phaseCloseRoot, "latest.md")
  };
}

export async function writeReleaseCheckArtifacts(targetRoot: string, report: ReleaseCheckReport): Promise<{ jsonPath: string; markdownPath: string }> {
  const paths = getReleasePaths(targetRoot);
  await ensureDir(paths.releaseHistoryDir);
  await writeText(paths.releaseLatestJson, `${JSON.stringify(report, null, 2)}\n`);
  await writeText(paths.releaseLatestMarkdown, renderReleaseCheckMarkdown(report));
  await writeText(path.join(paths.releaseHistoryDir, `${report.createdAt.replace(/[:.]/g, "-")}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return {
    jsonPath: paths.releaseLatestJson,
    markdownPath: paths.releaseLatestMarkdown
  };
}

export async function writePhaseCloseArtifacts(targetRoot: string, record: PhaseCloseRecord): Promise<{ jsonPath: string; markdownPath: string }> {
  const paths = getReleasePaths(targetRoot);
  await ensureDir(paths.phaseCloseHistoryDir);
  await writeText(paths.phaseCloseLatestJson, `${JSON.stringify(record, null, 2)}\n`);
  await writeText(paths.phaseCloseLatestMarkdown, renderPhaseCloseMarkdown(record));
  await writeText(path.join(paths.phaseCloseHistoryDir, `${record.createdAt.replace(/[:.]/g, "-")}.json`), `${JSON.stringify(record, null, 2)}\n`);
  return {
    jsonPath: paths.phaseCloseLatestJson,
    markdownPath: paths.phaseCloseLatestMarkdown
  };
}

export async function loadLatestReleaseCheck(targetRoot: string): Promise<ReleaseCheckReport | null> {
  const latestPath = getReleasePaths(targetRoot).releaseLatestJson;
  if (!(await pathExists(latestPath))) {
    return null;
  }
  return readJson<ReleaseCheckReport>(latestPath);
}

export async function loadLatestPhaseClose(targetRoot: string): Promise<PhaseCloseRecord | null> {
  const latestPath = getReleasePaths(targetRoot).phaseCloseLatestJson;
  if (!(await pathExists(latestPath))) {
    return null;
  }
  return readJson<PhaseCloseRecord>(latestPath);
}

export function buildReleaseCheckReport(options: {
  profileName: string;
  executionMode: ExecutionMode;
  latestPhase: PhaseRecord | null;
  latestDispatch: DispatchManifest | null;
  latestCollection: DispatchCollection | null;
  latestReconcile: ReconcileReport | null;
  pushAssessment: PushAssessment;
  policyEvaluation: PolicyEvaluation;
}): ReleaseCheckReport {
  const unresolvedRisks = dedupe([
    ...(options.latestPhase?.warnings ?? []),
    ...(options.latestPhase?.openIssues ?? []),
    ...(options.latestReconcile?.unresolvedRisks ?? [])
  ]);
  const missingValidations = dedupe([
    ...(options.latestReconcile?.missingValidations ?? []),
    ...(!options.latestPhase || options.latestPhase.validationsRun.length === 0 ? ["latest checkpoint has no recorded validations"] : [])
  ]);
  const activeSpecialists = dedupe(
    options.latestDispatch?.roleAssignments
      .map((assignment) => ("specialistId" in assignment ? String((assignment as { specialistId?: string }).specialistId ?? "") : ""))
      .filter(Boolean) ?? []
  );
  const status = resolveReleaseStatus(options.pushAssessment, options.policyEvaluation, options.latestReconcile, unresolvedRisks, missingValidations);

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    profile: options.profileName,
    mode: options.executionMode,
    status,
    phaseLabel: options.latestPhase?.label ?? "no checkpoint recorded",
    validationsRun: options.latestPhase?.validationsRun ?? [],
    missingValidations,
    unresolvedRisks,
    ...(options.latestReconcile ? { reconcileStatus: options.latestReconcile.status } : {}),
    pushSuitability: options.pushAssessment.result,
    policyResult: options.policyEvaluation.result,
    policyFindings: options.policyEvaluation.findings.map((finding) => finding.message),
    activeSpecialists,
    recommendedNextStep:
      status === "blocked"
        ? "Resolve blocked reconcile, policy, or push blockers before closing the phase."
        : status === "review-required"
          ? "Tighten validations or role outputs, then rerun release-check."
          : "Phase is ready for commit planning and a final push-check."
  };
}

export function buildCommitPlan(options: {
  targetRoot: string;
  gitState: GitState;
  latestPhase: PhaseRecord | null;
  latestReconcile: ReconcileReport | null;
}): CommitPlan {
  const files = options.latestPhase?.changedFilesSummary?.changedFiles.length
    ? options.latestPhase.changedFilesSummary.changedFiles
    : options.gitState.changedFiles;
  const grouped = new Map<string, string[]>();
  for (const filePath of files.slice(0, 24)) {
    const [topLevel] = filePath.split("/");
    const key = topLevel || "root";
    grouped.set(key, [...(grouped.get(key) ?? []), filePath]);
  }

  const groups = [...grouped.entries()].map(([title, groupFiles]) => ({
    title,
    files: groupFiles,
    rationale: title === "src" ? "core implementation and command logic" : title === "docs" ? "documentation and operator guidance" : "group related changes together"
  }));

  return {
    phaseLabel: options.latestPhase?.label ?? "no checkpoint recorded",
    groups,
    validationsRun: options.latestPhase?.validationsRun ?? [],
    warnings: dedupe([...(options.latestPhase?.warnings ?? []), ...(options.latestReconcile?.unresolvedRisks ?? [])]),
    suggestedCommitNotes: groups.map((group) => `${group.title === "src" ? "feat" : "chore"}: ${group.rationale}`)
  };
}

export function buildPhaseCloseRecord(options: {
  label: string;
  goal: string;
  profileName: string;
  executionMode: ExecutionMode;
  tool?: ToolName;
  checkpointPath?: string;
  latestReconcile: ReconcileReport | null;
  policyEvaluations: PolicyEvaluation[];
  nextSpecialist?: SpecialistSelection;
  nextTool?: ToolName;
}): PhaseCloseRecord {
  const policyResult = options.policyEvaluations.some((evaluation) => evaluation.result === "blocked")
    ? "blocked"
    : options.policyEvaluations.some((evaluation) => evaluation.result === "review-required")
      ? "review-required"
      : "allowed";

  const status: PhaseCloseRecord["status"] = policyResult === "blocked" || options.latestReconcile?.status === "blocked" ? "blocked" : "complete";
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    label: options.label,
    goal: options.goal,
    profile: options.profileName,
    mode: options.executionMode,
    status,
    ...(options.tool ? { tool: options.tool } : {}),
    ...(options.checkpointPath ? { checkpointPath: options.checkpointPath } : {}),
    ...(options.latestReconcile ? { reconcileStatus: options.latestReconcile.status } : {}),
    policyResult,
    policyFindings: options.policyEvaluations.flatMap((evaluation) => evaluation.findings.map((finding) => finding.message)),
    ...(options.nextTool ? { recommendedNextTool: options.nextTool } : {}),
    ...(options.nextSpecialist ? { recommendedNextSpecialist: options.nextSpecialist.specialistId } : {}),
    recommendedNextStep:
      status === "blocked"
        ? "Resolve blocked policy or reconcile issues before handing off or pushing."
        : options.nextTool
          ? `Hand off to ${options.nextTool}${options.nextSpecialist ? ` using ${options.nextSpecialist.specialistId}` : ""}.`
          : "Run a release-check or handoff for the next phase."
  };
}

export function renderReleaseCheckMarkdown(report: ReleaseCheckReport): string {
  return [
    "# Release Check",
    "",
    `Created: ${report.createdAt}`,
    `Profile: \`${report.profile}\``,
    `Mode: \`${report.mode}\``,
    `Status: \`${report.status}\``,
    `Phase: ${report.phaseLabel}`,
    `Push suitability: \`${report.pushSuitability}\``,
    ...(report.reconcileStatus ? [`Reconcile: \`${report.reconcileStatus}\``] : []),
    "",
    "## Active Specialists",
    "",
    ...(report.activeSpecialists.length ? report.activeSpecialists.map((item) => `- ${item}`) : ["- none recorded"]),
    "",
    "## Validations Run",
    "",
    ...(report.validationsRun.length ? report.validationsRun.map((item) => `- ${item}`) : ["- none recorded"]),
    "",
    "## Missing Validations",
    "",
    ...(report.missingValidations.length ? report.missingValidations.map((item) => `- ${item}`) : ["- none recorded"]),
    "",
    "## Unresolved Risks",
    "",
    ...(report.unresolvedRisks.length ? report.unresolvedRisks.map((item) => `- ${item}`) : ["- none recorded"]),
    "",
    "## Policy Findings",
    "",
    ...(report.policyFindings.length ? report.policyFindings.map((item) => `- ${item}`) : ["- none recorded"]),
    "",
    "## Recommended Next Step",
    "",
    `- ${report.recommendedNextStep}`
  ].join("\n") + "\n";
}

export function renderPhaseCloseMarkdown(record: PhaseCloseRecord): string {
  return [
    "# Phase Close",
    "",
    `Created: ${record.createdAt}`,
    `Label: ${record.label}`,
    `Goal: ${record.goal}`,
    `Profile: \`${record.profile}\``,
    `Mode: \`${record.mode}\``,
    `Status: \`${record.status}\``,
    ...(record.tool ? [`Tool: \`${record.tool}\``] : []),
    ...(record.checkpointPath ? [`Checkpoint: \`${record.checkpointPath}\``] : []),
    ...(record.reconcileStatus ? [`Reconcile: \`${record.reconcileStatus}\``] : []),
    "",
    "## Policy Findings",
    "",
    ...(record.policyFindings.length ? record.policyFindings.map((item) => `- ${item}`) : ["- none recorded"]),
    "",
    "## Next Step",
    "",
    `- ${record.recommendedNextStep}`
  ].join("\n") + "\n";
}

export async function listReleaseHistory(targetRoot: string): Promise<string[]> {
  const historyDir = getReleasePaths(targetRoot).releaseHistoryDir;
  if (!(await pathExists(historyDir))) {
    return [];
  }
  const entries = await fs.readdir(historyDir);
  return entries.filter((entry) => entry.endsWith(".json") && !isIgnoredArtifactName(entry)).sort().reverse();
}

function resolveReleaseStatus(
  pushAssessment: PushAssessment,
  policyEvaluation: PolicyEvaluation,
  latestReconcile: ReconcileReport | null,
  unresolvedRisks: string[],
  missingValidations: string[]
): ReleaseCheckReport["status"] {
  if (pushAssessment.result === "not-applicable") {
    return policyEvaluation.result === "blocked" ? "blocked" : "not-applicable";
  }
  if (policyEvaluation.result === "blocked" || latestReconcile?.status === "blocked" || pushAssessment.result === "blocked") {
    return "blocked";
  }
  if (policyEvaluation.result === "review-required" || latestReconcile?.status === "review-required" || unresolvedRisks.length > 0 || missingValidations.length > 0 || pushAssessment.result === "review-required") {
    return "review-required";
  }
  return "ready-for-release";
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter((item) => Boolean(item.trim())))];
}
