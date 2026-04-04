import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function hasCanonicalConfigs(root: string): boolean {
  return existsSync(path.join(root, "configs", "global.yaml"));
}

function hasSourceCheckoutLayout(root: string): boolean {
  return (
    hasCanonicalConfigs(root) &&
    existsSync(path.join(root, "packages", "sj-cli", "package.json")) &&
    existsSync(path.join(root, "apps", "sj-ui", "package.json")) &&
    existsSync(path.join(root, "scripts", "run-ui-dev.mjs"))
  );
}

export function findNearestSourceProductCheckout(startDir: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    if (hasSourceCheckoutLayout(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

export function resolveShreyJuniorProductRoot(fromImportMetaUrl = import.meta.url): string {
  const baseDir = path.dirname(fileURLToPath(fromImportMetaUrl));
  const overrideRoot = process.env.KIWI_CONTROL_PRODUCT_ROOT || process.env.SHREY_JUNIOR_PRODUCT_ROOT;
  const sourceCheckoutRoot = path.resolve(baseDir, "..", "..", "..");
  const candidates = [
    overrideRoot,
    hasSourceCheckoutLayout(sourceCheckoutRoot) ? sourceCheckoutRoot : undefined,
    path.resolve(baseDir, "runtime"),
    path.resolve(baseDir, "..", "runtime"),
    sourceCheckoutRoot
  ].filter((candidate): candidate is string => Boolean(candidate));

  const resolved = [...new Set(candidates)].find(hasCanonicalConfigs);
  if (resolved) {
    return resolved;
  }

  return path.resolve(baseDir, "runtime");
}

export function resolveSourceCliEntrypoint(productRoot = resolveShreyJuniorProductRoot()): string {
  return path.join(productRoot, "packages", "sj-cli", "dist", "cli.js");
}

export function resolveSourceUiDevEntrypoint(productRoot = resolveShreyJuniorProductRoot()): string {
  return path.join(productRoot, "scripts", "run-ui-dev.mjs");
}

export function resolveSourceUiDesktopBundlePath(productRoot = resolveShreyJuniorProductRoot()): string | null {
  if (process.platform !== "darwin") {
    return null;
  }

  return path.join(productRoot, "apps", "sj-ui", "src-tauri", "target", "release", "bundle", "macos", "Kiwi Control.app");
}

export function isSourceProductCheckout(productRoot = resolveShreyJuniorProductRoot()): boolean {
  return (
    hasCanonicalConfigs(productRoot) &&
    existsSync(resolveSourceUiDevEntrypoint(productRoot)) &&
    existsSync(path.join(productRoot, "apps", "sj-ui", "package.json"))
  );
}
