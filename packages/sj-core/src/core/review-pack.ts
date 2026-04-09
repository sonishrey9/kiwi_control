import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { ensureDir, pathExists, readText, writeText } from "../utils/fs.js";
import { classifyFileArea } from "./task-intent.js";
import { inspectGitState } from "./git.js";
import type { LoadedRepoIntelligenceArtifacts } from "./repo-intelligence.js";

const execFile = promisify(execFileCallback);

export interface ReviewPackState {
  artifactType: "kiwi-control/review-pack";
  version: 1;
  generatedAt: string;
  summary: string;
  source: "working-tree" | "git-base";
  baseRef: string | null;
  task: string | null;
  changedFiles: string[];
  rankedFiles: Array<{
    file: string;
    moduleGroup: string;
    score: number;
    reasons: string[];
    touches: number;
    failures: number;
  }>;
  rankedModules: Array<{
    id: string;
    score: number;
    reasons: string[];
    files: string[];
  }>;
  impactChains: Array<{
    file: string;
    chain: string[];
  }>;
  repeatedTouchAreas: Array<{
    kind: "file" | "module";
    target: string;
    touches: number;
    commits: number;
  }>;
  failureLinkedAreas: Array<{
    kind: "file" | "module";
    target: string;
    reasons: string[];
  }>;
  likelyMissingValidation: string[];
  reviewOrder: Array<{
    kind: "file" | "module" | "decision";
    target: string;
    reason: string;
  }>;
  reviewerHandoff: {
    summary: string;
    readFirst: string[];
  };
  codingToolHandoff: {
    summary: string;
    readFirst: string[];
  };
}

export async function resolveReviewChangedFiles(
  targetRoot: string,
  baseRef?: string
): Promise<{ source: ReviewPackState["source"]; changedFiles: string[] }> {
  if (baseRef?.trim()) {
    const changedFiles = filterReviewableChangedFiles(await readGitDiffFiles(targetRoot, baseRef.trim()));
    return {
      source: "git-base",
      changedFiles
    };
  }

  const gitState = await inspectGitState(targetRoot);
  return {
    source: "working-tree",
    changedFiles: filterReviewableChangedFiles(gitState.changedFiles)
  };
}

export function buildReviewPack(options: {
  targetRoot: string;
  artifacts: LoadedRepoIntelligenceArtifacts;
  changedFiles: string[];
  source: ReviewPackState["source"];
  baseRef?: string | null;
  task?: string | null;
}): ReviewPackState {
  const changedFileSet = new Set(options.changedFiles);
  const changedModuleSet = new Set(
    options.changedFiles.map((file) => moduleGroupForFile(options.artifacts, file)).filter(Boolean)
  );

  const relatedRankedFiles = options.artifacts.reviewGraph.fileRisks
    .filter((entry) =>
      changedFileSet.has(entry.file)
      || changedModuleSet.has(entry.moduleGroup)
      || options.artifacts.impactMap.rankedFiles.some((impact) => impact.file === entry.file && changedModuleSet.has(impact.moduleGroup))
    )
    .slice(0, 12)
    .map((entry) => ({
      file: entry.file,
      moduleGroup: entry.moduleGroup,
      score: entry.score,
      reasons: entry.reasons,
      touches: entry.touches,
      failures: entry.failures
    }));

  const relatedRankedModules = options.artifacts.reviewGraph.moduleRisks
    .filter((entry) => changedModuleSet.has(entry.id))
    .slice(0, 8)
    .map((entry) => ({
      id: entry.id,
      score: entry.score,
      reasons: entry.reasons,
      files: entry.files
    }));

  const impactChains = options.artifacts.impactMap.rankedFiles
    .filter((entry) => changedFileSet.has(entry.file) || changedModuleSet.has(entry.moduleGroup))
    .map((entry) => ({
      file: entry.file,
      chain: options.artifacts.impactMap.dependencyChains[entry.file] ?? []
    }))
    .filter((entry) => entry.chain.length > 1)
    .slice(0, 12);

  const repeatedTouchAreas = [
    ...options.artifacts.historyGraph.hotspotFiles
      .filter((entry) => changedFileSet.has(entry.file))
      .slice(0, 4)
      .map((entry) => ({
        kind: "file" as const,
        target: entry.file,
        touches: entry.touches,
        commits: entry.commits
      })),
    ...options.artifacts.historyGraph.repeatedTouchModules
      .filter((entry) => changedModuleSet.has(entry.id))
      .slice(0, 4)
      .map((entry) => ({
        kind: "module" as const,
        target: entry.id,
        touches: entry.touches,
        commits: entry.commits
      }))
  ];

  const failureLinkedAreas = [
    ...relatedRankedFiles
      .filter((entry) => entry.failures > 0 || entry.reasons.includes("failure-linked"))
      .map((entry) => ({
        kind: "file" as const,
        target: entry.file,
        reasons: entry.reasons
      })),
    ...relatedRankedModules
      .filter((entry) => entry.reasons.includes("failure-linked"))
      .map((entry) => ({
        kind: "module" as const,
        target: entry.id,
        reasons: entry.reasons
      }))
  ].slice(0, 8);

  const likelyMissingValidation = buildLikelyMissingValidation(options.changedFiles);

  const reviewOrder = [
    ...relatedRankedModules.map((entry) => ({
      kind: "module" as const,
      target: entry.id,
      reason: entry.reasons[0] ?? "module review"
    })),
    ...relatedRankedFiles.map((entry) => ({
      kind: "file" as const,
      target: entry.file,
      reason: entry.reasons[0] ?? "file review"
    })),
    ...options.artifacts.decisionGraph.importantDecisions
      .filter((entry) => entry.status === "blocked" || entry.status === "failed")
      .slice(0, 4)
      .map((entry) => ({
        kind: "decision" as const,
        target: entry.label,
        reason: entry.summary
      }))
  ].slice(0, 16);

  const topReviewTarget = reviewOrder[0]?.target ?? relatedRankedFiles[0]?.file ?? relatedRankedModules[0]?.id ?? "the current diff";
  const summary =
    options.changedFiles.length > 0
      ? `Review ${topReviewTarget} first across ${options.changedFiles.length} changed file(s), ${relatedRankedFiles.length} ranked file target(s), and ${relatedRankedModules.length} ranked module target(s).`
      : "Review pack generated for a clean working tree. No changed files were detected in the current scope.";

  return {
    artifactType: "kiwi-control/review-pack",
    version: 1,
    generatedAt: new Date().toISOString(),
    summary,
    source: options.source,
    baseRef: options.baseRef ?? null,
    task: options.task ?? null,
    changedFiles: options.changedFiles,
    rankedFiles: relatedRankedFiles,
    rankedModules: relatedRankedModules,
    impactChains,
    repeatedTouchAreas,
    failureLinkedAreas,
    likelyMissingValidation,
    reviewOrder,
    reviewerHandoff: {
      summary: relatedRankedFiles.length > 0
        ? `Review ${relatedRankedFiles[0]?.file} first, then the highest-risk changed modules.`
        : "Review the changed files in repo-local order.",
      readFirst: [
        ".agent/context/review-pack.json",
        ".agent/state/review-graph.json",
        ".agent/state/impact-map.json",
        ".agent/state/history-graph.json",
        ".agent/state/decision-graph.json"
      ]
    },
    codingToolHandoff: {
      summary: options.task
        ? `Use the review pack with the task pack for "${options.task}".`
        : "Use the review pack with the runtime state and task pack before modifying risky areas.",
      readFirst: [
        ".agent/context/review-pack.json",
        ".agent/context/task-pack.json",
        ".agent/state/execution-state.json",
        ".agent/state/execution-events.ndjson",
        ".agent/context/review-context-pack.json"
      ]
    }
  };
}

export async function persistReviewPack(targetRoot: string, reviewPack: ReviewPackState): Promise<string> {
  const outputPath = path.join(targetRoot, ".agent", "context", "review-pack.json");
  await ensureDir(path.dirname(outputPath));
  await writeText(outputPath, `${JSON.stringify(reviewPack, null, 2)}\n`);
  return outputPath;
}

function buildLikelyMissingValidation(changedFiles: string[]): string[] {
  const changedTests = new Set(
    changedFiles.filter((file) => classifyFileArea(file) === "tests")
  );
  const findings: string[] = [];

  for (const file of changedFiles) {
    const area = classifyFileArea(file);
    if (area === "tests" || area === "docs" || area === "context") {
      continue;
    }

    const basename = path.basename(file).replace(/\.[^.]+$/, "");
    const siblingTestChanged = [...changedTests].some((candidate) =>
      candidate.includes(basename) || basename.includes(path.basename(candidate).replace(/\.[^.]+$/, ""))
    );
    if (!siblingTestChanged) {
      findings.push(`No changed test detected alongside ${file}.`);
    }
    if (area === "config" || area === "infra") {
      findings.push(`Run kiwi-control check after editing ${file}.`);
    }
  }

  return [...new Set(findings)].slice(0, 10);
}

function moduleGroupForFile(artifacts: LoadedRepoIntelligenceArtifacts, file: string): string | null {
  return artifacts.dependencyGraph.fileRelationships.find((entry) => entry.file === file)?.moduleGroup ?? null;
}

async function readGitDiffFiles(targetRoot: string, baseRef: string): Promise<string[]> {
  if (!(await pathExists(path.join(targetRoot, ".git")))) {
    return [];
  }
  try {
    const { stdout } = await execFile(
      "git",
      ["diff", "--name-only", `${baseRef}...HEAD`],
      {
        cwd: targetRoot,
        encoding: "utf8"
      }
    );
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function filterReviewableChangedFiles(changedFiles: string[]): string[] {
  return [...new Set(changedFiles.map((file) => file.replace(/\\/g, "/")))]
    .filter((file) => file.length > 0)
    .filter((file) => !isGeneratedKiwiReviewNoise(file));
}

function isGeneratedKiwiReviewNoise(file: string): boolean {
  if (file.startsWith(".agent/state/") || file.startsWith(".agent/eval/")) {
    return true;
  }

  return [
    ".agent/context-authority.json",
    ".agent/context/agent-pack.json",
    ".agent/context/compact-context-pack.json",
    ".agent/context/context-tree.json",
    ".agent/context/repo-map.json",
    ".agent/context/review-context-pack.json",
    ".agent/context/review-pack.json",
    ".agent/context/task-pack.json",
    ".agent/memory/current-focus.json",
    ".agent/memory/open-risks.json",
    ".agent/memory/repo-facts.json"
  ].includes(file);
}
