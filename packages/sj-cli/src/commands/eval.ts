import { summarizeEval } from "@shrey-junior/sj-core/core/eval.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface EvalOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  logger: Logger;
}

export async function runEval(options: EvalOptions): Promise<number> {
  const summary = await summarizeEval(options.targetRoot);
  if (options.json) {
    options.logger.info(JSON.stringify(summary, null, 2));
    return 0;
  }

  options.logger.info(`total runs: ${summary.totalRuns}`);
  options.logger.info(`success rate: ${summary.successRate}%`);
  options.logger.info(`retry rate: ${summary.retryRate}%`);
  options.logger.info(`average context precision: ${summary.averageContextPrecision}`);
  options.logger.info(`average token count: ${summary.averageTokenCount}`);
  for (const entry of summary.recentEntries.slice(0, 5)) {
    options.logger.info(`${entry.task}: success=${entry.success} precision=${entry.contextPrecision} tokens=${entry.tokenCount}`);
  }
  return 0;
}
