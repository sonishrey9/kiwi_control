import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  isSourceProductCheckout,
  resolveShreyJuniorProductRoot,
  resolveSourceCliEntrypoint,
  resolveSourceUiDevEntrypoint
} from "@shrey-junior/sj-core";

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

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

test("runtime helpers can derive source entrypoints from an explicit source checkout root", () => {
  const productRoot = repoRoot();
  const cliEntrypoint = resolveSourceCliEntrypoint(productRoot);
  const uiEntrypoint = resolveSourceUiDevEntrypoint(productRoot);

  assert.equal(
    cliEntrypoint,
    path.join(productRoot, "packages", "sj-cli", "dist", "cli.js")
  );
  assert.equal(uiEntrypoint, path.join(productRoot, "scripts", "run-ui-dev.mjs"));
  assert.equal(isSourceProductCheckout(productRoot), true);
});

test("runtime resolver honors the Kiwi Control product root override env var", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-runtime-env-"));
  await fs.mkdir(path.join(tempDir, "configs"), { recursive: true });
  await fs.writeFile(path.join(tempDir, "configs", "global.yaml"), "version: 2\n", "utf8");

  const previousOverride = process.env.KIWI_CONTROL_PRODUCT_ROOT;
  process.env.KIWI_CONTROL_PRODUCT_ROOT = tempDir;

  try {
    const resolved = resolveShreyJuniorProductRoot();
    assert.equal(resolved, tempDir);
  } finally {
    if (previousOverride === undefined) {
      delete process.env.KIWI_CONTROL_PRODUCT_ROOT;
    } else {
      process.env.KIWI_CONTROL_PRODUCT_ROOT = previousOverride;
    }
  }
});
