import type {
  MachineAdvisoryConfigHealth,
  MachineAdvisoryGuidance,
  MachineAdvisoryOptimizationLayer,
  MachineAdvisoryState,
  MachineAdvisoryTool
} from "./machine-advisory.js";

export type MachineParityStatus = "covered" | "partial" | "missing" | "optional";

export interface MachineParityItem {
  id: string;
  label: string;
  scope: "repo-local" | "machine-global";
  category:
    | "runtime"
    | "repo-intelligence"
    | "toolchain"
    | "config"
    | "optimization"
    | "telemetry"
    | "assistant-runtime"
    | "workflow";
  status: MachineParityStatus;
  detail: string;
  evidence: string[];
  helperCommand?: string | null;
}

export interface MachineParityHelper {
  id: string;
  label: string;
  command: string;
  reason: string;
}

export interface MachineParityState {
  artifactType: "kiwi-control/machine-parity";
  version: 1;
  updatedAt: string;
  overallStatus: "ready" | "needs-work";
  boundaryNote: string;
  summary: {
    covered: number;
    partial: number;
    missing: number;
    optional: number;
    total: number;
  };
  repoLocalCapabilities: MachineParityItem[];
  machineGlobalCapabilities: MachineParityItem[];
  helpers: MachineParityHelper[];
}

export interface MachineParitySummaryState {
  available: true;
  updatedAt: string;
  overallStatus: "ready" | "needs-work";
  boundaryNote: string;
  repoLocalCovered: number;
  repoLocalTotal: number;
  machineGlobal: {
    covered: number;
    partial: number;
    missing: number;
    optional: number;
    total: number;
  };
  topMissing: Array<{
    id: string;
    label: string;
    helperCommand: string | null;
  }>;
  topPartial: Array<{
    id: string;
    label: string;
    helperCommand: string | null;
  }>;
}

export function buildMachineParityState(advisory: MachineAdvisoryState): MachineParityState {
  const repoLocalCapabilities = buildRepoLocalCapabilities();
  const machineGlobalCapabilities = buildMachineGlobalCapabilities(advisory);
  const counts = countStatuses(machineGlobalCapabilities);

  return {
    artifactType: "kiwi-control/machine-parity",
    version: 1,
    updatedAt: advisory.updatedAt,
    overallStatus: counts.missing > 0 || counts.partial > 0 ? "needs-work" : "ready",
    boundaryNote:
      "Repo-local Kiwi capability is built into the product. Machine-global parity measures optional external setup that Kiwi can benefit from, but does not treat as canonical repo truth.",
    summary: {
      ...counts,
      total: machineGlobalCapabilities.length
    },
    repoLocalCapabilities,
    machineGlobalCapabilities,
    helpers: buildHelpers(machineGlobalCapabilities)
  };
}

export function summarizeMachineParity(parity: MachineParityState): MachineParitySummaryState {
  const repoLocalCovered = parity.repoLocalCapabilities.filter((item) => item.status === "covered").length;
  const topMissing = parity.machineGlobalCapabilities
    .filter((item) => item.status === "missing")
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      label: item.label,
      helperCommand: item.helperCommand ?? null
    }));
  const topPartial = parity.machineGlobalCapabilities
    .filter((item) => item.status === "partial")
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      label: item.label,
      helperCommand: item.helperCommand ?? null
    }));

  return {
    available: true,
    updatedAt: parity.updatedAt,
    overallStatus: parity.overallStatus,
    boundaryNote: parity.boundaryNote,
    repoLocalCovered,
    repoLocalTotal: parity.repoLocalCapabilities.length,
    machineGlobal: parity.summary,
    topMissing,
    topPartial
  };
}

function buildRepoLocalCapabilities(): MachineParityItem[] {
  return [
    {
      id: "runtime-authority",
      label: "Runtime-backed canonical truth",
      scope: "repo-local",
      category: "runtime",
      status: "covered",
      detail: "Runtime-backed canonical state, identity proof, and CLI↔desktop parity are built into Kiwi Control.",
      evidence: ["runtime authority", "runtime identity proof", "cli-desktop parity"]
    },
    {
      id: "repo-graph",
      label: "Repo graph and impact analysis",
      scope: "repo-local",
      category: "repo-intelligence",
      status: "covered",
      detail: "Repo map, symbol index, dependency graph, impact map, and compact context packs are available repo-locally.",
      evidence: ["repo-map", "symbol-index", "dependency-graph", "impact-map", "compact-context-pack"]
    },
    {
      id: "decision-history-review",
      label: "Decision, history, and review intelligence",
      scope: "repo-local",
      category: "repo-intelligence",
      status: "covered",
      detail: "Decision graph, history graph, review graph, and review context packs are produced from repo-local continuity and runtime artifacts.",
      evidence: ["decision-graph", "history-graph", "review-graph", "review-context-pack"]
    }
  ];
}

function buildMachineGlobalCapabilities(advisory: MachineAdvisoryState): MachineParityItem[] {
  const tool = (name: string): MachineAdvisoryTool | undefined => advisory.inventory.find((entry) => entry.name === name);
  const config = (displayPath: string): MachineAdvisoryConfigHealth | undefined =>
    advisory.configHealth.find((entry) => entry.path === displayPath);
  const layer = (name: string): MachineAdvisoryOptimizationLayer | undefined =>
    advisory.optimizationLayers.find((entry) => entry.name === name);
  const guidanceFix = (...ids: string[]): string | null => {
    for (const id of ids) {
      const entry = advisory.guidance.find((item) => item.id === id);
      if (entry?.fixCommand) {
        return entry.fixCommand;
      }
    }
    return null;
  };

  const statusForTriad = (values: boolean[], optionalIfMissing = false): MachineParityStatus => {
    const activeCount = values.filter(Boolean).length;
    if (activeCount === values.length) {
      return "covered";
    }
    if (activeCount === 0) {
      return optionalIfMissing ? "optional" : "missing";
    }
    return "partial";
  };

  const statusForConfigPair = (
    one: MachineAdvisoryConfigHealth | undefined,
    two: MachineAdvisoryConfigHealth | undefined
  ): MachineParityStatus => {
    const healthy = [one?.healthy ?? false, two?.healthy ?? false];
    return statusForTriad(healthy);
  };

  return [
    {
      id: "ai-setup",
      label: "ai-setup bootstrap helper",
      scope: "machine-global",
      category: "workflow",
      status: tool("ai-setup")?.installed ? "covered" : "optional",
      detail: tool("ai-setup")?.installed
        ? "The repo initializer exists on this machine."
        : "Helpful optional bootstrap helper for matching the intended workstation setup.",
      evidence: [tool("ai-setup")?.installed ? "ai-setup installed" : "ai-setup not detected"],
      helperCommand: tool("ai-setup")?.installed ? null : "bash scripts/install-global.sh --dry-run"
    },
    {
      id: "code-review-graph",
      label: "Structural code graph tooling",
      scope: "machine-global",
      category: "toolchain",
      status: statusForTriad([
        advisory.mcpInventory.tokenServers.find((entry) => entry.name === "code-review-graph")?.claude ?? false,
        advisory.mcpInventory.tokenServers.find((entry) => entry.name === "code-review-graph")?.codex ?? false,
        advisory.mcpInventory.tokenServers.find((entry) => entry.name === "code-review-graph")?.copilot ?? false
      ]),
      detail: "Graph-backed structural search and impact queries across Claude Code, Codex, and Copilot runtimes.",
      evidence: describeHarnessEvidence("code-review-graph", advisory.mcpInventory.tokenServers.find((entry) => entry.name === "code-review-graph")),
      helperCommand: guidanceFix("missing-code-review-graph") ?? "ai-setup"
    },
    {
      id: "lean-ctx",
      label: "Shell/token compression",
      scope: "machine-global",
      category: "optimization",
      status: statusForTriad([
        layer("lean-ctx")?.claude ?? false,
        layer("lean-ctx")?.codex ?? false,
        layer("lean-ctx")?.copilot ?? false
      ]),
      detail: "Machine-global shell compression and token reduction for supported harnesses.",
      evidence: describeLayerEvidence("lean-ctx", layer("lean-ctx")),
      helperCommand: "ai-setup"
    },
    {
      id: "repomix",
      label: "Codebase summary tooling",
      scope: "machine-global",
      category: "optimization",
      status: tool("repomix")?.installed ? "covered" : "missing",
      detail: "Compressed codebase summaries used as optional planning accelerators.",
      evidence: [tool("repomix")?.installed ? "repomix installed" : "repomix missing"],
      helperCommand: "ai-setup"
    },
    {
      id: "context-mode",
      label: "Output sandboxing",
      scope: "machine-global",
      category: "optimization",
      status: (layer("context-mode")?.claude ?? false) ? "covered" : "optional",
      detail: "Useful but optional containment for verbose tool output.",
      evidence: describeLayerEvidence("context-mode", layer("context-mode")),
      helperCommand: guidanceFix("missing-context-mode") ?? "ai-setup"
    },
    {
      id: "omc",
      label: "Planning orchestration layer",
      scope: "machine-global",
      category: "workflow",
      status: tool("omc")?.installed ? "covered" : "optional",
      detail: "Optional machine-global planning orchestration beyond Kiwi’s repo-local control plane.",
      evidence: [tool("omc")?.installed ? "omc installed" : "omc not detected"],
      helperCommand: tool("omc")?.installed ? null : "ai-setup"
    },
    {
      id: "omx",
      label: "Execution orchestration layer",
      scope: "machine-global",
      category: "workflow",
      status: tool("omx")?.installed ? "covered" : "optional",
      detail: "Optional execution orchestration layer for tmux/team workflows.",
      evidence: [tool("omx")?.installed ? "omx installed" : "omx not detected"],
      helperCommand: tool("omx")?.installed ? null : "ai-setup"
    },
    {
      id: "claude-global-config",
      label: "Claude Code global config",
      scope: "machine-global",
      category: "config",
      status: statusForConfigPair(config("~/.claude.json"), config("~/.claude/CLAUDE.md")),
      detail: "Claude Code instructions and MCP wiring.",
      evidence: describeConfigPair("Claude", config("~/.claude.json"), config("~/.claude/CLAUDE.md")),
      helperCommand: "bash scripts/apply-global-preferences.sh --dry-run"
    },
    {
      id: "codex-global-config",
      label: "Codex global config",
      scope: "machine-global",
      category: "config",
      status: statusForConfigPair(config("~/.codex/config.toml"), config("~/.codex/AGENTS.md")),
      detail: "Codex MCP wiring and global instructions.",
      evidence: describeConfigPair("Codex", config("~/.codex/config.toml"), config("~/.codex/AGENTS.md")),
      helperCommand: "bash scripts/apply-global-preferences.sh --dry-run"
    },
    {
      id: "copilot-global-config",
      label: "Copilot global config",
      scope: "machine-global",
      category: "config",
      status: statusForConfigPair(config("~/.copilot/mcp-config.json"), config("~/.copilot/config.json")),
      detail: "Copilot MCP config and plugin registry.",
      evidence: describeConfigPair("Copilot", config("~/.copilot/mcp-config.json"), config("~/.copilot/config.json")),
      helperCommand: "bash scripts/apply-global-preferences.sh --dry-run"
    },
    {
      id: "claude-telemetry",
      label: "Claude usage telemetry",
      scope: "machine-global",
      category: "telemetry",
      status: advisory.usage.claude.available
        ? "covered"
        : advisory.mcpInventory.tokenServers.find((entry) => entry.name === "ccusage")?.claude
          ? "partial"
          : "missing",
      detail: "Claude token telemetry through ccusage when available.",
      evidence: [advisory.usage.claude.note],
      helperCommand: advisory.usage.claude.available ? null : guidanceFix("missing-ccusage") ?? "npm install -g ccusage"
    },
    {
      id: "codex-telemetry",
      label: "Codex session telemetry",
      scope: "machine-global",
      category: "telemetry",
      status: advisory.usage.codex.available ? "covered" : "partial",
      detail: "Codex local session-log telemetry. Partial means the runtime is present but no recent measurable sessions were found.",
      evidence: [advisory.usage.codex.note],
      helperCommand: advisory.usage.codex.available ? null : "kiwi-control usage --refresh --json"
    },
    {
      id: "copilot-plugins",
      label: "Copilot plugin expansion",
      scope: "machine-global",
      category: "assistant-runtime",
      status: advisory.copilotPlugins.length > 0 ? "covered" : "optional",
      detail: "Optional Copilot assistant expansion through installed plugins.",
      evidence: [advisory.copilotPlugins.length > 0 ? `plugins: ${advisory.copilotPlugins.join(", ")}` : "no Copilot plugins detected"],
      helperCommand: advisory.copilotPlugins.length > 0 ? null : "ai-setup"
    },
    {
      id: "planning-runtime",
      label: "Planning runtime readiness",
      scope: "machine-global",
      category: "assistant-runtime",
      status: advisory.setupSummary.readyRuntimes.planning
        ? "covered"
        : advisory.optimizationScore.planning.score >= 40
          ? "partial"
          : "missing",
      detail: "Machine-global planning readiness from optimization/runtime signals.",
      evidence: [`planning heuristic ${advisory.optimizationScore.planning.score}%`],
      helperCommand: "kiwi-control toolchain --refresh"
    },
    {
      id: "execution-runtime",
      label: "Execution runtime readiness",
      scope: "machine-global",
      category: "assistant-runtime",
      status: advisory.setupSummary.readyRuntimes.execution
        ? "covered"
        : advisory.optimizationScore.execution.score >= 40
          ? "partial"
          : "missing",
      detail: "Machine-global execution readiness from optimization/runtime signals.",
      evidence: [`execution heuristic ${advisory.optimizationScore.execution.score}%`],
      helperCommand: "kiwi-control toolchain --refresh"
    },
    {
      id: "assistant-runtime",
      label: "Assistant runtime readiness",
      scope: "machine-global",
      category: "assistant-runtime",
      status: advisory.setupSummary.readyRuntimes.assistant
        ? "covered"
        : advisory.optimizationScore.assistant.score >= 40
          ? "partial"
          : "missing",
      detail: "Machine-global assistant readiness from Copilot-oriented signals.",
      evidence: [`assistant heuristic ${advisory.optimizationScore.assistant.score}%`],
      helperCommand: "kiwi-control toolchain --refresh"
    }
  ];
}

function countStatuses(items: MachineParityItem[]): {
  covered: number;
  partial: number;
  missing: number;
  optional: number;
} {
  return {
    covered: items.filter((item) => item.status === "covered").length,
    partial: items.filter((item) => item.status === "partial").length,
    missing: items.filter((item) => item.status === "missing").length,
    optional: items.filter((item) => item.status === "optional").length
  };
}

function buildHelpers(items: MachineParityItem[]): MachineParityHelper[] {
  const helpers = new Map<string, MachineParityHelper>();
  for (const item of items) {
    if (!item.helperCommand || item.status === "covered") {
      continue;
    }
    helpers.set(item.helperCommand, {
      id: item.id,
      label: item.label,
      command: item.helperCommand,
      reason: item.detail
    });
  }
  return [...helpers.values()];
}

function describeHarnessEvidence(
  label: string,
  server:
    | {
        claude: boolean;
        codex: boolean;
        copilot: boolean;
      }
    | undefined
): string[] {
  return [
    `${label} on Claude Code: ${(server?.claude ?? false) ? "yes" : "no"}`,
    `${label} on Codex: ${(server?.codex ?? false) ? "yes" : "no"}`,
    `${label} on Copilot: ${(server?.copilot ?? false) ? "yes" : "no"}`
  ];
}

function describeLayerEvidence(label: string, layer: MachineAdvisoryOptimizationLayer | undefined): string[] {
  return [
    `${label} on Claude Code: ${(layer?.claude ?? false) ? "yes" : "no"}`,
    `${label} on Codex: ${(layer?.codex ?? false) ? "yes" : "no"}`,
    `${label} on Copilot: ${(layer?.copilot ?? false) ? "yes" : "no"}`
  ];
}

function describeConfigPair(
  label: string,
  one: MachineAdvisoryConfigHealth | undefined,
  two: MachineAdvisoryConfigHealth | undefined
): string[] {
  return [
    `${label} config: ${one?.healthy ? "healthy" : "missing or invalid"}`,
    `${label} instructions: ${two?.healthy ? "healthy" : "missing or invalid"}`
  ];
}
