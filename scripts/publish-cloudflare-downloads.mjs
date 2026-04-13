#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_CHECK_ATTEMPTS = 5;
const URL_CHECK_DELAY_MS = 3000;
const CORE_ARTIFACT_KEYS = ["macosPkg", "macosAppTarball", "windowsNsis", "windowsMsi"];
const ARTIFACT_DESCRIPTORS = {
  macosPkg: {
    artifactType: "desktop-pkg",
    platform: "macos",
    latestKey: "latest/macos/kiwi-control.pkg",
    fallbackFilename: "kiwi-control.pkg"
  },
  macosDmg: {
    artifactType: "desktop-dmg",
    platform: "macos",
    latestKey: "latest/macos/kiwi-control.dmg",
    fallbackFilename: "kiwi-control.dmg"
  },
  macosAppTarball: {
    artifactType: "desktop-app",
    platform: "macos",
    latestKey: "latest/macos/kiwi-control.app.tar.gz",
    fallbackFilename: "kiwi-control.app.tar.gz"
  },
  windowsNsis: {
    artifactType: "desktop-nsis",
    platform: "windows",
    latestKey: "latest/windows/kiwi-control-setup.exe",
    fallbackFilename: "kiwi-control-setup.exe"
  },
  windowsMsi: {
    artifactType: "desktop-msi",
    platform: "windows",
    latestKey: "latest/windows/kiwi-control.msi",
    fallbackFilename: "kiwi-control.msi"
  },
  cliMacos: {
    artifactType: "cli",
    platform: "macos",
    latestKey: "latest/macos/kiwi-control-cli.tar.gz",
    fallbackFilename: "kiwi-control-cli.tar.gz"
  },
  cliWindows: {
    artifactType: "cli",
    platform: "windows",
    latestKey: "latest/windows/kiwi-control-cli.zip",
    fallbackFilename: "kiwi-control-cli.zip"
  }
};

const args = parseArgs(process.argv.slice(2));

const publishRoot = path.resolve(args.publishRoot ?? path.join(repoRoot, "dist", "release", "publish"));
const manifestPath = path.join(publishRoot, "release-manifest.json");
const checksumsPath = path.join(publishRoot, "SHA256SUMS.txt");
const outputPath = path.resolve(args.output ?? path.join(publishRoot, "downloads.json"));
const downloadsUrl = stripTrailingSlash(args.downloadsUrl ?? process.env.DOWNLOADS_URL ?? "");
const bucket = args.bucket ?? process.env.CLOUDFLARE_R2_BUCKET ?? "";

if (!downloadsUrl) {
  throw new Error("Missing downloads base URL. Pass --downloads-url or set DOWNLOADS_URL.");
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
await fs.access(checksumsPath);

const metadataOnly = args.metadataOnly === true;
const requireCoreArtifacts = args.requireCoreArtifacts === true;
const requireReady = args.requireReady === true;
const shouldCheckPublicUrls = !args.dryRun && !args.skipPublicUrlCheck;
const tagName = args.releaseTag ?? `v${manifest.version}`;
const releaseNotesUrl = stripOptionalUrl(args.releaseNotesUrl ?? null);
const sourceUrl = stripOptionalUrl(args.sourceUrl ?? null);
const macosTrust = await readTrustPayload(args.macosTrustJson, "macos");
const windowsTrust = await readTrustPayload(args.windowsTrustJson, "windows");

const artifacts = Object.fromEntries(
  await Promise.all(
    Object.entries(ARTIFACT_DESCRIPTORS).map(async ([key, descriptor]) => {
      const artifact = await resolveArtifact({
        manifest,
        publishRoot,
        descriptor,
        metadataOnly,
        required: requireCoreArtifacts && CORE_ARTIFACT_KEYS.includes(key)
      });
      return [key, artifact];
    })
  )
);

const provisionalDownloads = buildDownloadsPayload({
  manifest,
  tagName,
  downloadsUrl,
  artifacts,
  macosTrust,
  windowsTrust,
  releaseNotesUrl,
  sourceUrl
});

const artifactUploadPlan = await buildUploadPlan({
  publishRoot,
  tagName,
  downloadsUrl,
  artifacts,
  metadataOnly
});

if (!args.dryRun) {
  if (!bucket) {
    throw new Error("Missing R2 bucket name. Pass --bucket or set CLOUDFLARE_R2_BUCKET.");
  }
  for (const entry of artifactUploadPlan) {
    await putObject({
      bucket,
      key: entry.key,
      filePath: entry.filePath,
      contentType: entry.contentType,
      cacheControl: entry.cacheControl
    });
  }
}

const { downloads, urlResults } = shouldCheckPublicUrls
  ? await pruneUnreachableUrls(provisionalDownloads)
  : { downloads: provisionalDownloads, urlResults: [] };

const finalDownloads = {
  ...downloads,
  publicReleaseReady: shouldCheckPublicUrls
    ? isFullyReachableRelease(downloads)
    : isStructurallyReadyRelease(downloads)
};

await fs.writeFile(outputPath, `${JSON.stringify(finalDownloads, null, 2)}\n`, "utf8");

const metadataUploadPlan = buildMetadataUploadEntries({
  publishRoot,
  tagName,
  downloadsUrl,
  outputPath
});

if (!args.dryRun) {
  for (const entry of metadataUploadPlan) {
    await putObject({
      bucket,
      key: entry.key,
      filePath: entry.filePath,
      contentType: entry.contentType,
      cacheControl: entry.cacheControl
    });
  }
}

const publishedArtifacts = Object.entries(finalDownloads.artifacts)
  .filter(([, artifact]) => Boolean(artifact?.latestUrl))
  .map(([key]) => key);
const blockingReasons = buildBlockingReasons(finalDownloads, requireReady);
const payload = {
  ok: blockingReasons.length === 0,
  dryRun: args.dryRun,
  metadataOnly,
  publishRoot: path.relative(repoRoot, publishRoot).replace(/\\/g, "/"),
  downloadsUrl,
  bucket: bucket || null,
  tagName,
  output: path.relative(repoRoot, outputPath).replace(/\\/g, "/"),
  publicReleaseReady: finalDownloads.publicReleaseReady,
  publishedArtifacts,
  trust: finalDownloads.trust,
  blockingReasons,
  urlResults,
  uploads: [...artifactUploadPlan, ...metadataUploadPlan].map((entry) => ({
    key: entry.key,
    publicUrl: entry.publicUrl,
    file: path.relative(repoRoot, entry.filePath).replace(/\\/g, "/"),
    cacheControl: entry.cacheControl
  }))
};

console.log(JSON.stringify(payload, null, 2));
process.exitCode = payload.ok ? 0 : 1;

function parseArgs(argv) {
  const parsed = {
    publishRoot: null,
    downloadsUrl: null,
    bucket: null,
    releaseTag: null,
    output: null,
    macosTrustJson: null,
    windowsTrustJson: null,
    releaseNotesUrl: null,
    sourceUrl: null,
    dryRun: false,
    metadataOnly: false,
    requireCoreArtifacts: false,
    requireReady: false,
    skipPublicUrlCheck: false
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
    if (token === "--release-tag") {
      parsed.releaseTag = argv[index + 1] ?? null;
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
    if (token === "--release-notes-url") {
      parsed.releaseNotesUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--source-url") {
      parsed.sourceUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (token === "--metadata-only") {
      parsed.metadataOnly = true;
      continue;
    }
    if (token === "--require-core-artifacts") {
      parsed.requireCoreArtifacts = true;
      continue;
    }
    if (token === "--require-ready") {
      parsed.requireReady = true;
      continue;
    }
    if (token === "--skip-public-url-check") {
      parsed.skipPublicUrlCheck = true;
    }
  }

  return parsed;
}

async function resolveArtifact({ manifest, publishRoot, descriptor, metadataOnly, required }) {
  const manifestArtifact = resolveOptionalManifestArtifact({
    manifest,
    artifactType: descriptor.artifactType,
    platform: descriptor.platform
  });

  if (!manifestArtifact) {
    if (required) {
      throw new Error(`Missing manifest artifact for ${descriptor.platform}/${descriptor.artifactType}.`);
    }
    return null;
  }

  if (metadataOnly) {
    return {
      ...manifestArtifact,
      filePath: null
    };
  }

  const filePath = path.join(publishRoot, manifestArtifact.fileName);
  try {
    const stats = await fs.stat(filePath);
    if (stats.isFile()) {
      return {
        ...manifestArtifact,
        filePath
      };
    }
  } catch {
    // Fall through to optional handling below.
  }

  if (required) {
    throw new Error(`Missing publish artifact for ${descriptor.platform}/${descriptor.artifactType}.`);
  }

  return null;
}

function resolveOptionalManifestArtifact({ manifest, artifactType, platform }) {
  return manifest.artifacts
    .filter((entry) => {
      if (entry.artifactType !== artifactType) {
        return false;
      }
      if (platform && entry.platform !== platform) {
        return false;
      }
      return true;
    })
    .sort((left, right) => archPriority(left.arch) - archPriority(right.arch))[0] ?? null;
}

function buildDownloadsPayload({
  manifest,
  tagName,
  downloadsUrl,
  artifacts,
  macosTrust,
  windowsTrust,
  releaseNotesUrl,
  sourceUrl
}) {
  return {
    publicReleaseReady: false,
    tagName,
    version: manifest.version,
    channel: manifest.channel ?? inferChannel(manifest.version),
    releaseNotesUrl,
    sourceUrl,
    checksumsUrl: joinUrl(downloadsUrl, "latest/SHA256SUMS.txt"),
    manifestUrl: joinUrl(downloadsUrl, "latest/release-manifest.json"),
    trust: {
      macos: macosTrust.classification,
      windows: windowsTrust.classification
    },
    artifacts: Object.fromEntries(
      Object.entries(ARTIFACT_DESCRIPTORS).map(([key, descriptor]) => [
        key,
        surfaceArtifact(downloadsUrl, tagName, descriptor, artifacts[key] ?? null)
      ])
    )
  };
}

function surfaceArtifact(downloadsUrl, tagName, descriptor, artifact) {
  return {
    filename: artifact?.fileName ?? descriptor.fallbackFilename,
    latestUrl: artifact ? joinUrl(downloadsUrl, descriptor.latestKey) : null,
    versionedUrl: artifact ? joinUrl(downloadsUrl, `releases/${tagName}/${artifact.fileName}`) : null
  };
}

async function buildUploadPlan({ publishRoot, tagName, downloadsUrl, artifacts, metadataOnly }) {
  const versionedEntries = [];
  const excludeNames = new Set([
    "downloads.json",
    "macos-trust.json",
    "windows-trust.json",
    "release-manifest.json",
    "SHA256SUMS.txt",
    "release-notes.md",
    "release-update.json"
  ]);

  if (!metadataOnly) {
    const publishEntries = await sortedPublishFiles(publishRoot);
    for (const entry of publishEntries) {
      if (excludeNames.has(path.basename(entry))) {
        continue;
      }
      versionedEntries.push(makeUploadEntry({
        downloadsUrl,
        key: `releases/${tagName}/${path.basename(entry)}`,
        filePath: entry
      }));
    }
  }

  const latestEntries = metadataOnly
    ? []
    : Object.entries(ARTIFACT_DESCRIPTORS)
      .flatMap(([key, descriptor]) => {
        const artifact = artifacts[key];
        if (!artifact?.filePath) {
          return [];
        }
        return [makeUploadEntry({
          downloadsUrl,
          key: descriptor.latestKey,
          filePath: artifact.filePath,
          cacheControl: latestCacheControl()
        })];
      });

  return dedupeUploadEntries([...versionedEntries, ...latestEntries]);
}

function buildMetadataUploadEntries({ publishRoot, tagName, downloadsUrl, outputPath, includeDownloadsJson = true }) {
  const entries = [
    makeUploadEntry({
      downloadsUrl,
      key: `releases/${tagName}/release-manifest.json`,
      filePath: path.join(publishRoot, "release-manifest.json")
    }),
    makeUploadEntry({
      downloadsUrl,
      key: `releases/${tagName}/SHA256SUMS.txt`,
      filePath: path.join(publishRoot, "SHA256SUMS.txt")
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
    })
  ];

  if (includeDownloadsJson) {
    entries.push(
      makeUploadEntry({
        downloadsUrl,
        key: `releases/${tagName}/downloads.json`,
        filePath: outputPath
      }),
      makeUploadEntry({
        downloadsUrl,
        key: "latest/downloads.json",
        filePath: outputPath,
        cacheControl: latestCacheControl()
      })
    );
  }

  return entries;
}

async function pruneUnreachableUrls(downloads) {
  const urlResults = await verifyUrlTargets(collectUrlTargets(downloads), {
    attempts: URL_CHECK_ATTEMPTS,
    delayMs: URL_CHECK_DELAY_MS
  });
  const statusByLabel = new Map(urlResults.map((entry) => [entry.label, entry.ok]));

  return {
    downloads: {
      ...downloads,
      releaseNotesUrl: statusByLabel.get("releaseNotesUrl") ? downloads.releaseNotesUrl : null,
      sourceUrl: statusByLabel.get("sourceUrl") ? downloads.sourceUrl : null,
      checksumsUrl: statusByLabel.get("checksumsUrl") ? downloads.checksumsUrl : null,
      manifestUrl: statusByLabel.get("manifestUrl") ? downloads.manifestUrl : null,
      artifacts: Object.fromEntries(
        Object.entries(downloads.artifacts).map(([key, artifact]) => [
          key,
          {
            ...artifact,
            latestUrl: statusByLabel.get(`${key}.latestUrl`) ? artifact.latestUrl : null,
            versionedUrl: statusByLabel.get(`${key}.versionedUrl`) ? artifact.versionedUrl : null
          }
        ])
      )
    },
    urlResults
  };
}

function collectUrlTargets(downloads) {
  const entries = [
    { label: "releaseNotesUrl", url: downloads.releaseNotesUrl, kind: "metadata" },
    { label: "sourceUrl", url: downloads.sourceUrl, kind: "metadata" },
    { label: "checksumsUrl", url: downloads.checksumsUrl, kind: "metadata" },
    { label: "manifestUrl", url: downloads.manifestUrl, kind: "metadata" }
  ];

  for (const [key, artifact] of Object.entries(downloads.artifacts ?? {})) {
    if (artifact?.latestUrl) {
      entries.push({ label: `${key}.latestUrl`, url: artifact.latestUrl, kind: "artifact" });
    }
    if (artifact?.versionedUrl) {
      entries.push({ label: `${key}.versionedUrl`, url: artifact.versionedUrl, kind: "artifact" });
    }
  }

  return entries.filter((entry) => Boolean(entry.url));
}

async function verifyUrlTargets(entries, { attempts, delayMs }) {
  const results = [];
  for (const entry of entries) {
    results.push(await verifyUrlTarget(entry, { attempts, delayMs }));
  }
  return results;
}

async function verifyUrlTarget(entry, { attempts, delayMs }) {
  let lastResult = {
    ok: false,
    status: null,
    method: "GET",
    error: "URL check did not run"
  };

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResult = await headOrGet(entry.url);
    if (lastResult.ok) {
      return {
        ...entry,
        ...lastResult,
        attemptsUsed: attempt
      };
    }
    if (attempt < attempts) {
      await delay(delayMs);
    }
  }

  return {
    ...entry,
    ...lastResult,
    attemptsUsed: attempts
  };
}

async function headOrGet(url) {
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (head.ok) {
      return {
        url,
        ok: true,
        status: head.status,
        method: "HEAD",
        error: null
      };
    }
  } catch {
    // Fall through to GET.
  }

  try {
    const get = await fetch(url, {
      method: "GET",
      headers: {
        Range: "bytes=0-0"
      }
    });
    return {
      url,
      ok: get.ok,
      status: get.status,
      method: "GET",
      error: null
    };
  } catch (error) {
    return {
      url,
      ok: false,
      status: null,
      method: "GET",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function isStructurallyReadyRelease(downloads) {
  return CORE_ARTIFACT_KEYS.every((key) => Boolean(downloads.artifacts?.[key]?.latestUrl))
    && Boolean(downloads.checksumsUrl)
    && Boolean(downloads.manifestUrl);
}

function isFullyReachableRelease(downloads) {
  return CORE_ARTIFACT_KEYS.every((key) => Boolean(downloads.artifacts?.[key]?.latestUrl))
    && Boolean(downloads.checksumsUrl)
    && Boolean(downloads.manifestUrl);
}

function buildBlockingReasons(downloads, requireReady) {
  if (!requireReady) {
    return [];
  }

  const reasons = [];
  if (!downloads.publicReleaseReady) {
    reasons.push("publicReleaseReady remained false after publication.");
  }
  for (const key of CORE_ARTIFACT_KEYS) {
    if (!downloads.artifacts?.[key]?.latestUrl) {
      reasons.push(`Missing live latestUrl for ${key}.`);
    }
  }
  if (!downloads.checksumsUrl) {
    reasons.push("Missing live checksumsUrl.");
  }
  if (!downloads.manifestUrl) {
    reasons.push("Missing live manifestUrl.");
  }
  return reasons;
}

function dedupeUploadEntries(entries) {
  const deduped = new Map();
  for (const entry of entries) {
    deduped.set(entry.key, entry);
  }
  return [...deduped.values()];
}

async function sortedPublishFiles(publishRoot) {
  const entries = await fs.readdir(publishRoot, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(publishRoot, entry.name))
    .filter((entry) => {
      const name = path.basename(entry);
      return !name.startsWith("._") && name !== ".DS_Store";
    })
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right)));
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

function makeUploadEntry({ downloadsUrl, key, filePath, cacheControl }) {
  return {
    key,
    filePath,
    publicUrl: joinUrl(downloadsUrl, key),
    contentType: inferContentType(filePath),
    cacheControl: cacheControl ?? versionedCacheControl(key)
  };
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

function inferChannel(version) {
  return version.includes("beta") ? "beta" : "stable";
}

function archPriority(arch) {
  switch (arch) {
    case "aarch64":
      return 0;
    case "x64":
      return 1;
    default:
      return 2;
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function stripOptionalUrl(value) {
  if (!value) {
    return null;
  }
  return stripTrailingSlash(value);
}

function joinUrl(baseUrl, pathname) {
  return `${stripTrailingSlash(baseUrl)}/${pathname.replace(/^\/+/, "")}`;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
