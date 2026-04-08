import { Dirent, promises as fs } from "node:fs";
import path from "node:path";
import type { LoadedConfig, ProjectType } from "./config.js";
import { PROJECT_TYPES } from "./config.js";
import { isIgnoredArtifactName, pathExists, readText } from "../utils/fs.js";

export type TargetKind = "empty-folder" | "existing-project" | "existing-repo";

export interface BootstrapInspection {
  targetRoot: string;
  targetKind: TargetKind;
  missingTarget: boolean;
  alreadyInitialized: boolean;
  projectType: ProjectType;
  projectTypeSource: "explicit" | "detected" | "fallback";
  existingAuthorityFiles: string[];
  authorityProfileHint?: string;
  authorityOptOut?: string;
}

export async function inspectBootstrapTarget(
  targetRoot: string,
  config: LoadedConfig,
  explicitProjectType?: ProjectType
): Promise<BootstrapInspection> {
  const missingTarget = !(await pathExists(targetRoot));
  const entries = missingTarget ? [] : await fs.readdir(targetRoot, { withFileTypes: true });
  const visibleEntries = entries.filter((entry) => !isIgnoredArtifactName(entry.name));
  const targetKind = resolveTargetKind(visibleEntries, missingTarget);
  const existingAuthorityFiles = await findExistingAuthorityFiles(targetRoot, config);
  const authorityProfileHint = await detectAuthorityProfileHint(targetRoot, existingAuthorityFiles, config);
  const authorityOptOut = await detectAuthorityOptOut(targetRoot, existingAuthorityFiles);
  const alreadyInitialized = await detectInitialization(targetRoot, existingAuthorityFiles);

  let projectType: ProjectType = "generic";
  let projectTypeSource: BootstrapInspection["projectTypeSource"] = "fallback";
  if (explicitProjectType) {
    projectType = explicitProjectType;
    projectTypeSource = "explicit";
  } else if (!missingTarget) {
    const detected = await detectProjectType(targetRoot, visibleEntries);
    projectType = detected;
    projectTypeSource = detected === "generic" ? "fallback" : "detected";
  }

  return {
    targetRoot,
    targetKind,
    missingTarget,
    alreadyInitialized,
    projectType,
    projectTypeSource,
    existingAuthorityFiles,
    ...(authorityProfileHint ? { authorityProfileHint } : {})
    ,
    ...(authorityOptOut ? { authorityOptOut } : {})
  };
}

function resolveTargetKind(entries: Dirent[], missingTarget: boolean): TargetKind {
  if (missingTarget || entries.length === 0) {
    return "empty-folder";
  }

  const hasGit = entries.some((entry) => entry.name === ".git");
  return hasGit ? "existing-repo" : "existing-project";
}

async function detectProjectType(targetRoot: string, entries: Dirent[]): Promise<ProjectType> {
  const direct = detectProjectTypeFromEntries(entries);
  if (direct !== "generic") {
    return direct;
  }

  return detectNestedProjectType(targetRoot, entries);
}

function detectProjectTypeFromEntries(entries: Dirent[]): ProjectType {
  const names = new Set(entries.map((entry) => entry.name));
  const dirNames = new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  const hasPythonSignals = hasAny(names, ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile", "poetry.lock"]);
  if (hasPythonSignals) {
    return "python";
  }

  const hasNodeSignals =
    hasAny(names, ["package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json", "tsconfig.json"]) ||
    hasAnyDirectory(dirNames, ["apps", "packages", "frontend", "backend", "web", "api", "services"]) ||
    (hasAnyDirectory(dirNames, ["apps", "packages", "tests"]) &&
      hasAny(names, ["docker-compose.yml", "docker-compose.yaml", "turbo.json", "nx.json"]));
  if (hasNodeSignals) {
    return "node";
  }

  if (
    hasAny(names, ["dbt_project.yml", "dbt_project.yaml"]) ||
    hasAnyDirectory(dirNames, ["dags", "models", "sql", "airflow"])
  ) {
    return "data-platform";
  }

  if (names.has("mkdocs.yml") || names.has("mkdocs.yaml") || dirNames.has("docs")) {
    return "docs";
  }
  return "generic";
}

async function detectNestedProjectType(targetRoot: string, entries: Dirent[]): Promise<ProjectType> {
  const nestedProjectTypes = new Map<ProjectType, number>();
  const candidateDirs = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));

  for (const entry of candidateDirs) {
    try {
      const nestedEntries = await fs.readdir(path.join(targetRoot, entry.name), { withFileTypes: true });
      const detected = detectProjectTypeFromEntries(nestedEntries.filter((nested) => !isIgnoredArtifactName(nested.name)));
      if (detected !== "generic") {
        nestedProjectTypes.set(detected, (nestedProjectTypes.get(detected) ?? 0) + 1);
      }
    } catch {
      // Ignore unreadable nested directories.
    }
  }

  const ranked = [...nestedProjectTypes.entries()].sort((left, right) => right[1] - left[1]);
  return ranked[0]?.[0] ?? "generic";
}

async function findExistingAuthorityFiles(targetRoot: string, config: LoadedConfig): Promise<string[]> {
  const configuredAuthorityFiles = config.global.defaults.authority_files ?? [];
  const candidates = [
    "AGENTS.md",
    "CLAUDE.md",
    ".github/copilot-instructions.md",
    ...configuredAuthorityFiles.filter(
      (relativePath) => !["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"].includes(relativePath)
    )
  ];
  const discovered: string[] = [];
  for (const relativePath of candidates) {
    if (await pathExists(path.join(targetRoot, relativePath))) {
      discovered.push(relativePath);
    }
  }
  return discovered;
}

async function detectAuthorityProfileHint(targetRoot: string, authorityFiles: string[], config: LoadedConfig): Promise<string | undefined> {
  const profileNames = Object.keys(config.routing.profiles);
  if (profileNames.length === 0) {
    return undefined;
  }

  for (const relativePath of authorityFiles) {
    const fullPath = path.join(targetRoot, relativePath);
    const content = await readText(fullPath);
    const lowered = content.toLowerCase();
    for (const profileName of profileNames) {
      if (lowered.includes(profileName.toLowerCase())) {
        return profileName;
      }
    }
  }
  return undefined;
}

async function detectInitialization(targetRoot: string, authorityFiles: string[]): Promise<boolean> {
  const overlayPath = path.join(targetRoot, ".agent", "project.yaml");
  if (await pathExists(overlayPath)) {
    return true;
  }

  for (const relativePath of authorityFiles) {
    const fullPath = path.join(targetRoot, relativePath);
    const content = await readText(fullPath);
    if (content.includes("SHREY-JUNIOR")) {
      return true;
    }
  }

  return false;
}

async function detectAuthorityOptOut(targetRoot: string, authorityFiles: string[]): Promise<string | undefined> {
  for (const relativePath of authorityFiles) {
    const fullPath = path.join(targetRoot, relativePath);
    const content = await readText(fullPath);
    const excerpt = findAuthorityOptOutExcerpt(content);
    if (excerpt) {
      return `${relativePath}: ${excerpt}`;
    }
  }
  return undefined;
}

function hasAny(values: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => values.has(candidate));
}

function hasAnyDirectory(values: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => values.has(candidate));
}

function findAuthorityOptOutExcerpt(content: string): string | undefined {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => Boolean(line));

  for (const line of lines) {
    const lowered = line.toLowerCase();
    if (
      lowered.includes("repo authority overrides global preferences") ||
      lowered.includes("do not use shrey junior") ||
      lowered.includes("operate repo-local only") ||
      (lowered.includes("repo-local only") && lowered.includes("shrey junior"))
    ) {
      return line.slice(0, 180);
    }
  }

  return undefined;
}

export function isProjectType(value: string): value is ProjectType {
  return PROJECT_TYPES.includes(value as ProjectType);
}
