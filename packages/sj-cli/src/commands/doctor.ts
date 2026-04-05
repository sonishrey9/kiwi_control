import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { validateTargetRepo } from "@shrey-junior/sj-core/core/validator.js";
import { resolveProfileSelection } from "@shrey-junior/sj-core/core/profiles.js";
import { syncExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface DoctorOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  logger: Logger;
}

export async function runDoctor(options: DoctorOptions): Promise<number> {
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
    for (const finding of findings) {
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
