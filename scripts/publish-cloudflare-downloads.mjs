#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));

const publishRoot = path.resolve(args.publishRoot ?? path.join(repoRoot, "dist", "release", "publish"));
const manifestPath = path.join(publishRoot, "release-manifest.json");
const checksumsPath = path.join(publishRoot, "SHA256SUMS.txt");
const outputPath = path.resolve(args.output ?? path.join(publishRoot, "downloads.json"));
const downloadsUrl = stripTrailingSlash(args.downloadsUrl ?? process.env.DOWNLOADS_URL ?? "");
const bucket = args.bucket ?? process.env.CLOUDFLARE_R2_BUCKET ?? "";
const repoUrl = stripTrailingSlash(args.repoUrl ?? process.env.REPO_URL ?? "https://github.com/sonishrey9/kiwi-control");

if (!downloadsUrl) {
  throw new Error("Missing downloads base URL. Pass --downloads-url or set DOWNLOADS_URL.");
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
await fs.access(checksumsPath);

const tagName = args.releaseTag ?? `v${manifest.version}`;
const releaseUrl = args.releaseUrl ?? `${repoUrl}/releases/tag/${tagName}`;
const macosTrust = await readTrustPayload(args.macosTrustJson, "macos");
const windowsTrust = await readTrustPayload(args.windowsTrustJson, "windows");

const requiredArtifacts = {
  macosDmg: await resolveRequiredArtifact({
    manifest,
    publishRoot,
    artifactType: "desktop-dmg",
    platform: "macos"
  }),
  macosAppTarball: await resolveRequiredArtifact({
    manifest,
    publishRoot,
    artifactType: "desktop-app",
    platform: "macos"
  }),
  windowsNsis: await resolveRequiredArtifact({
    manifest,
    publishRoot,
    artifactType: "desktop-nsis",
    platform: "windows"
  }),
  windowsMsi: await resolveRequiredArtifact({
    manifest,
    publishRoot,
    artifactType: "desktop-msi",
    platform: "windows"
  })
};

const optionalArtifacts = {
  cliMacos: await resolveOptionalArtifact({
    manifest,
    publishRoot,
    artifactType: "cli",
    platform: "macos"
  }),
  cliWindows: await resolveOptionalArtifact({
    manifest,
    publishRoot,
    artifactType: "cli",
    platform: "windows"
  })
};

const downloads = buildDownloadsPayload({
  manifest,
  tagName,
  releaseUrl,
  downloadsUrl,
  requiredArtifacts,
  optionalArtifacts,
  macosTrust,
  windowsTrust
});

await fs.writeFile(outputPath, `${JSON.stringify(downloads, null, 2)}\n`, "utf8");

const uploadPlan = await buildUploadPlan({
  publishRoot,
  tagName,
  downloadsUrl,
  outputPath,
  requiredArtifacts,
  optionalArtifacts
});

if (!args.dryRun) {
  if (!bucket) {
    throw new Error("Missing R2 bucket name. Pass --bucket or set CLOUDFLARE_R2_BUCKET.");
  }
  for (const entry of uploadPlan) {
    await putObject({
      bucket,
      key: entry.key,
      filePath: entry.filePath,
      contentType: entry.contentType,
      cacheControl: entry.cacheControl
    });
  }
}

const payload = {
  ok: true,
  dryRun: args.dryRun,
  publishRoot: path.relative(repoRoot, publishRoot).replace(/\\/g, "/"),
  downloadsUrl,
  bucket: bucket || null,
  tagName,
  releaseUrl,
  output: path.relative(repoRoot, outputPath).replace(/\\/g, "/"),
  trust: downloads.trust,
  uploads: uploadPlan.map((entry) => ({
    key: entry.key,
    publicUrl: entry.publicUrl,
    file: path.relative(repoRoot, entry.filePath).replace(/\\/g, "/"),
    cacheControl: entry.cacheControl
  }))
};

console.log(JSON.stringify(payload, null, 2));

function parseArgs(argv) {
  const parsed = {
    publishRoot: null,
    downloadsUrl: null,
    bucket: null,
    repoUrl: null,
    releaseTag: null,
    releaseUrl: null,
    output: null,
    macosTrustJson: null,
    windowsTrustJson: null,
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--publish-root") {
      parsed.publishRoot = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--downloads-url") {
      parsed.downloadsUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--bucket") {
      parsed.bucket = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--repo-url") {
      parsed.repoUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--release-tag") {
      parsed.releaseTag = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--release-url") {
      parsed.releaseUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--output") {
      parsed.output = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--macos-trust-json") {
      parsed.macosTrustJson = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--windows-trust-json") {
      parsed.windowsTrustJson = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--dry-run") {
      parsed.dryRun = true;
    }
  }

  return parsed;
}

async function resolveRequiredArtifact({ manifest, publishRoot, artifactType, platform }) {
  const artifact = await resolveOptionalArtifact({ manifest, publishRoot, artifactType, platform });
  if (!artifact) {
    throw new Error(`Missing required publish artifact for ${platform}/${artifactType}.`);
  }
  return artifact;
}

async function resolveOptionalArtifact({ manifest, publishRoot, artifactType, platform }) {
  const candidates = manifest.artifacts.filter((entry) => {
    if (entry.artifactType !== artifactType) {
      return false;
    }
    if (platform && entry.platform !== platform) {
      return false;
    }
    return true;
  });

  for (const candidate of candidates) {
    const filePath = path.join(publishRoot, candidate.fileName);
    if (candidate.fileName.startsWith("._")) {
      continue;
    }
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        return {
          ...candidate,
          filePath
        };
      }
    } catch {
      // Keep scanning for the first publishable artifact.
    }
  }

  return null;
}

function buildDownloadsPayload({
  manifest,
  tagName,
  releaseUrl,
  downloadsUrl,
  requiredArtifacts,
  optionalArtifacts,
  macosTrust,
  windowsTrust
}) {
  return {
    tagName,
    version: manifest.version,
    channel: manifest.channel,
    releaseNotesUrl: releaseUrl,
    sourceUrl: releaseUrl,
    checksumsUrl: joinUrl(downloadsUrl, "latest/SHA256SUMS.txt"),
    manifestUrl: joinUrl(downloadsUrl, "latest/release-manifest.json"),
    trust: {
      macos: macosTrust.classification,
      windows: windowsTrust.classification
    },
    artifacts: {
      macosDmg: surfaceArtifact(downloadsUrl, tagName, requiredArtifacts.macosDmg, "latest/macos/kiwi-control.dmg"),
      macosAppTarball: surfaceArtifact(downloadsUrl, tagName, requiredArtifacts.macosAppTarball, "latest/macos/kiwi-control.app.tar.gz"),
      windowsNsis: surfaceArtifact(downloadsUrl, tagName, requiredArtifacts.windowsNsis, "latest/windows/kiwi-control-setup.exe"),
      windowsMsi: surfaceArtifact(downloadsUrl, tagName, requiredArtifacts.windowsMsi, "latest/windows/kiwi-control.msi"),
      ...(optionalArtifacts.cliMacos
        ? {
            cliMacos: surfaceArtifact(downloadsUrl, tagName, optionalArtifacts.cliMacos, "latest/macos/kiwi-control-cli.tar.gz")
          }
        : {}),
      ...(optionalArtifacts.cliWindows
        ? {
            cliWindows: surfaceArtifact(downloadsUrl, tagName, optionalArtifacts.cliWindows, "latest/windows/kiwi-control-cli.zip")
          }
        : {})
    }
  };
}

function surfaceArtifact(downloadsUrl, tagName, artifact, latestKey) {
  return {
    filename: artifact.fileName,
    latestUrl: joinUrl(downloadsUrl, latestKey),
    versionedUrl: joinUrl(downloadsUrl, `releases/${tagName}/${artifact.fileName}`)
  };
}

async function buildUploadPlan({ publishRoot, tagName, downloadsUrl, outputPath, requiredArtifacts, optionalArtifacts }) {
  const versionedEntries = [];
  const versionedNames = new Set();
  const excludeNames = new Set([
    "downloads.json",
    "macos-trust.json",
    "windows-trust.json",
    "release-notes.md",
    "release-update.json"
  ]);

  const publishEntries = await sortedPublishFiles(publishRoot);
  for (const entry of publishEntries) {
    if (excludeNames.has(path.basename(entry))) {
      continue;
    }
    const key = `releases/${tagName}/${path.basename(entry)}`;
    versionedEntries.push(makeUploadEntry({ downloadsUrl, key, filePath: entry }));
    versionedNames.add(path.basename(entry));
  }

  const metadataEntries = [
    makeUploadEntry({
      downloadsUrl,
      key: `releases/${tagName}/downloads.json`,
      filePath: outputPath
    }),
    makeUploadEntry({
      downloadsUrl,
      key: "latest/release-manifest.json",
      filePath: path.join(publishRoot, "release-manifest.json"),
      cacheControl: latestCacheControl()
    }),
    makeUploadEntry({
      downloadsUrl,
      key: "latest/SHA256SUMS.txt",
      filePath: path.join(publishRoot, "SHA256SUMS.txt"),
      cacheControl: latestCacheControl()
    }),
    makeUploadEntry({
      downloadsUrl,
      key: "latest/downloads.json",
      filePath: outputPath,
      cacheControl: latestCacheControl()
    })
  ];

  const latestEntries = [
    makeLatestAlias(downloadsUrl, requiredArtifacts.macosDmg.filePath, "latest/macos/kiwi-control.dmg"),
    makeLatestAlias(downloadsUrl, requiredArtifacts.macosAppTarball.filePath, "latest/macos/kiwi-control.app.tar.gz"),
    makeLatestAlias(downloadsUrl, requiredArtifacts.windowsNsis.filePath, "latest/windows/kiwi-control-setup.exe"),
    makeLatestAlias(downloadsUrl, requiredArtifacts.windowsMsi.filePath, "latest/windows/kiwi-control.msi"),
    ...(optionalArtifacts.cliMacos ? [makeLatestAlias(downloadsUrl, optionalArtifacts.cliMacos.filePath, "latest/macos/kiwi-control-cli.tar.gz")] : []),
    ...(optionalArtifacts.cliWindows ? [makeLatestAlias(downloadsUrl, optionalArtifacts.cliWindows.filePath, "latest/windows/kiwi-control-cli.zip")] : [])
  ];

  return dedupeUploadEntries([...versionedEntries, ...metadataEntries, ...latestEntries]);
}

function makeLatestAlias(downloadsUrl, filePath, key) {
  return makeUploadEntry({
    downloadsUrl,
    key,
    filePath,
    cacheControl: latestCacheControl()
  });
}

function makeUploadEntry({ downloadsUrl, key, filePath, cacheControl }) {
  return {
    key,
    filePath,
    publicUrl: joinUrl(downloadsUrl, key),
    contentType: inferContentType(filePath),
    cacheControl: cacheControl ?? versionedCacheControl(key)
  };
}

function dedupeUploadEntries(entries) {
  const deduped = new Map();
  for (const entry of entries) {
    deduped.set(entry.key, entry);
  }
  return [...deduped.values()];
}

function sortedPublishFiles(publishRoot) {
  return readPublishFiles(publishRoot).then((entries) => entries.filter((entry) => {
    const name = path.basename(entry);
    return !name.startsWith("._") && name !== ".DS_Store";
  }).sort((left, right) => path.basename(left).localeCompare(path.basename(right))));
}

function readPublishFiles(rootDir) {
  return fs.readdir(rootDir, { withFileTypes: true }).then((entries) => {
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(rootDir, entry.name));
  });
}

async function readTrustPayload(filePath, platform) {
  if (filePath) {
    return JSON.parse(await fs.readFile(path.resolve(filePath), "utf8"));
  }

  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "verify-release-trust.mjs"), "--platform", platform, "--json"],
    {
      cwd: repoRoot,
      encoding: "utf8"
    }
  );

  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr || result.stdout || `Unable to determine ${platform} trust.`);
  }

  return JSON.parse(result.stdout);
}

async function putObject({ bucket, key, filePath, contentType, cacheControl }) {
  const args = [
    "--yes",
    "wrangler",
    "r2",
    "object",
    "put",
    `${bucket}/${key}`,
    "--remote",
    "--file",
    filePath,
    "--content-type",
    contentType,
    "--cache-control",
    cacheControl
  ];
  const result = spawnSync("npx", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env
  });

  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr || result.stdout || `npx ${args.join(" ")} failed`);
  }
}

function inferContentType(filePath) {
  const fileName = path.basename(filePath).toLowerCase();
  if (fileName.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  if (fileName.endsWith(".txt")) {
    return "text/plain; charset=utf-8";
  }
  if (fileName.endsWith(".dmg")) {
    return "application/x-apple-diskimage";
  }
  if (fileName.endsWith(".msi")) {
    return "application/x-msi";
  }
  if (fileName.endsWith(".exe")) {
    return "application/vnd.microsoft.portable-executable";
  }
  if (fileName.endsWith(".zip")) {
    return "application/zip";
  }
  if (fileName.endsWith(".tar.gz")) {
    return "application/gzip";
  }
  return "application/octet-stream";
}

function latestCacheControl() {
  return "public, max-age=300";
}

function versionedCacheControl(key) {
  return key.startsWith("latest/") ? latestCacheControl() : "public, max-age=31536000, immutable";
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function joinUrl(baseUrl, pathname) {
  return `${stripTrailingSlash(baseUrl)}/${pathname.replace(/^\/+/, "")}`;
}
