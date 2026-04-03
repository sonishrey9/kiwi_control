import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolveShreyJuniorProductRoot } from "@shrey-junior/sj-core";

test("runtime resolver prefers packaged runtime assets when present", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-runtime-packaged-"));
  const runtimeRoot = path.join(tempDir, "package", "dist", "runtime");
  const runtimeFile = path.join(tempDir, "package", "dist", "runtime.js");
  await fs.mkdir(path.join(runtimeRoot, "configs"), { recursive: true });
  await fs.writeFile(path.join(runtimeRoot, "configs", "global.yaml"), "version: 2\n", "utf8");
  await fs.writeFile(runtimeFile, "", "utf8");

  const resolved = resolveShreyJuniorProductRoot(pathToFileURL(runtimeFile).href);
  assert.equal(resolved, runtimeRoot);
});

test("runtime resolver falls back to the source repo root when running from source", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-runtime-source-"));
  const repoRoot = path.join(tempDir, "repo");
  const runtimeFile = path.join(repoRoot, "packages", "sj-core", "src", "runtime.ts");
  await fs.mkdir(path.join(repoRoot, "configs"), { recursive: true });
  await fs.mkdir(path.dirname(runtimeFile), { recursive: true });
  await fs.writeFile(path.join(repoRoot, "configs", "global.yaml"), "version: 2\n", "utf8");
  await fs.writeFile(runtimeFile, "", "utf8");

  const resolved = resolveShreyJuniorProductRoot(pathToFileURL(runtimeFile).href);
  assert.equal(resolved, repoRoot);
});
