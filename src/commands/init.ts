import { loadCanonicalConfig } from "../core/config.js";
import { initOrSyncTarget, summarizeWrites } from "../core/executor.js";
import { buildTemplateContext } from "../core/router.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "../core/profiles.js";
import type { Logger } from "../core/logger.js";

export interface InitOptions {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
  logger: Logger;
}

export async function runInit(options: InitOptions): Promise<number> {
  const config = await loadCanonicalConfig(options.repoRoot);
  const overlay = await loadProjectOverlay(options.targetRoot);
  const selection = await resolveProfileSelection(options.targetRoot, config, options.profileName);
  const executionMode = resolveExecutionMode(config, selection, overlay);
  const context = buildTemplateContext(options.targetRoot, config, {
    profileName: selection.profileName,
    executionMode
  });
  const results = await initOrSyncTarget(options.repoRoot, options.targetRoot, config, context);
  options.logger.info(summarizeWrites(results, options.targetRoot));
  return results.some((result) => result.status === "conflict") ? 1 : 0;
}
