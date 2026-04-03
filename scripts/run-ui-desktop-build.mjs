import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntrypoint = path.join(repoRoot, "packages", "sj-cli", "dist", "cli.js");

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

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npmExecutable, ["run", "tauri:build", "-w", "@shrey-junior/sj-ui", ...process.argv.slice(2)], {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    KIWI_CONTROL_CLI: cliEntrypoint,
    SHREY_JUNIOR_CLI: cliEntrypoint
  }
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
