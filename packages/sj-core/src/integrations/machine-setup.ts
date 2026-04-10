import path from "node:path";
import { existsSync } from "node:fs";
import { loadCanonicalConfig } from "../core/config.js";
import { inspectBootstrapTarget } from "../core/project-detect.js";
import { getRuntimeRepoGraphStatus } from "../runtime/client.js";
import { pathExists, readText } from "../utils/fs.js";
import { loadMachineAdvisory, type MachineAdvisoryState } from "./machine-advisory.js";
import {
  discoverMachineTools,
  resolveMachineHome,
  type MachineCommandRunner,
  type MachineToolDetection
} from "./machine-setup-detection.js";

export type MachineSetupProfile =
  | "desktop-only"
  | "desktop-plus-cli"
  | "repo-only"
  | "repair"
  | "full-dev-machine";

export type MachineSetupActionId =
  | "global-cli"
  | "global-preferences"
  | "repo-contract"
  | "repo-assistant-wiring"
  | "repo-graph"
  | "repo-hygiene"
  | "lean-ctx"
  | "repomix";

export interface MachineSetupStep {
  id: MachineSetupActionId;
  title: string;
  scope: "machine" | "repo";
  required: boolean;
  status: "ready" | "actionable" | "blocked" | "optional";
  detail: string;
  recommendedCommand: string | null;
}

export interface MachineSetupState {
  artifactType: "kiwi-control/machine-setup";
  version: 1;
  updatedAt: string;
  targetRoot: string;
  profile: MachineSetupProfile;
  homeRoot: string;
  globalHomeRoot: string;
  pathBinRoot: string;
  shellProfilePath: string;
  aiSetup: {
    detected: boolean;
    path: string | null;
    status: "available-for-reuse" | "not-detected";
    note: string;
  };
  tools: MachineToolDetection[];
  advisory: Pick<
    MachineAdvisoryState,
    "updatedAt" | "stale" | "inventory" | "configHealth" | "optimizationLayers" | "setupPhases" | "guidance" | "setupSummary"
  >;
  repo: {
    initialized: boolean;
    repoMode: string;
    graphReady: boolean;
    repomixOutputReady: boolean;
    assistantWiringReady: boolean;
    gitignoreReady: boolean;
    instructionFilesReady: boolean;
  };
  summary: {
    status: "ready" | "needs-work" | "blocked";
    detail: string;
    actionableRequiredCount: number;
    blockedRequiredCount: number;
  };
  steps: MachineSetupStep[];
  notes: string[];
}

export interface MachineSetupStatusOptions {
  repoRoot?: string;
  targetRoot: string;
  profile?: MachineSetupProfile;
  homeRoot?: string;
  machineAdvisory?: MachineAdvisoryState | null;
  commandRunner?: MachineCommandRunner;
}

export const AI_SETUP_GITIGNORE_ENTRIES = [
  ".code-review-graph/",
  ".omc/",
  ".omx/",
  ".lean-ctx/",
  ".repomix-output.xml"
] as const;

export async function buildMachineSetupState(options: MachineSetupStatusOptions): Promise<MachineSetupState> {
  const profile = options.profile ?? "full-dev-machine";
  const homeRoot = resolveMachineHome(options.homeRoot);
  const globalHomeRoot = resolveGlobalHomeRoot(homeRoot);
  const pathBinRoot = resolvePathBinRoot(homeRoot);
  const shellProfilePath = resolveShellProfilePath(homeRoot);
  const advisory = options.machineAdvisory ?? await loadMachineAdvisory({
    ...(options.homeRoot ? { homeRoot: options.homeRoot } : {}),
    ...(options.commandRunner ? { commandRunner: options.commandRunner } : {})
  });
  const tools = await discoverMachineTools({
    homeRoot,
    ...(options.commandRunner ? { commandRunner: options.commandRunner } : {})
  });
  const aiSetupTool = tools.find((entry) => entry.name === "ai-setup") ?? null;
  const config = await loadCanonicalConfig(options.repoRoot ?? process.cwd());
  const inspection = await inspectBootstrapTarget(options.targetRoot, config);
  const graph = await getRuntimeRepoGraphStatus(options.targetRoot).catch(() => null);
  const repomixOutputReady =
    await pathExists(path.join(options.targetRoot, ".repomix-output.xml"))
    || await pathExists(path.join(options.targetRoot, "repomix-output.xml"));
  const assistantWiringReady = await pathExists(path.join(options.targetRoot, ".omc"))
    && (!(tools.find((entry) => entry.name === "copilot")?.installed ?? false) || await pathExists(path.join(options.targetRoot, ".github", "copilot", "mcp.json")));
  const gitignoreReady = await repoGitignoreReady(options.targetRoot);
  const instructionFilesReady = await repoInstructionFilesReady(options.targetRoot);
  const globalCliReady = await detectGlobalCliInstall(globalHomeRoot, pathBinRoot);

  const steps = buildMachineSetupSteps({
    profile,
    tools,
    advisory,
    globalCliReady,
    repo: {
      initialized: inspection.alreadyInitialized,
      graphReady: graph?.status === "ready",
      repomixOutputReady,
      assistantWiringReady,
      gitignoreReady,
      instructionFilesReady
    }
  });
  const actionableRequiredCount = steps.filter((entry) => entry.required && entry.status === "actionable").length;
  const blockedRequiredCount = steps.filter((entry) => entry.required && entry.status === "blocked").length;
  const summaryStatus = blockedRequiredCount > 0
    ? "blocked"
    : actionableRequiredCount > 0
      ? "needs-work"
      : "ready";

  return {
    artifactType: "kiwi-control/machine-setup",
    version: 1,
    updatedAt: new Date().toISOString(),
    targetRoot: options.targetRoot,
    profile,
    homeRoot,
    globalHomeRoot,
    pathBinRoot,
    shellProfilePath,
    aiSetup: {
      detected: Boolean(aiSetupTool?.installed),
      path: aiSetupTool?.path ?? null,
      status: aiSetupTool?.installed ? "available-for-reuse" : "not-detected",
      note: aiSetupTool?.installed
        ? "Local ai-setup is available as a compatibility helper, but Kiwi setup remains the primary machine setup surface."
        : "Local ai-setup was not detected. Kiwi setup must rely on native steps and explicit tool availability checks."
    },
    tools,
    advisory: {
      updatedAt: advisory.updatedAt,
      stale: advisory.stale,
      inventory: advisory.inventory,
      configHealth: advisory.configHealth,
      optimizationLayers: advisory.optimizationLayers,
      setupPhases: advisory.setupPhases,
      guidance: advisory.guidance,
      setupSummary: advisory.setupSummary
    },
    repo: {
      initialized: inspection.alreadyInitialized,
      repoMode: inspection.alreadyInitialized ? "initialized" : "repo-not-initialized",
      graphReady: graph?.status === "ready",
      repomixOutputReady,
      assistantWiringReady,
      gitignoreReady,
      instructionFilesReady
    },
    summary: {
      status: summaryStatus,
      detail: summaryStatus === "ready"
        ? "Machine and repo setup surfaces needed for this profile are already aligned."
        : summaryStatus === "blocked"
          ? "At least one required setup surface is blocked or unsupported and needs manual intervention."
          : "One or more required setup surfaces still need attention for this profile.",
      actionableRequiredCount,
      blockedRequiredCount
    },
    steps,
    notes: [
      "Machine setup is machine-global and non-canonical. Repo runtime authority stays in runtime SQLite and repo-local derived outputs.",
      "Detected ai-setup is treated as a compatibility helper, not as runtime authority."
    ]
  };
}

export function resolveProfileStepIds(profile: MachineSetupProfile): MachineSetupActionId[] {
  switch (profile) {
    case "desktop-only":
      return ["repo-contract", "repo-assistant-wiring", "repo-graph", "repo-hygiene"];
    case "desktop-plus-cli":
      return ["global-cli", "global-preferences", "repo-contract", "repo-assistant-wiring", "repo-graph", "repo-hygiene"];
    case "repo-only":
      return ["repo-contract", "repo-assistant-wiring", "repo-graph", "repo-hygiene"];
    case "repair":
      return ["global-cli", "global-preferences", "repo-contract", "repo-assistant-wiring", "repo-graph", "repo-hygiene", "lean-ctx", "repomix"];
    case "full-dev-machine":
    default:
      return ["global-cli", "global-preferences", "repo-contract", "repo-assistant-wiring", "repo-graph", "repo-hygiene"];
  }
}

export function resolvePathBinRoot(homeRoot: string): string {
  return process.env.KIWI_CONTROL_PATH_BIN
    ?? process.env.SHREY_JUNIOR_PATH_BIN
    ?? path.join(homeRoot, ".local", "bin");
}

export function resolveGlobalHomeRoot(homeRoot: string): string {
  if (process.env.KIWI_CONTROL_HOME) {
    return process.env.KIWI_CONTROL_HOME;
  }
  if (process.env.SHREY_JUNIOR_HOME) {
    return process.env.SHREY_JUNIOR_HOME;
  }
  const kiwiRoot = path.join(homeRoot, ".kiwi-control");
  const legacyRoot = path.join(homeRoot, ".shrey-junior");
  return existsSync(kiwiRoot) || !existsSync(legacyRoot) ? kiwiRoot : legacyRoot;
}

export function resolveShellProfilePath(homeRoot: string): string {
  const shellName = (process.env.KIWI_CONTROL_SHELL ?? process.env.SHELL ?? "").split("/").pop() ?? "";
  if (shellName === "bash") {
    return process.platform === "darwin"
      ? path.join(homeRoot, ".bash_profile")
      : path.join(homeRoot, ".bashrc");
  }
  if (shellName === "zsh") {
    return path.join(homeRoot, ".zshrc");
  }
  return path.join(homeRoot, ".profile");
}

export async function repoGitignoreReady(targetRoot: string): Promise<boolean> {
  const gitignorePath = path.join(targetRoot, ".gitignore");
  if (!(await pathExists(gitignorePath))) {
    return false;
  }
  const content = await readText(gitignorePath);
  return AI_SETUP_GITIGNORE_ENTRIES.every((entry) => content.includes(entry));
}

export async function repoInstructionFilesReady(targetRoot: string): Promise<boolean> {
  const required = [
    path.join(targetRoot, "AGENTS.md"),
    path.join(targetRoot, "CLAUDE.md"),
    path.join(targetRoot, ".github", "copilot-instructions.md")
  ];
  const statuses = await Promise.all(required.map((entry) => pathExists(entry)));
  return statuses.every(Boolean);
}

function buildMachineSetupSteps(input: {
  profile: MachineSetupProfile;
  tools: MachineToolDetection[];
  advisory: MachineAdvisoryState;
  globalCliReady: boolean;
  repo: {
    initialized: boolean;
    graphReady: boolean;
    repomixOutputReady: boolean;
    assistantWiringReady: boolean;
    gitignoreReady: boolean;
    instructionFilesReady: boolean;
  };
}): MachineSetupStep[] {
  const requiredIds = new Set(resolveProfileStepIds(input.profile));
  const toolInstalled = (name: string): boolean => input.tools.some((entry) => entry.name === name && entry.installed);
  const healthyConfig = (pathLabel: string): boolean =>
    input.advisory.configHealth.find((entry) => entry.path === pathLabel)?.healthy ?? false;
  const leanCtxActive = input.advisory.optimizationLayers.find((entry) => entry.name === "lean-ctx");

  const steps: Array<MachineSetupStep> = [
    {
      id: "global-cli",
      title: "Install Kiwi CLI globally",
      scope: "machine",
      required: requiredIds.has("global-cli"),
      status: input.globalCliReady ? "ready" : requiredIds.has("global-cli") ? "actionable" : "optional",
      detail: input.globalCliReady
        ? "Global Kiwi CLI wrappers, aliases, and bootstrap defaults are already installed."
        : "Install global Kiwi CLI wrappers, aliases, and defaults so desktop and terminal share the same machine entry point.",
      recommendedCommand: "kiwi-control setup install global-cli"
    },
    {
      id: "global-preferences",
      title: "Apply global AI preferences",
      scope: "machine",
      required: requiredIds.has("global-preferences"),
      status:
        healthyConfig("~/.codex/config.toml")
        && healthyConfig("~/.codex/AGENTS.md")
        && healthyConfig("~/.claude/CLAUDE.md")
        && healthyConfig("~/.claude/settings.json")
        && healthyConfig("~/Library/Application Support/Code/User/prompts/shrey-junior.instructions.md")
        && healthyConfig("~/Library/Application Support/Code/User/mcp.json")
          ? "ready"
          : requiredIds.has("global-preferences")
            ? "actionable"
            : "optional",
      detail:
        healthyConfig("~/.codex/config.toml")
        && healthyConfig("~/.codex/AGENTS.md")
        && healthyConfig("~/.claude/CLAUDE.md")
        && healthyConfig("~/.claude/settings.json")
        && healthyConfig("~/Library/Application Support/Code/User/prompts/shrey-junior.instructions.md")
        && healthyConfig("~/Library/Application Support/Code/User/mcp.json")
          ? "Global Codex and Claude preference surfaces look healthy."
          : "Apply Kiwi-managed machine-global instruction and editor preference surfaces.",
      recommendedCommand: "kiwi-control setup repair global-preferences"
    },
    {
      id: "repo-contract",
      title: input.repo.initialized ? "Sync repo contract" : "Initialize repo contract",
      scope: "repo",
      required: requiredIds.has("repo-contract"),
      status: input.repo.initialized && input.repo.instructionFilesReady
        ? "ready"
        : "actionable",
      detail: input.repo.initialized && input.repo.instructionFilesReady
        ? "Repo-local contract and primary instruction files are already present."
        : "Initialize or sync repo-local Kiwi contract surfaces and instruction files.",
      recommendedCommand: "kiwi-control setup init"
    },
    {
      id: "repo-assistant-wiring",
      title: "Wire repo assistant compatibility files",
      scope: "repo",
      required: requiredIds.has("repo-assistant-wiring"),
      status: input.repo.assistantWiringReady ? "ready" : "actionable",
      detail: input.repo.assistantWiringReady
        ? "Compatibility assistant wiring is already present for this repo."
        : "Create lightweight compatibility wiring for .omc and Copilot MCP repo surfaces.",
      recommendedCommand: "kiwi-control setup repair repo-assistant-wiring"
    },
    {
      id: "repo-graph",
      title: "Refresh runtime-backed repo graph",
      scope: "repo",
      required: requiredIds.has("repo-graph"),
      status: input.repo.graphReady ? "ready" : "actionable",
      detail: input.repo.graphReady
        ? "Runtime-backed graph authority is already ready."
        : "Build or refresh the runtime-backed repo graph and related intelligence outputs.",
      recommendedCommand: "kiwi-control setup repair repo-graph"
    },
    {
      id: "repo-hygiene",
      title: "Align repo hygiene outputs",
      scope: "repo",
      required: requiredIds.has("repo-hygiene"),
      status: input.repo.gitignoreReady ? "ready" : "actionable",
      detail: input.repo.gitignoreReady
        ? "Supported setup artifacts are already covered by .gitignore."
        : "Add supported machine-setup outputs to .gitignore without rewriting unrelated entries.",
      recommendedCommand: "kiwi-control setup repair repo-hygiene"
    },
    {
      id: "lean-ctx",
      title: "Initialize lean-ctx",
      scope: "machine",
      required: requiredIds.has("lean-ctx"),
      status: !toolInstalled("lean-ctx")
        ? requiredIds.has("lean-ctx") ? "blocked" : "optional"
        : leanCtxActive?.claude || leanCtxActive?.codex || leanCtxActive?.copilot
          ? "ready"
          : "actionable",
      detail: !toolInstalled("lean-ctx")
        ? "lean-ctx is not installed on this machine."
        : leanCtxActive?.claude || leanCtxActive?.codex || leanCtxActive?.copilot
          ? "lean-ctx already has active compression signals."
          : "Initialize lean-ctx so shell output compression is actually active on this machine.",
      recommendedCommand: "kiwi-control setup repair lean-ctx"
    },
    {
      id: "repomix",
      title: "Generate repomix output",
      scope: "repo",
      required: requiredIds.has("repomix"),
      status: !toolInstalled("repomix")
        ? requiredIds.has("repomix") ? "blocked" : "optional"
        : input.repo.repomixOutputReady
          ? "ready"
          : "actionable",
      detail: !toolInstalled("repomix")
        ? "repomix is not installed on this machine."
        : input.repo.repomixOutputReady
          ? "repomix output already exists for this repo."
          : "Generate the compressed repomix summary for this repo.",
      recommendedCommand: "kiwi-control setup repair repomix"
    }
  ];

  return steps;
}

async function detectGlobalCliInstall(globalHomeRoot: string, pathBinRoot: string): Promise<boolean> {
  const required = [
    path.join(globalHomeRoot, "bin", "kiwi-control"),
    path.join(globalHomeRoot, "bin", "sj-init"),
    path.join(pathBinRoot, "kiwi-control"),
    path.join(pathBinRoot, "kc"),
    path.join(pathBinRoot, "sj-init")
  ];
  const statuses = await Promise.all(required.map((entry) => pathExists(entry)));
  return statuses.every(Boolean);
}
