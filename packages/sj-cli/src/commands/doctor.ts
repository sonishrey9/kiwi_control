import { PRODUCT_METADATA } from "@shrey-junior/sj-core";
import { buildRepoControlState } from "@shrey-junior/sj-core/core/ui-state.js";
import { buildMachineDoctorFindings, loadMachineAdvisory } from "@shrey-junior/sj-core/integrations/machine-advisory.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { renderDisplayPath } from "@shrey-junior/sj-core/utils/fs.js";

export interface DoctorOptions {
  repoRoot: string;
  targetRoot: string;
  machine?: boolean;
  json?: boolean;
  logger: Logger;
}

export async function runDoctor(options: DoctorOptions): Promise<number> {
  if (options.machine) {
    return runMachineDoctor(options);
  }
  const controlState = await buildRepoControlState({
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    machineAdvisoryOptions: { fastMode: true },
    readOnly: true
  });
  const findings = controlState.validation.issues.map((issue) => ({
    level: issue.level,
    message: issue.message,
    filePath: issue.filePath ?? null,
    fixCommand: suggestFixCommand(issue.message, options.targetRoot)
  }));
  if (
    (controlState.executionState.lifecycle === "blocked" || controlState.executionState.lifecycle === "failed")
    && controlState.executionState.reason
  ) {
    findings.push({
      level: controlState.executionState.lifecycle === "failed" ? "error" : "warn",
      message: controlState.executionState.reason,
      filePath: null,
      fixCommand: controlState.executionState.nextCommand ?? `${PRODUCT_METADATA.cli.primaryCommand} doctor --target "${options.targetRoot}"`
    });
  }
  const payload = {
    ok: findings.every((finding) => finding.level !== "error"),
    findings,
    nextCommand: controlState.readiness.nextCommand ?? `${PRODUCT_METADATA.cli.primaryCommand} status --target "${options.targetRoot}"`
  };

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
  } else if (findings.length === 0) {
    options.logger.info("doctor: repo setup looks healthy");
    options.logger.info(`next command: ${payload.nextCommand}`);
  } else {
    for (const finding of groupRepoFindings(findings, options.targetRoot)) {
      options.logger.info(
        `${finding.level}: ${finding.message}${finding.filePath ? ` (${renderDisplayPath(options.targetRoot, finding.filePath)})` : ""}`
      );
      options.logger.info(`fix command: ${finding.fixCommand}`);
    }
    options.logger.info(`next command: ${payload.nextCommand}`);
  }

  return payload.ok ? 0 : 1;
}

function suggestFixCommand(message: string, targetRoot: string): string {
  if (/context tree missing/i.test(message)) {
    return `${PRODUCT_METADATA.cli.primaryCommand} plan "describe your task" --target "${targetRoot}"`;
  }
  if (/repo-local memory file missing|required file missing/i.test(message)) {
    return `${PRODUCT_METADATA.cli.primaryCommand} sync --target "${targetRoot}" --dry-run --diff-summary`;
  }
  if (/stale|invalid|missing or invalid/i.test(message)) {
    return `${PRODUCT_METADATA.cli.primaryCommand} status --target "${targetRoot}"`;
  }
  return `${PRODUCT_METADATA.cli.primaryCommand} check --target "${targetRoot}"`;
}

async function runMachineDoctor(options: DoctorOptions): Promise<number> {
  const advisory = await loadMachineAdvisory();
  const findings = buildMachineDoctorFindings(advisory);
  const payload = {
    ok: findings.length === 0,
    updatedAt: advisory.updatedAt,
    stale: advisory.stale,
    findings,
    nextCommand: findings[0]?.fixCommand ?? "kiwi-control toolchain"
  };

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
  } else if (findings.length === 0) {
    options.logger.info(`doctor: machine advisory looks healthy (${advisory.updatedAt}${advisory.stale ? " stale" : ""})`);
    options.logger.info(`next command: ${payload.nextCommand}`);
  } else {
    for (const finding of findings) {
      options.logger.info(`${finding.level}: ${finding.category} — ${finding.reason}`);
      options.logger.info(`fix command: ${finding.fixCommand}`);
    }
    options.logger.info(`next command: ${payload.nextCommand}`);
  }

  return findings.length === 0 ? 0 : 1;
}

function groupRepoFindings(
  findings: Array<{ level: string; message: string; filePath: string | null; fixCommand: string }>,
  targetRoot: string
): Array<{ level: string; message: string; filePath: string | null; fixCommand: string }> {
  const grouped: Array<{ level: string; message: string; filePath: string | null; fixCommand: string }> = [];
  const missingRepoState = findings.filter((finding) => /generated repo-local state missing|repo-local memory file missing/.test(finding.message));
  if (missingRepoState.length > 0) {
    grouped.push({
      level: missingRepoState.some((finding) => finding.level === "error") ? "error" : "warn",
      message: `repo-local state is incomplete (${missingRepoState.length} missing surfaces)`,
      filePath: null,
      fixCommand: `${PRODUCT_METADATA.cli.primaryCommand} sync --target "${targetRoot}" --dry-run --diff-summary`
    });
  }
  const staleOrInvalid = findings.filter((finding) => /stale|invalid|missing or invalid/.test(finding.message));
  if (staleOrInvalid.length > 0) {
    grouped.push({
      level: staleOrInvalid.some((finding) => finding.level === "error") ? "error" : "warn",
      message: `repo-local state contains stale or invalid artifacts (${staleOrInvalid.length} findings)`,
      filePath: null,
      fixCommand: `${PRODUCT_METADATA.cli.primaryCommand} status --target "${targetRoot}"`
    });
  }
  const everythingElse = findings.filter((finding) =>
    !/generated repo-local state missing|repo-local memory file missing|stale|invalid|missing or invalid/.test(finding.message)
  );
  return [...grouped, ...everythingElse];
}
