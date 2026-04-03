import type { ProjectType } from "@shrey-junior/sj-core/core/config.js";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { bootstrapTarget, formatBootstrapSummary } from "@shrey-junior/sj-core/core/bootstrap.js";
import { isProjectType } from "@shrey-junior/sj-core/core/project-detect.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface BootstrapCommandOptions {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
  projectType?: string;
  dryRun?: boolean;
  backup?: boolean;
  json?: boolean;
  logger: Logger;
}

export async function runBootstrap(options: BootstrapCommandOptions): Promise<number> {
  if (options.projectType && !isProjectType(options.projectType)) {
    throw new Error(`bootstrap received unknown project type: ${options.projectType}`);
  }

  const config = await loadCanonicalConfig(options.repoRoot);
  if (options.profileName && !config.routing.profiles[options.profileName]) {
    throw new Error(`bootstrap received unknown profile: ${options.profileName}`);
  }
  const plan = await bootstrapTarget(
    {
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot,
      ...(options.profileName ? { explicitProfileName: options.profileName } : {}),
      ...(options.projectType ? { explicitProjectType: options.projectType as ProjectType } : {}),
      ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
      ...(options.backup !== undefined ? { backup: options.backup } : {}),
      diffSummary: true
    },
    config
  );

  if (options.json) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    options.logger.info(formatBootstrapSummary(plan));
  }
  return plan.results.some((result) => result.status === "conflict") ? 1 : 0;
}
