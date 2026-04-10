import { createHash } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { ensureDir, pathExists, readText, writeText } from "../utils/fs.js";
import {
  AI_SETUP_GITIGNORE_ENTRIES,
  buildMachineSetupState,
  resolveGlobalHomeRoot,
  resolvePathBinRoot,
  resolveShellProfilePath,
  type MachineSetupActionId,
  type MachineSetupProfile
} from "./machine-setup.js";
import { resolveMachineHome } from "./machine-setup-detection.js";

const execFile = promisify(execFileCallback);

export interface MachineSetupActionResult {
  ok: boolean;
  changed: boolean;
  dryRun: boolean;
  actionId: MachineSetupActionId;
  targetRoot: string;
  changedFiles: string[];
  blockedReason: string | null;
  stdout: string;
  stderr: string;
  note: string;
}

export interface MachineSetupActionOptions {
  repoRoot: string;
  targetRoot: string;
  actionId: MachineSetupActionId;
  profile?: MachineSetupProfile;
  dryRun?: boolean;
  homeRoot?: string;
}

export async function applyMachineSetupAction(options: MachineSetupActionOptions): Promise<MachineSetupActionResult> {
  const dryRun = options.dryRun ?? false;
  const homeRoot = resolveMachineHome(options.homeRoot);
  const globalHomeRoot = resolveGlobalHomeRoot(homeRoot);
  const pathBinRoot = resolvePathBinRoot(homeRoot);
  const shellProfilePath = resolveShellProfilePath(homeRoot);
  const state = await buildMachineSetupState({
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    ...(options.profile ? { profile: options.profile } : {}),
    ...(options.homeRoot ? { homeRoot: options.homeRoot } : {})
  });
  const step = state.steps.find((entry) => entry.id === options.actionId) ?? null;
  if (!step) {
    return {
      ok: false,
      changed: false,
      dryRun,
      actionId: options.actionId,
      targetRoot: options.targetRoot,
      changedFiles: [],
      blockedReason: `Unknown setup action: ${options.actionId}`,
      stdout: "",
      stderr: "",
      note: "Kiwi does not know how to run this setup action."
    };
  }

  if (step.status === "ready") {
    return {
      ok: true,
      changed: false,
      dryRun,
      actionId: options.actionId,
      targetRoot: options.targetRoot,
      changedFiles: [],
      blockedReason: null,
      stdout: "",
      stderr: "",
      note: `${step.title} is already aligned.`
    };
  }

  if (step.status === "blocked") {
    return {
      ok: false,
      changed: false,
      dryRun,
      actionId: options.actionId,
      targetRoot: options.targetRoot,
      changedFiles: [],
      blockedReason: step.detail,
      stdout: "",
      stderr: "",
      note: `Kiwi cannot run ${step.title.toLowerCase()} automatically for this machine yet.`
    };
  }

  switch (options.actionId) {
    case "global-cli":
      return runScriptBackedAction({
        actionId: options.actionId,
        targetRoot: options.targetRoot,
        dryRun,
        scriptPath: path.join(options.repoRoot, "scripts", "install-global.sh"),
        scriptArgs: dryRun ? ["--dry-run"] : [],
        cwd: options.repoRoot,
        env: {
          HOME: homeRoot,
          KIWI_CONTROL_HOME: globalHomeRoot,
          KIWI_CONTROL_PATH_BIN: pathBinRoot
        },
        watchPaths: [
          path.join(globalHomeRoot, "bin", "kiwi-control"),
          path.join(globalHomeRoot, "bin", "kc"),
          path.join(globalHomeRoot, "bin", "shrey-junior"),
          path.join(globalHomeRoot, "bin", "sj"),
          path.join(globalHomeRoot, "bin", "sj-init"),
          path.join(globalHomeRoot, "specialists", "specialists.yaml"),
          path.join(globalHomeRoot, "policies", "policies.yaml"),
          path.join(globalHomeRoot, "mcp", "mcp.servers.json"),
          path.join(globalHomeRoot, "defaults", "bootstrap.yaml"),
          path.join(pathBinRoot, "kiwi-control"),
          path.join(pathBinRoot, "kc"),
          path.join(pathBinRoot, "shrey-junior"),
          path.join(pathBinRoot, "sj"),
          path.join(pathBinRoot, "sj-init"),
          shellProfilePath
        ],
        note: "Global Kiwi CLI wrappers, aliases, and defaults are managed by the existing installer script."
      });
    case "global-preferences":
      return runScriptBackedAction({
        actionId: options.actionId,
        targetRoot: options.targetRoot,
        dryRun,
        scriptPath: path.join(options.repoRoot, "scripts", "apply-global-preferences.sh"),
        scriptArgs: dryRun ? ["--dry-run"] : [],
        cwd: options.repoRoot,
        env: {
          HOME: homeRoot
        },
        watchPaths: [
          path.join(homeRoot, ".codex", "AGENTS.md"),
          path.join(homeRoot, ".codex", "config.toml"),
          path.join(homeRoot, ".claude", "CLAUDE.md"),
          path.join(homeRoot, ".claude", "settings.json"),
          path.join(homeRoot, ".claude", "commands", "shrey-read-first.md"),
          path.join(homeRoot, ".claude", "commands", "shrey-serious-task.md"),
          path.join(homeRoot, "Library", "Application Support", "Code", "User", "prompts", "shrey-junior.instructions.md"),
          path.join(homeRoot, "Library", "Application Support", "Code", "User", "mcp.json")
        ],
        note: "Machine-global preference overlays are still owned by the existing Kiwi preference script."
      });
    case "lean-ctx":
      return runCommandBackedAction({
        actionId: options.actionId,
        targetRoot: options.targetRoot,
        dryRun,
        command: "lean-ctx",
        args: ["init"],
        cwd: options.repoRoot,
        env: { HOME: homeRoot },
        watchPaths: [
          shellProfilePath,
          path.join(homeRoot, ".codex", "hooks", "lean-ctx-rewrite-codex.sh"),
          path.join(options.targetRoot, ".lean-ctx"),
          path.join(options.targetRoot, ".lean-ctx.toml")
        ],
        note: "lean-ctx initialization remains a wrapped tool action, not a repo runtime authority step."
      });
    case "repomix":
      return runCommandBackedAction({
        actionId: options.actionId,
        targetRoot: options.targetRoot,
        dryRun,
        command: "repomix",
        args: ["--compress", "--output", ".repomix-output.xml"],
        cwd: options.targetRoot,
        env: { HOME: homeRoot },
        watchPaths: [path.join(options.targetRoot, ".repomix-output.xml")],
        note: "repomix output is optional machine-accelerator context, not canonical runtime truth."
      });
    case "repo-assistant-wiring":
      return applyRepoAssistantWiring({
        targetRoot: options.targetRoot,
        dryRun,
        copilotInstalled: state.tools.some((entry) => entry.name === "copilot" && entry.installed)
      });
    case "repo-hygiene":
      return applyRepoHygiene({
        targetRoot: options.targetRoot,
        dryRun
      });
    default:
      return {
        ok: false,
        changed: false,
        dryRun,
        actionId: options.actionId,
        targetRoot: options.targetRoot,
        changedFiles: [],
        blockedReason: `${options.actionId} is orchestrated by the CLI setup flow rather than the machine-only action layer.`,
        stdout: "",
        stderr: "",
        note: "Use the CLI setup command to execute repo-contract or repo-graph actions."
      };
  }
}

async function runScriptBackedAction(options: {
  actionId: MachineSetupActionId;
  targetRoot: string;
  dryRun: boolean;
  scriptPath: string;
  scriptArgs: string[];
  cwd: string;
  env: Record<string, string>;
  watchPaths: string[];
  note: string;
}): Promise<MachineSetupActionResult> {
  return runCommandBackedAction({
    actionId: options.actionId,
    targetRoot: options.targetRoot,
    dryRun: options.dryRun,
    command: "bash",
    args: [options.scriptPath, ...options.scriptArgs],
    cwd: options.cwd,
    env: options.env,
    watchPaths: options.watchPaths,
    note: options.note
  });
}

async function runCommandBackedAction(options: {
  actionId: MachineSetupActionId;
  targetRoot: string;
  dryRun: boolean;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  watchPaths: string[];
  note: string;
}): Promise<MachineSetupActionResult> {
  const before = await snapshotPaths(options.watchPaths);
  if (options.dryRun) {
    return {
      ok: true,
      changed: false,
      dryRun: true,
      actionId: options.actionId,
      targetRoot: options.targetRoot,
      changedFiles: options.watchPaths,
      blockedReason: null,
      stdout: "",
      stderr: "",
      note: options.note
    };
  }

  const output = await execFile(options.command, options.args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...options.env
    },
    maxBuffer: 8 * 1024 * 1024
  }).then((result) => ({
    code: 0,
    stdout: result.stdout,
    stderr: result.stderr
  })).catch((error: { code?: number; stdout?: string; stderr?: string }) => ({
    code: typeof error.code === "number" ? error.code : 1,
    stdout: error.stdout ?? "",
    stderr: error.stderr ?? ""
  }));

  const after = await snapshotPaths(options.watchPaths);
  const changedFiles = collectChangedPaths(before, after);
  return {
    ok: output.code === 0,
    changed: changedFiles.length > 0,
    dryRun: false,
    actionId: options.actionId,
    targetRoot: options.targetRoot,
    changedFiles,
    blockedReason: output.code === 0 ? null : output.stderr.trim() || output.stdout.trim() || `${options.command} exited with ${output.code}`,
    stdout: output.stdout.trim(),
    stderr: output.stderr.trim(),
    note: options.note
  };
}

async function applyRepoAssistantWiring(options: {
  targetRoot: string;
  dryRun: boolean;
  copilotInstalled: boolean;
}): Promise<MachineSetupActionResult> {
  const omcDir = path.join(options.targetRoot, ".omc");
  const copilotPath = path.join(options.targetRoot, ".github", "copilot", "mcp.json");
  const watchPaths = [omcDir, copilotPath];
  const before = await snapshotPaths(watchPaths);
  if (options.dryRun) {
    return {
      ok: true,
      changed: false,
      dryRun: true,
      actionId: "repo-assistant-wiring",
      targetRoot: options.targetRoot,
      changedFiles: watchPaths,
      blockedReason: null,
      stdout: "",
      stderr: "",
      note: "Repo assistant compatibility wiring is previewable and idempotent."
    };
  }

  await ensureDir(omcDir);
  if (options.copilotInstalled && !(await pathExists(copilotPath))) {
    await ensureDir(path.dirname(copilotPath));
    await writeText(
      copilotPath,
      `${JSON.stringify({
        mcpServers: {
          "code-review-graph": {
            type: "local",
            command: "uvx",
            args: ["code-review-graph", "serve"],
            tools: ["*"]
          }
        }
      }, null, 2)}\n`
    );
  }

  const after = await snapshotPaths(watchPaths);
  return {
    ok: true,
    changed: collectChangedPaths(before, after).length > 0,
    dryRun: false,
    actionId: "repo-assistant-wiring",
    targetRoot: options.targetRoot,
    changedFiles: collectChangedPaths(before, after),
    blockedReason: null,
    stdout: "",
    stderr: "",
    note: "Repo assistant compatibility wiring is additive and does not change runtime authority."
  };
}

async function applyRepoHygiene(options: {
  targetRoot: string;
  dryRun: boolean;
}): Promise<MachineSetupActionResult> {
  const gitignorePath = path.join(options.targetRoot, ".gitignore");
  const before = await snapshotPaths([gitignorePath]);
  const existing = await pathExists(gitignorePath) ? await readText(gitignorePath) : "";
  const missing = AI_SETUP_GITIGNORE_ENTRIES.filter((entry) => !existing.includes(entry));
  if (missing.length === 0) {
    return {
      ok: true,
      changed: false,
      dryRun: options.dryRun,
      actionId: "repo-hygiene",
      targetRoot: options.targetRoot,
      changedFiles: [],
      blockedReason: null,
      stdout: "",
      stderr: "",
      note: "Repo hygiene entries are already present."
    };
  }

  if (options.dryRun) {
    return {
      ok: true,
      changed: false,
      dryRun: true,
      actionId: "repo-hygiene",
      targetRoot: options.targetRoot,
      changedFiles: [gitignorePath],
      blockedReason: null,
      stdout: "",
      stderr: "",
      note: `Would append ${missing.length} supported setup entries to .gitignore.`
    };
  }

  const separator = existing.endsWith("\n") || existing.length === 0 ? "" : "\n";
  const next = `${existing}${separator}${missing.join("\n")}\n`;
  await writeText(gitignorePath, next);
  const after = await snapshotPaths([gitignorePath]);
  return {
    ok: true,
    changed: collectChangedPaths(before, after).length > 0,
    dryRun: false,
    actionId: "repo-hygiene",
    targetRoot: options.targetRoot,
    changedFiles: collectChangedPaths(before, after),
    blockedReason: null,
    stdout: "",
    stderr: "",
    note: "Repo hygiene only appends missing supported setup entries."
  };
}

async function snapshotPaths(paths: string[]): Promise<Map<string, string>> {
  const snapshots = new Map<string, string>();
  for (const filePath of paths) {
    snapshots.set(filePath, await fingerprintPath(filePath));
  }
  return snapshots;
}

function collectChangedPaths(before: Map<string, string>, after: Map<string, string>): string[] {
  const changed: string[] = [];
  for (const [filePath, next] of after.entries()) {
    if ((before.get(filePath) ?? "missing") !== next) {
      changed.push(filePath);
    }
  }
  return changed;
}

async function fingerprintPath(filePath: string): Promise<string> {
  if (!(await pathExists(filePath))) {
    return "missing";
  }

  const stat = await fs.stat(filePath);
  if (stat.isDirectory()) {
    const entries = await fs.readdir(filePath);
    return `dir:${entries.sort().join("|")}`;
  }

  const content = await fs.readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}
