import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  resolveDesktopInstallReceiptPath,
  resolveDesktopLaunchMode,
  resolveGlobalHomeRoot,
  resolvePathBinRoot,
  findNearestSourceProductCheckout,
  isSourceProductCheckout,
  resolveShreyJuniorProductRoot,
  resolveSourceCliEntrypoint,
  resolveSourceUiDesktopBundlePath,
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

test("runtime resolver prefers the source repo root over packaged runtime assets in a built checkout", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-runtime-built-source-"));
  const checkoutRoot = path.join(tempDir, "repo");
  const runtimeFile = path.join(checkoutRoot, "packages", "sj-core", "dist", "runtime.js");
  const packagedRuntimeRoot = path.join(checkoutRoot, "packages", "sj-core", "dist", "runtime");
  await fs.mkdir(path.join(checkoutRoot, "configs"), { recursive: true });
  await fs.mkdir(path.join(packagedRuntimeRoot, "configs"), { recursive: true });
  await fs.mkdir(path.join(checkoutRoot, "packages", "sj-cli"), { recursive: true });
  await fs.mkdir(path.join(checkoutRoot, "apps", "sj-ui"), { recursive: true });
  await fs.mkdir(path.join(checkoutRoot, "scripts"), { recursive: true });
  await fs.mkdir(path.dirname(runtimeFile), { recursive: true });
  await fs.writeFile(path.join(checkoutRoot, "configs", "global.yaml"), "version: 2\n", "utf8");
  await fs.writeFile(path.join(packagedRuntimeRoot, "configs", "global.yaml"), "version: 2\n", "utf8");
  await fs.writeFile(path.join(checkoutRoot, "packages", "sj-cli", "package.json"), "{}\n", "utf8");
  await fs.writeFile(path.join(checkoutRoot, "apps", "sj-ui", "package.json"), "{}\n", "utf8");
  await fs.writeFile(path.join(checkoutRoot, "scripts", "run-ui-dev.mjs"), "", "utf8");
  await fs.writeFile(runtimeFile, "", "utf8");

  const resolved = resolveShreyJuniorProductRoot(pathToFileURL(runtimeFile).href);
  assert.equal(resolved, checkoutRoot);
});

test("runtime helpers can derive source entrypoints from an explicit source checkout root", () => {
  const productRoot = repoRoot();
  const cliEntrypoint = resolveSourceCliEntrypoint(productRoot);
  const uiEntrypoint = resolveSourceUiDevEntrypoint(productRoot);
  const desktopBundlePath = resolveSourceUiDesktopBundlePath(productRoot);

  assert.equal(
    cliEntrypoint,
    path.join(productRoot, "packages", "sj-cli", "dist", "cli.js")
  );
  assert.equal(uiEntrypoint, path.join(productRoot, "scripts", "run-ui-dev.mjs"));
  if (process.platform === "darwin") {
    assert.equal(
      desktopBundlePath,
      path.join(productRoot, "apps", "sj-ui", "src-tauri", "target", "release", "bundle", "macos", "Kiwi Control.app")
    );
  } else {
    assert.equal(desktopBundlePath, null);
  }
  assert.equal(isSourceProductCheckout(productRoot), true);
});

test("runtime can discover the nearest source checkout from a nested workspace path", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-runtime-nearest-source-"));
  const checkoutRoot = path.join(tempDir, "repo");
  const nestedWorkspace = path.join(checkoutRoot, "apps", "sj-ui", "src", "views");
  await fs.mkdir(path.join(checkoutRoot, "configs"), { recursive: true });
  await fs.mkdir(path.join(checkoutRoot, "packages", "sj-cli"), { recursive: true });
  await fs.mkdir(path.join(checkoutRoot, "apps", "sj-ui"), { recursive: true });
  await fs.mkdir(path.join(checkoutRoot, "scripts"), { recursive: true });
  await fs.mkdir(nestedWorkspace, { recursive: true });
  await fs.writeFile(path.join(checkoutRoot, "configs", "global.yaml"), "version: 2\n", "utf8");
  await fs.writeFile(path.join(checkoutRoot, "packages", "sj-cli", "package.json"), "{}\n", "utf8");
  await fs.writeFile(path.join(checkoutRoot, "apps", "sj-ui", "package.json"), "{}\n", "utf8");
  await fs.writeFile(path.join(checkoutRoot, "scripts", "run-ui-dev.mjs"), "", "utf8");

  assert.equal(findNearestSourceProductCheckout(nestedWorkspace), checkoutRoot);
  assert.equal(findNearestSourceProductCheckout(tempDir), null);
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

test("runtime helpers resolve desktop receipt and path roots from user-global defaults", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-runtime-global-home-"));
  const previousHome = process.env.KIWI_CONTROL_HOME;
  const previousPathBin = process.env.KIWI_CONTROL_PATH_BIN;
  const previousReceipt = process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH;
  delete process.env.KIWI_CONTROL_PATH_BIN;
  delete process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH;
  process.env.KIWI_CONTROL_HOME = tempDir;

  try {
    assert.equal(resolveGlobalHomeRoot(), tempDir);
    assert.equal(resolveDesktopInstallReceiptPath(), path.join(tempDir, "desktop-install.json"));
    if (process.platform === "win32") {
      assert.equal(resolvePathBinRoot(), path.join(tempDir, "bin"));
    } else {
      assert.equal(resolvePathBinRoot().endsWith(path.join(".local", "bin")), true);
    }
  } finally {
    if (previousHome === undefined) {
      delete process.env.KIWI_CONTROL_HOME;
    } else {
      process.env.KIWI_CONTROL_HOME = previousHome;
    }
    if (previousPathBin === undefined) {
      delete process.env.KIWI_CONTROL_PATH_BIN;
    } else {
      process.env.KIWI_CONTROL_PATH_BIN = previousPathBin;
    }
    if (previousReceipt === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH;
    } else {
      process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH = previousReceipt;
    }
  }
});

test("desktop launch mode defaults to installed-user but can be forced to source or installed", async () => {
  const previousPreference = process.env.KIWI_CONTROL_DESKTOP_PREFERENCE;
  const sourceCheckout = repoRoot();

  try {
    delete process.env.KIWI_CONTROL_DESKTOP_PREFERENCE;
    assert.equal(resolveDesktopLaunchMode(sourceCheckout), "developer-source");

    process.env.KIWI_CONTROL_DESKTOP_PREFERENCE = "installed";
    assert.equal(resolveDesktopLaunchMode(sourceCheckout), "installed-user");

    process.env.KIWI_CONTROL_DESKTOP_PREFERENCE = "source";
    assert.equal(resolveDesktopLaunchMode(sourceCheckout), "developer-source");
  } finally {
    if (previousPreference === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP_PREFERENCE;
    } else {
      process.env.KIWI_CONTROL_DESKTOP_PREFERENCE = previousPreference;
    }
  }
});
