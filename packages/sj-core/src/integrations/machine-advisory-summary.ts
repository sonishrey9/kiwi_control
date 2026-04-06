import type {
  MachineAdvisoryConfigHealth,
  MachineAdvisoryOptimizationLayer,
  MachineAdvisoryOptimizationScore,
  MachineAdvisorySetupSummary,
  MachineAdvisoryTool
} from "./machine-advisory.js";

export function buildSetupSummary(context: {
  inventory: MachineAdvisoryTool[];
  configHealth: MachineAdvisoryConfigHealth[];
  optimizationLayers: MachineAdvisoryOptimizationLayer[];
  optimizationScore: MachineAdvisoryOptimizationScore;
}): MachineAdvisorySetupSummary {
  return {
    installedTools: {
      readyCount: context.inventory.filter((tool) => tool.installed).length,
      totalCount: context.inventory.length
    },
    healthyConfigs: {
      readyCount: context.configHealth.filter((entry) => entry.healthy).length,
      totalCount: context.configHealth.length
    },
    activeTokenLayers: context.optimizationLayers
      .filter((layer) => layer.claude || layer.codex || layer.copilot)
      .map((layer) => layer.name),
    readyRuntimes: {
      planning: context.optimizationScore.planning.score >= 70,
      execution: context.optimizationScore.execution.score >= 70,
      assistant: context.optimizationScore.assistant.score >= 60
    }
  };
}
