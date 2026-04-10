import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { pathExists } from "../utils/fs.js";

const execFile = promisify(execFileCallback);
const MACHINE_HOME_ENV = "KIWI_MACHINE_HOME";

export interface MachineToolRegistryEntry {
  name: string;
  description: string;
  phase: string;
  versionArgs?: string[];
}

export interface MachineCommandOutput {
  code: number;
  stdout: string;
  stderr: string;
}

export type MachineCommandRunner = (command: string, args: string[]) => Promise<MachineCommandOutput>;

export interface MachineToolDetection {
  name: string;
  description: string;
  phase: string;
  installed: boolean;
  version: string;
  path: string | null;
  source: "path" | "known-location" | "missing";
}

export const MACHINE_SETUP_TOOL_REGISTRY: MachineToolRegistryEntry[] = [
  { name: "ai-setup", description: "Local one-command AI bootstrap helper", phase: "Compatibility" },
  { name: "code-review-graph", description: "Graph-based code search", phase: "Phase 1" },
  { name: "omc", description: "Planning orchestration layer", phase: "Phase 1" },
  { name: "omx", description: "Execution orchestration layer", phase: "Phase 1" },
  { name: "lean-ctx", description: "Shell output compression", phase: "Phase 2" },
  { name: "repomix", description: "Codebase summarizer", phase: "Phase 2" },
  { name: "context-mode", description: "Tool output sandboxing", phase: "Phase 2" },
  { name: "copilot", description: "GitHub Copilot CLI", phase: "Phase 2" },
  { name: "tmux", description: "Terminal multiplexer", phase: "Existing", versionArgs: ["-V"] }
];

export function resolveMachineHome(homeRoot?: string): string {
  return homeRoot ?? process.env[MACHINE_HOME_ENV]?.trim() ?? os.homedir();
}

export function buildMachineEnv(homeRoot?: string): NodeJS.ProcessEnv {
  const resolvedHome = resolveMachineHome(homeRoot);
  return {
    ...process.env,
    HOME: resolvedHome,
    PATH: [
      path.join(resolvedHome, ".cargo", "bin"),
      path.join(resolvedHome, ".local", "bin"),
      path.join(resolvedHome, ".npm-global", "bin"),
      "/opt/homebrew/bin",
      "/opt/homebrew/sbin",
      "/usr/local/bin",
      "/usr/local/sbin",
      "/usr/bin",
      process.env.PATH ?? ""
    ].join(":")
  };
}

export async function runMachineCommand(
  command: string,
  args: string[],
  options: {
    homeRoot?: string;
    commandRunner?: MachineCommandRunner;
    timeoutMs?: number;
  } = {}
): Promise<MachineCommandOutput> {
  if (options.commandRunner) {
    return options.commandRunner(command, args);
  }
  try {
    const result = await execFile(command, args, {
      encoding: "utf8",
      env: buildMachineEnv(options.homeRoot),
      timeout: options.timeoutMs ?? 5_000,
      maxBuffer: 8 * 1024 * 1024
    });
    return {
      code: 0,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    const payload = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof payload.code === "number" ? payload.code : 1,
      stdout: payload.stdout ?? "",
      stderr: payload.stderr ?? ""
    };
  }
}

export async function discoverMachineTools(options: {
  homeRoot?: string;
  commandRunner?: MachineCommandRunner;
  tools?: MachineToolRegistryEntry[];
} = {}): Promise<MachineToolDetection[]> {
  const homeRoot = resolveMachineHome(options.homeRoot);
  const packageManagerBinDirs = await resolvePackageManagerBinDirs(homeRoot, options.commandRunner);
  const tools = options.tools ?? MACHINE_SETUP_TOOL_REGISTRY;
  const detections: MachineToolDetection[] = [];
  for (const tool of tools) {
    detections.push(await detectMachineTool(tool, {
      homeRoot,
      ...(options.commandRunner ? { commandRunner: options.commandRunner } : {}),
      packageManagerBinDirs
    }));
  }
  return detections;
}

export async function detectMachineTool(
  tool: MachineToolRegistryEntry,
  options: {
    homeRoot?: string;
    commandRunner?: MachineCommandRunner;
    packageManagerBinDirs?: string[];
  } = {}
): Promise<MachineToolDetection> {
  const homeRoot = resolveMachineHome(options.homeRoot);
  const packageManagerBinDirs =
    options.packageManagerBinDirs ?? await resolvePackageManagerBinDirs(homeRoot, options.commandRunner);

  const whichResult = await runMachineCommand("which", [tool.name], {
    homeRoot,
    ...(options.commandRunner ? { commandRunner: options.commandRunner } : {}),
    timeoutMs: 2_000
  });
  const resolvedPath = firstNonEmptyLine(whichResult.stdout);
  if (resolvedPath) {
    return {
      ...tool,
      installed: true,
      version: await getBinaryVersion(resolvedPath, tool.versionArgs, homeRoot, options.commandRunner),
      path: resolvedPath,
      source: "path"
    };
  }

  const candidatePath = await firstExistingPath(resolveKnownToolCandidatePaths(tool.name, homeRoot, packageManagerBinDirs));
  if (candidatePath) {
    return {
      ...tool,
      installed: true,
      version: await getBinaryVersion(candidatePath, tool.versionArgs, homeRoot, options.commandRunner),
      path: candidatePath,
      source: "known-location"
    };
  }

  return {
    ...tool,
    installed: false,
    version: "—",
    path: null,
    source: "missing"
  };
}

export function resolveKnownToolCandidatePaths(
  toolName: string,
  homeRoot: string,
  packageManagerBinDirs: string[] = []
): string[] {
  const explicitLocal = [
    path.join(homeRoot, ".local", "bin", toolName),
    path.join(homeRoot, ".cargo", "bin", toolName),
    path.join(homeRoot, ".npm-global", "bin", toolName)
  ];
  const packageManagerBins = packageManagerBinDirs.map((dir) => path.join(dir, toolName));
  const sharedBins = [
    `/opt/homebrew/bin/${toolName}`,
    `/opt/homebrew/sbin/${toolName}`,
    `/usr/local/bin/${toolName}`,
    `/usr/local/sbin/${toolName}`,
    `/usr/bin/${toolName}`
  ];
  return [...new Set([...explicitLocal, ...packageManagerBins, ...sharedBins])];
}

async function resolvePackageManagerBinDirs(
  homeRoot: string,
  commandRunner?: MachineCommandRunner
): Promise<string[]> {
  const dirs = new Set<string>();

  const npmPrefix = firstNonEmptyLine(
    (
      await runMachineCommand("npm", ["config", "get", "prefix"], {
        homeRoot,
        ...(commandRunner ? { commandRunner } : {}),
        timeoutMs: 3_000
      })
    ).stdout
  );
  if (npmPrefix && npmPrefix !== "undefined") {
    dirs.add(path.join(npmPrefix, "bin"));
  }

  const pnpmBin = firstNonEmptyLine(
    (
      await runMachineCommand("pnpm", ["bin", "-g"], {
        homeRoot,
        ...(commandRunner ? { commandRunner } : {}),
        timeoutMs: 3_000
      })
    ).stdout
  );
  if (pnpmBin && pnpmBin !== "undefined") {
    dirs.add(pnpmBin);
  }

  const pnpmGlobalBin = firstNonEmptyLine(
    (
      await runMachineCommand("pnpm", ["config", "get", "global-bin-dir"], {
        homeRoot,
        ...(commandRunner ? { commandRunner } : {}),
        timeoutMs: 3_000
      })
    ).stdout
  );
  if (pnpmGlobalBin && pnpmGlobalBin !== "undefined") {
    dirs.add(pnpmGlobalBin);
  }

  return [...dirs];
}

async function firstExistingPath(paths: string[]): Promise<string | null> {
  for (const filePath of paths) {
    if (await pathExists(filePath)) {
      return filePath;
    }
  }
  return null;
}

async function getBinaryVersion(
  executablePath: string,
  versionArgs: string[] | undefined,
  homeRoot: string,
  commandRunner?: MachineCommandRunner
): Promise<string> {
  const candidates = [versionArgs ?? ["--version"], ["-V"], []];
  for (const args of candidates) {
    const result = await runMachineCommand(executablePath, args, {
      homeRoot,
      ...(commandRunner ? { commandRunner } : {}),
      timeoutMs: 3_000
    });
    const version = extractVersion(`${result.stdout}\n${result.stderr}`.trim());
    if (version) {
      return version;
    }
  }
  return "?";
}

function extractVersion(output: string): string | null {
  const normalized = stripAnsi(output);
  const match = normalized.match(/v?(\d+\.\d+(?:\.\d+)?(?:[-\w.]*)?)/);
  if (match?.[1]) {
    return match[1];
  }
  const line = firstNonEmptyLine(normalized);
  return line ? line.slice(0, 24) : null;
}

function firstNonEmptyLine(value: string): string | null {
  return value
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? null;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}
