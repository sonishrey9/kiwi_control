import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { validateTargetRepo } from "@shrey-junior/sj-core/core/validator.js";
import { resolveProfileSelection } from "@shrey-junior/sj-core/core/profiles.js";
import { syncExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import { buildMachineDoctorFindings, loadMachineAdvisory } from "@shrey-junior/sj-core/integrations/machine-advisory.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

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
  const config = await loadCanonicalConfig(options.repoRoot);
  const issues = await validateTargetRepo(
    options.targetRoot,
    config,
    await resolveProfileSelection(options.targetRoot, config)
  );
  const plan = await syncExecutionPlan(options.targetRoot);
  const findings = issues.map((issue) => ({
    level: issue.level,
    message: issue.message,
    filePath: issue.filePath ?? null,
    fixCommand: suggestFixCommand(issue.message)
  }));
  const payload = {
    ok: findings.every((finding) => finding.level !== "error"),
    findings,
    nextCommand: plan.nextCommands[0] ?? "kiwi-control status"
  };

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
  } else if (findings.length === 0) {
    options.logger.info("doctor: repo setup looks healthy");
    options.logger.info(`next command: ${payload.nextCommand}`);
  } else {
    for (const finding of groupRepoFindings(findings)) {
      options.logger.info(`${finding.level}: ${finding.message}${finding.filePath ? ` (${finding.filePath})` : ""}`);
      options.logger.info(`fix command: ${finding.fixCommand}`);
    }
    options.logger.info(`next command: ${payload.nextCommand}`);
  }

  return payload.ok ? 0 : 1;
}

function suggestFixCommand(message: string): string {
  if (/context tree missing/i.test(message)) {
    return 'kiwi-control plan "describe your task"';
  }
  if (/repo-local memory file missing|required file missing/i.test(message)) {
    return "kiwi-control sync";
  }
  if (/stale|invalid|missing or invalid/i.test(message)) {
    return "kiwi-control status";
  }
  return "kiwi-control check";
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
  findings: Array<{ level: string; message: string; filePath: string | null; fixCommand: string }>
): Array<{ level: string; message: string; filePath: string | null; fixCommand: string }> {
  const grouped: Array<{ level: string; message: string; filePath: string | null; fixCommand: string }> = [];
  const missingRepoState = findings.filter((finding) => /generated repo-local state missing|repo-local memory file missing/.test(finding.message));
  if (missingRepoState.length > 0) {
    grouped.push({
      level: missingRepoState.some((finding) => finding.level === "error") ? "error" : "warn",
      message: `repo-local state is incomplete (${missingRepoState.length} missing surfaces)`,
      filePath: null,
      fixCommand: "kiwi-control sync"
    });
  }
  const staleOrInvalid = findings.filter((finding) => /stale|invalid|missing or invalid/.test(finding.message));
  if (staleOrInvalid.length > 0) {
    grouped.push({
      level: staleOrInvalid.some((finding) => finding.level === "error") ? "error" : "warn",
      message: `repo-local state contains stale or invalid artifacts (${staleOrInvalid.length} findings)`,
      filePath: null,
      fixCommand: "kiwi-control status"
    });
  }
  const everythingElse = findings.filter((finding) =>
    !/generated repo-local state missing|repo-local memory file missing|stale|invalid|missing or invalid/.test(finding.message)
  );
  return [...grouped, ...everythingElse];
}
