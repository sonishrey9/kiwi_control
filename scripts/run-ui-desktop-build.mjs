import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { removeMacMetadataArtifacts } from "./remove-macos-metadata.mjs";
import { prepareRuntimeSidecar } from "./prepare-runtime-sidecar.mjs";
import { stageDesktopInstallerResources } from "./stage-cli-bundle.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntrypoint = path.join(repoRoot, "packages", "sj-cli", "dist", "cli.js");
const uiRoot = path.join(repoRoot, "apps", "sj-ui");
const tauriRoot = path.join(uiRoot, "src-tauri");
const repoTargetDir = path.join(tauriRoot, "target");
const repoBundleDir = path.join(repoTargetDir, "release", "bundle");
const installerResourcesDir = path.join(tauriRoot, "resources", "desktop");
const defaultReleaseConfigPath = path.join(tauriRoot, "tauri.release.conf.json");

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
  await prepareRuntimeSidecar({
    repoRoot,
    cargoTargetDir: path.join(cargoTargetDir, "runtime-sidecar")
  });
  await killRunningDesktopBundles(cargoTargetDir);
  await fs.rm(cargoTargetDir, { recursive: true, force: true });

  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
  const tauriArgs = await withDefaultDesktopBundleArgs(process.argv.slice(2));
  const requestedBundles = extractRequestedBundles(tauriArgs);
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
      const verifyArtifacts = spawnSync(
        process.execPath,
        [
          path.join(repoRoot, "scripts", "verify-release-artifacts.mjs"),
          "--platform",
          normalizePlatform(process.platform),
          ...(requestedBundles ? ["--bundles", requestedBundles] : [])
        ],
        {
          cwd: repoRoot,
          stdio: "inherit",
          env: process.env
        }
      );
      if (verifyArtifacts.error) {
        throw verifyArtifacts.error;
      }
      if ((verifyArtifacts.status ?? 1) !== 0) {
        process.exit(verifyArtifacts.status ?? 1);
        return;
      }
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

async function withDefaultDesktopBundleArgs(args) {
  const nextArgs = [...args];
  const hasForwardedArgs = nextArgs.includes("--");
  const effectiveForwardedArgs = hasForwardedArgs ? nextArgs.slice(nextArgs.indexOf("--") + 1) : nextArgs;

  if (!effectiveForwardedArgs.some((arg) => arg === "--config")) {
    const configPath = await resolveReleaseConfigPath();
    effectiveForwardedArgs.push("--config", configPath);
  }

  if (!effectiveForwardedArgs.some((arg) => arg === "--bundles" || arg.startsWith("--bundles="))) {
    effectiveForwardedArgs.push("--bundles", defaultBundleForPlatform());
  }

  return ["--", ...effectiveForwardedArgs];
}

function defaultBundleForPlatform() {
  switch (process.platform) {
    case "darwin":
      return "app,dmg";
    case "win32":
      return "nsis,msi";
    case "linux":
      return "appimage";
    default:
      return "app";
  }
}

async function resolveReleaseConfigPath() {
  const extraConfigPath = process.env.KIWI_CONTROL_TAURI_EXTRA_CONFIG?.trim();
  if (!extraConfigPath) {
    return defaultReleaseConfigPath;
  }

  const mergedPath = path.join(await resolveCargoTargetDir(), "release-config", "tauri.release.merged.json");
  await fs.mkdir(path.dirname(mergedPath), { recursive: true });
  const merged = deepMerge(
    JSON.parse(await fs.readFile(defaultReleaseConfigPath, "utf8")),
    JSON.parse(await fs.readFile(extraConfigPath, "utf8"))
  );
  await fs.writeFile(mergedPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return mergedPath;
}

function deepMerge(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return right;
  }
  if (isRecord(left) && isRecord(right)) {
    const merged = { ...left };
    for (const [key, value] of Object.entries(right)) {
      merged[key] = key in merged ? deepMerge(merged[key], value) : value;
    }
    return merged;
  }
  return right;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizePlatform(value) {
  switch (value) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    case "linux":
      return "linux";
    default:
      return value;
  }
}

function extractRequestedBundles(args) {
  const bundleIndex = args.findIndex((arg) => arg === "--bundles");
  if (bundleIndex >= 0) {
    return args[bundleIndex + 1] ?? null;
  }
  const inline = args.find((arg) => arg.startsWith("--bundles="));
  return inline ? inline.slice("--bundles=".length) : null;
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
