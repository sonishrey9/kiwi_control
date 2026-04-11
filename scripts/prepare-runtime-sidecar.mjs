import path from "node:path";
import { chmod, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { removeMacMetadataArtifacts } from "./remove-macos-metadata.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function prepareRuntimeSidecar(options = {}) {
  const resolvedRepoRoot = options.repoRoot ? path.resolve(options.repoRoot) : repoRoot;
  const cargoTargetDir = path.resolve(
    resolvedRepoRoot,
    options.cargoTargetDir
      ?? process.env.KIWI_CONTROL_CARGO_TARGET_DIR
      ?? process.env.CARGO_TARGET_DIR
      ?? "target"
  );
  const targetTriple = options.targetTriple ?? resolveRustHostTriple(resolvedRepoRoot);
  const executableName = process.platform === "win32" ? "kiwi-control-runtime.exe" : "kiwi-control-runtime";
  const builtBinaryPath = path.join(cargoTargetDir, "release", executableName);
  const tauriSidecarPath = path.join(
    resolvedRepoRoot,
    "apps",
    "sj-ui",
    "src-tauri",
    "binaries",
    `kiwi-control-runtime-${targetTriple}${process.platform === "win32" ? ".exe" : ""}`
  );
  const runtimeBundleBinaryPath = path.join(
    resolvedRepoRoot,
    "packages",
    "sj-core",
    "dist",
    "runtime",
    "bin",
    executableName
  );
  const metadataPath = path.join(
    resolvedRepoRoot,
    "packages",
    "sj-core",
    "dist",
    "runtime",
    "runtime-binary.json"
  );

  buildRuntimeBinary(resolvedRepoRoot, cargoTargetDir);

  if (!existsSync(builtBinaryPath)) {
    throw new Error(`expected runtime binary at ${builtBinaryPath} after cargo build`);
  }

  await mkdir(path.dirname(tauriSidecarPath), { recursive: true });
  await mkdir(path.dirname(runtimeBundleBinaryPath), { recursive: true });
  await mkdir(path.dirname(metadataPath), { recursive: true });
  await rm(tauriSidecarPath, { force: true });
  await rm(runtimeBundleBinaryPath, { force: true });
  await cp(builtBinaryPath, tauriSidecarPath);
  await cp(builtBinaryPath, runtimeBundleBinaryPath);
  await chmod(tauriSidecarPath, 0o755).catch(() => undefined);
  await chmod(runtimeBundleBinaryPath, 0o755).catch(() => undefined);
  await writeFile(
    metadataPath,
    `${JSON.stringify(
      {
        binaryName: executableName,
        targetTriple,
        builtBinaryPath: path.relative(resolvedRepoRoot, builtBinaryPath).replace(/\\/g, "/"),
        tauriSidecarPath: path.relative(resolvedRepoRoot, tauriSidecarPath).replace(/\\/g, "/"),
        runtimeBundleBinaryPath: path.relative(resolvedRepoRoot, runtimeBundleBinaryPath).replace(/\\/g, "/")
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await removeMacMetadataArtifacts(path.join(resolvedRepoRoot, "apps", "sj-ui", "src-tauri"));
  await removeMacMetadataArtifacts(path.join(resolvedRepoRoot, "packages", "sj-core", "dist", "runtime"));

  return {
    targetTriple,
    builtBinaryPath,
    tauriSidecarPath,
    runtimeBundleBinaryPath,
    metadataPath
  };
}

function buildRuntimeBinary(resolvedRepoRoot, cargoTargetDir) {
  const cargoExecutable = process.platform === "win32" ? "cargo.exe" : "cargo";
  const result = spawnSync(
    cargoExecutable,
    [
      "build",
      "--manifest-path",
      path.join(resolvedRepoRoot, "crates", "kiwi-runtime", "Cargo.toml"),
      "--release",
      "--bin",
      "kiwi-control-runtime"
    ],
    {
      cwd: resolvedRepoRoot,
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
    throw new Error("cargo build failed while preparing the Kiwi Control runtime sidecar");
  }
}

function resolveRustHostTriple(resolvedRepoRoot) {
  const rustcExecutable = process.platform === "win32" ? "rustc.exe" : "rustc";
  const result = spawnSync(rustcExecutable, ["-vV"], {
    cwd: resolvedRepoRoot,
    encoding: "utf8",
    stdio: "pipe"
  });

  if (result.error) {
    throw result.error;
  }
  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr || result.stdout || "rustc -vV failed while resolving the host target triple");
  }

  const output = result.stdout || "";
  const hostLine = output
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("host: "));
  const hostTriple = hostLine?.slice("host: ".length).trim();
  if (!hostTriple) {
    throw new Error("rustc -vV did not report a host target triple");
  }
  return hostTriple;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const quiet = process.argv.includes("--quiet");
  const result = await prepareRuntimeSidecar();
  if (!quiet) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
}
