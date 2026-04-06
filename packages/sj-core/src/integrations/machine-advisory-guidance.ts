import type {
  MachineAdvisoryConfigHealth,
  MachineAdvisoryGuidance,
  MachineAdvisoryMcpInventory,
  MachineAdvisoryOptimizationLayer,
  MachineAdvisorySystemHealth,
  MachineAdvisoryTool,
  MachineAdvisoryUsage,
  MachineGuidanceContext
} from "./machine-advisory.js";

export function buildMachineGuidanceContext(options: {
  taskType?: string | null;
  workflowStep?: string | null;
  validationFailed?: boolean;
  evalPrecisionLow?: boolean;
  executionRetriesTriggered?: boolean;
}): MachineGuidanceContext {
  return {
    taskType: options.taskType ?? null,
    workflowStep: options.workflowStep ?? null,
    validationFailed: options.validationFailed ?? false,
    evalPrecisionLow: options.evalPrecisionLow ?? false,
    executionRetriesTriggered: options.executionRetriesTriggered ?? false
  };
}

export function buildMachineGuidance(context: {
  inventory: MachineAdvisoryTool[];
  mcpInventory: MachineAdvisoryMcpInventory;
  optimizationLayers: MachineAdvisoryOptimizationLayer[];
  configHealth: MachineAdvisoryConfigHealth[];
  usage: MachineAdvisoryUsage;
}): MachineAdvisoryGuidance[] {
  const guidance: MachineAdvisoryGuidance[] = [];
  const toolInstalled = (name: string): boolean => context.inventory.some((tool) => tool.name === name && tool.installed);
  const tokenServer = (name: string) =>
    context.mcpInventory.tokenServers.find((entry) => entry.name === name);

  if (!context.usage.claude.available && (!toolInstalled("ccusage") || !tokenServer("ccusage")?.claude)) {
    guidance.push({
      id: "missing-ccusage",
      section: "usage",
      priority: "recommended",
      group: "improvements",
      severity: "warn",
      message: "Token tracking limited",
      impact: "Improves token tracking accuracy for Claude usage.",
      reason: "Claude usage cannot be measured locally without ccusage.",
      fixCommand: "npm install -g ccusage"
    });
  }

  if (!tokenServer("code-review-graph")?.codex) {
    guidance.push({
      id: "missing-code-review-graph",
      section: "mcpInventory",
      priority: "critical",
      group: "critical-issues",
      severity: "warn",
      message: "Structural code graph unavailable for Codex",
      impact: "Improves structural code search and impact analysis quality.",
      reason: "Graph-guided exploration and change analysis are limited until the MCP server is installed.",
      fixCommand: "ai-setup"
    });
  }

  const codexTotal = context.usage.codex.totals.totalTokens;
  const claudeTotal = context.usage.claude.totals.totalTokens;
  if (codexTotal >= 100_000_000 || claudeTotal >= 50_000_000) {
    guidance.push({
      id: "high-token-usage",
      section: "usage",
      priority: "optional",
      group: "optional-optimizations",
      severity: "info",
      message: "High token usage detected",
      impact: "Can reduce token spend and broaden context planning quality on larger tasks.",
      reason: "Large machine-level usage suggests broad tasks where wider context planning may help.",
      hintCommand: 'kiwi-control plan "<task>" --expand'
    });
  }

  if (!toolInstalled("context-mode")) {
    guidance.push({
      id: "missing-context-mode",
      section: "optimizationLayers",
      priority: "optional",
      group: "optional-optimizations",
      severity: "info",
      message: "Context sandboxing not installed",
      impact: "Improves tool-output containment and reduces noisy machine context.",
      reason: "Machine-level tool output compression and sandboxing remain limited.",
      fixCommand: "ai-setup"
    });
  }

  return sortMachineGuidance(guidance);
}

export function buildMachineSystemHealth(context: {
  inventory: MachineAdvisoryTool[];
  optimizationLayers: MachineAdvisoryOptimizationLayer[];
  configHealth: MachineAdvisoryConfigHealth[];
  guidance: MachineAdvisoryGuidance[];
}): MachineAdvisorySystemHealth {
  const criticalCount = context.guidance.filter((entry) => entry.priority === "critical").length;
  const warningCount = context.guidance.filter((entry) => entry.priority === "recommended").length;
  const okCount =
    context.inventory.filter((tool) => tool.installed).length +
    context.configHealth.filter((entry) => entry.healthy).length +
    context.optimizationLayers.filter((layer) => layer.claude || layer.codex || layer.copilot).length;
  return {
    criticalCount,
    warningCount,
    okCount
  };
}

export function filterMachineGuidance(
  guidance: MachineAdvisoryGuidance[],
  context: MachineGuidanceContext
): MachineAdvisoryGuidance[] {
  const taskType = context.taskType ?? null;
  const workflowStep = context.workflowStep ?? null;
  const triggered =
    Boolean(context.validationFailed) ||
    Boolean(context.evalPrecisionLow) ||
    Boolean(context.executionRetriesTriggered);
  const filtered = guidance.filter((entry) => {
    if (!triggered && entry.priority !== "critical") {
      return false;
    }
    if ((taskType === "read" || taskType === "docs") && workflowStep === "prepare" && entry.id === "missing-ccusage") {
      return false;
    }
    return true;
  });

  return filtered;
}

function sortMachineGuidance(entries: MachineAdvisoryGuidance[]): MachineAdvisoryGuidance[] {
  const priorityRank: Record<MachineAdvisoryGuidance["priority"], number> = {
    critical: 0,
    recommended: 1,
    optional: 2
  };
  return [...entries].sort((left, right) => {
    const byPriority = priorityRank[left.priority] - priorityRank[right.priority];
    if (byPriority !== 0) {
      return byPriority;
    }
    return left.message.localeCompare(right.message);
  });
}
