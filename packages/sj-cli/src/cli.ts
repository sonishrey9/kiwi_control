#!/usr/bin/env node
import path from "node:path";
import { resolveShreyJuniorProductRoot } from "@shrey-junior/sj-core";
import { PRODUCT_METADATA, listCliCommandAliases } from "@shrey-junior/sj-core";
import { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { runAudit } from "./commands/audit.js";
import { runBootstrap } from "./commands/bootstrap.js";
import { runCheck } from "./commands/check.js";
import { runInit } from "./commands/init.js";
import { runSync } from "./commands/sync.js";
import { runStandardize } from "./commands/standardize.js";
import { runRun } from "./commands/run.js";
import { runFanout } from "./commands/fanout.js";
import { runCheckpoint } from "./commands/checkpoint.js";
import { runHandoff } from "./commands/handoff.js";
import { runStatus } from "./commands/status.js";
import { runPushCheck } from "./commands/push-check.js";
import { runDispatch } from "./commands/dispatch.js";
import { runCollect } from "./commands/collect.js";
import { runReconcile } from "./commands/reconcile.js";
import { runSpecialists } from "./commands/specialists.js";
import { runUi } from "./commands/ui.js";

interface ParsedArgs {
  command: string | undefined;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const invokedCommand = resolveInvokedCommand(process.argv[1]);
  const repoRoot = resolveShreyJuniorProductRoot();
  const logger = new Logger(true);
  const targetRoot = typeof parsed.flags.target === "string" ? path.resolve(String(parsed.flags.target)) : process.cwd();
  const helpRequested = parsed.flags.help === true || parsed.flags.h === true || parsed.command === "--help" || parsed.command === "-h" || parsed.command === "help";

  if (helpRequested) {
    printHelp(invokedCommand);
    process.exitCode = 0;
    return;
  }

  switch (parsed.command) {
    case "bootstrap":
      process.exitCode = await runBootstrap({
        repoRoot,
        targetRoot,
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
        ...(typeof parsed.flags["project-type"] === "string" ? { projectType: String(parsed.flags["project-type"]) } : {}),
        dryRun: parsed.flags["dry-run"] === true,
        backup: parsed.flags.backup === true,
        json: parsed.flags.json === true,
        logger
      });
      return;
    case "standardize":
      process.exitCode = await runStandardize({
        repoRoot,
        targetRoot,
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
        ...(typeof parsed.flags["project-type"] === "string" ? { projectType: String(parsed.flags["project-type"]) } : {}),
        dryRun: parsed.flags["dry-run"] === true,
        backup: parsed.flags.backup === true,
        json: parsed.flags.json === true,
        logger
      });
      return;
    case "audit":
      process.exitCode = await runAudit({
        repoRoot,
        targetRoot,
        ...(typeof parsed.flags.report === "string"
          ? { reportPath: path.resolve(String(parsed.flags.report)) }
          : {}),
        logger
      });
      return;
    case "check":
      process.exitCode = await runCheck({
        repoRoot,
        ...(typeof parsed.flags.target === "string" ? { targetRoot } : {}),
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
        json: parsed.flags.json === true,
        logger
      });
      return;
    case "init":
      process.exitCode = await runInit({
        repoRoot,
        targetRoot,
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
        logger
      });
      return;
    case "sync":
      process.exitCode = await runSync({
        repoRoot,
        targetRoot,
        dryRun: parsed.flags["dry-run"] === true,
        diffSummary: parsed.flags["diff-summary"] === true,
        backup: parsed.flags.backup === true,
        logger
      });
      return;
    case "run": {
      const goal = parsed.positionals.join(" ").trim();
      if (!goal) {
        throw new CliUsageError('run requires a goal string. Example: kiwi-control run "stabilize repo-local docs"');
      }
      process.exitCode = await runRun({
        repoRoot,
        targetRoot,
        goal,
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
        ...(typeof parsed.flags.mode === "string" ? { mode: String(parsed.flags.mode) as "assisted" | "guarded" | "inline" } : {}),
        ...(typeof parsed.flags.tool === "string" ? { tool: String(parsed.flags.tool) as "codex" | "claude" | "copilot" } : {}),
        logger
      });
      return;
    }
    case "checkpoint": {
      const label = parsed.positionals.join(" ").trim();
      if (!label) {
        throw new CliUsageError("checkpoint requires a label. Example: kiwi-control checkpoint \"beta handoff ready\"");
      }
      process.exitCode = await runCheckpoint({
        repoRoot,
        targetRoot,
        label,
        ...(typeof parsed.flags.goal === "string" ? { goal: String(parsed.flags.goal) } : {}),
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
        ...(typeof parsed.flags.mode === "string" ? { mode: String(parsed.flags.mode) as "assisted" | "guarded" | "inline" } : {}),
        ...(typeof parsed.flags.tool === "string" ? { tool: String(parsed.flags.tool) as "codex" | "claude" | "copilot" } : {}),
        ...(typeof parsed.flags.status === "string"
          ? { status: String(parsed.flags.status) as "in-progress" | "complete" | "blocked" }
          : {}),
        ...(typeof parsed.flags.validations === "string" ? { validations: String(parsed.flags.validations) } : {}),
        ...(typeof parsed.flags.warnings === "string" ? { warnings: String(parsed.flags.warnings) } : {}),
        ...(typeof parsed.flags["open-issues"] === "string" ? { openIssues: String(parsed.flags["open-issues"]) } : {}),
        ...(typeof parsed.flags.next === "string" ? { nextStep: String(parsed.flags.next) } : {}),
        logger
      });
      return;
    }
    case "handoff": {
      if (typeof parsed.flags.to !== "string") {
        throw new CliUsageError("handoff requires --to qa-specialist. Example: kiwi-control handoff --to qa-specialist");
      }
      const handoffTarget = String(parsed.flags.to);
      const explicitTool = parseToolFlag(parsed.flags.tool) ?? parseToolFlag(parsed.flags["to-tool"]);
      const legacyToolTarget = parseToolFlag(handoffTarget);
      process.exitCode = await runHandoff({
        repoRoot,
        targetRoot,
        toRole: legacyToolTarget ? "" : handoffTarget,
        ...(explicitTool ? { toTool: explicitTool } : legacyToolTarget ? { toTool: legacyToolTarget } : {}),
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
        logger
      });
      return;
    }
    case "status":
      process.exitCode = await runStatus({
        repoRoot,
        targetRoot,
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
        json: parsed.flags.json === true,
        logger
      });
      return;
    case "specialists":
      process.exitCode = await runSpecialists({
        repoRoot,
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
        json: parsed.flags.json === true,
        logger
      });
      return;
    case "ui":
      process.exitCode = await runUi({
        repoRoot,
        targetRoot,
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
        json: parsed.flags.json === true,
        logger
      });
      return;
    case "push-check":
      process.exitCode = await runPushCheck({
        repoRoot,
        targetRoot,
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
        logger
      });
      return;
    case "dispatch": {
      const goal = parsed.positionals.join(" ").trim();
      if (!goal) {
        throw new CliUsageError('dispatch requires a goal string. Example: kiwi-control dispatch "split docs cleanup"');
      }
      process.exitCode = await runDispatch({
        repoRoot,
        targetRoot,
        goal,
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
        ...(typeof parsed.flags.mode === "string" ? { mode: String(parsed.flags.mode) as "assisted" | "guarded" | "inline" } : {}),
        logger
      });
      return;
    }
    case "collect":
      process.exitCode = await runCollect({
        targetRoot,
        logger
      });
      return;
    case "reconcile":
      process.exitCode = await runReconcile({
        repoRoot,
        targetRoot,
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
        logger
      });
      return;
    case "fanout": {
      const goal = parsed.positionals.join(" ").trim();
      if (!goal) {
        throw new CliUsageError('fanout requires a goal string. Example: kiwi-control fanout "stabilize release docs"');
      }
      process.exitCode = await runFanout({
        repoRoot,
        targetRoot,
        goal,
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
        ...(typeof parsed.flags.mode === "string" ? { mode: String(parsed.flags.mode) as "assisted" | "guarded" | "inline" } : {}),
        logger
      });
      return;
    }
    default:
      if (parsed.command) {
        throw new CliUsageError(`unknown command: ${parsed.command}`);
      }
      printHelp(invokedCommand);
      process.exitCode = 0;
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value) {
      continue;
    }

    if (value.startsWith("--")) {
      const key = value.slice(2);
      const next = rest[index + 1];
      if (!next || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        index += 1;
      }
      continue;
    }

    positionals.push(value);
  }

  return { command, positionals, flags };
}

function printHelp(invokedCommand = PRODUCT_METADATA.cli.primaryCommand): void {
  const primaryCommand = PRODUCT_METADATA.cli.primaryCommand;
  const compatibilityAliasInvoked = PRODUCT_METADATA.cli.compatibilityCommands.includes(invokedCommand);
  const aliasBanner = compatibilityAliasInvoked
    ? `\nCompatibility alias invoked: ${invokedCommand}. Prefer ${primaryCommand} or ${PRODUCT_METADATA.cli.shortCommand} in new scripts and docs.\n`
    : "";

  console.log(`${PRODUCT_METADATA.displayName}${aliasBanner}

Primary commands:
  ${primaryCommand}
  ${PRODUCT_METADATA.cli.shortCommand}

Commands default to the current working directory. Use --target only when you need to operate on a different repo or folder.

Core commands:
  ${primaryCommand} init [--profile profile-name] [--target /path/to/repo]
  ${primaryCommand} status [--profile profile-name] [--json] [--target /path/to/repo]
  ${primaryCommand} check [--profile profile-name] [--json] [--target /path/to/repo]
  ${primaryCommand} specialists [--profile profile-name] [--json]
  ${primaryCommand} checkpoint "label" [--goal text] [--tool codex|claude|copilot] [--profile profile-name] [--mode assisted|guarded|inline] [--status in-progress|complete|blocked] [--validations a,b] [--warnings a,b] [--open-issues a,b] [--next text] [--target /path/to/repo]
  ${primaryCommand} handoff --to qa-specialist [--tool codex|claude|copilot] [--profile profile-name] [--target /path/to/repo]
  ${primaryCommand} ui [--profile profile-name] [--json] [--target /path/to/repo]

Advanced commands:
  ${primaryCommand} bootstrap --target /path/to/folder [--profile profile-name] [--project-type python|node|docs|data-platform|generic] [--dry-run] [--json]
  ${primaryCommand} standardize --target /path/to/repo [--profile profile-name] [--project-type python|node|docs|data-platform|generic] [--dry-run] [--backup] [--json]
  ${primaryCommand} audit --target /path/to/repo [--report /path/to/report.md]
  ${primaryCommand} sync --target /path/to/repo [--dry-run] [--diff-summary] [--backup]
  ${primaryCommand} run "goal" --target /path/to/repo [--profile profile-name] [--mode assisted|guarded|inline] [--tool codex|claude|copilot]
  ${primaryCommand} fanout "goal" --target /path/to/repo [--profile profile-name] [--mode assisted|guarded|inline]
  ${primaryCommand} dispatch "goal" --target /path/to/repo [--profile profile-name] [--mode assisted|guarded|inline]
  ${primaryCommand} collect [--target /path/to/repo]
  ${primaryCommand} reconcile [--profile profile-name] [--target /path/to/repo]
  ${primaryCommand} push-check [--profile profile-name] [--target /path/to/repo]

Inside-folder usage:
  cd /path/to/repo
  ${primaryCommand} init
  ${primaryCommand} status
  ${primaryCommand} check
  ${primaryCommand} checkpoint "beta handoff ready"
  ${primaryCommand} handoff --to qa-specialist
  ${primaryCommand} ui

${primaryCommand} ui launches the Kiwi Control desktop app and loads the current repo automatically. Use --target only when you want the desktop app to open a different folder.

Contributor source usage:
  npm install
  npm run build
  ${PRODUCT_METADATA.cli.sourceLauncher} status
  ${PRODUCT_METADATA.cli.sourceDesktopLauncher}

Compatibility:
  internal packages remain sj-core, sj-cli, and sj-ui
  repo-local schema and artifact IDs remain ${PRODUCT_METADATA.compatibility.schemaPrefix}/*
  temporary beta aliases: ${PRODUCT_METADATA.cli.compatibilityCommands.join(" | ")}
  primary public commands: ${primaryCommand} | ${PRODUCT_METADATA.cli.shortCommand}
`);
}

function resolveInvokedCommand(argv1?: string): string {
  const fallback = PRODUCT_METADATA.cli.primaryCommand;
  if (!argv1) {
    return fallback;
  }

  const invokedName = path.basename(argv1).replace(/\.(cjs|mjs|js|cmd|ps1|bat|exe)$/i, "");
  return listCliCommandAliases().includes(invokedName) ? invokedName : fallback;
}

function parseToolFlag(value: string | boolean | undefined): "codex" | "claude" | "copilot" | undefined {
  if (value !== "codex" && value !== "claude" && value !== "copilot") {
    return undefined;
  }

  return value;
}

class CliUsageError extends Error {}

main().catch((error: unknown) => {
  if (error instanceof CliUsageError) {
    console.error(`${PRODUCT_METADATA.cli.primaryCommand} usage error: ${error.message}`);
    console.error(
      `Core commands: ${[
        "init",
        "status",
        "check",
        "specialists",
        "checkpoint",
        "handoff",
        "ui"
      ].join(", ")}`
    );
    console.error(`Run \`${PRODUCT_METADATA.cli.primaryCommand} --help\` for the current command surface.`);
    process.exitCode = 2;
    return;
  }

  console.error(`${PRODUCT_METADATA.displayName} error: ${(error as Error).message}`);
  process.exitCode = 1;
});
