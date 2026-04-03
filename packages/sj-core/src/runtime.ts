import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function hasCanonicalConfigs(root: string): boolean {
  return existsSync(path.join(root, "configs", "global.yaml"));
}

export function resolveShreyJuniorProductRoot(fromImportMetaUrl = import.meta.url): string {
  const baseDir = path.dirname(fileURLToPath(fromImportMetaUrl));
  const overrideRoot = process.env.SHREY_JUNIOR_PRODUCT_ROOT;
  const candidates = [
    overrideRoot,
    path.resolve(baseDir, "runtime"),
    path.resolve(baseDir, "..", "runtime"),
    path.resolve(baseDir, "..", "..", "..")
  ].filter((candidate): candidate is string => Boolean(candidate));

  const resolved = candidates.find(hasCanonicalConfigs);
  if (resolved) {
    return resolved;
  }

  return path.resolve(baseDir, "runtime");
}
