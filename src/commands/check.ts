import type { Logger } from "../core/logger.js";
import { loadCanonicalConfig } from "../core/config.js";
import { validateControlPlane, validateTargetRepo } from "../core/validator.js";
import { resolveProfileSelection } from "../core/profiles.js";

export interface CheckOptions {
  repoRoot: string;
  targetRoot?: string;
  profileName?: string;
  logger: Logger;
}

export async function runCheck(options: CheckOptions): Promise<number> {
  const config = await loadCanonicalConfig(options.repoRoot);
  const issues = [
    ...(await validateControlPlane(options.repoRoot, config)),
    ...(options.targetRoot
      ? await validateTargetRepo(options.targetRoot, config, await resolveProfileSelection(options.targetRoot, config, options.profileName))
      : [])
  ];

  if (issues.length === 0) {
    options.logger.info("check passed");
    return 0;
  }

  for (const issue of issues) {
    const prefix = issue.level === "error" ? "error" : "warn";
    const suffix = issue.filePath ? ` (${issue.filePath})` : "";
    options.logger.info(`${prefix}: ${issue.message}${suffix}`);
  }

  return issues.some((issue) => issue.level === "error") ? 1 : 0;
}
