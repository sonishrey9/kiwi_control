import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { runCommand } from "@shrey-junior/sj-core/utils/child-process.js";
import { contextSelector } from "@shrey-junior/sj-core/core/context-selector.js";
import { pathExists, readJson } from "@shrey-junior/sj-core/utils/fs.js";

test("context selector returns empty include for clean repos with no recent files", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-clean-"));
  await runCommand("git", ["init"], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "--allow-empty", "-m", "init"], tempDir);

  const result = await contextSelector("fix auth bug", tempDir);

  assert.ok(Array.isArray(result.include));
  assert.ok(Array.isArray(result.exclude));
  assert.ok(typeof result.reason === "string");
  assert.ok(result.reason.length > 0);
});

test("context selector includes changed files with highest priority", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-dirty-"));
  await runCommand("git", ["init"], tempDir);
  await fs.writeFile(path.join(tempDir, "auth.ts"), "export function login() {}\n", "utf8");
  await fs.writeFile(path.join(tempDir, "utils.ts"), "export function hash() {}\n", "utf8");
  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);

  await fs.writeFile(path.join(tempDir, "auth.ts"), "export function login() { return true; }\n", "utf8");

  const result = await contextSelector("fix login", tempDir);

  assert.ok(result.include.length > 0);
  assert.ok(
    result.include.includes("auth.ts"),
    `Expected auth.ts in include list, got: ${result.include.join(", ")}`
  );
  assert.ok(result.signals.changedFiles.includes("auth.ts"));
});

test("context selector finds import neighbors", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-imports-"));
  await runCommand("git", ["init"], tempDir);

  await fs.writeFile(
    path.join(tempDir, "main.ts"),
    'import { helper } from "./helper.js";\nexport function run() { return helper(); }\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(tempDir, "helper.ts"),
    "export function helper() { return 42; }\n",
    "utf8"
  );
  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);

  await fs.writeFile(
    path.join(tempDir, "main.ts"),
    'import { helper } from "./helper.js";\nexport function run() { return helper() + 1; }\n',
    "utf8"
  );

  const result = await contextSelector("update run function", tempDir);

  assert.ok(result.signals.changedFiles.includes("main.ts"));
  assert.ok(
    result.signals.importNeighbors.some((f) => f.includes("helper")),
    `Expected helper in import neighbors, got: ${result.signals.importNeighbors.join(", ")}`
  );
});

test("context selector persists worktree and selection state", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-persist-"));
  await runCommand("git", ["init"], tempDir);
  await fs.writeFile(path.join(tempDir, "app.ts"), "console.log('hi');\n", "utf8");
  await runCommand("git", ["add", "."], tempDir);

  await contextSelector("build feature", tempDir);

  const worktreePath = path.join(tempDir, ".agent", "state", "worktree.json");
  const selectionPath = path.join(tempDir, ".agent", "state", "context-selection.json");

  assert.ok(await pathExists(worktreePath), "worktree.json should be persisted");
  assert.ok(await pathExists(selectionPath), "context-selection.json should be persisted");

  const worktree = await readJson<{ artifactType: string; dirty: boolean }>(worktreePath);
  assert.equal(worktree.artifactType, "kiwi-control/worktree");
  assert.equal(worktree.dirty, true);

  const selection = await readJson<{ artifactType: string; task: string }>(selectionPath);
  assert.equal(selection.artifactType, "kiwi-control/context-selection");
  assert.equal(selection.task, "build feature");
});

test("context selector excludes node_modules and dist paths", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-exclude-"));
  await runCommand("git", ["init"], tempDir);
  await fs.mkdir(path.join(tempDir, "node_modules", "lib"), { recursive: true });
  await fs.writeFile(path.join(tempDir, "node_modules", "lib", "index.js"), "module.exports = {};\n", "utf8");
  await fs.writeFile(path.join(tempDir, "src.ts"), "export const x = 1;\n", "utf8");
  await runCommand("git", ["add", "src.ts"], tempDir);

  const result = await contextSelector("update x", tempDir);

  const hasNodeModules = result.include.some((f) => f.includes("node_modules"));
  assert.equal(hasNodeModules, false, "node_modules files should never be in include list");
});
