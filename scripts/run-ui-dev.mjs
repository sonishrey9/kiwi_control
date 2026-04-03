import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntrypoint = path.join(repoRoot, "packages", "sj-cli", "dist", "cli.js");

if (!existsSync(cliEntrypoint)) {
  console.error("Kiwi Control desktop dev mode needs the local CLI build. Run `npm run build` first.");
  process.exit(1);
}

const cargoCheck = spawnSync(process.platform === "win32" ? "cargo.exe" : "cargo", ["--version"], {
  stdio: "ignore"
});

if (cargoCheck.status !== 0) {
  console.error("Kiwi Control desktop dev mode requires Rust/Cargo. Install Rust first, then rerun `npm run ui:dev`.");
  process.exit(1);
}

const tauriExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(tauriExecutable, ["run", "tauri:dev", "-w", "@shrey-junior/sj-ui"], {
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
