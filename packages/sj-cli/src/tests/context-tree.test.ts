import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { buildRepoContextTree } from "@shrey-junior/sj-core/core/context-tree.js";

test("repo context tree excludes generated dist-types files from discovery and entry points", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-context-tree-"));
  await fs.mkdir(path.join(tempDir, "apps", "sj-ui", "src"), { recursive: true });
  await fs.mkdir(path.join(tempDir, "apps", "sj-ui", "dist-types"), { recursive: true });
  await fs.writeFile(path.join(tempDir, "package.json"), '{\n  "name": "context-tree-fixture"\n}\n', "utf8");
  await fs.writeFile(path.join(tempDir, "apps", "sj-ui", "src", "main.ts"), "export const source = true;\n", "utf8");
  await fs.writeFile(path.join(tempDir, "apps", "sj-ui", "dist-types", "main.js"), "export const generated = true;\n", "utf8");

  const { state, view } = await buildRepoContextTree(tempDir, "node");

  assert.equal(state.entryPoints.some((entry) => entry.includes("dist-types")), false);
  assert.equal(view.entryPoints.some((entry) => entry.includes("dist-types")), false);
  assert.equal(JSON.stringify(state.tree).includes("dist-types"), false);
});
