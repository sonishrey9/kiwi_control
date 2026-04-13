#!/usr/bin/env node
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const pkgPath = readFlagValue(argv, "--pkg-path")
  ?? await findDefaultPkg();

if (process.platform !== "darwin") {
  console.log("macOS pkg verification requires a macOS host.");
  process.exit(0);
}

assert.ok(pkgPath, "Built macOS pkg installer not found. Run npm run ui:desktop:build:release on a macOS host first.");

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-pkg-verify-"));
const dmgPath = path.join(tempDir, "target.dmg");
const mountPoint = path.join(tempDir, "mount");
await fs.mkdir(mountPoint, { recursive: true });

try {
  run("hdiutil", ["create", "-size", "2g", "-fs", "APFS", "-volname", "KiwiPkgTest", dmgPath]);
  run("hdiutil", ["attach", dmgPath, "-nobrowse", "-mountpoint", mountPoint]);
  const install = await runInstallerOrSimulate(pkgPath, mountPoint);
  if (!install.ok) {
    throw new Error(install.error);
  }

  const appPath = path.join(mountPoint, "Applications", "Kiwi Control.app");
  const receiptPath = path.join(mountPoint, "Library", "Application Support", "Kiwi Control", "desktop-cli-install.json");
  const commandPath = path.join(mountPoint, "usr", "local", "bin", "kc");

  await fs.access(appPath);
  await fs.access(receiptPath);
  await fs.access(commandPath);

  const receipt = JSON.parse(await fs.readFile(receiptPath, "utf8"));
  assert.equal(receipt.installScope, "machine");
  assert.equal(receipt.verificationStatus, "passed");

  const shellResult = spawnSync("/bin/zsh", [
    "-lc",
    `export PATH="${path.join(mountPoint, "usr", "local", "bin")}:$PATH"; resolved="$(command -v kc)"; printf '%s\\n' "$resolved"; kc --help >/dev/null`
  ], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.equal(shellResult.status, 0, shellResult.stderr || shellResult.stdout);

  const resolvedPath = shellResult.stdout.trim().split(/\r?\n/).at(-1) ?? "";
  assert.match(resolvedPath, new RegExp(`^${escapeForRegex(commandPath)}$`));

  console.log(JSON.stringify({
    ok: true,
    verificationMode: install.mode,
    pkgPath,
    appPath,
    receiptPath,
    commandPath,
    verificationStatus: receipt.verificationStatus
  }, null, 2));
} finally {
  spawnSync("hdiutil", ["detach", mountPoint], { stdio: "ignore" });
  await fs.rm(tempDir, { recursive: true, force: true });
}

function readFlagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) {
    return null;
  }
  return args[index + 1] ?? null;
}

async function findDefaultPkg() {
  const pkgDir = path.join(repoRoot, "apps", "sj-ui", "src-tauri", "target", "release", "bundle", "pkg");
  const entries = await fs.readdir(pkgDir).catch(() => []);
  return entries
    .filter((entry) => entry.endsWith(".pkg") && !entry.startsWith("._"))
    .map((entry) => path.join(pkgDir, entry))
    .sort()
    .at(0) ?? null;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.error) {
    throw result.error;
  }
  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} ${args.join(" ")} failed`);
  }
}

function runInstaller(pkgPath, mountPoint) {
  const direct = spawnSync("installer", ["-pkg", pkgPath, "-target", mountPoint], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if ((direct.status ?? 1) === 0) {
    return { ok: true };
  }

  const combined = `${direct.stderr || ""}${direct.stdout || ""}`;
  if (!combined.includes("Must be run as root")) {
    return {
      ok: false,
      error: combined || "installer failed"
    };
  }

  const sudoCheck = spawnSync("sudo", ["-n", "true"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if ((sudoCheck.status ?? 1) !== 0) {
    return {
      ok: false,
      error: `${combined}\nsudo -n installer is unavailable on this machine.`
    };
  }

  const elevated = spawnSync("sudo", ["-n", "installer", "-pkg", pkgPath, "-target", mountPoint], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if ((elevated.status ?? 1) !== 0) {
    return {
      ok: false,
      error: elevated.stderr || elevated.stdout || "sudo installer failed"
    };
  }

  return { ok: true };
}

async function runInstallerOrSimulate(pkgPath, mountPoint) {
  const direct = runInstaller(pkgPath, mountPoint);
  if (direct.ok) {
    return {
      ok: true,
      mode: "installer"
    };
  }

  if (!direct.error.includes("Must be run as root")) {
    return direct;
  }

  const expandedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-pkg-expand-"));
  const expandedDir = path.join(expandedRoot, "expanded");
  try {
    run("pkgutil", ["--expand-full", pkgPath, expandedDir]);
    const payloadAppPath = path.join(expandedDir, "Payload", "Applications", "Kiwi Control.app");
    await fs.mkdir(path.join(mountPoint, "Applications"), { recursive: true });
    await fs.cp(payloadAppPath, path.join(mountPoint, "Applications", "Kiwi Control.app"), { recursive: true });
    run("/bin/bash", [path.join(expandedDir, "Scripts", "postinstall"), pkgPath, "/", mountPoint]);
    return {
      ok: true,
      mode: "simulated-postinstall"
    };
  } finally {
    await fs.rm(expandedRoot, { recursive: true, force: true });
  }
}

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
