#!/usr/bin/env node
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stageDesktopInstallerResources } from "./stage-cli-bundle.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const platformFlag = process.argv[2] === "--platform" ? process.argv[3] : null;
const platform = platformFlag ?? process.platform;

async function main() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-bundled-cli-"));
  const resourcesRoot = path.join(tempDir, "resources");
  const staged = await stageDesktopInstallerResources({
    repoRoot,
    resourcesRoot,
    nodeBinaryPath: process.execPath
  });

  const installShPath = path.join(staged.cliBundlePath, "install.sh");
  const installPs1Path = path.join(staged.cliBundlePath, "install.ps1");
  await fs.access(installShPath);
  await fs.access(installPs1Path);

  if (platform === "macos" || (platform === "darwin" && process.platform === "darwin")) {
    await verifyMacosInstall(staged);
    console.log("Bundled CLI install verification passed for macOS.");
    return;
  }

  if (platform === "windows") {
    const content = await fs.readFile(installPs1Path, "utf8");
    assert.match(content, /Join-Path \$GlobalHome "bin"/);
    assert.match(content, /KIWI_CONTROL_NODE_ABSOLUTE/);
    assert.match(content, /SetEnvironmentVariable\("Path", .*"User"\)/);
    console.log("Bundled CLI install verification passed for Windows installer scaffolding.");
    return;
  }

  console.log(`Bundled CLI install verification is not implemented for platform ${platform}.`);
}

async function verifyMacosInstall(staged) {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-bundled-cli-home-"));
  const tempBin = path.join(tempHome, ".local", "bin");
  const result = spawnSync("/bin/bash", [path.join(staged.cliBundlePath, "install.sh")], {
    cwd: staged.cliBundlePath,
    env: {
      ...process.env,
      HOME: tempHome,
      KIWI_CONTROL_HOME: path.join(tempHome, ".kiwi-control"),
      KIWI_CONTROL_PATH_BIN: tempBin,
      KIWI_CONTROL_NODE_ABSOLUTE: staged.stagedNodePath
    },
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const kcPath = path.join(tempBin, "kc");
  await fs.access(kcPath);
  const helpResult = spawnSync(kcPath, ["--help"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOME: tempHome,
      KIWI_CONTROL_HOME: path.join(tempHome, ".kiwi-control"),
      KIWI_CONTROL_PATH_BIN: tempBin
    },
    encoding: "utf8"
  });

  assert.equal(helpResult.status, 0, helpResult.stderr || helpResult.stdout);
  assert.match(helpResult.stdout, /Kiwi Control/);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
