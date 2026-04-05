import { loadMachineAdvisory } from "@shrey-junior/sj-core/integrations/machine-advisory.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface ToolchainOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  refresh?: boolean;
  logger: Logger;
}

export async function runToolchain(options: ToolchainOptions): Promise<number> {
  const advisory = await loadMachineAdvisory({
    ...(options.refresh !== undefined ? { forceRefresh: options.refresh } : {})
  });

  if (options.json) {
    options.logger.info(JSON.stringify(advisory, null, 2));
    return 0;
  }

  options.logger.info(`updated: ${advisory.updatedAt}${advisory.stale ? " (stale)" : ""}`);
  options.logger.info("toolchain inventory:");
  for (const tool of advisory.inventory) {
    options.logger.info(`- ${tool.name}: ${tool.installed ? tool.version : "missing"} [${tool.phase}]`);
  }
  options.logger.info(`mcp totals: claude=${advisory.mcpInventory.claudeTotal} codex=${advisory.mcpInventory.codexTotal} copilot=${advisory.mcpInventory.copilotTotal}`);
  options.logger.info(`next command: kiwi-control usage`);
  return 0;
}
