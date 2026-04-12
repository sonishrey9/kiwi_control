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
const scope = readFlagValue(argv, "--scope") ?? "machine";

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

  if (platform === "macos" || platform === "darwin") {
    if (process.platform !== "darwin") {
      console.log("Bundled CLI install verification for macOS requires a macOS host.");
      return;
    }
    await verifyMacosInstall(staged, scope);
    console.log("Bundled CLI install verification passed for macOS.");
    return;
  }

  if (platform === "windows") {
    const content = await fs.readFile(installPs1Path, "utf8");
    assert.match(content, /\[string\]\$InstallScope/);
    assert.match(content, /Join-Path \$GlobalHome "bin"/);
    assert.match(content, /KIWI_CONTROL_NODE_ABSOLUTE/);
    assert.match(content, /SetEnvironmentVariable\("Path", .*"Machine"\)/);
    assert.match(content, /ResultPath/);
    console.log("Bundled CLI install verification passed for Windows installer scaffolding.");
    return;
  }

  console.log(`Bundled CLI install verification is not implemented for platform ${platform}.`);
}

async function verifyMacosInstall(staged, installScope) {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-bundled-cli-home-"));
  const tempMachineRoot = path.join(tempHome, "Library", "Application Support", "Kiwi Control");
  const tempBin = path.join(tempHome, "usr-local-bin");
  const resultPath = path.join(tempHome, "install-result.json");
  const result = spawnSync("/bin/bash", [path.join(staged.cliBundlePath, "install.sh")], {
    cwd: staged.cliBundlePath,
    env: {
      ...process.env,
      HOME: tempHome,
      KIWI_CONTROL_HOME: path.join(tempHome, ".kiwi-control"),
      KIWI_CONTROL_INSTALL_SCOPE: installScope,
      KIWI_CONTROL_INSTALL_ROOT: tempMachineRoot,
      KIWI_CONTROL_PATH_BIN: tempBin,
      KIWI_CONTROL_NODE_ABSOLUTE: staged.stagedNodePath,
      KIWI_CONTROL_RESULT_PATH: resultPath
    },
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const kcPath = path.join(tempBin, "kc");
  await fs.access(kcPath);
  const resultPayload = JSON.parse(await fs.readFile(resultPath, "utf8"));
  assert.equal(resultPayload.installScope, installScope);
  assert.equal(resultPayload.pathChanged, false);
  const helpResult = spawnSync("/bin/zsh", ["-lic", `export PATH="${tempBin}:$PATH"; resolved="$(command -v kc)"; printf '%s\\n' "$resolved"; kc --help >/dev/null`], {
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
  const resolvedPath = helpResult.stdout.trim().split(/\r?\n/).at(-1) ?? "";
  assert.match(resolvedPath, new RegExp(`^${escapeForRegex(tempBin)}/kc$`));
  const shellProfilePath = path.join(tempHome, ".zshrc");
  const profileExists = await fs.access(shellProfilePath).then(() => true).catch(() => false);
  assert.equal(profileExists, false);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});

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
