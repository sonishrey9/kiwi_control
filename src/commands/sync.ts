import { loadCanonicalConfig } from "../core/config.js";
import { initOrSyncTarget, summarizeWrites } from "../core/executor.js";
import { buildTemplateContext } from "../core/router.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "../core/profiles.js";
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
  const overlay = await loadProjectOverlay(options.targetRoot);
  const selection = await resolveProfileSelection(options.targetRoot, config);
  const executionMode = resolveExecutionMode(config, selection, overlay);
  const context = buildTemplateContext(options.targetRoot, config, {
    profileName: selection.profileName,
    executionMode
  });
  const results = await initOrSyncTarget(options.repoRoot, options.targetRoot, config, context, {
    ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
    ...(options.diffSummary !== undefined ? { diffSummary: options.diffSummary } : {}),
    backup: options.backup ?? selection.profile.sync.default_backup,
    backupLabel: context.generatedAt.replace(/[:.]/g, "-")
  });
  options.logger.info(
    summarizeWrites(results, options.targetRoot, {
      ...(options.diffSummary !== undefined ? { diffSummary: options.diffSummary } : {}),
      ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {})
    })
  );
  return results.some((result) => result.status === "conflict") ? 1 : 0;
}
