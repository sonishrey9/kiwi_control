import { loadMachineAdvisory } from "@shrey-junior/sj-core/integrations/machine-advisory.js";
import type { MachineAdvisorySetupPhase, MachineAdvisoryState } from "@shrey-junior/sj-core/integrations/machine-advisory.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface ToolchainOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  refresh?: boolean;
  logger: Logger;
}

export async function runToolchain(options: ToolchainOptions): Promise<number> {
  const advisory = await loadMachineAdvisory({
    ...(options.refresh !== undefined ? { forceRefresh: options.refresh } : {})
  });

  if (options.json) {
    options.logger.info(JSON.stringify(advisory, null, 2));
    return 0;
  }

  renderSection(options.logger, `AI TOOLCHAIN DASHBOARD   ${advisory.updatedAt}${advisory.stale ? " (stale)" : ""}`);
  renderSection(options.logger, "HEALTH SUMMARY");
  options.logger.info(
    `critical=${formatInteger(advisory.systemHealth.criticalCount)} warning=${formatInteger(advisory.systemHealth.warningCount)} ok=${formatInteger(advisory.systemHealth.okCount)}`
  );

  renderSection(options.logger, `TOOLCHAIN INVENTORY [${formatSection(advisory.sections.inventory)}]`);
  renderTable(
    options.logger,
    ["Tool", "Version", "Phase", "Status"],
    advisory.inventory.map((tool) => [
      tool.name,
      tool.version,
      tool.phase,
      tool.installed ? "installed" : "missing"
    ])
  );

  renderSection(options.logger, `MCP SERVERS [${formatSection(advisory.sections.mcpInventory)}]`);
  options.logger.info(
    `Total: Claude Code ${formatInteger(advisory.mcpInventory.claudeTotal)}   Codex ${formatInteger(advisory.mcpInventory.codexTotal)}   Copilot ${formatInteger(advisory.mcpInventory.copilotTotal)}`
  );
  options.logger.info("");
  options.logger.info("Token Optimization Servers");
  renderTable(
    options.logger,
    ["Server", "Claude Code", "Codex", "Copilot"],
    advisory.mcpInventory.tokenServers.map((server) => [
      server.name,
      formatActive(server.claude),
      formatActive(server.codex),
      formatActive(server.copilot)
    ])
  );

  renderSection(options.logger, `TOKEN OPTIMIZATION LAYERS [${formatSection(advisory.sections.optimizationLayers)}]`);
  renderTable(
    options.logger,
    ["Layer", "Savings", "Claude Code", "Codex", "Copilot"],
    advisory.optimizationLayers.map((layer) => [
      layer.name,
      layer.savings,
      formatYesNo(layer.claude),
      formatYesNo(layer.codex),
      formatYesNo(layer.copilot)
    ])
  );
  options.logger.info("Optimization score intentionally omitted. Kiwi reports factual-only machine advisory.");

  renderSection(options.logger, "SKILLS & PLUGINS");
  options.logger.info(`Claude Code: ${formatInteger(advisory.skillsCount)} agent skills in ~/.agents/skills/`);
  options.logger.info(
    `Codex: ${formatInteger(advisory.mcpInventory.codexTotal)} MCP servers${advisory.inventory.some((tool) => tool.name === "omx" && tool.installed) ? " + OMX orchestration" : ""}`
  );
  options.logger.info(
    `Copilot CLI: ${formatInteger(advisory.copilotPlugins.length)} plugins${advisory.copilotPlugins.length > 0 ? `: ${advisory.copilotPlugins.join(", ")}` : ""}`
  );

  renderSection(options.logger, "WHAT AI-SETUP ADDED");
  options.logger.info(`status: ${formatSection(advisory.sections.setupPhases)}`);
  for (const phase of advisory.setupPhases) {
    renderSetupPhase(options.logger, phase);
  }

  renderSection(options.logger, `CONFIG HEALTH [${formatSection(advisory.sections.configHealth)}]`);
  renderTable(
    options.logger,
    ["Config", "Status", "Description"],
    advisory.configHealth.map((entry) => [
      entry.path,
      entry.healthy ? "healthy" : "issue",
      entry.description
    ])
  );

  renderSection(options.logger, `TOKEN USAGE (LAST ${advisory.windowDays} DAYS) [${formatSection(advisory.sections.usage)}]`);
  options.logger.info(`Claude Code: ${buildUsageSummary(advisory, "claude")}`);
  options.logger.info(`Codex: ${buildUsageSummary(advisory, "codex")}`);
  options.logger.info(`Copilot CLI: ${advisory.usage.copilot.note}`);
  options.logger.info("Run kiwi-control usage for daily usage tables.");
  if (advisory.guidance.length > 0) {
    renderSection(options.logger, `GUIDANCE [${formatSection(advisory.sections.guidance)}]`);
    for (const [title, entries] of groupGuidance(advisory.guidance)) {
      if (entries.length === 0) {
        continue;
      }
      options.logger.info(title);
      for (const entry of entries) {
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
  }
  options.logger.info("next command: kiwi-control usage");
  return 0;
}

function renderSection(logger: Logger, title: string): void {
  logger.info(title);
}

function renderSetupPhase(logger: Logger, phase: MachineAdvisorySetupPhase): void {
  logger.info(phase.phase);
  for (const item of phase.items) {
    logger.info(`- ${item.name}: ${item.active ? "active" : "inactive"} — ${item.description} (${item.location})`);
  }
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

function formatActive(value: boolean): string {
  return value ? "active" : "—";
}

function formatYesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function buildUsageSummary(advisory: MachineAdvisoryState, source: "claude" | "codex"): string {
  if (source === "claude") {
    if (!advisory.usage.claude.available) {
      return advisory.usage.claude.note;
    }
    const totals = advisory.usage.claude.totals;
    const detail = totals.totalCost != null
      ? `cache ${formatPercent(totals.cacheHitRatio)} · cost ${formatCurrency(totals.totalCost)}`
      : `cache ${formatPercent(totals.cacheHitRatio)}`;
    return `${formatInteger(totals.totalTokens)} tokens · ${detail}`;
  }

  if (!advisory.usage.codex.available) {
    return advisory.usage.codex.note;
  }
  const totals = advisory.usage.codex.totals;
  return `${formatInteger(totals.totalTokens)} tokens · cache ${formatPercent(totals.cacheHitRatio)} · sessions ${formatInteger(totals.sessions)}`;
}

function groupGuidance(entries: MachineAdvisoryState["guidance"]): Array<[string, MachineAdvisoryState["guidance"]]> {
  return [
    ["Critical Issues", entries.filter((entry) => entry.group === "critical-issues")],
    ["Improvements", entries.filter((entry) => entry.group === "improvements")],
    ["Optional Optimizations", entries.filter((entry) => entry.group === "optional-optimizations")]
  ];
}

function formatPercent(value: number | null): string {
  return value == null ? "n/a" : `${value.toFixed(1)}%`;
}

function formatCurrency(value: number | null): string {
  return value == null ? "—" : `$${value.toFixed(2)}`;
}

function formatSection(section: MachineAdvisoryState["sections"][keyof MachineAdvisoryState["sections"]]): string {
  return `${section.status}${section.updatedAt ? ` · ${section.updatedAt}` : ""}${section.reason ? ` · ${section.reason}` : ""}`;
}
