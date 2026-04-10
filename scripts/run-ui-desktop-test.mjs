import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { removeMacMetadataArtifacts } from "./remove-macos-metadata.mjs";
import { prepareRuntimeSidecar } from "./prepare-runtime-sidecar.mjs";
import { stageDesktopInstallerResources } from "./stage-cli-bundle.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tauriRoot = path.join(repoRoot, "apps", "sj-ui", "src-tauri");
const installerResourcesDir = path.join(tauriRoot, "resources", "desktop");

await main();

async function main() {
  const cliEntrypoint = path.join(repoRoot, "packages", "sj-cli", "dist", "cli.js");
  if (!existsSync(cliEntrypoint)) {
    console.error("Kiwi Control desktop tests need the local CLI build. Run `npm run build` first.");
    process.exit(1);
  }

  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

  await stageDesktopInstallerResources({
    repoRoot,
    resourcesRoot: installerResourcesDir,
    nodeBinaryPath: process.execPath
  });

  const buildUi = spawnSync(npmExecutable, ["run", "build", "-w", "@shrey-junior/sj-ui"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      COPYFILE_DISABLE: "1",
      COPY_EXTENDED_ATTRIBUTES_DISABLE: "1"
    }
  });
  if (buildUi.error) {
    throw buildUi.error;
  }
  if ((buildUi.status ?? 1) !== 0) {
    process.exit(buildUi.status ?? 1);
  }

  const cargoTargetDir = path.join(await fs.realpath(os.tmpdir()).catch(() => os.tmpdir()), "kiwi-control-tauri-target");
  await prepareRuntimeSidecar({
    repoRoot,
    cargoTargetDir: path.join(cargoTargetDir, "runtime-sidecar")
  });
  await removeMacMetadataArtifacts(installerResourcesDir);

  const cargoExecutable = process.platform === "win32" ? "cargo.exe" : "cargo";
  const result = spawnSync(
    cargoExecutable,
    ["test", "--manifest-path", path.join(tauriRoot, "Cargo.toml")],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        CARGO_TARGET_DIR: cargoTargetDir,
        COPYFILE_DISABLE: "1",
        COPY_EXTENDED_ATTRIBUTES_DISABLE: "1"
      }
    }
  );

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }

  if (process.platform === "darwin") {
    const buildDesktop = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "run-ui-desktop-build.mjs")], {
      cwd: repoRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        CARGO_TARGET_DIR: cargoTargetDir,
        COPYFILE_DISABLE: "1",
        COPY_EXTENDED_ATTRIBUTES_DISABLE: "1"
      }
    });
    if (buildDesktop.error) {
      throw buildDesktop.error;
    }
    if ((buildDesktop.status ?? 1) !== 0) {
      process.exit(buildDesktop.status ?? 1);
    }

    const renderedCheck = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "verify-rendered-desktop.mjs")], {
      cwd: repoRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        CARGO_TARGET_DIR: cargoTargetDir,
        COPYFILE_DISABLE: "1",
        COPY_EXTENDED_ATTRIBUTES_DISABLE: "1"
      }
    });
    if (renderedCheck.error) {
      throw renderedCheck.error;
    }
    process.exit(renderedCheck.status ?? 1);
  }

  process.exit(0);
}
