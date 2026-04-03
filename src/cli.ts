#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Logger } from "./core/logger.js";
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

interface ParsedArgs {
  command: string | undefined;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const logger = new Logger(true);
  const targetRoot = typeof parsed.flags.target === "string" ? path.resolve(String(parsed.flags.target)) : process.cwd();

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
        throw new Error("run requires a goal");
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
        throw new Error("checkpoint requires a label");
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
    case "handoff":
      if (typeof parsed.flags.to !== "string") {
        throw new Error("handoff requires --to codex|claude|copilot");
      }
      process.exitCode = await runHandoff({
        repoRoot,
        targetRoot,
        toTool: String(parsed.flags.to) as "codex" | "claude" | "copilot",
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
        logger
      });
      return;
    case "status":
      process.exitCode = await runStatus({
        repoRoot,
        targetRoot,
        ...(typeof parsed.flags.profile === "string" ? { profileName: String(parsed.flags.profile) } : {}),
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
        throw new Error("dispatch requires a goal");
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
        throw new Error("fanout requires a goal");
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
      printHelp();
      process.exitCode = parsed.command ? 1 : 0;
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

function printHelp(): void {
  console.log(`shrey-junior

Usage:
  shrey-junior bootstrap --target /path/to/folder [--profile profile-name] [--project-type python|node|docs|data-platform|generic] [--dry-run] [--json]
  shrey-junior standardize --target /path/to/repo [--profile profile-name] [--project-type python|node|docs|data-platform|generic] [--dry-run] [--backup] [--json]
  shrey-junior audit --target /path/to/repo [--report /path/to/report.md]
  shrey-junior check [--target /path/to/repo] [--profile profile-name]
  shrey-junior init --target /path/to/repo [--profile profile-name]
  shrey-junior sync --target /path/to/repo [--dry-run] [--diff-summary] [--backup]
  shrey-junior run "goal" --target /path/to/repo [--profile profile-name] [--mode assisted|guarded|inline] [--tool codex|claude|copilot]
  shrey-junior fanout "goal" --target /path/to/repo [--profile profile-name] [--mode assisted|guarded|inline]
  shrey-junior checkpoint "label" --target /path/to/repo [--goal text] [--tool codex|claude|copilot] [--profile profile-name] [--mode assisted|guarded|inline] [--status in-progress|complete|blocked] [--validations a,b] [--warnings a,b] [--open-issues a,b] [--next text]
  shrey-junior handoff --target /path/to/repo --to codex|claude|copilot [--profile profile-name]
  shrey-junior status --target /path/to/repo [--profile profile-name]
  shrey-junior push-check --target /path/to/repo [--profile profile-name]
  shrey-junior dispatch "goal" --target /path/to/repo [--profile profile-name] [--mode assisted|guarded|inline]
  shrey-junior collect --target /path/to/repo
  shrey-junior reconcile --target /path/to/repo [--profile profile-name]
`);
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
