#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await main();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const platform = args.platform ?? normalizePlatform(process.platform);
  const arch = args.arch ?? normalizeArch(process.arch);
  const bundleRoot = path.resolve(args.bundleRoot ?? path.join(repoRoot, "apps", "sj-ui", "src-tauri", "target", "release", "bundle"));

  const expectations = filterExpectations(buildExpectations(bundleRoot, platform), args.bundles);
  const results = [];
  for (const expectation of expectations) {
    const match = await findArtifact(expectation);
    results.push({
      id: expectation.id,
      required: expectation.required,
      path: match,
      exists: Boolean(match)
    });
  }

  const missingRequired = results.filter((entry) => entry.required && !entry.exists);
  const payload = {
    ok: missingRequired.length === 0,
    platform,
    arch,
    bundleRoot,
    results,
    missingRequired: missingRequired.map((entry) => entry.id)
  };

  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = payload.ok ? 0 : 1;
}

function parseArgs(argv) {
  const parsed = {
    platform: null,
    arch: null,
    bundleRoot: null,
    bundles: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--platform") {
      parsed.platform = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--arch") {
      parsed.arch = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--bundle-root") {
      parsed.bundleRoot = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--bundles") {
      parsed.bundles = argv[index + 1] ?? null;
      index += 1;
    }
  }
  return parsed;
}

function buildExpectations(bundleRoot, platform) {
  switch (platform) {
    case "macos":
      return [
        {
          id: "macos-app-bundle",
          required: true,
          directory: path.join(bundleRoot, "macos"),
          predicate: (name, fullPath, isDirectory) => isDirectory && name.endsWith(".app")
        },
        {
          id: "macos-dmg",
          required: true,
          directory: path.join(bundleRoot, "dmg"),
          predicate: (name, _fullPath, isDirectory) => !isDirectory && name.endsWith(".dmg")
        }
      ];
    case "windows":
      return [
        {
          id: "windows-nsis-installer",
          required: true,
          directory: path.join(bundleRoot, "nsis"),
          predicate: (name, _fullPath, isDirectory) => !isDirectory && name.toLowerCase().endsWith(".exe")
        },
        {
          id: "windows-msi-installer",
          required: true,
          directory: path.join(bundleRoot, "msi"),
          predicate: (name, _fullPath, isDirectory) => !isDirectory && name.toLowerCase().endsWith(".msi")
        }
      ];
    case "linux":
      return [
        {
          id: "linux-appimage",
          required: true,
          directory: path.join(bundleRoot, "appimage"),
          predicate: (name, _fullPath, isDirectory) => !isDirectory && name.endsWith(".AppImage")
        }
      ];
    default:
      throw new Error(`Unsupported platform for release artifact verification: ${platform}`);
  }
}

function filterExpectations(expectations, bundleSpec) {
  if (!bundleSpec) {
    return expectations;
  }
  const requested = new Set(
    bundleSpec.split(",").map((value) => value.trim()).filter(Boolean)
  );
  return expectations.filter((entry) => {
    if (requested.has("app") && entry.id === "macos-app-bundle") {
      return true;
    }
    if (requested.has("dmg") && entry.id === "macos-dmg") {
      return true;
    }
    if (requested.has("nsis") && entry.id === "windows-nsis-installer") {
      return true;
    }
    if (requested.has("msi") && entry.id === "windows-msi-installer") {
      return true;
    }
    if (requested.has("appimage") && entry.id === "linux-appimage") {
      return true;
    }
    return false;
  });
}

async function findArtifact(expectation) {
  const entries = await fs.readdir(expectation.directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = path.join(expectation.directory, entry.name);
    if (expectation.predicate(entry.name, fullPath, entry.isDirectory())) {
      return fullPath;
    }
  }
  return null;
}

function normalizePlatform(value) {
  switch (value) {
    case "darwin":
    case "macos":
      return "macos";
    case "win32":
    case "windows":
      return "windows";
    case "linux":
      return "linux";
    default:
      throw new Error(`Unsupported platform: ${value}`);
  }
}

function normalizeArch(value) {
  switch (value.toLowerCase()) {
    case "arm64":
      return "aarch64";
    case "x64":
      return "x64";
    default:
      return value.toLowerCase();
  }
}
