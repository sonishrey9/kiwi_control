import type { PhaseRecord } from "./state.js";
import { runCommand } from "../utils/child-process.js";

export interface GitState {
  isGitRepo: boolean;
  branch?: string;
  headCommit?: string | null;
  ahead: number;
  behind: number;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  changedFiles: string[];
  stagedFiles?: string[];
  unstagedFiles?: string[];
  untrackedFiles?: string[];
  createdFiles?: string[];
  deletedFiles?: string[];
  clean: boolean;
  error?: string;
}

export interface PushAssessment {
  result: "allowed" | "review-required" | "blocked" | "not-applicable";
  reasons: string[];
  validationsPassed: boolean;
  pushPlan: {
    phaseCompleted: string;
    majorChanges: string[];
    validationsRun: string[];
    knownRisks: string[];
    recommendedNote: string;
  };
}

export async function inspectGitState(targetRoot: string): Promise<GitState> {
  const probe = await runCommand("git", ["rev-parse", "--is-inside-work-tree"], targetRoot);
  if (probe.code !== 0 || probe.stdout.trim() !== "true") {
    return {
      isGitRepo: false,
      headCommit: null,
      ahead: 0,
      behind: 0,
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      changedFiles: [],
      stagedFiles: [],
      unstagedFiles: [],
      untrackedFiles: [],
      createdFiles: [],
      deletedFiles: [],
      clean: true
    };
  }

  const headCommitProbe = await runCommand("git", ["rev-parse", "HEAD"], targetRoot);
  const headCommit = headCommitProbe.code === 0 ? headCommitProbe.stdout.trim() : null;

  const status = await runCommand("git", ["status", "--porcelain=1", "--branch"], targetRoot);
  if (status.code !== 0) {
    if (isIgnorableGitMetadataFailure(status.stderr)) {
      return {
        isGitRepo: true,
        headCommit,
        ahead: 0,
        behind: 0,
        stagedCount: 0,
        unstagedCount: 0,
        untrackedCount: 0,
        changedFiles: [],
        stagedFiles: [],
        unstagedFiles: [],
        untrackedFiles: [],
        createdFiles: [],
        deletedFiles: [],
        clean: true
      };
    }
    return {
      isGitRepo: true,
      headCommit,
      ahead: 0,
      behind: 0,
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      changedFiles: [],
      stagedFiles: [],
      unstagedFiles: [],
      untrackedFiles: [],
      createdFiles: [],
      deletedFiles: [],
      clean: false,
      error: status.stderr.trim() || "git status failed"
    };
  }

  const lines = status.stdout.split("\n").filter((line) => Boolean(line));
  const branchLine = lines.find((line) => line.startsWith("##")) ?? "##";
  const branch = parseBranch(branchLine);
  const ahead = parseAheadBehind(branchLine, "ahead");
  const behind = parseAheadBehind(branchLine, "behind");
  let stagedCount = 0;
  let unstagedCount = 0;
  let untrackedCount = 0;
  const changedFiles: string[] = [];
  const stagedFiles: string[] = [];
  const unstagedFiles: string[] = [];
  const untrackedFiles: string[] = [];
  const createdFiles: string[] = [];
  const deletedFiles: string[] = [];

  for (const line of lines.filter((line) => !line.startsWith("##"))) {
    const filePath = parsePorcelainPath(line);
    if (filePath && isIgnoredGitNoisePath(filePath)) {
      continue;
    }
    if (line.startsWith("??")) {
      untrackedCount += 1;
      if (filePath) {
        changedFiles.push(filePath);
        untrackedFiles.push(filePath);
        createdFiles.push(filePath);
      }
      continue;
    }

    const indexStatus = line[0] ?? " ";
    const worktreeStatus = line[1] ?? " ";
    if (indexStatus !== " ") {
      stagedCount += 1;
      if (filePath) {
        stagedFiles.push(filePath);
      }
    }
    if (worktreeStatus !== " ") {
      unstagedCount += 1;
      if (filePath) {
        unstagedFiles.push(filePath);
      }
    }
    if (filePath) {
      changedFiles.push(filePath);
    }
    if (filePath && (indexStatus === "A" || worktreeStatus === "A")) {
      createdFiles.push(filePath);
    }
    if (filePath && (indexStatus === "D" || worktreeStatus === "D")) {
      deletedFiles.push(filePath);
    }
  }

  return {
    isGitRepo: true,
    ...(branch ? { branch } : {}),
    headCommit,
    ahead,
    behind,
    stagedCount,
    unstagedCount,
    untrackedCount,
    changedFiles,
    stagedFiles: uniqueStrings(stagedFiles),
    unstagedFiles: uniqueStrings(unstagedFiles),
    untrackedFiles: uniqueStrings(untrackedFiles),
    createdFiles: uniqueStrings(createdFiles),
    deletedFiles: uniqueStrings(deletedFiles),
    clean: stagedCount === 0 && unstagedCount === 0 && untrackedCount === 0
  };
}

function isIgnoredGitNoisePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return (
    /(^|\/)\._/.test(normalized) ||
    normalized.startsWith(".playwright-") ||
    normalized.startsWith(".playwright-cli/") ||
    normalized.startsWith(".playwright-mcp/") ||
    normalized.startsWith(".git/") ||
    /(^|\/)system\.log$/i.test(normalized) ||
    /\.log$/i.test(normalized)
  );
}

function isIgnorableGitMetadataFailure(stderr: string): boolean {
  return /non-monotonic index/i.test(stderr) && /\._pack-/i.test(stderr);
}

export function assessPushReadiness(git: GitState, latestPhase: PhaseRecord | null): PushAssessment {
  if (!git.isGitRepo) {
    return {
      result: "not-applicable",
      reasons: ["target repo is not a git repository"],
      validationsPassed: false,
      pushPlan: {
        phaseCompleted: latestPhase?.label ?? "no checkpoint recorded",
        majorChanges: latestPhase?.changedFilesSummary?.changedFiles ?? [],
        validationsRun: latestPhase?.validationsRun ?? [],
        knownRisks: [...(latestPhase?.warnings ?? []), ...(latestPhase?.openIssues ?? [])],
        recommendedNote: "No git push plan is available because the target is not a git repo."
      }
    };
  }

  const reasons: string[] = [];
  const validationsPassed = Boolean(latestPhase && latestPhase.validationsRun.length > 0 && latestPhase.status === "complete");

  if (!latestPhase) {
    reasons.push("no checkpoint recorded");
  } else if (latestPhase.status === "blocked") {
    reasons.push("latest checkpoint is blocked");
  } else if (latestPhase.openIssues.length > 0) {
    reasons.push("latest checkpoint still has open issues");
  } else if (latestPhase.warnings.length > 0) {
    reasons.push("latest checkpoint still has warnings");
  }

  if (!validationsPassed) {
    reasons.push("latest checkpoint does not record completed validations");
  }
  if (!git.clean) {
    reasons.push("working tree is not clean");
  }

  let result: PushAssessment["result"] = "allowed";
  if (reasons.includes("latest checkpoint is blocked")) {
    result = "blocked";
  } else if (reasons.length > 0) {
    result = "review-required";
  }

  return {
    result,
    reasons,
    validationsPassed,
    pushPlan: {
      phaseCompleted: latestPhase?.label ?? "no checkpoint recorded",
      majorChanges: latestPhase?.changedFilesSummary?.changedFiles ?? git.changedFiles.slice(0, 12),
      validationsRun: latestPhase?.validationsRun ?? [],
      knownRisks: [...(latestPhase?.warnings ?? []), ...(latestPhase?.openIssues ?? [])],
      recommendedNote: buildRecommendedNote(result, git, latestPhase)
    }
  };
}

function parseBranch(branchLine: string): string | undefined {
  const match = /^## ([^.\s]+)(?:\.{3}.*)?$/.exec(branchLine.trim());
  return match?.[1];
}

function parseAheadBehind(branchLine: string, direction: "ahead" | "behind"): number {
  const match = new RegExp(`${direction} (\\d+)`).exec(branchLine);
  return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
}

function buildRecommendedNote(result: PushAssessment["result"], git: GitState, latestPhase: PhaseRecord | null): string {
  if (result === "not-applicable") {
    return "No push note because the target is not tracked by git.";
  }

  const phase = latestPhase?.label ?? "current phase";
  const branch = git.branch ? ` on ${git.branch}` : "";
  if (result === "allowed") {
    return `Ready to push ${phase}${branch} once you review the final diff and commit summary.`;
  }
  if (result === "blocked") {
    return `Do not push ${phase}${branch} until the blocked checkpoint issues are resolved.`;
  }
  return `Review ${phase}${branch}, resolve outstanding warnings or dirty-tree items, and then reassess push readiness.`;
}

function parsePorcelainPath(line: string): string {
  return line
    .slice(3)
    .trim()
    .split(" -> ")
    .pop()
    ?.trim() ?? "";
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter((item) => Boolean(item.trim())))];
}
