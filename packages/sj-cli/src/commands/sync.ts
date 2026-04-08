import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { initOrSyncTarget, summarizeWrites } from "@shrey-junior/sj-core/core/executor.js";
import { prepareBootstrapContext, syncRepoAwareBootstrapArtifacts } from "@shrey-junior/sj-core/core/bootstrap.js";
import { recordExecutionState } from "@shrey-junior/sj-core/core/execution-state.js";
import { buildBootstrapNextSuggestedCommand } from "@shrey-junior/sj-core/core/guidance.js";
import { selectPortableContract } from "@shrey-junior/sj-core/core/router.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

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
  const contract = selectPortableContract(config, prepared.context);
  const results = await initOrSyncTarget(options.repoRoot, options.targetRoot, config, prepared.context, {
    ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
    ...(options.diffSummary !== undefined ? { diffSummary: options.diffSummary } : {}),
    backup: options.backup ?? prepared.profileResolution.profile.sync.default_backup,
    backupLabel: prepared.context.generatedAt.replace(/[:.]/g, "-")
  });
  const repoAwareResults =
    options.dryRun
      ? []
      : await syncRepoAwareBootstrapArtifacts(options.targetRoot, {
          projectName: prepared.context.projectName,
          projectType: prepared.inspection.projectType,
          profileName: prepared.profileResolution.profileName,
          profileSource: prepared.profileResolution.source,
          activeRole: contract.activeRole,
          recommendedMcpPack: prepared.starterMcpHints[0] ?? "core-pack",
          nextRecommendedSpecialist: prepared.starterSpecialists[0] ?? contract.activeRole,
          nextSuggestedCommand: buildBootstrapNextSuggestedCommand(options.targetRoot)
        });
  options.logger.info(
    summarizeWrites([...results, ...repoAwareResults], options.targetRoot, {
      ...(options.diffSummary !== undefined ? { diffSummary: options.diffSummary } : {}),
      ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {})
    })
  );
  if (!options.dryRun) {
    await recordExecutionState(options.targetRoot, {
      type: "repo-sync",
      lifecycle: "idle",
      sourceCommand: "kiwi-control sync",
      reason: "Repo-local control surfaces were synchronized.",
      nextCommand: buildBootstrapNextSuggestedCommand(options.targetRoot),
      clearTask: true,
      reuseOperation: false
    }).catch(() => null);
  }
  return [...results, ...repoAwareResults].some((result) => result.status === "conflict") ? 1 : 0;
}
