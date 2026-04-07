import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { validateControlPlane, validateTargetRepo } from "@shrey-junior/sj-core/core/validator.js";
import { resolveProfileSelection } from "@shrey-junior/sj-core/core/profiles.js";
import { renderDisplayPath } from "@shrey-junior/sj-core/utils/fs.js";

export interface CheckOptions {
  repoRoot: string;
  targetRoot?: string;
  profileName?: string;
  json?: boolean;
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
    if (options.json) {
      options.logger.info(JSON.stringify({ ok: true, issues: [] }, null, 2));
    } else {
      options.logger.info("check passed");
    }
    return 0;
  }

  if (options.json) {
    options.logger.info(
      JSON.stringify(
        {
          ok: issues.every((issue) => issue.level !== "error"),
          issues
        },
        null,
        2
      )
    );
    return issues.some((issue) => issue.level === "error") ? 1 : 0;
  }

  for (const issue of issues) {
    const prefix = issue.level === "error" ? "error" : "warn";
    const suffix = issue.filePath ? ` (${renderDisplayPath(options.targetRoot ?? options.repoRoot, issue.filePath)})` : "";
    options.logger.info(`${prefix}: ${issue.message}${suffix}`);
  }

  return issues.some((issue) => issue.level === "error") ? 1 : 0;
}
