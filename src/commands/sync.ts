import { loadCanonicalConfig } from "../core/config.js";
import { initOrSyncTarget, summarizeWrites } from "../core/executor.js";
import { prepareBootstrapContext } from "../core/bootstrap.js";
import type { Logger } from "../core/logger.js";

export interface SyncOptions {
  repoRoot: string;
  targetRoot: string;
  dryRun?: boolean;
  diffSummary?: boolean;
  backup?: boolean;
  logger: Logger;
}

export async function runSync(options: SyncOptions): Promise<number> {
  const config = await loadCanonicalConfig(options.repoRoot);
  const prepared = await prepareBootstrapContext(
    {
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot
    },
    config
  );
  if (prepared.inspection.authorityOptOut) {
    options.logger.warn(`repo authority requests repo-local-only behavior; sync stood down (${prepared.inspection.authorityOptOut})`);
    return 0;
  }
  const results = await initOrSyncTarget(options.repoRoot, options.targetRoot, config, prepared.context, {
    ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
    ...(options.diffSummary !== undefined ? { diffSummary: options.diffSummary } : {}),
    backup: options.backup ?? prepared.profileResolution.profile.sync.default_backup,
    backupLabel: prepared.context.generatedAt.replace(/[:.]/g, "-")
  });
  options.logger.info(
    summarizeWrites(results, options.targetRoot, {
      ...(options.diffSummary !== undefined ? { diffSummary: options.diffSummary } : {}),
      ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {})
    })
  );
  return results.some((result) => result.status === "conflict") ? 1 : 0;
}
