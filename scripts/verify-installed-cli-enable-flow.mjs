#!/usr/bin/env node
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stageDesktopInstallerResources } from "./stage-cli-bundle.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const platform = readFlagValue(argv, "--platform") ?? process.platform;
const realMachinePath = argv.includes("--real-machine-path");

await main();

async function main() {
  if (platform === "macos" || platform === "darwin") {
    if (process.platform !== "darwin") {
      console.log("macOS installed-app CLI enablement requires a macOS host.");
      return;
    }
    if (realMachinePath) {
      await verifyMacosRealMachinePath();
      console.log("Installed-app machine-wide CLI verification passed for macOS real-machine-path mode.");
      return;
    }
    await verifyMacosDeterministic();
    console.log("Installed-app machine-wide CLI verification passed for macOS deterministic mode.");
    return;
  }

  if (platform === "windows") {
    if (process.platform !== "win32") {
      console.log("Windows installed-app CLI enablement requires a Windows runner or Windows machine.");
      return;
    }
    await verifyWindowsRealMachinePath();
    console.log("Installed-app machine-wide CLI verification passed for Windows real-machine-path mode.");
    return;
  }

  console.log(`Installed-app CLI enablement verification is not implemented for platform ${platform}.`);
}

async function verifyMacosDeterministic() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-installed-cli-flow-"));
  const appResources = path.join(tempDir, "Kiwi Control.app", "Contents", "Resources", "desktop");
  const tempMachineRoot = path.join(tempDir, "Library", "Application Support", "Kiwi Control");
  const tempBin = path.join(tempDir, "usr-local-bin");
  const resultPath = path.join(tempDir, "cli-enable-result.json");

  const staged = await stageDesktopInstallerResources({
    repoRoot,
    resourcesRoot: appResources,
    nodeBinaryPath: process.execPath
  });

  const installPath = path.join(staged.cliBundlePath, "install.sh");
  const result = spawnSync("/bin/bash", [installPath], {
    cwd: staged.cliBundlePath,
    env: {
      ...process.env,
      HOME: tempDir,
      KIWI_CONTROL_INSTALL_SCOPE: "machine",
      KIWI_CONTROL_INSTALL_ROOT: tempMachineRoot,
      KIWI_CONTROL_PATH_BIN: tempBin,
      KIWI_CONTROL_NODE_ABSOLUTE: staged.stagedNodePath,
      KIWI_CONTROL_RESULT_PATH: resultPath
    },
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(await fs.readFile(resultPath, "utf8"));
  assert.equal(payload.installScope, "machine");
  assert.equal(payload.installBinDir, tempBin);
  const shellResult = spawnSync("/bin/zsh", ["-lic", `export PATH="${tempBin}:$PATH"; resolved="$(command -v kc)"; printf '%s\\n' "$resolved"; kc --help >/dev/null`], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOME: tempDir,
      KIWI_CONTROL_PATH_BIN: tempBin
    },
    encoding: "utf8"
  });
  assert.equal(shellResult.status, 0, shellResult.stderr || shellResult.stdout);
  const resolvedPath = shellResult.stdout.trim().split(/\r?\n/).at(-1) ?? "";
  assert.match(resolvedPath, new RegExp(`^${escapeForRegex(tempBin)}/kc$`));
}

async function verifyMacosRealMachinePath() {
  const bundleRoot = path.join(
    repoRoot,
    "apps",
    "sj-ui",
    "src-tauri",
    "target",
    "release",
    "bundle",
    "macos",
    "Kiwi Control.app",
    "Contents",
    "Resources",
    "desktop",
    "cli-bundle"
  );
  const installPath = path.join(bundleRoot, "install.sh");
  await fs.access(installPath);
  const resultPath = path.join(os.tmpdir(), "kiwi-real-machine-cli-enable.json");
  const bundledNodePath = path.join(
    repoRoot,
    "apps",
    "sj-ui",
    "src-tauri",
    "target",
    "release",
    "bundle",
    "macos",
    "Kiwi Control.app",
    "Contents",
    "Resources",
    "desktop",
    "node",
    "node"
  );

  let commandLine = [
    `export KIWI_CONTROL_INSTALL_SCOPE=${shellQuote("machine")}`,
    `export KIWI_CONTROL_INSTALL_ROOT=${shellQuote("/Library/Application Support/Kiwi Control")}`,
    `export KIWI_CONTROL_PATH_BIN=${shellQuote("/usr/local/bin")}`,
    `export KIWI_CONTROL_RESULT_PATH=${shellQuote(resultPath)}`
  ];
  if (await fs.access(bundledNodePath).then(() => true).catch(() => false)) {
    commandLine.unshift(`export KIWI_CONTROL_NODE_ABSOLUTE=${shellQuote(bundledNodePath)}`);
  }
  commandLine.push(`/bin/bash ${shellQuote(installPath)}`);

  const result = spawnSync("osascript", [
    "-e",
    `do shell script ${appleScriptStringLiteral(commandLine.join("; "))} with administrator privileges`
  ], {
    cwd: bundleRoot,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const shellResult = spawnSync("/bin/zsh", ["-lic", "command -v kc && kc --help >/dev/null"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.equal(shellResult.status, 0, shellResult.stderr || shellResult.stdout);
}

async function verifyWindowsRealMachinePath() {
  const bundleRoot = path.join(repoRoot, "apps", "sj-ui", "src-tauri", "target", "release", "bundle");
  const installerPath = await findFirstMatchingFile(path.join(bundleRoot, "nsis"), (entry) => entry.toLowerCase().endsWith(".exe"));
  assert.ok(installerPath, "Built Windows NSIS installer not found. Run npm run ui:desktop:build on a Windows host first.");

  const installResult = spawnSync(installerPath, ["/S"], {
    cwd: path.dirname(installerPath),
    encoding: "utf8"
  });
  assert.equal(installResult.status, 0, installResult.stderr || installResult.stdout);

  const receiptPath = await findWindowsCliReceipt();
  if (receiptPath) {
    const payload = JSON.parse(await fs.readFile(receiptPath, "utf8"));
    assert.match(payload.installScope, /^(machine|user)$/);
    assert.match(String(payload.installBinDir ?? ""), /Kiwi Control|\.kiwi-control/i);
    assert.equal(payload.verificationStatus, "passed");
  } else {
    console.warn("Windows installer did not leave a CLI receipt; continuing with live kc --help verification.");
  }

  const powerShellResult = spawnSync("powershell.exe", [
    "-NoProfile",
    "-Command",
    "$machine = [Environment]::GetEnvironmentVariable('Path', 'Machine'); " +
      "$user = [Environment]::GetEnvironmentVariable('Path', 'User'); " +
      "$env:Path = @($machine, $user) -join ';'; " +
      "$command = Get-Command kc -ErrorAction Stop; " +
      "& $command.Source --help | Out-Null; " +
      "Write-Output $command.Source"
  ], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.equal(powerShellResult.status, 0, powerShellResult.stderr || powerShellResult.stdout);
  const resolvedCommandPath = powerShellResult.stdout.trim().split(/\r?\n/).at(-1) ?? "";
  assert.match(resolvedCommandPath, /\\kc\.cmd$/i);

  const cmdResult = spawnSync("cmd.exe", ["/d", "/c", "kc --help"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.equal(cmdResult.status, 0, cmdResult.stderr || cmdResult.stdout);

  const installDir = await findWindowsDesktopInstallDir();
  assert.ok(installDir, "Windows desktop install directory not found after NSIS install.");
  const uninstallerPath = await findFirstMatchingFile(installDir, (entry) => /uninstall.*\.exe$/i.test(entry));
  assert.ok(uninstallerPath, "Windows uninstaller not found after NSIS install.");
  const uninstallResult = spawnSync(uninstallerPath, ["/S"], {
    cwd: installDir,
    encoding: "utf8"
  });
  assert.equal(uninstallResult.status, 0, uninstallResult.stderr || uninstallResult.stdout);

  const postUninstallPowerShell = spawnSync("powershell.exe", [
    "-NoProfile",
    "-Command",
    "$machine = [Environment]::GetEnvironmentVariable('Path', 'Machine'); " +
      "$user = [Environment]::GetEnvironmentVariable('Path', 'User'); " +
      "$env:Path = @($machine, $user) -join ';'; " +
      "if (Get-Command kc -ErrorAction SilentlyContinue) { exit 1 }"
  ], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.equal(postUninstallPowerShell.status, 0, postUninstallPowerShell.stderr || postUninstallPowerShell.stdout);
}

async function findWindowsCliReceipt() {
  const candidates = [
    path.join(process.env.ProgramData ?? "C:\\ProgramData", "Kiwi Control", "desktop-cli-install.json"),
    path.join(os.homedir(), ".kiwi-control", "desktop-cli-install.json")
  ];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function findWindowsDesktopInstallDir() {
  const candidates = [
    path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Kiwi Control"),
    path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Kiwi Control"),
    path.join(process.env.LocalAppData ?? path.join(os.homedir(), "AppData", "Local"), "Programs", "Kiwi Control"),
    path.join(process.env.LocalAppData ?? path.join(os.homedir(), "AppData", "Local"), "Kiwi Control")
  ];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function appleScriptStringLiteral(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function readFlagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) {
    return null;
  }
  return args[index + 1] ?? null;
}

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findFirstMatchingFile(directory, predicate) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const match = entries.find((entry) => entry.isFile() && predicate(entry.name));
  return match ? path.join(directory, match.name) : null;
}

async function fileExists(candidate) {
  return fs.access(candidate).then(() => true).catch(() => false);
}
