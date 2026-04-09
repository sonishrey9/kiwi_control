import { buildMachineParityState } from "@shrey-junior/sj-core/integrations/machine-parity.js";
import { loadMachineAdvisory } from "@shrey-junior/sj-core/integrations/machine-advisory.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { createSpinner, printSection, printTable, success, warn } from "../utils/cli-output.js";

export interface ParityOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  refresh?: boolean;
  logger: Logger;
}

export async function runParity(options: ParityOptions): Promise<number> {
  const spinner = options.json ? null : await createSpinner("Loading machine parity");
  const advisory = await loadMachineAdvisory({
    ...(options.refresh !== undefined ? { forceRefresh: options.refresh } : {})
  });
  const parity = buildMachineParityState(advisory);
  spinner?.succeed("Machine parity ready");

  if (options.json) {
    options.logger.info(JSON.stringify(parity, null, 2));
    return parity.overallStatus === "ready" ? 0 : 1;
  }

  printSection(options.logger, `MACHINE PARITY   ${parity.updatedAt}${advisory.stale ? " (stale)" : ""}`);
  options.logger.info(parity.boundaryNote);
  printSection(options.logger, "STATUS SUMMARY");
  options.logger.info(
    `covered=${parity.summary.covered} partial=${parity.summary.partial} missing=${parity.summary.missing} optional=${parity.summary.optional}`
  );
  options.logger.info(`overall: ${parity.overallStatus}`);

  printSection(options.logger, "REPO-LOCAL CAPABILITIES");
  await printTable(
    options.logger,
    ["Capability", "Status", "Detail"],
    parity.repoLocalCapabilities.map((item) => [item.label, item.status, item.detail])
  );

  printSection(options.logger, "MACHINE-GLOBAL PARITY");
  await printTable(
    options.logger,
    ["Capability", "Status", "Category", "Helper"],
    parity.machineGlobalCapabilities.map((item) => [
      item.label,
      formatStatus(item.status),
      item.category,
      item.helperCommand ?? "—"
    ])
  );

  if (parity.helpers.length > 0) {
    printSection(options.logger, "SAFE HELPER COMMANDS");
    for (const helper of parity.helpers) {
      const marker = helper.command === "ai-setup" ? warn("[guided]") : success("[safe]");
      options.logger.info(`- ${marker} ${helper.label}`);
      options.logger.info(`  command: ${helper.command}`);
      options.logger.info(`  reason: ${helper.reason}`);
    }
  }

  return parity.overallStatus === "ready" ? 0 : 1;
}

function formatStatus(status: "covered" | "partial" | "missing" | "optional"): string {
  switch (status) {
    case "covered":
      return "covered";
    case "partial":
      return "partial";
    case "missing":
      return "missing";
    case "optional":
      return "optional";
  }
}
