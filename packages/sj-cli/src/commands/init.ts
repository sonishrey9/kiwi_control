import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { recordExecutionState } from "@shrey-junior/sj-core/core/execution-state.js";
import { summarizeWrites } from "@shrey-junior/sj-core/core/executor.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { syncPackSelectionSideEffects } from "./helpers/pack-selection.js";

export interface InitOptions {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
  logger: Logger;
}

export async function runInit(options: InitOptions): Promise<number> {
  const config = await loadCanonicalConfig(options.repoRoot);
  const plan = await bootstrapTarget(
    {
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot,
      ...(options.profileName ? { explicitProfileName: options.profileName } : {})
    },
    config
  );
  if (plan.inspection.authorityOptOut) {
    options.logger.warn(`repo authority requests repo-local-only behavior; init stood down (${plan.inspection.authorityOptOut})`);
    return 0;
  }
  await recordExecutionState(options.targetRoot, {
    type: "repo-init",
    lifecycle: "idle",
    sourceCommand: `${plan.results.some((result) => result.status === "conflict") ? "kiwi-control init" : "kiwi-control init"}`,
    reason: "Repo-local control surfaces were initialized.",
    nextCommand: "kiwi-control status",
    clearTask: true,
    reuseOperation: false
  }).catch(() => null);
  await syncPackSelectionSideEffects({
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    ...(options.profileName ? { profileName: options.profileName } : {})
  }).catch(() => null);
  options.logger.info(summarizeWrites(plan.results, options.targetRoot));
  return plan.results.some((result) => result.status === "conflict") ? 1 : 0;
}
