import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { pathExists, readJson, writeText } from "../utils/fs.js";

const execFile = promisify(execFileCallback);
const MACHINE_HOME_ENV = "KIWI_MACHINE_HOME";
const MACHINE_FAST_ENV = "KIWI_MACHINE_ADVISORY_FAST";
const CACHE_TTL_MS = 60_000;
const DEFAULT_TOOLS: Array<{ name: string; description: string; phase: string; versionArgs?: string[] }> = [
  { name: "code-review-graph", description: "Graph-based code search", phase: "Phase 1" },
  { name: "omc", description: "Claude Code orchestration", phase: "Phase 1" },
  { name: "omx", description: "Codex orchestration", phase: "Phase 1" },
  { name: "lean-ctx", description: "Shell output compression", phase: "Phase 2" },
  { name: "repomix", description: "Codebase summarizer", phase: "Phase 2" },
  { name: "context-mode", description: "Tool output sandboxing", phase: "Phase 2" },
  { name: "copilot", description: "GitHub Copilot CLI", phase: "Phase 2" },
  { name: "tmux", description: "Terminal multiplexer", phase: "Existing", versionArgs: ["-V"] }
];
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

export interface MachineAdvisoryState {
  artifactType: "kiwi-control/machine-advisory";
  version: 2;
  generatedBy: string;
  windowDays: number;
  updatedAt: string;
  stale: boolean;
  inventory: MachineAdvisoryTool[];
  mcpInventory: MachineAdvisoryMcpInventory;
  optimizationLayers: MachineAdvisoryOptimizationLayer[];
  setupPhases: MachineAdvisorySetupPhase[];
  configHealth: MachineAdvisoryConfigHealth[];
  skillsCount: number;
  copilotPlugins: string[];
  usage: MachineAdvisoryUsage;
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
}

type CommandOutput = { code: number; stdout: string; stderr: string };

export async function loadMachineAdvisory(options: MachineAdvisoryBuildOptions = {}): Promise<MachineAdvisoryState> {
  const now = options.now ?? new Date();
  const homeRoot = resolveMachineHome(options.homeRoot);
  const cachePath = advisoryCachePath(homeRoot);
  const explicitFastMode = options.fastMode ?? process.env[MACHINE_FAST_ENV] === "1";

  if (!options.forceRefresh && await pathExists(cachePath)) {
    try {
      const cached = await readJson<MachineAdvisoryState>(cachePath);
      if (cached.artifactType === "kiwi-control/machine-advisory" && cached.version === 2) {
        const age = now.getTime() - new Date(cached.updatedAt).getTime();
        if (explicitFastMode) {
          return {
            ...cached,
            stale: true,
            note: appendFastModeNote(cached.note)
          };
        }
        if (age < CACHE_TTL_MS && !cached.stale) {
          return { ...cached, stale: false };
        }
      }
    } catch {
      // rebuild below
    }
  }

  if (explicitFastMode) {
    return buildUnavailableMachineAdvisory(now, "Machine-local advisory fast mode is active for desktop repo loading.");
  }

  const built = await buildMachineAdvisory(options);
  await ensureCacheDir(path.dirname(cachePath));
  await writeText(cachePath, `${JSON.stringify(built, null, 2)}\n`);
  return built;
}

export async function buildMachineAdvisory(options: MachineAdvisoryBuildOptions = {}): Promise<MachineAdvisoryState> {
  const homeRoot = resolveMachineHome(options.homeRoot);
  const now = options.now ?? new Date();
  const windowDays = 7;
  const fastMode = options.fastMode ?? (process.env.CODEX_CI === "1" && !options.homeRoot && !options.commandRunner && options.ccusagePayload === undefined);
  const commandRunner = fastMode
    ? async () => ({ code: 1, stdout: "", stderr: "" } satisfies CommandOutput)
    : options.commandRunner;
  const ccusagePayload = fastMode ? { daily: [] } : options.ccusagePayload;
  const [inventory, mcpInventory, optimizationLayers, configHealth, skillsCount, copilotPlugins, usage] = await Promise.all([
    buildToolchainInventory(homeRoot, commandRunner),
    buildMcpInventory(homeRoot),
    buildOptimizationLayers(homeRoot),
    buildConfigHealth(homeRoot),
    countSkills(homeRoot),
    getCopilotPlugins(homeRoot),
    buildUsage(homeRoot, windowDays, now, commandRunner, ccusagePayload)
  ]);
  const setupPhases = await buildSetupPhases({
    homeRoot,
    inventory,
    mcpInventory,
    optimizationLayers,
    configHealth,
    skillsCount,
    copilotPlugins
  });

  return {
    artifactType: "kiwi-control/machine-advisory",
    version: 2,
    generatedBy: "kiwi-control machine-advisory",
    windowDays,
    updatedAt: now.toISOString(),
    stale: fastMode,
    inventory,
    mcpInventory,
    optimizationLayers,
    setupPhases,
    configHealth,
    skillsCount,
    copilotPlugins,
    usage,
    note: fastMode
      ? "Machine-local advisory was built in CI fast mode. Optimization score is intentionally omitted. Refresh in a live shell for actual machine readings."
      : "Machine-local advisory only. Optimization score is intentionally omitted and this data never overrides repo-local Kiwi state."
  };
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

async function buildToolchainInventory(homeRoot: string, commandRunner?: (command: string, args: string[]) => Promise<CommandOutput>): Promise<MachineAdvisoryTool[]> {
  const results: MachineAdvisoryTool[] = [];
  for (const tool of DEFAULT_TOOLS) {
    const installed = await isBinaryInstalled(tool.name, commandRunner);
    const version = installed ? await getBinaryVersion(tool.name, tool.versionArgs, commandRunner) : "—";
    results.push({
      name: tool.name,
      description: tool.description,
      phase: tool.phase,
      installed,
      version
    });
  }
  return results;
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
  health.push({ path: "~/.codex/config.toml", healthy: (await loadCodexMcpServers(homeRoot)) != null, description: "Codex global config (valid TOML)" });
  health.push({ path: "~/.codex/AGENTS.md", healthy: await pathExists(path.join(homeRoot, ".codex", "AGENTS.md")), description: "Codex global instructions" });
  health.push({ path: "~/.codex/hooks/lean-ctx-*", healthy: await pathExists(path.join(homeRoot, ".codex", "hooks", "lean-ctx-rewrite-codex.sh")), description: "Codex lean-ctx compression hook" });
  health.push({ path: "~/.copilot/mcp-config.json", healthy: await pathExists(path.join(homeRoot, ".copilot", "mcp-config.json")), description: "Copilot global MCP config" });
  health.push({ path: "~/.copilot/config.json", healthy: await pathExists(path.join(homeRoot, ".copilot", "config.json")), description: "Copilot plugin registry" });
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
    const payload = ccusagePayload ?? (JSON.parse((await runMachineCommand(command[0]!, command.slice(1), commandRunner, 8_000)).stdout) as { daily?: Array<Record<string, unknown>> });
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
  } catch {
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
      note: "No Claude ccusage data was available."
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
  const aiSetupInstalled = await pathExists(path.join(context.homeRoot, ".local", "bin", "ai-setup"));

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
          name: "oh-my-claudecode (OMC)",
          description: "19-agent orchestration for Claude Code",
          location: "Global CLAUDE.md + skills",
          active: toolInstalled("omc") && configHealthy("~/.claude.json") && configHealthy("~/.claude/CLAUDE.md")
        },
        {
          name: "oh-my-codex (OMX)",
          description: "Multi-agent orchestration for Codex",
          location: "Global config.toml + AGENTS.md",
          active: toolInstalled("omx") && configHealthy("~/.codex/config.toml") && configHealthy("~/.codex/AGENTS.md")
        },
        {
          name: "ai-setup script",
          description: "One-command per-project setup",
          location: "~/.local/bin/ai-setup",
          active: aiSetupInstalled
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
  return {
    artifactType: "kiwi-control/machine-advisory",
    version: 2,
    generatedBy: "kiwi-control machine-advisory",
    windowDays: 7,
    updatedAt: now.toISOString(),
    stale: true,
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
    note: `${note} Optimization score is intentionally omitted.`
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

async function isBinaryInstalled(name: string, commandRunner?: (command: string, args: string[]) => Promise<CommandOutput>): Promise<boolean> {
  try {
    const result = await runMachineCommand("which", [name], commandRunner, 2_000);
    return result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function getBinaryVersion(name: string, versionArgs?: string[], commandRunner?: (command: string, args: string[]) => Promise<CommandOutput>): Promise<string> {
  const candidates = [versionArgs ?? ["--version"], ["-V"], []];
  for (const args of candidates) {
    try {
      const result = await runMachineCommand(name, args, commandRunner, 3_000);
      const output = `${result.stdout}\n${result.stderr}`.trim();
      const version = extractVersion(output);
      if (version) {
        return version;
      }
    } catch {
      continue;
    }
  }
  return "?";
}

function extractVersion(output: string): string | null {
  const match = output.match(/v?(\d+\.\d+\.\d+(?:[-\w.]*)?)/);
  if (match?.[1]) {
    return match[1];
  }
  const line = output.split("\n").find((value) => value.trim().length > 0)?.trim();
  return line ? line.slice(0, 24) : null;
}

function buildMachineEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${os.homedir()}/.cargo/bin:${os.homedir()}/.local/bin:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ""}`
  };
}

async function runMachineCommand(
  command: string,
  args: string[],
  commandRunner?: (command: string, args: string[]) => Promise<CommandOutput>,
  timeoutMs = 5_000
): Promise<CommandOutput> {
  if (commandRunner) {
    return commandRunner(command, args);
  }
  try {
    const result = await execFile(command, args, {
      encoding: "utf8",
      env: buildMachineEnv(),
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024
    });
    return {
      code: 0,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    const payload = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof payload.code === "number" ? payload.code : 1,
      stdout: payload.stdout ?? "",
      stderr: payload.stderr ?? ""
    };
  }
}

function resolveMachineHome(homeRoot?: string): string {
  return homeRoot ?? process.env[MACHINE_HOME_ENV]?.trim() ?? os.homedir();
}

function advisoryCachePath(homeRoot: string): string {
  return path.join(homeRoot, ".kiwi-control", "cache", "machine-advisory.json");
}

async function ensureCacheDir(cacheDir: string): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
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

function formatSinceDate(now: Date, days: number): string {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const year = since.getFullYear();
  const month = `${since.getMonth() + 1}`.padStart(2, "0");
  const day = `${since.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

function suggestMachineFixForTools(missingTools: string[]): string {
  if (missingTools.length === 1 && missingTools[0] === "tmux") {
    return "brew install tmux";
  }
  if (missingTools.length === 1 && missingTools[0] === "copilot") {
    return "npm install -g @github/copilot";
  }
  return "ai-setup";
}

function suggestMachineFixForConfig(paths: string[], homeRoot: string): string {
  if (paths.some((entry) => entry.includes(".codex"))) {
    return `test -f "${path.join(homeRoot, ".codex", "config.toml")}" || echo "missing codex config"`;
  }
  if (paths.some((entry) => entry.includes(".claude"))) {
    return `test -f "${path.join(homeRoot, ".claude.json")}" || echo "missing claude config"`;
  }
  if (paths.some((entry) => entry.includes(".copilot"))) {
    return `test -f "${path.join(homeRoot, ".copilot", "config.json")}" || echo "missing copilot config"`;
  }
  return "ai-setup";
}
