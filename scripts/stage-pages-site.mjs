#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const siteRoot = path.resolve(args.siteRoot ?? path.join(repoRoot, "website"));
const outputDir = path.resolve(args.outputDir ?? path.join(repoRoot, "dist", "site"));
const downloadsUrl = stripTrailingSlash(args.downloadsUrl ?? process.env.DOWNLOADS_URL ?? "");
const repoUrl = stripTrailingSlash(args.repoUrl ?? process.env.REPO_URL ?? "https://github.com/sonishrey9/kiwi-control-backup");
const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));

await fs.rm(outputDir, { recursive: true, force: true });
await fs.cp(siteRoot, outputDir, { recursive: true });
await removeMetadataArtifacts(outputDir);

const release = await resolveReleaseMetadata({
  downloadsJsonPath: args.downloadsJson,
  downloadsUrl,
  repoUrl,
  version: packageJson.version,
  requireDownloadsJson: args.requireDownloadsJson
});

const dataDir = path.join(outputDir, "data");
await fs.mkdir(dataDir, { recursive: true });
await fs.writeFile(path.join(dataDir, "latest-release.json"), `${JSON.stringify(release, null, 2)}\n`, "utf8");
await removeMetadataArtifacts(outputDir);

console.log(
  JSON.stringify(
    {
      ok: true,
      outputDir: path.relative(repoRoot, outputDir).replace(/\\/g, "/"),
      downloadsSource: args.downloadsJson ? "local-json" : downloadsUrl ? "remote-json-or-fallback" : "fallback",
      tagName: release.tagName,
      checksumsUrl: release.checksumsUrl
    },
    null,
    2
  )
);

function parseArgs(argv) {
  const parsed = {
    siteRoot: null,
    outputDir: null,
    downloadsJson: null,
    downloadsUrl: null,
    repoUrl: null,
    requireDownloadsJson: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--site-root") {
      parsed.siteRoot = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--output-dir") {
      parsed.outputDir = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--downloads-json") {
      parsed.downloadsJson = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--downloads-url") {
      parsed.downloadsUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--repo-url") {
      parsed.repoUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--require-downloads-json") {
      parsed.requireDownloadsJson = true;
    }
  }

  return parsed;
}

async function resolveReleaseMetadata({ downloadsJsonPath, downloadsUrl, repoUrl, version, requireDownloadsJson }) {
  if (downloadsJsonPath) {
    return JSON.parse(await fs.readFile(path.resolve(downloadsJsonPath), "utf8"));
  }

  if (downloadsUrl) {
    const remoteUrl = `${downloadsUrl}/latest/downloads.json`;
    try {
      const response = await fetch(remoteUrl, {
        headers: {
          Accept: "application/json"
        }
      });
      if (response.ok) {
        return await response.json();
      }
      if (requireDownloadsJson) {
        throw new Error(`${remoteUrl} returned ${response.status}.`);
      }
    } catch {
      if (requireDownloadsJson) {
        throw new Error(`Missing required Cloudflare downloads metadata at ${remoteUrl}.`);
      }
      // Fall back to the built-in release metadata when remote downloads metadata is unavailable.
    }
  }

  return fallbackReleaseMetadata({ downloadsUrl, repoUrl, version });
}

function fallbackReleaseMetadata({ downloadsUrl, repoUrl, version }) {
  const channel = version.includes("beta") ? "beta" : "stable";

  return {
    publicReleaseReady: false,
    tagName: `v${version}`,
    version,
    channel,
    releaseNotesUrl: null,
    sourceUrl: repoUrl,
    checksumsUrl: null,
    manifestUrl: null,
    trust: {
      macos: "local-beta-build-only",
      windows: "windows-runner-required"
    },
    artifacts: {
      macosDmg: {
        filename: "kiwi-control.dmg",
        latestUrl: null,
        versionedUrl: null
      },
      macosAppTarball: {
        filename: "kiwi-control.app.tar.gz",
        latestUrl: null,
        versionedUrl: null
      },
      windowsNsis: {
        filename: "kiwi-control-setup.exe",
        latestUrl: null,
        versionedUrl: null
      },
      windowsMsi: {
        filename: "kiwi-control.msi",
        latestUrl: null,
        versionedUrl: null
      },
      cliMacos: {
        filename: "kiwi-control-cli.tar.gz",
        latestUrl: null,
        versionedUrl: null
      },
      cliWindows: {
        filename: "kiwi-control-cli.zip",
        latestUrl: null,
        versionedUrl: null
      }
    }
  };
}

async function removeMetadataArtifacts(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      await removeMetadataArtifacts(fullPath);
      continue;
    }
    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) {
      await fs.rm(fullPath, { force: true });
    }
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
