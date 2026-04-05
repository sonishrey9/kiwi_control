import { loadMachineAdvisory } from "@shrey-junior/sj-core/integrations/machine-advisory.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface UsageOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  refresh?: boolean;
  logger: Logger;
}

export async function runUsage(options: UsageOptions): Promise<number> {
  const advisory = await loadMachineAdvisory({
    ...(options.refresh !== undefined ? { forceRefresh: options.refresh } : {})
  });
  const payload = advisory.usage;

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
    return 0;
  }

  options.logger.info(`usage window: last ${payload.days} days`);
  if (payload.claude.available) {
    options.logger.info(`claude total tokens: ${payload.claude.totals.totalTokens}`);
    options.logger.info(`claude cache hit ratio: ${payload.claude.totals.cacheHitRatio ?? "n/a"}%`);
    if (payload.claude.totals.totalCost != null) {
      options.logger.info(`claude total cost: $${payload.claude.totals.totalCost.toFixed(2)}`);
    }
  } else {
    options.logger.info(`claude: ${payload.claude.note}`);
  }

  if (payload.codex.available) {
    options.logger.info(`codex total tokens: ${payload.codex.totals.totalTokens}`);
    options.logger.info(`codex cache hit ratio: ${payload.codex.totals.cacheHitRatio ?? "n/a"}%`);
    options.logger.info(`codex sessions: ${payload.codex.totals.sessions}`);
  } else {
    options.logger.info(`codex: ${payload.codex.note}`);
  }

  options.logger.info(`copilot: ${payload.copilot.note}`);
  options.logger.info("next command: kiwi-control toolchain");
  return 0;
}
