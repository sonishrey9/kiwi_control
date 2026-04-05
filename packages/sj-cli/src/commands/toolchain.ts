import { loadMachineAdvisory } from "@shrey-junior/sj-core/integrations/machine-advisory.js";
import type { MachineAdvisorySetupPhase, MachineAdvisoryState } from "@shrey-junior/sj-core/integrations/machine-advisory.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { createSpinner, printSection, printTable, success, warn } from "../utils/cli-output.js";

export interface ToolchainOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  refresh?: boolean;
  logger: Logger;
}

export async function runToolchain(options: ToolchainOptions): Promise<number> {
  const spinner = await createSpinner("Loading machine advisory");
  const advisory = await loadMachineAdvisory({
    ...(options.refresh !== undefined ? { forceRefresh: options.refresh } : {})
  });
  spinner.succeed("Machine advisory ready");

  if (options.json) {
    options.logger.info(JSON.stringify(advisory, null, 2));
    return 0;
  }

  printSection(options.logger, `AI TOOLCHAIN DASHBOARD   ${advisory.updatedAt}${advisory.stale ? " (stale)" : ""}`);
  printSection(options.logger, "HEALTH SUMMARY");
  options.logger.info(
    `critical=${formatInteger(advisory.systemHealth.criticalCount)} warning=${formatInteger(advisory.systemHealth.warningCount)} ok=${formatInteger(advisory.systemHealth.okCount)}`
  );

  printSection(options.logger, `TOOLCHAIN INVENTORY [${formatSection(advisory.sections.inventory)}]`);
  await printTable(
    options.logger,
    ["Tool", "Version", "Phase", "Status"],
    advisory.inventory.map((tool) => [
      tool.name,
      tool.version,
      tool.phase,
      tool.installed ? "installed" : "missing"
    ])
  );

  printSection(options.logger, `MCP SERVERS [${formatSection(advisory.sections.mcpInventory)}]`);
  options.logger.info(
    `Total: Claude Code ${formatInteger(advisory.mcpInventory.claudeTotal)}   Codex ${formatInteger(advisory.mcpInventory.codexTotal)}   Copilot ${formatInteger(advisory.mcpInventory.copilotTotal)}`
  );
  options.logger.info("");
  options.logger.info("Token Optimization Servers");
  await printTable(
    options.logger,
    ["Server", "Claude Code", "Codex", "Copilot"],
    advisory.mcpInventory.tokenServers.map((server) => [
      server.name,
      formatActive(server.claude),
      formatActive(server.codex),
      formatActive(server.copilot)
    ])
  );

  printSection(options.logger, `TOKEN OPTIMIZATION LAYERS [${formatSection(advisory.sections.optimizationLayers)}]`);
  await printTable(
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

  printSection(options.logger, "SKILLS & PLUGINS");
  options.logger.info(`Claude Code: ${formatInteger(advisory.skillsCount)} agent skills in ~/.agents/skills/`);
  options.logger.info(
    `Codex: ${formatInteger(advisory.mcpInventory.codexTotal)} MCP servers${advisory.inventory.some((tool) => tool.name === "omx" && tool.installed) ? " + OMX orchestration" : ""}`
  );
  options.logger.info(
    `Copilot CLI: ${formatInteger(advisory.copilotPlugins.length)} plugins${advisory.copilotPlugins.length > 0 ? `: ${advisory.copilotPlugins.join(", ")}` : ""}`
  );

  printSection(options.logger, "WHAT AI-SETUP ADDED");
  options.logger.info(`status: ${formatSection(advisory.sections.setupPhases)}`);
  for (const phase of advisory.setupPhases) {
    renderSetupPhase(options.logger, phase);
  }

  printSection(options.logger, `CONFIG HEALTH [${formatSection(advisory.sections.configHealth)}]`);
  await printTable(
    options.logger,
    ["Config", "Status", "Description"],
    advisory.configHealth.map((entry) => [
      entry.path,
      entry.healthy ? "healthy" : "issue",
      entry.description
    ])
  );

  printSection(options.logger, `TOKEN USAGE (LAST ${advisory.windowDays} DAYS) [${formatSection(advisory.sections.usage)}]`);
  options.logger.info(`Claude Code: ${buildUsageSummary(advisory, "claude")}`);
  options.logger.info(`Codex: ${buildUsageSummary(advisory, "codex")}`);
    options.logger.info(`Copilot CLI: ${advisory.usage.copilot.note}`);
  options.logger.info("Run kiwi-control usage for daily usage tables.");
  if (advisory.guidance.length > 0) {
    printSection(options.logger, `GUIDANCE [${formatSection(advisory.sections.guidance)}]`);
    for (const [title, entries] of groupGuidance(advisory.guidance)) {
      if (entries.length === 0) {
        continue;
      }
      options.logger.info(title);
      for (const entry of entries) {
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
  }
  options.logger.info(`${success("next command")}: kiwi-control usage`);
  return 0;
}

function renderSetupPhase(logger: Logger, phase: MachineAdvisorySetupPhase): void {
  logger.info(phase.phase);
  for (const item of phase.items) {
    logger.info(`- ${item.name}: ${item.active ? "active" : "inactive"} — ${item.description} (${item.location})`);
  }
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
