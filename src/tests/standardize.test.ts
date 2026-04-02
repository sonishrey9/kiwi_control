import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { runStandardize } from "../commands/standardize.js";
import { Logger } from "../core/logger.js";

test("standardize upgrades an existing repo with the portable contract and backup support", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-standardize-"));
  const target = path.join(tempDir, "existing-repo");
  await fs.mkdir(path.join(target, ".git"), { recursive: true });
  await fs.writeFile(path.join(target, "README.md"), "# Existing Repo\n", "utf8");
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "existing-repo"\n}\n', "utf8");
  await fs.writeFile(path.join(target, "AGENTS.md"), "# Existing Authority\n", "utf8");

  const logs: string[] = [];
  const logger = new Logger(false);
  const originalInfo = logger.info.bind(logger);
  const originalWarn = logger.warn.bind(logger);
  const originalError = logger.error.bind(logger);
  logger.info = (message: string) => {
    logs.push(message);
    originalInfo(message);
  };
  logger.warn = (message: string) => {
    logs.push(message);
    originalWarn(message);
  };
  logger.error = (message: string) => {
    logs.push(message);
    originalError(message);
  };
  const exitCode = await runStandardize({
    repoRoot,
    targetRoot: target,
    backup: true,
    logger
  });

  assert.equal(exitCode, 0);
  assert.match(logs.join("\n"), /standardize summary/);
  assert.match(logs.join("\n"), /skipped as irrelevant:/);
  assert.match(logs.join("\n"), /active role:/);
  assert.match(logs.join("\n"), /verification commands:/);
  assert.equal(await fs.readFile(path.join(target, ".github", "agents", "backend-specialist.md"), "utf8").then(() => true), true);
  assert.equal(await fs.readFile(path.join(target, ".agent", "roles", "backend-specialist.md"), "utf8").then(() => true), true);
  assert.equal(await fs.readFile(path.join(target, ".agent", "state", "active-role-hints.json"), "utf8").then(() => true), true);
  assert.equal(await fs.readFile(path.join(target, ".agent", "scripts", "verify-contract.sh"), "utf8").then(() => true), true);
  assert.equal(await fs.readFile(path.join(target, ".github", "workflows", "shrey-junior-contract.yml"), "utf8").then(() => true), true);
  assert.equal(await fs.access(path.join(target, ".github", "instructions", "data.instructions.md")).then(() => true).catch(() => false), false);
  const backupRoot = path.join(target, ".agent", "backups", "shrey-junior");
  const backupEntries = await fs.readdir(backupRoot);
  assert.equal(backupEntries.length > 0, true);
});
