import { loadMachineAdvisory } from "@shrey-junior/sj-core/integrations/machine-advisory.js";
import type {
  MachineAdvisoryClaudeUsageDay,
  MachineAdvisoryCodexUsageDay
} from "@shrey-junior/sj-core/integrations/machine-advisory.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { createSpinner, printSection, printTable, success, warn } from "../utils/cli-output.js";

export interface UsageOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  refresh?: boolean;
  logger: Logger;
}

export async function runUsage(options: UsageOptions): Promise<number> {
  const spinner = options.json ? null : await createSpinner("Loading usage telemetry");
  const advisory = await loadMachineAdvisory({
    ...(options.refresh !== undefined ? { forceRefresh: options.refresh } : {})
  });
  spinner?.succeed("Usage telemetry ready");
  const payload = advisory.usage;

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
    return 0;
  }

  printSection(options.logger, `TOKEN USAGE (LAST ${advisory.windowDays} DAYS) [${formatSection(advisory.sections.usage)}]`);
  printSection(options.logger, "HEALTH SUMMARY");
  options.logger.info(
    `critical=${formatInteger(advisory.systemHealth.criticalCount)} warning=${formatInteger(advisory.systemHealth.warningCount)} ok=${formatInteger(advisory.systemHealth.okCount)}`
  );

  printSection(options.logger, "Claude Code (via ccusage)");
  if (payload.claude.available) {
    await printTable(
      options.logger,
      ["Date", "Input", "Output", "Cache Read", "Cost", "Models"],
      payload.claude.days.map((day) => renderClaudeDay(day))
    );
    options.logger.info(
      `Total: ${formatInteger(payload.claude.totals.inputTokens)} input · ${formatInteger(payload.claude.totals.outputTokens)} output · ${formatInteger(payload.claude.totals.cacheReadTokens)} cache read · ${formatCurrency(payload.claude.totals.totalCost)}`
    );
    options.logger.info(`Cache hit ratio: ${formatPercent(payload.claude.totals.cacheHitRatio)}`);
  } else {
    options.logger.info(payload.claude.note);
  }

  printSection(options.logger, "Codex (via session logs)");
  if (payload.codex.available) {
    await printTable(
      options.logger,
      ["Date", "Input", "Output", "Cached", "Sessions"],
      payload.codex.days.map((day) => renderCodexDay(day))
    );
    options.logger.info(
      `Total: ${formatInteger(payload.codex.totals.inputTokens)} input · ${formatInteger(payload.codex.totals.outputTokens)} output · ${formatInteger(payload.codex.totals.cachedInputTokens)} cached · ${formatInteger(payload.codex.totals.sessions)} sessions`
    );
    options.logger.info(`Cache hit ratio: ${formatPercent(payload.codex.totals.cacheHitRatio)}`);
  } else {
    options.logger.info(payload.codex.note);
  }

  printSection(options.logger, "Copilot CLI");
  options.logger.info(payload.copilot.note);
  if (advisory.guidance.length > 0) {
    printSection(options.logger, `GUIDANCE [${formatSection(advisory.sections.guidance)}]`);
    for (const entry of advisory.guidance.filter((item) => item.section === "usage" || item.section === "guidance")) {
      const marker = entry.priority === "critical" ? warn(`[${entry.priority}]`) : success(`[${entry.priority}]`);
      options.logger.info(`- ${marker} ${entry.message}: ${entry.impact}`);
      options.logger.info(`  reason: ${entry.reason ?? entry.section}`);
      if (entry.fixCommand) {
        options.logger.info(`  fix: ${entry.fixCommand}`);
      }
      if (entry.hintCommand) {
        options.logger.info(`  hint: ${entry.hintCommand}`);
      }
    }
  }
  options.logger.info(`${success("next command")}: kiwi-control toolchain`);
  return 0;
}

function renderClaudeDay(day: MachineAdvisoryClaudeUsageDay): string[] {
  return [
    day.date,
    formatInteger(day.inputTokens),
    formatInteger(day.outputTokens),
    formatInteger(day.cacheReadTokens),
    formatCurrency(day.totalCost),
    day.modelsUsed.join(", ") || "—"
  ];
}

function renderCodexDay(day: MachineAdvisoryCodexUsageDay): string[] {
  return [
    day.date,
    formatInteger(day.inputTokens),
    formatInteger(day.outputTokens),
    formatInteger(day.cachedInputTokens),
    formatInteger(day.sessions)
  ];
}


function formatInteger(value: number): string {
  return value.toLocaleString("en-US");
}

function formatPercent(value: number | null): string {
  return value == null ? "n/a" : `${value.toFixed(1)}%`;
}

function formatCurrency(value: number | null): string {
  return value == null ? "—" : `$${value.toFixed(2)}`;
}

function formatSection(section: { status: "fresh" | "cached" | "partial"; updatedAt: string; reason?: string }): string {
  return `${section.status}${section.updatedAt ? ` · ${section.updatedAt}` : ""}${section.reason ? ` · ${section.reason}` : ""}`;
}
