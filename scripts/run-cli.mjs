import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntrypoint = path.join(repoRoot, "packages", "sj-cli", "dist", "cli.js");

if (!existsSync(cliEntrypoint)) {
  console.error("Kiwi Control local CLI is not built yet. Run `npm run build` first.");
  process.exit(1);
}

const child = spawn(process.execPath, [cliEntrypoint, ...process.argv.slice(2)], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
