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
    console.log("Windows installed-app CLI enablement verification should run on a Windows runner with machine PATH privileges.");
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
  const shellResult = spawnSync("/bin/zsh", ["-lic", "command -v kc && kc --help >/dev/null"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOME: tempDir,
      PATH: `${tempBin}:${process.env.PATH ?? "/usr/bin:/bin"}`,
      KIWI_CONTROL_PATH_BIN: tempBin
    },
    encoding: "utf8"
  });
  assert.equal(shellResult.status, 0, shellResult.stderr || shellResult.stdout);
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
  const result = spawnSync("/bin/bash", [installPath], {
    cwd: bundleRoot,
    env: {
      ...process.env,
      KIWI_CONTROL_INSTALL_SCOPE: "machine",
      KIWI_CONTROL_INSTALL_ROOT: "/Library/Application Support/Kiwi Control",
      KIWI_CONTROL_PATH_BIN: "/usr/local/bin",
      KIWI_CONTROL_RESULT_PATH: resultPath
    },
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const shellResult = spawnSync("/bin/zsh", ["-lic", "command -v kc && kc --help >/dev/null"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.equal(shellResult.status, 0, shellResult.stderr || shellResult.stdout);
}

function readFlagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) {
    return null;
  }
  return args[index + 1] ?? null;
}
