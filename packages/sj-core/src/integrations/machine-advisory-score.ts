import type {
  MachineAdvisoryConfigHealth,
  MachineAdvisoryMcpInventory,
  MachineAdvisoryOptimizationLayer,
  MachineAdvisoryOptimizationScore,
  MachineAdvisoryOptimizationScoreRuntime,
  MachineAdvisoryTool,
  MachineAdvisoryUsage
} from "./machine-advisory.js";

export function buildOptimizationScore(context: {
  inventory: MachineAdvisoryTool[];
  mcpInventory: MachineAdvisoryMcpInventory;
  optimizationLayers: MachineAdvisoryOptimizationLayer[];
  configHealth: MachineAdvisoryConfigHealth[];
  copilotPlugins: string[];
  usage: MachineAdvisoryUsage;
}): MachineAdvisoryOptimizationScore {
  const toolInstalled = (name: string): boolean => context.inventory.some((tool) => tool.name === name && tool.installed);
  const configHealthy = (displayPath: string): boolean =>
    context.configHealth.find((entry) => entry.path === displayPath)?.healthy ?? false;
  const optimizationLayer = (name: string): MachineAdvisoryOptimizationLayer | undefined =>
    context.optimizationLayers.find((layer) => layer.name === name);

  const buildRuntimeScore = (
    label: MachineAdvisoryOptimizationScoreRuntime["label"],
    signals: Array<{ label: string; points: number; active: boolean }>
  ): MachineAdvisoryOptimizationScoreRuntime => {
    const earnedPoints = signals.reduce((sum, signal) => sum + (signal.active ? signal.points : 0), 0);
    const maxPoints = signals.reduce((sum, signal) => sum + signal.points, 0);
    const score = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0;
    return {
      label,
      score,
      earnedPoints,
      maxPoints,
      activeSignals: signals.filter((signal) => signal.active).map((signal) => signal.label),
      missingSignals: signals.filter((signal) => !signal.active).map((signal) => signal.label)
    };
  };

  return {
    planning: buildRuntimeScore("planning", [
      { label: "code-review-graph", points: 20, active: Boolean(context.mcpInventory.tokenServers.find((server) => server.name === "code-review-graph")?.claude) },
      { label: "lean-ctx", points: 10, active: Boolean(optimizationLayer("lean-ctx")?.claude) },
      { label: "repomix", points: 10, active: toolInstalled("repomix") },
      { label: "context-mode", points: 15, active: Boolean(optimizationLayer("context-mode")?.claude) },
      { label: "token-efficient rules", points: 15, active: Boolean(optimizationLayer("token-efficient rules")?.claude) },
      { label: "ccusage", points: 10, active: context.usage.claude.available },
      { label: "planning orchestration", points: 10, active: toolInstalled("omc") },
      { label: "Claude config health", points: 10, active: configHealthy("~/.claude.json") && configHealthy("~/.claude/CLAUDE.md") }
    ]),
    execution: buildRuntimeScore("execution", [
      { label: "code-review-graph", points: 20, active: Boolean(context.mcpInventory.tokenServers.find((server) => server.name === "code-review-graph")?.codex) },
      { label: "lean-ctx", points: 15, active: Boolean(optimizationLayer("lean-ctx")?.codex) },
      { label: "repomix", points: 10, active: toolInstalled("repomix") },
      { label: "context-mode", points: 15, active: Boolean(optimizationLayer("context-mode")?.codex) },
      { label: "token-efficient rules", points: 10, active: Boolean(optimizationLayer("token-efficient rules")?.codex) },
      { label: "session telemetry", points: 10, active: context.usage.codex.available },
      { label: "execution orchestration", points: 10, active: toolInstalled("omx") },
      { label: "Codex config health", points: 10, active: configHealthy("~/.codex/config.toml") && configHealthy("~/.codex/AGENTS.md") }
    ]),
    assistant: buildRuntimeScore("assistant", [
      { label: "code-review-graph", points: 15, active: Boolean(context.mcpInventory.tokenServers.find((server) => server.name === "code-review-graph")?.copilot) },
      { label: "lean-ctx", points: 15, active: Boolean(optimizationLayer("lean-ctx")?.copilot) },
      { label: "repomix", points: 10, active: toolInstalled("repomix") },
      { label: "token-efficient rules", points: 15, active: Boolean(optimizationLayer("token-efficient rules")?.copilot) },
      { label: "usage telemetry", points: 10, active: context.usage.copilot.available },
      { label: "assistant runtime", points: 15, active: toolInstalled("copilot") },
      { label: "Copilot config health", points: 10, active: configHealthy("~/.copilot/mcp-config.json") && configHealthy("~/.copilot/config.json") },
      { label: "Copilot plugins", points: 10, active: context.copilotPlugins.length > 0 }
    ])
  };
}
