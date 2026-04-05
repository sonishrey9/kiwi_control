import { loadMachineAdvisory } from "@shrey-junior/sj-core/integrations/machine-advisory.js";
import type {
  MachineAdvisoryClaudeUsageDay,
  MachineAdvisoryCodexUsageDay
} from "@shrey-junior/sj-core/integrations/machine-advisory.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface UsageOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  refresh?: boolean;
  logger: Logger;
}

export async function runUsage(options: UsageOptions): Promise<number> {
  const advisory = await loadMachineAdvisory({
    ...(options.refresh !== undefined ? { forceRefresh: options.refresh } : {})
  });
  const payload = advisory.usage;

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
    return 0;
  }

  renderSection(options.logger, `TOKEN USAGE (LAST ${advisory.windowDays} DAYS) [${formatSection(advisory.sections.usage)}]`);
  renderSection(options.logger, "HEALTH SUMMARY");
  options.logger.info(
    `critical=${formatInteger(advisory.systemHealth.criticalCount)} warning=${formatInteger(advisory.systemHealth.warningCount)} ok=${formatInteger(advisory.systemHealth.okCount)}`
  );

  renderSection(options.logger, "Claude Code (via ccusage)");
  if (payload.claude.available) {
    renderTable(
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

  renderSection(options.logger, "Codex (via session logs)");
  if (payload.codex.available) {
    renderTable(
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

  renderSection(options.logger, "Copilot CLI");
  options.logger.info(payload.copilot.note);
  if (advisory.guidance.length > 0) {
    renderSection(options.logger, `GUIDANCE [${formatSection(advisory.sections.guidance)}]`);
    for (const entry of advisory.guidance.filter((item) => item.section === "usage" || item.section === "guidance")) {
      options.logger.info(`- [${entry.priority}] ${entry.message}: ${entry.impact}`);
      options.logger.info(`  reason: ${entry.reason ?? entry.section}`);
      if (entry.fixCommand) {
        options.logger.info(`  fix: ${entry.fixCommand}`);
      }
      if (entry.hintCommand) {
        options.logger.info(`  hint: ${entry.hintCommand}`);
      }
    }
  }
  options.logger.info("next command: kiwi-control toolchain");
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

function renderSection(logger: Logger, title: string): void {
  logger.info(title);
}

function renderTable(logger: Logger, headers: string[], rows: string[][]): void {
  const widths = headers.map((header, index) =>
    Math.max(
      header.length,
      ...rows.map((row) => stripAnsi(row[index] ?? "").length)
    )
  );
  logger.info(formatRow(headers, widths));
  logger.info(formatRow(widths.map((width) => "-".repeat(width)), widths));
  for (const row of rows) {
    logger.info(formatRow(row, widths));
  }
}

function formatRow(values: string[], widths: number[]): string {
  return values
    .map((value, index) => pad(value, widths[index] ?? value.length))
    .join("  ");
}

function pad(value: string, width: number): string {
  const visible = stripAnsi(value).length;
  const padding = Math.max(0, width - visible);
  return `${value}${" ".repeat(padding)}`;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
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
