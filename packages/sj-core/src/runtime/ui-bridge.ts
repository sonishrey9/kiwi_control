#!/usr/bin/env node
import path from "node:path";
import { buildRepoControlState, loadWarmRepoControlSnapshot } from "../core/ui-state.js";
import {
  loadMachineAdvisory,
  loadMachineAdvisorySection,
  type MachineAdvisorySectionName
} from "../integrations/machine-advisory.js";
import { resolveShreyJuniorProductRoot } from "../runtime.js";

type ParsedArgs = {
  command: string | undefined;
  flags: Record<string, string | boolean>;
};

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const repoRoot = typeof parsed.flags["repo-root"] === "string"
    ? path.resolve(String(parsed.flags["repo-root"]))
    : resolveShreyJuniorProductRoot(import.meta.url);
  const fastMode = parsed.flags["machine-fast"] === true || parsed.flags.fast === true;
  const forceRefresh = parsed.flags.refresh === true;

  switch (parsed.command) {
    case "repo-state": {
      const targetRoot = typeof parsed.flags["target-root"] === "string"
        ? path.resolve(String(parsed.flags["target-root"]))
        : process.cwd();
      const profileName = typeof parsed.flags.profile === "string" ? String(parsed.flags.profile) : undefined;
      const preferSnapshot = parsed.flags["prefer-snapshot"] === true;
      const snapshotMaxAgeMs =
        typeof parsed.flags["snapshot-max-age-ms"] === "string"
          ? Number(parsed.flags["snapshot-max-age-ms"])
          : undefined;
      const warmSnapshot =
        preferSnapshot
          ? await loadWarmRepoControlSnapshot(targetRoot, {
              ...(Number.isFinite(snapshotMaxAgeMs)
                ? {
                    warmMaxAgeMs: Number(snapshotMaxAgeMs),
                    staleMaxAgeMs: Math.max(Number(snapshotMaxAgeMs) * 5, Number(snapshotMaxAgeMs))
                  }
                : {})
            })
          : null;
      const state = warmSnapshot ?? await buildRepoControlState({
        repoRoot,
        targetRoot,
        ...(profileName ? { profileName } : {}),
        machineAdvisoryOptions: {
          fastMode
        }
      });
      process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
      return;
    }
    case "machine-advisory": {
      const advisory = await loadMachineAdvisory({
        forceRefresh,
        fastMode
      });
      process.stdout.write(`${JSON.stringify(advisory, null, 2)}\n`);
      return;
    }
    case "machine-advisory-section": {
      if (typeof parsed.flags.section !== "string") {
        throw new Error("machine-advisory-section requires --section");
      }
      const section = String(parsed.flags.section) as MachineAdvisorySectionName;
      const advisorySection = await loadMachineAdvisorySection(section, {
        forceRefresh,
        fastMode
      });
      process.stdout.write(`${JSON.stringify(advisorySection, null, 2)}\n`);
      return;
    }
    default:
      throw new Error("usage: ui-bridge <repo-state|machine-advisory|machine-advisory-section> [flags]");
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value?.startsWith("--")) {
      continue;
    }
    const key = value.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }

  return { command, flags };
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${detail}\n`);
  process.exitCode = 1;
});
