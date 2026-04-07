import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { removeMacMetadataArtifacts } from "./remove-macos-metadata.mjs";
import { stageDesktopInstallerResources } from "./stage-cli-bundle.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntrypoint = path.join(repoRoot, "packages", "sj-cli", "dist", "cli.js");
const uiRoot = path.join(repoRoot, "apps", "sj-ui");
const tauriRoot = path.join(uiRoot, "src-tauri");
const repoTargetDir = path.join(tauriRoot, "target");
const repoBundleDir = path.join(repoTargetDir, "release", "bundle");
const installerResourcesDir = path.join(tauriRoot, "resources", "desktop");

await main();

async function main() {
  if (!existsSync(cliEntrypoint)) {
    console.error("Kiwi Control desktop packaging needs the local CLI build. Run `npm run build` first.");
    process.exit(1);
  }

  const cargoExecutable = process.platform === "win32" ? "cargo.exe" : "cargo";
  const cargoCheck = spawnSync(cargoExecutable, ["--version"], {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8"
  });

  if (cargoCheck.status !== 0) {
    console.error("Kiwi Control desktop packaging requires Rust/Cargo. Install Rust first, then rerun `npm run ui:desktop:build`.");
    process.exit(1);
  }

  const removedMetadataCount = await removeMacMetadataArtifacts(uiRoot);
  if (removedMetadataCount > 0) {
    console.log(`Sanitized ${removedMetadataCount} macOS metadata artifact${removedMetadataCount === 1 ? "" : "s"} before building Kiwi Control.`);
  }

  await stageDesktopInstallerResources({
    repoRoot,
    resourcesRoot: installerResourcesDir,
    nodeBinaryPath: process.execPath
  });

  const cargoTargetDir = await resolveCargoTargetDir();
  await killRunningDesktopBundles(cargoTargetDir);
  await fs.rm(cargoTargetDir, { recursive: true, force: true });

  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
  const tauriArgs = withDefaultDesktopBundleArgs(process.argv.slice(2));
  let cleanupInterval = null;
  const child = spawn(npmExecutable, ["run", "tauri:build", "-w", "@shrey-junior/sj-ui", ...tauriArgs], {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      KIWI_CONTROL_CLI: cliEntrypoint,
      SHREY_JUNIOR_CLI: cliEntrypoint,
      CARGO_TARGET_DIR: cargoTargetDir,
      COPYFILE_DISABLE: "1",
      COPY_EXTENDED_ATTRIBUTES_DISABLE: "1"
    }
  });

  cleanupInterval = setInterval(() => {
    void removeMacMetadataArtifacts(cargoTargetDir).catch(() => null);
  }, 500);

  child.on("exit", async (code, signal) => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    if (code === 0) {
      await syncBundleArtifacts(cargoTargetDir);
      const bundleRoot = path.join(repoTargetDir, "release", "bundle", "macos", "Kiwi Control.app");
      if (existsSync(bundleRoot)) {
        console.log(`Built Kiwi Control desktop bundle at ${bundleRoot}`);
      }
    }

    process.exit(code ?? 1);
  });
}

async function resolveCargoTargetDir() {
  const explicitTargetDir = process.env.KIWI_CONTROL_CARGO_TARGET_DIR?.trim();
  if (explicitTargetDir) {
    return explicitTargetDir;
  }

  if (process.platform === "darwin") {
    const tmpRoot = await fs.realpath(os.tmpdir()).catch(() => os.tmpdir());
    return path.join(tmpRoot, "kiwi-control-tauri-target");
  }

  return repoTargetDir;
}

function withDefaultDesktopBundleArgs(args) {
  if (args.some((arg) => arg === "--bundles" || arg.startsWith("--bundles="))) {
    return args;
  }

  return [...args, "--", "--bundles", "app"];
}

async function syncBundleArtifacts(cargoTargetDir) {
  if (cargoTargetDir === repoTargetDir) {
    return;
  }

  const stagedBundleDir = path.join(cargoTargetDir, "release", "bundle");
  if (!existsSync(stagedBundleDir)) {
    return;
  }

  await fs.rm(repoBundleDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(repoBundleDir), { recursive: true });
  await fs.cp(stagedBundleDir, repoBundleDir, { recursive: true });
  await removeMacMetadataArtifacts(repoBundleDir);
}

async function killRunningDesktopBundles(cargoTargetDir) {
  if (process.platform !== "darwin") {
    return;
  }

  const stagedExecutable = path.join(
    cargoTargetDir,
    "release",
    "bundle",
    "macos",
    "Kiwi Control.app",
    "Contents",
    "MacOS",
    "sj-ui"
  );
  const repoExecutable = path.join(
    repoBundleDir,
    "macos",
    "Kiwi Control.app",
    "Contents",
    "MacOS",
    "sj-ui"
  );

  for (const executablePath of new Set([repoExecutable, stagedExecutable])) {
    spawnSync("pkill", ["-f", executablePath], { stdio: "ignore" });
  }

  await new Promise((resolve) => setTimeout(resolve, 400));
}
