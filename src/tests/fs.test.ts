import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { managedBlockStart, managedBlockEnd, upsertManagedBlock, upsertManagedFile } from "../utils/fs.js";

test("managed block append then update keeps markers stable", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-fs-"));
  const filePath = path.join(tempDir, "AGENTS.md");
  await fs.writeFile(filePath, "# Existing\n", "utf8");

  const appended = await upsertManagedBlock(filePath, "codex", "first version");
  assert.equal(appended.status, "appended");

  const updated = await upsertManagedBlock(filePath, "codex", "second version");
  assert.equal(updated.status, "updated");

  const finalText = await fs.readFile(filePath, "utf8");
  assert.equal(finalText.includes(managedBlockStart("codex")), true);
  assert.equal(finalText.includes(managedBlockEnd("codex")), true);
  assert.equal(finalText.includes("second version"), true);
});

test("managed file refuses to overwrite unmanaged file", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-file-"));
  const filePath = path.join(tempDir, ".agent", "project.yaml");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, "human: true\n", "utf8");

  const result = await upsertManagedFile(filePath, ".agent/project.yaml", "managed: true");
  assert.equal(result.status, "conflict");
});

test("managed yaml file uses yaml-safe markers", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-yaml-"));
  const filePath = path.join(tempDir, ".agent", "checks.yaml");

  const result = await upsertManagedFile(filePath, ".agent/checks.yaml", "version: 1\n");
  assert.equal(result.status, "created");

  const finalText = await fs.readFile(filePath, "utf8");
  assert.match(finalText, /^# SHREY-JUNIOR:FILE-START/m);
});
