import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultEnvPath = path.join(repoRoot, ".env");

export function loadLocalEnv(options = {}) {
  const envPath = path.resolve(options.envPath ?? defaultEnvPath);
  if (!existsSync(envPath)) {
    return {
      envPath,
      loadedKeys: [],
      missing: true
    };
  }

  const loadedKeys = [];
  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const match = rawLine.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (process.env[key] && process.env[key]?.length) {
      continue;
    }

    process.env[key] = normalizeEnvValue(rawValue);
    loadedKeys.push(key);
  }

  return {
    envPath,
    loadedKeys,
    missing: false
  };
}

function normalizeEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
