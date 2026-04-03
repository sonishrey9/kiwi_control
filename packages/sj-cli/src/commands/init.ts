import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { initOrSyncTarget, summarizeWrites } from "@shrey-junior/sj-core/core/executor.js";
import { prepareBootstrapContext } from "@shrey-junior/sj-core/core/bootstrap.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface InitOptions {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
  logger: Logger;
}

export async function runInit(options: InitOptions): Promise<number> {
  const config = await loadCanonicalConfig(options.repoRoot);
  const prepared = await prepareBootstrapContext(
    {
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot,
      ...(options.profileName ? { explicitProfileName: options.profileName } : {})
    },
    config
  );
  if (prepared.inspection.authorityOptOut) {
    options.logger.warn(`repo authority requests repo-local-only behavior; init stood down (${prepared.inspection.authorityOptOut})`);
    return 0;
  }
  const results = await initOrSyncTarget(options.repoRoot, options.targetRoot, config, prepared.context);
  options.logger.info(summarizeWrites(results, options.targetRoot));
  return results.some((result) => result.status === "conflict") ? 1 : 0;
}
