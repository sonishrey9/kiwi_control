import path from "node:path";
import { promises as fs } from "node:fs";
import { pathExists, readJson } from "../utils/fs.js";
import {
  MACHINE_SETUP_TOOL_REGISTRY,
  discoverMachineTools,
  resolveMachineHome,
  runMachineCommand,
  type MachineCommandOutput as CommandOutput,
  type MachineCommandRunner
} from "./machine-setup-detection.js";
import {
  buildMachineGuidance,
  buildMachineGuidanceContext,
  buildMachineSystemHealth,
  filterMachineGuidance
} from "./machine-advisory-guidance.js";
import {
  loadMachineAdvisoryFromCache,
  loadMachineAdvisorySectionFromCache,
  MACHINE_ADVISORY_ARTIFACT_TYPE,
  MACHINE_ADVISORY_VERSION,
  writeMachineAdvisoryCache
} from "./machine-advisory-cache.js";
import { buildOptimizationScore } from "./machine-advisory-score.js";
import { buildSetupSummary } from "./machine-advisory-summary.js";

export { buildMachineGuidanceContext, filterMachineGuidance } from "./machine-advisory-guidance.js";

const MACHINE_FAST_ENV = "KIWI_MACHINE_ADVISORY_FAST";
const TOKEN_SERVER_IDS = ["code-review-graph", "lean-ctx", "context-mode", "ccusage"] as const;

export interface MachineAdvisoryTool {
  name: string;
  description: string;
  phase: string;
  installed: boolean;
  version: string;
}

export interface MachineAdvisoryMcpTokenServer {
  name: string;
  claude: boolean;
  codex: boolean;
  copilot: boolean;
}

export interface MachineAdvisoryMcpInventory {
  claudeTotal: number;
  codexTotal: number;
  copilotTotal: number;
  tokenServers: MachineAdvisoryMcpTokenServer[];
}

export interface MachineAdvisoryOptimizationLayer {
  name: string;
  savings: string;
  claude: boolean;
  codex: boolean;
  copilot: boolean;
}

export interface MachineAdvisorySetupPhaseItem {
  name: string;
  description: string;
  location: string;
  active: boolean;
}

export interface MachineAdvisorySetupPhase {
  phase: string;
  items: MachineAdvisorySetupPhaseItem[];
}

export interface MachineAdvisoryConfigHealth {
  path: string;
  healthy: boolean;
  description: string;
}

export type MachineAdvisorySectionName =
  | "inventory"
  | "mcpInventory"
  | "optimizationLayers"
  | "setupPhases"
  | "configHealth"
  | "usage"
  | "guidance";

export interface MachineAdvisorySectionState {
  status: "fresh" | "cached" | "partial";
  updatedAt: string;
  reason?: string;
}

export interface MachineAdvisoryClaudeUsageDay {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number | null;
  modelsUsed: string[];
}

export interface MachineAdvisoryCodexUsageDay {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningOutputTokens: number;
  sessions: number;
}

export interface MachineAdvisoryUsage {
  days: number;
  claude: {
    available: boolean;
    days: MachineAdvisoryClaudeUsageDay[];
    totals: {
      inputTokens: number;
      outputTokens: number;
      cacheCreationTokens: number;
      cacheReadTokens: number;
      totalTokens: number;
      totalCost: number | null;
      cacheHitRatio: number | null;
    };
    note: string;
  };
  codex: {
    available: boolean;
    days: MachineAdvisoryCodexUsageDay[];
    totals: {
      inputTokens: number;
      outputTokens: number;
      cachedInputTokens: number;
      reasoningOutputTokens: number;
      sessions: number;
      totalTokens: number;
      cacheHitRatio: number | null;
    };
    note: string;
  };
  copilot: {
    available: boolean;
    note: string;
  };
}

export interface MachineAdvisoryGuidance {
  id: string;
  section: MachineAdvisorySectionName;
  priority: "critical" | "recommended" | "optional";
  group: "critical-issues" | "improvements" | "optional-optimizations";
  severity: "info" | "warn";
  message: string;
  impact: string;
  reason?: string;
  fixCommand?: string;
  hintCommand?: string;
}

export interface MachineAdvisorySystemHealth {
  criticalCount: number;
  warningCount: number;
  okCount: number;
}

export interface MachineAdvisoryOptimizationScoreRuntime {
  label: "planning" | "execution" | "assistant";
  score: number;
  earnedPoints: number;
  maxPoints: number;
  activeSignals: string[];
  missingSignals: string[];
}

export interface MachineAdvisoryOptimizationScore {
  planning: MachineAdvisoryOptimizationScoreRuntime;
  execution: MachineAdvisoryOptimizationScoreRuntime;
  assistant: MachineAdvisoryOptimizationScoreRuntime;
}

export interface MachineAdvisorySetupSummary {
  installedTools: {
    readyCount: number;
    totalCount: number;
  };
  healthyConfigs: {
    readyCount: number;
    totalCount: number;
  };
  activeTokenLayers: string[];
  readyRuntimes: {
    planning: boolean;
    execution: boolean;
    assistant: boolean;
  };
}

export interface MachineGuidanceContext {
  taskType?: string | null;
  workflowStep?: string | null;
  validationFailed?: boolean;
  evalPrecisionLow?: boolean;
  executionRetriesTriggered?: boolean;
}

export interface MachineAdvisoryState {
  artifactType: "kiwi-control/machine-advisory";
  version: 3;
  generatedBy: string;
  windowDays: number;
  updatedAt: string;
  stale: boolean;
  sections: Record<MachineAdvisorySectionName, MachineAdvisorySectionState>;
  inventory: MachineAdvisoryTool[];
  mcpInventory: MachineAdvisoryMcpInventory;
  optimizationLayers: MachineAdvisoryOptimizationLayer[];
  setupPhases: MachineAdvisorySetupPhase[];
  configHealth: MachineAdvisoryConfigHealth[];
  skillsCount: number;
  copilotPlugins: string[];
  usage: MachineAdvisoryUsage;
  systemHealth: MachineAdvisorySystemHealth;
  optimizationScore: MachineAdvisoryOptimizationScore;
  setupSummary: MachineAdvisorySetupSummary;
  guidance: MachineAdvisoryGuidance[];
  note: string;
}

export interface MachineDoctorFinding {
  level: "error" | "warn";
  category: string;
  reason: string;
  fixCommand: string;
}

export interface MachineAdvisoryBuildOptions {
  forceRefresh?: boolean;
  homeRoot?: string;
  now?: Date;
  commandRunner?: (command: string, args: string[]) => Promise<CommandOutput>;
  ccusagePayload?: { daily?: Array<Record<string, unknown>> } | null;
  fastMode?: boolean;
  section?: MachineAdvisorySectionName;
}

export async function loadMachineAdvisory(options: MachineAdvisoryBuildOptions = {}): Promise<MachineAdvisoryState> {
  const now = options.now ?? new Date();
  const homeRoot = resolveMachineHome(options.homeRoot);
  const explicitFastMode = resolveMachineAdvisoryFastMode(options);

  if (!options.forceRefresh) {
    const cached = await loadMachineAdvisoryFromCache(homeRoot, now, explicitFastMode
      ? { forceStale: true }
      : undefined);
    if (cached) {
      return explicitFastMode
        ? { ...cached, note: appendFastModeNote(cached.note) }
        : cached;
    }
  }

  if (explicitFastMode) {
    return buildUnavailableMachineAdvisory(now, "Machine-local advisory fast mode is active for desktop repo loading.");
  }

  const built = await buildMachineAdvisory(options);
  await writeMachineAdvisoryCache(homeRoot, built);
  return built;
}

export async function buildMachineAdvisory(options: MachineAdvisoryBuildOptions = {}): Promise<MachineAdvisoryState> {
  const homeRoot = resolveMachineHome(options.homeRoot);
  const now = options.now ?? new Date();
  const windowDays = 7;
  const fastMode = resolveMachineAdvisoryFastMode(options);
  const commandRunner = fastMode
    ? async () => ({ code: 1, stdout: "", stderr: "" } satisfies CommandOutput)
    : options.commandRunner;
  const ccusagePayload = fastMode ? { daily: [] } : options.ccusagePayload;
  const builtAt = now.toISOString();
  const inventory = await buildMachineSection("inventory", builtAt, async () => buildToolchainInventory(homeRoot, commandRunner), []);
  const mcpInventory = await buildMachineSection("mcpInventory", builtAt, async () => buildMcpInventory(homeRoot), {
    claudeTotal: 0,
    codexTotal: 0,
    copilotTotal: 0,
    tokenServers: []
  });
  const optimizationLayers = await buildMachineSection("optimizationLayers", builtAt, async () => buildOptimizationLayers(homeRoot), []);
  const configHealth = await buildMachineSection("configHealth", builtAt, async () => buildConfigHealth(homeRoot), []);
  const skillsCount = await countSkills(homeRoot).catch(() => 0);
  const copilotPlugins = await getCopilotPlugins(homeRoot).catch(() => []);
  const usage = await buildMachineSection(
    "usage",
    builtAt,
    async () => buildUsage(homeRoot, windowDays, now, commandRunner, ccusagePayload),
    buildUnavailableMachineAdvisory(now, "Machine-local usage is unavailable.").usage
  );
  const setupPhases = await buildMachineSection(
    "setupPhases",
    builtAt,
    async () => buildSetupPhases({
      homeRoot,
      inventory: inventory.data,
      mcpInventory: mcpInventory.data,
      optimizationLayers: optimizationLayers.data,
      configHealth: configHealth.data,
      skillsCount,
      copilotPlugins
    }),
    []
  );
  const guidance = buildMachineGuidance({
    inventory: inventory.data,
    mcpInventory: mcpInventory.data,
    optimizationLayers: optimizationLayers.data,
    configHealth: configHealth.data,
    usage: usage.data
  });
  const systemHealth = buildMachineSystemHealth({
    inventory: inventory.data,
    optimizationLayers: optimizationLayers.data,
    configHealth: configHealth.data,
    guidance
  });
  const optimizationScore = buildOptimizationScore({
    inventory: inventory.data,
    mcpInventory: mcpInventory.data,
    optimizationLayers: optimizationLayers.data,
    configHealth: configHealth.data,
    copilotPlugins,
    usage: usage.data
  });
  const setupSummary = buildSetupSummary({
    inventory: inventory.data,
    configHealth: configHealth.data,
    optimizationLayers: optimizationLayers.data,
    optimizationScore
  });

  return {
    artifactType: MACHINE_ADVISORY_ARTIFACT_TYPE,
    version: MACHINE_ADVISORY_VERSION,
    generatedBy: "kiwi-control machine-advisory",
    windowDays,
    updatedAt: builtAt,
    stale: fastMode,
    sections: {
      inventory: inventory.meta,
      mcpInventory: mcpInventory.meta,
      optimizationLayers: optimizationLayers.meta,
      setupPhases: setupPhases.meta,
      configHealth: configHealth.meta,
      usage: usage.meta,
      guidance: {
        status: "fresh",
        updatedAt: builtAt
      }
    },
    inventory: inventory.data,
    mcpInventory: mcpInventory.data,
    optimizationLayers: optimizationLayers.data,
    setupPhases: setupPhases.data,
    configHealth: configHealth.data,
    skillsCount,
    copilotPlugins,
    usage: usage.data,
    systemHealth,
    optimizationScore,
    setupSummary,
    guidance,
    note: fastMode
      ? "Machine-local advisory was built in CI fast mode. Refresh in a live shell for actual machine readings."
      : "Machine-local advisory only. Optimization scores are heuristic completeness estimates calculated from inspected machine signals and never override repo-local Kiwi state."
  };
}

export async function loadMachineAdvisorySection(
  section: MachineAdvisorySectionName,
  options: MachineAdvisoryBuildOptions = {}
): Promise<{ section: MachineAdvisorySectionName; meta: MachineAdvisorySectionState; data: unknown }> {
  const homeRoot = resolveMachineHome(options.homeRoot);
  const now = options.now ?? new Date();
  const builtAt = now.toISOString();
  const windowDays = 7;
  const fastMode = resolveMachineAdvisoryFastMode(options);
  const commandRunner = fastMode
    ? async () => ({ code: 1, stdout: "", stderr: "" } satisfies CommandOutput)
    : options.commandRunner;
  const ccusagePayload = fastMode ? { daily: [] } : options.ccusagePayload;

  if (!options.forceRefresh) {
    const cachedSection = await loadMachineAdvisorySectionFromCache(section, homeRoot, now);
    if (cachedSection) {
      return cachedSection;
    }
  }

  switch (section) {
    case "inventory":
      return buildMachineSection(section, builtAt, async () => buildToolchainInventory(homeRoot, commandRunner), []);
    case "mcpInventory":
      return buildMachineSection(section, builtAt, async () => buildMcpInventory(homeRoot), {
        claudeTotal: 0,
        codexTotal: 0,
        copilotTotal: 0,
        tokenServers: []
      });
    case "optimizationLayers":
      return buildMachineSection(section, builtAt, async () => buildOptimizationLayers(homeRoot), []);
    case "configHealth":
      return buildMachineSection(section, builtAt, async () => buildConfigHealth(homeRoot), []);
    case "usage":
      return buildMachineSection(
        section,
        builtAt,
        async () => buildUsage(homeRoot, windowDays, now, commandRunner, ccusagePayload),
        buildUnavailableMachineAdvisory(now, "Machine-local usage is unavailable.").usage
      );
    case "setupPhases": {
      const inventory = await loadMachineAdvisorySection("inventory", options);
      const mcpInventory = await loadMachineAdvisorySection("mcpInventory", options);
      const optimizationLayers = await loadMachineAdvisorySection("optimizationLayers", options);
      const configHealth = await loadMachineAdvisorySection("configHealth", options);
      const skillsCount = await countSkills(homeRoot).catch(() => 0);
      const copilotPlugins = await getCopilotPlugins(homeRoot).catch(() => []);
      return buildMachineSection(
        section,
        builtAt,
        async () => buildSetupPhases({
          homeRoot,
          inventory: inventory.data as MachineAdvisoryTool[],
          mcpInventory: mcpInventory.data as MachineAdvisoryMcpInventory,
          optimizationLayers: optimizationLayers.data as MachineAdvisoryOptimizationLayer[],
          configHealth: configHealth.data as MachineAdvisoryConfigHealth[],
          skillsCount,
          copilotPlugins
        }),
        []
      );
    }
    case "guidance": {
      const inventory = await loadMachineAdvisorySection("inventory", options);
      const mcpInventory = await loadMachineAdvisorySection("mcpInventory", options);
      const optimizationLayers = await loadMachineAdvisorySection("optimizationLayers", options);
      const configHealth = await loadMachineAdvisorySection("configHealth", options);
      const usage = await loadMachineAdvisorySection("usage", options);
      return {
        section,
        meta: {
          status: "fresh",
          updatedAt: builtAt
        },
        data: buildMachineGuidance({
          inventory: inventory.data as MachineAdvisoryTool[],
          mcpInventory: mcpInventory.data as MachineAdvisoryMcpInventory,
          optimizationLayers: optimizationLayers.data as MachineAdvisoryOptimizationLayer[],
          configHealth: configHealth.data as MachineAdvisoryConfigHealth[],
          usage: usage.data as MachineAdvisoryUsage
        })
      };
    }
  }
}

export function buildMachineDoctorFindings(state: MachineAdvisoryState, homeRoot?: string): MachineDoctorFinding[] {
  const home = resolveMachineHome(homeRoot);
  const findings: MachineDoctorFinding[] = [];

  const missingTools = state.inventory.filter((tool) => !tool.installed).map((tool) => tool.name);
  if (missingTools.length > 0) {
    findings.push({
      level: "warn",
      category: "toolchain",
      reason: `Missing tools: ${missingTools.join(", ")}`,
      fixCommand: suggestMachineFixForTools(missingTools)
    });
  }

  const unhealthyConfigs = state.configHealth.filter((entry) => !entry.healthy);
  if (unhealthyConfigs.length > 0) {
    findings.push({
      level: "warn",
      category: "config",
      reason: `Unhealthy config surfaces: ${unhealthyConfigs.map((entry) => entry.path).join(", ")}`,
      fixCommand: suggestMachineFixForConfig(unhealthyConfigs.map((entry) => entry.path), home)
    });
  }

  const missingTokenLayers = state.optimizationLayers
    .filter((layer) => !layer.claude && !layer.codex && !layer.copilot)
    .map((layer) => layer.name);
  if (missingTokenLayers.length > 0) {
    findings.push({
      level: "warn",
      category: "optimization",
      reason: `No active token optimization layer detected for: ${missingTokenLayers.join(", ")}`,
      fixCommand: "ai-setup"
    });
  }

  if (!state.usage.claude.available && !state.usage.codex.available) {
    findings.push({
      level: "warn",
      category: "usage",
      reason: "No local usage telemetry was detected for Claude or Codex.",
      fixCommand: "kiwi-control usage --json"
    });
  }

  return findings;
}

async function buildMachineSection<T>(
  section: MachineAdvisorySectionName,
  updatedAt: string,
  builder: () => Promise<T>,
  fallback: T
): Promise<{ section: MachineAdvisorySectionName; meta: MachineAdvisorySectionState; data: T }> {
  try {
    return {
      section,
      meta: {
        status: "fresh",
        updatedAt
      },
      data: await builder()
    };
  } catch (error) {
    return {
      section,
      meta: {
        status: "partial",
        updatedAt,
        reason: error instanceof Error ? error.message : String(error)
      },
      data: fallback
    };
  }
}

async function buildToolchainInventory(homeRoot: string, commandRunner?: (command: string, args: string[]) => Promise<CommandOutput>): Promise<MachineAdvisoryTool[]> {
  return discoverMachineTools({
    homeRoot,
    ...(commandRunner ? { commandRunner: commandRunner as MachineCommandRunner } : {}),
    tools: MACHINE_SETUP_TOOL_REGISTRY
  });
}

async function buildMcpInventory(homeRoot: string): Promise<MachineAdvisoryMcpInventory> {
  const [claudeServers, codexServers, copilotServers] = await Promise.all([
    loadClaudeMcpServers(homeRoot),
    loadCodexMcpServers(homeRoot),
    loadCopilotMcpServers(homeRoot)
  ]);
  return {
    claudeTotal: Object.keys(claudeServers).length,
    codexTotal: Object.keys(codexServers).length,
    copilotTotal: Object.keys(copilotServers).length,
    tokenServers: TOKEN_SERVER_IDS.map((name) => ({
      name,
      claude: name in claudeServers,
      codex: name in codexServers,
      copilot: name in copilotServers
    }))
  };
}

async function buildOptimizationLayers(homeRoot: string): Promise<MachineAdvisoryOptimizationLayer[]> {
  const [claudeServers, codexServers, copilotServers] = await Promise.all([
    loadClaudeMcpServers(homeRoot),
    loadCodexMcpServers(homeRoot),
    loadCopilotMcpServers(homeRoot)
  ]);
  const claudeMd = await readTextIfExists(path.join(homeRoot, ".claude", "CLAUDE.md"));
  const codexAgents = await readTextIfExists(path.join(homeRoot, ".codex", "AGENTS.md"));
  const zshrc = await readTextIfExists(path.join(homeRoot, ".zshrc"));
  const codexLeanHook = await pathExists(path.join(homeRoot, ".codex", "hooks", "lean-ctx-rewrite-codex.sh"));

  return [
    {
      name: "code-review-graph",
      savings: "8x on structural queries",
      claude: "code-review-graph" in claudeServers,
      codex: "code-review-graph" in codexServers,
      copilot: "code-review-graph" in copilotServers
    },
    {
      name: "lean-ctx",
      savings: "89-99% shell compression",
      claude: zshrc.includes("lean-ctx"),
      codex: codexLeanHook,
      copilot: "lean-ctx" in copilotServers
    },
    {
      name: "context-mode",
      savings: "98% tool output sandbox",
      claude: "context-mode" in claudeServers,
      codex: false,
      copilot: false
    },
    {
      name: "token-efficient rules",
      savings: "10-20% output reduction",
      claude: claudeMd.includes("Token-Efficient Output Rules"),
      codex: codexAgents.includes("Token-Efficient Output Rules"),
      copilot: false
    },
    {
      name: "ccusage",
      savings: "visibility (monitoring)",
      claude: "ccusage" in claudeServers,
      codex: false,
      copilot: false
    }
  ];
}

async function buildConfigHealth(homeRoot: string): Promise<MachineAdvisoryConfigHealth[]> {
  const health: MachineAdvisoryConfigHealth[] = [];
  const claudeJson = await safeReadJson<Record<string, unknown>>(path.join(homeRoot, ".claude.json"));
  health.push({ path: "~/.claude.json", healthy: claudeJson != null, description: "Claude Code global config" });
  health.push({ path: "~/.claude/CLAUDE.md", healthy: await pathExists(path.join(homeRoot, ".claude", "CLAUDE.md")), description: "Claude Code instructions" });
  health.push({ path: "~/.claude/settings.json", healthy: await pathExists(path.join(homeRoot, ".claude", "settings.json")), description: "Claude Code settings" });
  health.push({ path: "~/.codex/config.toml", healthy: (await loadCodexMcpServers(homeRoot)) != null, description: "Codex global config (valid TOML)" });
  health.push({ path: "~/.codex/AGENTS.md", healthy: await pathExists(path.join(homeRoot, ".codex", "AGENTS.md")), description: "Codex global instructions" });
  health.push({ path: "~/.codex/hooks/lean-ctx-*", healthy: await pathExists(path.join(homeRoot, ".codex", "hooks", "lean-ctx-rewrite-codex.sh")), description: "Codex lean-ctx compression hook" });
  health.push({ path: "~/.copilot/mcp-config.json", healthy: await pathExists(path.join(homeRoot, ".copilot", "mcp-config.json")), description: "Copilot global MCP config" });
  health.push({ path: "~/.copilot/config.json", healthy: await pathExists(path.join(homeRoot, ".copilot", "config.json")), description: "Copilot plugin registry" });
  health.push({
    path: "~/Library/Application Support/Code/User/prompts/shrey-junior.instructions.md",
    healthy: await pathExists(path.join(homeRoot, "Library", "Application Support", "Code", "User", "prompts", "shrey-junior.instructions.md")),
    description: "VS Code prompt overlay"
  });
  health.push({
    path: "~/Library/Application Support/Code/User/mcp.json",
    healthy: await pathExists(path.join(homeRoot, "Library", "Application Support", "Code", "User", "mcp.json")),
    description: "VS Code MCP registry"
  });
  const junkHomeFiles = ["AGENTS.md", "CLAUDE.md"].map((name) => path.join(homeRoot, name));
  health.push({
    path: "~/AGENTS.md, ~/CLAUDE.md",
    healthy: !(await pathExists(junkHomeFiles[0]!)) && !(await pathExists(junkHomeFiles[1]!)),
    description: "No junk files in home directory"
  });
  return health;
}

async function countSkills(homeRoot: string): Promise<number> {
  const skillsDir = path.join(homeRoot, ".agents", "skills");
  if (!(await pathExists(skillsDir))) {
    return 0;
  }
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (await pathExists(path.join(skillsDir, entry.name, "SKILL.md"))) {
        count += 1;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

async function getCopilotPlugins(homeRoot: string): Promise<string[]> {
  const config = await safeReadJson<{ installed_plugins?: Array<{ name?: string }> }>(path.join(homeRoot, ".copilot", "config.json"));
  return (config?.installed_plugins ?? [])
    .map((plugin) => plugin.name?.trim())
    .filter((name): name is string => Boolean(name));
}

async function buildUsage(
  homeRoot: string,
  days: number,
  now: Date,
  commandRunner?: (command: string, args: string[]) => Promise<CommandOutput>,
  ccusagePayload?: { daily?: Array<Record<string, unknown>> } | null
): Promise<MachineAdvisoryUsage> {
  const [claude, codex] = await Promise.all([
    loadClaudeUsage(now, days, commandRunner, ccusagePayload),
    loadCodexUsage(homeRoot, days, now)
  ]);
  return {
    days,
    claude,
    codex,
    copilot: {
      available: false,
      note: "No real local Copilot usage telemetry source was found."
    }
  };
}

async function loadClaudeUsage(
  now: Date,
  days: number,
  commandRunner?: (command: string, args: string[]) => Promise<CommandOutput>,
  ccusagePayload?: { daily?: Array<Record<string, unknown>> } | null
): Promise<MachineAdvisoryUsage["claude"]> {
  const since = formatSinceDate(now, days);
  const command = ["npx", "-y", "ccusage", "daily", "--since", since, "--json"];
  try {
    const payload = ccusagePayload ?? await loadClaudeUsagePayload(command, commandRunner);
    const days = (payload.daily ?? []).map((entry) => ({
      date: String(entry.date ?? ""),
      inputTokens: numberOrZero(entry.inputTokens),
      outputTokens: numberOrZero(entry.outputTokens),
      cacheCreationTokens: numberOrZero(entry.cacheCreationTokens),
      cacheReadTokens: numberOrZero(entry.cacheReadTokens),
      totalTokens: numberOrZero(entry.totalTokens),
      totalCost: typeof entry.totalCost === "number" ? entry.totalCost : null,
      modelsUsed: Array.isArray(entry.modelsUsed) ? entry.modelsUsed.map((model) => String(model)) : []
    }));
    const totals = days.reduce((acc, day) => {
      acc.inputTokens += day.inputTokens;
      acc.outputTokens += day.outputTokens;
      acc.cacheCreationTokens += day.cacheCreationTokens;
      acc.cacheReadTokens += day.cacheReadTokens;
      acc.totalTokens += day.totalTokens;
      acc.totalCost = (acc.totalCost ?? 0) + (day.totalCost ?? 0);
      return acc;
    }, {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 0,
      totalCost: 0 as number | null
    });
    return {
      available: days.length > 0,
      days,
      totals: {
        ...totals,
        cacheHitRatio: totals.inputTokens > 0 ? round2(totals.cacheReadTokens / Math.max(totals.inputTokens + totals.cacheReadTokens, 1)) : null
      },
      note: days.length > 0 ? "Measured Claude usage came from ccusage daily output." : "No Claude ccusage data was available."
    };
  } catch (error) {
    return {
      available: false,
      days: [],
      totals: {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
        totalCost: null,
        cacheHitRatio: null
      },
      note: describeClaudeUsageFailure(error)
    };
  }
}

async function loadCodexUsage(homeRoot: string, days: number, now: Date): Promise<MachineAdvisoryUsage["codex"]> {
  const sessionsDir = path.join(homeRoot, ".codex", "sessions");
  if (!(await pathExists(sessionsDir))) {
    return emptyCodexUsage("No Codex session logs were found.");
  }

  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const daily = new Map<string, MachineAdvisoryCodexUsageDay>();
  const files = await collectJsonlFiles(sessionsDir, []);
  for (const sessionFile of files) {
    const parsed = parseCodexSessionDate(sessionFile, sessionsDir);
    if (!parsed || parsed < cutoff) {
      continue;
    }
    const usage = await loadMaxCodexUsage(sessionFile);
    if (!usage) {
      continue;
    }
    const dateKey = parsed.toISOString().slice(0, 10);
    const current = daily.get(dateKey) ?? {
      date: dateKey,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      reasoningOutputTokens: 0,
      sessions: 0
    };
    current.inputTokens += usage.input_tokens;
    current.outputTokens += usage.output_tokens;
    current.cachedInputTokens += usage.cached_input_tokens;
    current.reasoningOutputTokens += usage.reasoning_output_tokens;
    current.sessions += 1;
    daily.set(dateKey, current);
  }

  const dayValues = [...daily.values()].sort((left, right) => left.date.localeCompare(right.date));
  const totals = dayValues.reduce((acc, day) => {
    acc.inputTokens += day.inputTokens;
    acc.outputTokens += day.outputTokens;
    acc.cachedInputTokens += day.cachedInputTokens;
    acc.reasoningOutputTokens += day.reasoningOutputTokens;
    acc.sessions += day.sessions;
    return acc;
  }, {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    reasoningOutputTokens: 0,
    sessions: 0
  });

  return {
    available: dayValues.length > 0,
    days: dayValues,
    totals: {
      ...totals,
      totalTokens: totals.inputTokens + totals.outputTokens,
      cacheHitRatio: totals.inputTokens > 0 ? round2(totals.cachedInputTokens / Math.max(totals.inputTokens, 1)) : null
    },
    note: dayValues.length > 0 ? "Measured Codex usage came from local session logs." : "No Codex session usage was available."
  };
}

async function buildSetupPhases(context: {
  homeRoot: string;
  inventory: MachineAdvisoryTool[];
  mcpInventory: MachineAdvisoryMcpInventory;
  optimizationLayers: MachineAdvisoryOptimizationLayer[];
  configHealth: MachineAdvisoryConfigHealth[];
  skillsCount: number;
  copilotPlugins: string[];
}): Promise<MachineAdvisorySetupPhase[]> {
  const toolInstalled = (name: string): boolean => context.inventory.some((tool) => tool.name === name && tool.installed);
  const tokenServer = (name: string): MachineAdvisoryMcpTokenServer | undefined =>
    context.mcpInventory.tokenServers.find((server) => server.name === name);
  const optimizationLayer = (name: string): MachineAdvisoryOptimizationLayer | undefined =>
    context.optimizationLayers.find((layer) => layer.name === name);
  const configHealthy = (displayPath: string): boolean =>
    context.configHealth.find((entry) => entry.path === displayPath)?.healthy ?? false;
  const anyHarnessActive = (layerName: string): boolean => {
    const layer = optimizationLayer(layerName);
    return Boolean(layer?.claude || layer?.codex || layer?.copilot);
  };

  return [
    {
      phase: "Phase 1 — Core",
      items: [
        {
          name: "code-review-graph",
          description: "Graph-based structural code search (22 MCP tools)",
          location: "MCP server + per-project graph",
          active: toolInstalled("code-review-graph") && Boolean(tokenServer("code-review-graph")?.claude || tokenServer("code-review-graph")?.codex || tokenServer("code-review-graph")?.copilot)
        },
        {
          name: "planning orchestration layer",
          description: "Multi-agent planning and review coordination",
          location: "Planner instructions + skill inventory",
          active: toolInstalled("omc") && configHealthy("~/.claude.json") && configHealthy("~/.claude/CLAUDE.md")
        },
        {
          name: "execution orchestration layer",
          description: "Multi-agent execution coordination",
          location: "Execution config + instruction contract",
          active: toolInstalled("omx") && configHealthy("~/.codex/config.toml") && configHealthy("~/.codex/AGENTS.md")
        },
        {
          name: "ai-setup script",
          description: "One-command per-project setup",
          location: "~/.local/bin/ai-setup",
          active: toolInstalled("ai-setup")
        }
      ]
    },
    {
      phase: "Phase 2 — Token Optimization",
      items: [
        {
          name: "lean-ctx",
          description: "Shell output compression (89-99% savings)",
          location: "~/.zshrc aliases + Codex hook + Copilot MCP",
          active: anyHarnessActive("lean-ctx")
        },
        {
          name: "repomix",
          description: "Codebase-to-summary (70% reduction)",
          location: "Per-project .repomix-output.xml",
          active: toolInstalled("repomix")
        },
        {
          name: "context-mode",
          description: "Tool output sandboxing (98% savings)",
          location: "Claude Code MCP server",
          active: Boolean(tokenServer("context-mode")?.claude)
        },
        {
          name: "Copilot CLI",
          description: "Terminal AI agent with MCP support",
          location: "~/.copilot/mcp-config.json",
          active: toolInstalled("copilot") && configHealthy("~/.copilot/mcp-config.json")
        }
      ]
    },
    {
      phase: "Phase 3 — Capability Expansion",
      items: [
        {
          name: "ccusage",
          description: "Token usage visibility",
          location: "Claude Code MCP server",
          active: Boolean(tokenServer("ccusage")?.claude)
        },
        {
          name: "Token-efficient rules",
          description: "5 output verbosity rules",
          location: "CLAUDE.md + AGENTS.md",
          active: anyHarnessActive("token-efficient rules")
        },
        {
          name: `Agent skills (${context.skillsCount} total)`,
          description: "Skill inventory under ~/.agents/skills/",
          location: "~/.agents/skills/",
          active: context.skillsCount > 0
        },
        {
          name: `Copilot plugins (${context.copilotPlugins.length})`,
          description: "Installed Copilot plugin registry",
          location: "~/.copilot/installed-plugins/",
          active: context.copilotPlugins.length > 0
        }
      ]
    }
  ];
}

function emptyCodexUsage(note: string): MachineAdvisoryUsage["codex"] {
  return {
    available: false,
    days: [],
    totals: {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      reasoningOutputTokens: 0,
      sessions: 0,
      totalTokens: 0,
      cacheHitRatio: null
    },
    note
  };
}

function buildUnavailableMachineAdvisory(now: Date, note: string): MachineAdvisoryState {
  const updatedAt = now.toISOString();
  return {
    artifactType: MACHINE_ADVISORY_ARTIFACT_TYPE,
    version: MACHINE_ADVISORY_VERSION,
    generatedBy: "kiwi-control machine-advisory",
    windowDays: 7,
    updatedAt,
    stale: true,
    sections: {
      inventory: { status: "partial", updatedAt, reason: note },
      mcpInventory: { status: "partial", updatedAt, reason: note },
      optimizationLayers: { status: "partial", updatedAt, reason: note },
      setupPhases: { status: "partial", updatedAt, reason: note },
      configHealth: { status: "partial", updatedAt, reason: note },
      usage: { status: "partial", updatedAt, reason: note },
      guidance: { status: "partial", updatedAt, reason: note }
    },
    inventory: [],
    mcpInventory: {
      claudeTotal: 0,
      codexTotal: 0,
      copilotTotal: 0,
      tokenServers: []
    },
    optimizationLayers: [],
    setupPhases: [],
    configHealth: [],
    skillsCount: 0,
    copilotPlugins: [],
    usage: {
      days: 7,
      claude: {
        available: false,
        days: [],
        totals: {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 0,
          totalCost: null,
          cacheHitRatio: null
        },
        note
      },
      codex: {
        available: false,
        days: [],
        totals: {
          inputTokens: 0,
          outputTokens: 0,
          cachedInputTokens: 0,
          reasoningOutputTokens: 0,
          sessions: 0,
          totalTokens: 0,
          cacheHitRatio: null
        },
        note
      },
      copilot: {
        available: false,
        note
      }
    },
    systemHealth: {
      criticalCount: 0,
      warningCount: 0,
      okCount: 0
    },
    optimizationScore: {
      planning: {
        label: "planning",
        score: 0,
        earnedPoints: 0,
        maxPoints: 100,
        activeSignals: [],
        missingSignals: []
      },
      execution: {
        label: "execution",
        score: 0,
        earnedPoints: 0,
        maxPoints: 100,
        activeSignals: [],
        missingSignals: []
      },
      assistant: {
        label: "assistant",
        score: 0,
        earnedPoints: 0,
        maxPoints: 100,
        activeSignals: [],
        missingSignals: []
      }
    },
    setupSummary: {
      installedTools: {
        readyCount: 0,
        totalCount: 0
      },
      healthyConfigs: {
        readyCount: 0,
        totalCount: 0
      },
      activeTokenLayers: [],
      readyRuntimes: {
        planning: false,
        execution: false,
        assistant: false
      }
    },
    guidance: [],
    note
  };
}

function appendFastModeNote(note: string): string {
  if (note.includes("fast mode")) {
    return note;
  }
  return `${note} Machine-local advisory fast mode is active for desktop repo loading.`;
}

async function loadClaudeMcpServers(homeRoot: string): Promise<Record<string, unknown>> {
  const config = await safeReadJson<{ mcpServers?: Record<string, unknown> }>(path.join(homeRoot, ".claude.json"));
  return config?.mcpServers ?? {};
}

async function loadCodexMcpServers(homeRoot: string): Promise<Record<string, unknown>> {
  const configPath = path.join(homeRoot, ".codex", "config.toml");
  if (!(await pathExists(configPath))) {
    return {};
  }
  const content = await readTextIfExists(configPath);
  const matches = [...content.matchAll(/^\[mcp_servers\."([^"]+)"\]/gm)];
  return Object.fromEntries(matches.map((match) => [match[1], true]));
}

async function loadCopilotMcpServers(homeRoot: string): Promise<Record<string, unknown>> {
  const config = await safeReadJson<{ mcpServers?: Record<string, unknown> }>(path.join(homeRoot, ".copilot", "mcp-config.json"));
  return config?.mcpServers ?? {};
}

async function safeReadJson<T>(filePath: string): Promise<T | null> {
  if (!(await pathExists(filePath))) {
    return null;
  }
  try {
    return await readJson<T>(filePath);
  } catch {
    return null;
  }
}

async function readTextIfExists(filePath: string): Promise<string> {
  if (!(await pathExists(filePath))) {
    return "";
  }
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function collectJsonlFiles(root: string, files: string[]): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await collectJsonlFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseCodexSessionDate(sessionFile: string, sessionsDir: string): Date | null {
  const relativePath = path.relative(sessionsDir, sessionFile).replace(/\\/g, "/");
  const parts = relativePath.split("/");
  if (parts.length < 4) {
    return null;
  }
  const [year, month, day] = parts;
  const iso = `${year}-${month}-${day}T00:00:00.000Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function loadMaxCodexUsage(sessionFile: string): Promise<{
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  reasoning_output_tokens: number;
} | null> {
  const content = await readTextIfExists(sessionFile);
  let maxUsage: { input_tokens: number; output_tokens: number; cached_input_tokens: number; reasoning_output_tokens: number; total_tokens: number } | null = null;
  for (const line of content.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      const payload = JSON.parse(line) as Record<string, unknown>;
      if (payload.type !== "event_msg") {
        continue;
      }
      const inner = payload.payload as Record<string, unknown> | undefined;
      if (inner?.type !== "token_count") {
        continue;
      }
      const usage = (inner.info as Record<string, unknown> | undefined)?.total_token_usage as Record<string, unknown> | undefined;
      if (!usage) {
        continue;
      }
      const normalized = {
        input_tokens: numberOrZero(usage.input_tokens),
        output_tokens: numberOrZero(usage.output_tokens),
        cached_input_tokens: numberOrZero(usage.cached_input_tokens),
        reasoning_output_tokens: numberOrZero(usage.reasoning_output_tokens),
        total_tokens: numberOrZero(usage.total_tokens)
      };
      if (!maxUsage || normalized.total_tokens > maxUsage.total_tokens) {
        maxUsage = normalized;
      }
    } catch {
      continue;
    }
  }
  return maxUsage
    ? {
        input_tokens: maxUsage.input_tokens,
        output_tokens: maxUsage.output_tokens,
        cached_input_tokens: maxUsage.cached_input_tokens,
        reasoning_output_tokens: maxUsage.reasoning_output_tokens
      }
    : null;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function round2(value: number): number {
  return Math.round(value * 10000) / 100;
}

function resolveMachineAdvisoryFastMode(options: MachineAdvisoryBuildOptions): boolean {
  return options.fastMode ?? process.env[MACHINE_FAST_ENV] === "1";
}

function formatSinceDate(now: Date, days: number): string {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const year = since.getFullYear();
  const month = `${since.getMonth() + 1}`.padStart(2, "0");
  const day = `${since.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

async function loadClaudeUsagePayload(
  command: string[],
  commandRunner?: (command: string, args: string[]) => Promise<CommandOutput>
): Promise<{ daily?: Array<Record<string, unknown>> }> {
  const result = await runMachineCommand(command[0]!, command.slice(1), {
    ...(commandRunner ? { commandRunner: commandRunner as MachineCommandRunner } : {}),
    timeoutMs: 8_000
  });
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();

  if (result.code !== 0) {
    throw new Error(stderr || stdout || `ccusage exited with code ${result.code}`);
  }

  try {
    return JSON.parse(stdout) as { daily?: Array<Record<string, unknown>> };
  } catch {
    throw new Error(stdout || stderr || "ccusage did not return valid JSON output");
  }
}

function describeClaudeUsageFailure(error: unknown): string {
  const detail = error instanceof Error ? error.message.trim() : String(error).trim();
  if (!detail) {
    return "No Claude ccusage data was available.";
  }

  if (/not found|enoent/i.test(detail)) {
    return "Claude ccusage could not be loaded because ccusage was not available on PATH. Install it with `npm install -g ccusage`.";
  }

  return `Claude ccusage could not be loaded: ${detail}`;
}

function suggestMachineFixForTools(missingTools: string[]): string {
  if (missingTools.length === 1 && missingTools[0] === "tmux") {
    return "brew install tmux";
  }
  if (missingTools.length === 1 && missingTools[0] === "lean-ctx") {
    return "kiwi-control setup repair lean-ctx";
  }
  if (missingTools.length === 1 && missingTools[0] === "repomix") {
    return "kiwi-control setup repair repomix";
  }
  if (missingTools.length === 1 && missingTools[0] === "copilot") {
    return "npm install -g @github/copilot";
  }
  return "kiwi-control setup doctor --json";
}

function suggestMachineFixForConfig(paths: string[], homeRoot: string): string {
  if (paths.some((entry) => entry.includes(".codex") || entry.includes(".claude") || entry.includes(".copilot") || entry.includes("Application Support/Code"))) {
    return "kiwi-control setup repair global-preferences";
  }
  return "kiwi-control setup doctor --json";
}
