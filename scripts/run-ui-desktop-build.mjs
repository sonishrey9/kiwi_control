import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./load-local-env.mjs";
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
const workspacePackage = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));

loadLocalEnv({ envPath: path.join(repoRoot, ".env") });

if (process.platform === "darwin") {
  process.umask(0o022);
}

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

  const tauriArgs = await withDefaultDesktopBundleArgs(process.argv.slice(2));
  const requestedBundles = extractRequestedBundles(tauriArgs);
  let cleanupInterval = null;
  const childEnv = sanitizeChildEnv({
    ...process.env,
    KIWI_CONTROL_CLI: cliEntrypoint,
    SHREY_JUNIOR_CLI: cliEntrypoint,
    CARGO_TARGET_DIR: cargoTargetDir,
    COPYFILE_DISABLE: "1",
    COPY_EXTENDED_ATTRIBUTES_DISABLE: "1"
  });
  const npmCliPath = process.env.npm_execpath?.trim();
  const npmCommand = process.platform === "win32" && npmCliPath
    ? process.execPath
    : process.platform === "win32"
      ? "npm.cmd"
      : "npm";
  const npmArgs = process.platform === "win32" && npmCliPath
    ? [npmCliPath, "run", "tauri:build", "-w", "@shrey-junior/sj-ui", ...tauriArgs]
    : ["run", "tauri:build", "-w", "@shrey-junior/sj-ui", ...tauriArgs];
  const child = spawn(npmCommand, npmArgs, {
        cwd: repoRoot,
        stdio: "inherit",
        env: childEnv
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
      const macosAppPath = path.join(repoBundleDir, "macos", "Kiwi Control.app");
      await removeMacMetadataArtifacts(macosAppPath);
      await normalizeMacosBundlePermissions(macosAppPath);
      await repairMacosBetaBundleIfNeeded();
      await packageMacosPkgIfNeeded();
      const verifyBundleSpec = requestedBundles
        ? process.platform === "darwin" && !requestedBundles.split(",").includes("pkg")
          ? `${requestedBundles},pkg`
          : requestedBundles
        : requestedBundles;
      const verifyArtifacts = spawnSync(
        process.execPath,
        [
          path.join(repoRoot, "scripts", "verify-release-artifacts.mjs"),
          "--platform",
          normalizePlatform(process.platform),
          ...(verifyBundleSpec ? ["--bundles", verifyBundleSpec] : [])
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

async function normalizeMacosBundlePermissions(appPath) {
  if (process.platform !== "darwin" || !existsSync(appPath)) {
    return;
  }

  await walkAndNormalize(appPath, appPath);
}

async function walkAndNormalize(rootPath, currentPath) {
  const stats = await fs.stat(currentPath);
  if (stats.isDirectory()) {
    await fs.chmod(currentPath, 0o755);
    const entries = await fs.readdir(currentPath);
    for (const entry of entries) {
      await walkAndNormalize(rootPath, path.join(currentPath, entry));
    }
    return;
  }

  await fs.chmod(currentPath, shouldRemainExecutable(rootPath, currentPath) ? 0o755 : 0o644);
}

function shouldRemainExecutable(rootPath, currentPath) {
  const relativePath = path.relative(rootPath, currentPath).replace(/\\/g, "/");
  if (relativePath.startsWith("Contents/MacOS/")) {
    return true;
  }
  if (relativePath.startsWith("Contents/Resources/desktop/node/")) {
    return true;
  }
  if (relativePath.startsWith("Contents/Resources/desktop/cli-bundle/bin/")) {
    return true;
  }
  if (relativePath.endsWith("/install.sh")) {
    return true;
  }
  if (relativePath.endsWith(".dylib")) {
    return true;
  }
  return false;
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
  const baseConfig = JSON.parse(await fs.readFile(defaultReleaseConfigPath, "utf8"));
  const merged = extraConfigPath
    ? deepMerge(baseConfig, JSON.parse(await fs.readFile(extraConfigPath, "utf8")))
    : baseConfig;
  const publicVersion = workspacePackage.version ?? merged.version;
  const windowsCompatibleVersion = process.platform === "win32"
    ? toWindowsInstallerVersion(publicVersion)
    : merged.version;
  const needsGeneratedConfig = Boolean(extraConfigPath) || windowsCompatibleVersion !== publicVersion;

  if (!needsGeneratedConfig) {
    return defaultReleaseConfigPath;
  }

  const mergedPath = path.join(await resolveCargoTargetDir(), "release-config", "tauri.release.merged.json");
  await fs.mkdir(path.dirname(mergedPath), { recursive: true });
  if (windowsCompatibleVersion !== publicVersion) {
    console.log(`Using Windows Installer compatible app version ${windowsCompatibleVersion} for desktop bundling.`);
    merged.version = windowsCompatibleVersion;
  }
  await fs.writeFile(mergedPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return mergedPath;
}

function toWindowsInstallerVersion(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)(?:-[A-Za-z]+\.?(\d+)?)?$/);
  if (!match) {
    return version;
  }

  const [, major, minor, patch, prereleaseNumber] = match;
  if (!prereleaseNumber) {
    return version;
  }

  const patchNumber = Number(patch);
  const prereleasePatch = Number(prereleaseNumber);
  if (!Number.isInteger(prereleasePatch) || prereleasePatch < 0 || prereleasePatch > 65535) {
    return `${major}.${minor}.${patch}`;
  }

  return `${major}.${minor}.${patchNumber === 0 ? prereleasePatch : patchNumber}`;
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

function sanitizeChildEnv(env) {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([key, value]) => (
        typeof key === "string"
        && key.length > 0
        && !key.startsWith("=")
        && !key.includes("=")
        && !key.includes("\0")
        && value !== undefined
      ))
      .map(([key, value]) => [key, String(value)])
  );
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

async function repairMacosBetaBundleIfNeeded() {
  if (process.platform !== "darwin") {
    return;
  }

  const hasSigningInputs = [
    process.env.APPLE_SIGNING_IDENTITY,
    process.env.APPLE_CERTIFICATE,
    process.env.APPLE_CERTIFICATE_PASSWORD,
    process.env.KEYCHAIN_PASSWORD
  ].some((value) => Boolean(value?.trim()));

  if (hasSigningInputs) {
    return;
  }

  const appPath = path.join(repoBundleDir, "macos", "Kiwi Control.app");
  if (!existsSync(appPath)) {
    return;
  }

  const dmgDir = path.join(repoBundleDir, "dmg");
  const dmgCandidates = existsSync(dmgDir)
    ? (await fs.readdir(dmgDir))
        .filter((entry) => entry.endsWith(".dmg"))
        .map((entry) => path.join(dmgDir, entry))
    : [];
  const dmgPath = dmgCandidates[0] ?? null;

  const repair = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "repair-macos-beta-bundle.mjs"),
      "--app-path",
      appPath,
      ...(dmgPath ? ["--dmg-path", dmgPath] : [])
    ],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env
    }
  );

  if (repair.error) {
    throw repair.error;
  }
  if ((repair.status ?? 1) !== 0) {
    process.exit(repair.status ?? 1);
  }
}

async function packageMacosPkgIfNeeded() {
  if (process.platform !== "darwin") {
    return;
  }

  const appPath = path.join(repoBundleDir, "macos", "Kiwi Control.app");
  if (!existsSync(appPath)) {
    return;
  }

  const outputDir = path.join(repoBundleDir, "pkg");
  await fs.mkdir(outputDir, { recursive: true });
  const arch = process.arch === "arm64" ? "aarch64" : process.arch;
  const outputPath = path.join(outputDir, `kiwi-control-${workspacePackage.version}-macos-${arch}.pkg`);

  const packageResult = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "package-macos-pkg.mjs"),
      "--app-path",
      appPath,
      "--output-path",
      outputPath,
      "--version",
      workspacePackage.version,
      "--identifier",
      "in.kiwi-ai.kiwi-control.pkg"
    ],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env
    }
  );

  if (packageResult.error) {
    throw packageResult.error;
  }
  if ((packageResult.status ?? 1) !== 0) {
    process.exit(packageResult.status ?? 1);
  }

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
