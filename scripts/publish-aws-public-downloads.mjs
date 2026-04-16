#!/usr/bin/env node
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  buildAwsEnv,
  headOrGet,
  immutableCacheControl,
  inferContentType,
  joinUrl,
  latestCacheControl,
  repoRoot,
  runAws,
  stripTrailingSlash
} from "./aws-public-common.mjs";

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
  cliMacosAarch64: {
    artifactType: "cli",
    platform: "macos",
    arch: "aarch64",
    latestKey: "latest/macos/aarch64/kiwi-control-cli.tar.gz",
    fallbackFilename: "kiwi-control-cli-macos-aarch64.tar.gz"
  },
  cliMacosX64: {
    artifactType: "cli",
    platform: "macos",
    arch: "x64",
    latestKey: "latest/macos/x64/kiwi-control-cli.tar.gz",
    fallbackFilename: "kiwi-control-cli-macos-x64.tar.gz"
  },
  runtimeMacos: {
    artifactType: "runtime",
    platform: "macos",
    latestKey: "latest/macos/kiwi-control-runtime.tar.gz",
    fallbackFilename: "kiwi-control-runtime.tar.gz"
  },
  runtimeMacosAarch64: {
    artifactType: "runtime",
    platform: "macos",
    arch: "aarch64",
    latestKey: "latest/macos/aarch64/kiwi-control-runtime.tar.gz",
    fallbackFilename: "kiwi-control-runtime-macos-aarch64.tar.gz"
  },
  runtimeMacosX64: {
    artifactType: "runtime",
    platform: "macos",
    arch: "x64",
    latestKey: "latest/macos/x64/kiwi-control-runtime.tar.gz",
    fallbackFilename: "kiwi-control-runtime-macos-x64.tar.gz"
  },
  cliLinux: {
    artifactType: "cli",
    platform: "linux",
    arch: "x64",
    latestKey: "latest/linux/kiwi-control-cli.tar.gz",
    fallbackFilename: "kiwi-control-cli-linux-x64.tar.gz"
  },
  runtimeLinux: {
    artifactType: "runtime",
    platform: "linux",
    arch: "x64",
    latestKey: "latest/linux/kiwi-control-runtime.tar.gz",
    fallbackFilename: "kiwi-control-runtime-linux-x64.tar.gz"
  },
  cliWindows: {
    artifactType: "cli",
    platform: "windows",
    arch: "x64",
    latestKey: "latest/windows/kiwi-control-cli.zip",
    fallbackFilename: "kiwi-control-cli.zip"
  },
  runtimeWindows: {
    artifactType: "runtime",
    platform: "windows",
    arch: "x64",
    latestKey: "latest/windows/kiwi-control-runtime.tar.gz",
    fallbackFilename: "kiwi-control-runtime-windows-x64.tar.gz"
  }
};

const args = parseArgs(process.argv.slice(2));

const publishRoot = path.resolve(args.publishRoot ?? path.join(repoRoot, "dist", "release", "publish"));
const manifestPath = path.join(publishRoot, "release-manifest.json");
const checksumsPath = path.join(publishRoot, "SHA256SUMS.txt");
const outputPath = path.resolve(args.output ?? path.join(publishRoot, "downloads.json"));
const siteUrl = stripTrailingSlash(firstNonEmpty(args.siteUrl, process.env.SITE_URL, ""));
const bucket = firstNonEmpty(args.bucket, process.env.AWS_PUBLIC_BUCKET, siteUrl ? new URL(siteUrl).hostname : "");

if (!siteUrl) {
  throw new Error("Missing site base URL. Pass --site-url or set SITE_URL.");
}
if (!bucket) {
  throw new Error("Missing AWS public bucket. Pass --bucket or set AWS_PUBLIC_BUCKET.");
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
  siteUrl,
  artifacts,
  macosTrust,
  windowsTrust,
  releaseNotesUrl,
  sourceUrl
});

const artifactUploadPlan = await buildArtifactUploadPlan({
  publishRoot,
  tagName,
  siteUrl,
  artifacts,
  metadataOnly
});

if (!args.dryRun) {
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
    ? isReady(downloads)
    : isStructurallyReady(downloads)
};

await fs.writeFile(outputPath, `${JSON.stringify(finalDownloads, null, 2)}\n`, "utf8");

const metadataUploadPlan = buildMetadataUploadPlan({
  publishRoot,
  tagName,
  siteUrl,
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
  siteUrl,
  bucket,
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
    siteUrl: null,
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
    if (token === "--site-url") {
      parsed.siteUrl = argv[index + 1] ?? null;
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

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === "string" ? value.length > 0 : value != null);
}

async function resolveArtifact({ manifest, publishRoot, descriptor, metadataOnly, required }) {
  const manifestArtifact = materializeManifestArtifact(resolveOptionalManifestArtifact({
    manifest,
    artifactType: descriptor.artifactType,
    platform: descriptor.platform,
    arch: descriptor.arch
  }), descriptor);

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
    // Fall through.
  }

  if (required) {
    throw new Error(`Missing publish artifact for ${descriptor.platform}/${descriptor.artifactType}.`);
  }

  return null;
}

function resolveOptionalManifestArtifact({ manifest, artifactType, platform, arch }) {
  return manifest.artifacts
    .filter((entry) => {
      if (entry.artifactType !== artifactType) {
        return false;
      }
      if (platform && entry.platform && entry.platform !== platform) {
        return false;
      }
      if (arch && entry.arch && entry.arch !== arch) {
        return false;
      }
      return true;
    })
    .sort((left, right) => archPriority(left.arch) - archPriority(right.arch))[0] ?? null;
}

function materializeManifestArtifact(artifact, descriptor) {
  if (!artifact) {
    return null;
  }

  return {
    ...artifact,
    fileName: renderTemplateArtifactName(
      artifact.fileName,
      descriptor.platform ?? artifact.platform ?? "linux",
      descriptor.arch ?? artifact.arch ?? "x64"
    )
  };
}

function buildDownloadsPayload({
  manifest,
  tagName,
  siteUrl,
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
    checksumsUrl: joinUrl(siteUrl, "latest/SHA256SUMS.txt"),
    manifestUrl: joinUrl(siteUrl, "latest/release-manifest.json"),
    trust: {
      macos: macosTrust.classification,
      windows: windowsTrust.classification
    },
    artifacts: Object.fromEntries(
      Object.entries(ARTIFACT_DESCRIPTORS).map(([key, descriptor]) => [
        key,
        surfaceArtifact(siteUrl, tagName, descriptor, artifacts[key] ?? null)
      ])
    )
  };
}

function surfaceArtifact(siteUrl, tagName, descriptor, artifact) {
  return {
    filename: artifact?.fileName ?? descriptor.fallbackFilename,
    latestUrl: artifact ? joinUrl(siteUrl, descriptor.latestKey) : null,
    versionedUrl: artifact ? joinUrl(siteUrl, `releases/${tagName}/${artifact.fileName}`) : null
  };
}

function renderTemplateArtifactName(template, platformValue, archValue) {
  return template.replaceAll("${os}", platformValue).replaceAll("${arch}", archValue);
}

async function buildArtifactUploadPlan({ publishRoot, tagName, siteUrl, artifacts, metadataOnly }) {
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
        siteUrl,
        key: `releases/${tagName}/${path.basename(entry)}`,
        filePath: entry,
        cacheControl: immutableCacheControl()
      }));
    }
  }

  const latestEntries = metadataOnly
    ? []
    : Object.entries(ARTIFACT_DESCRIPTORS).flatMap(([key, descriptor]) => {
      const artifact = artifacts[key];
      if (!artifact?.filePath) {
        return [];
      }
      return [makeUploadEntry({
        siteUrl,
        key: descriptor.latestKey,
        filePath: artifact.filePath,
        cacheControl: latestCacheControl()
      })];
    });

  return dedupeUploadEntries([...versionedEntries, ...latestEntries]);
}

function buildMetadataUploadPlan({ publishRoot, tagName, siteUrl, outputPath }) {
  return [
    makeUploadEntry({
      siteUrl,
      key: `releases/${tagName}/release-manifest.json`,
      filePath: path.join(publishRoot, "release-manifest.json"),
      cacheControl: immutableCacheControl()
    }),
    makeUploadEntry({
      siteUrl,
      key: `releases/${tagName}/SHA256SUMS.txt`,
      filePath: path.join(publishRoot, "SHA256SUMS.txt"),
      cacheControl: immutableCacheControl()
    }),
    makeUploadEntry({
      siteUrl,
      key: `releases/${tagName}/downloads.json`,
      filePath: outputPath,
      cacheControl: immutableCacheControl()
    }),
    makeUploadEntry({
      siteUrl,
      key: "latest/release-manifest.json",
      filePath: path.join(publishRoot, "release-manifest.json"),
      cacheControl: latestCacheControl()
    }),
    makeUploadEntry({
      siteUrl,
      key: "latest/SHA256SUMS.txt",
      filePath: path.join(publishRoot, "SHA256SUMS.txt"),
      cacheControl: latestCacheControl()
    }),
    makeUploadEntry({
      siteUrl,
      key: "latest/downloads.json",
      filePath: outputPath,
      cacheControl: latestCacheControl()
    })
  ];
}

async function pruneUnreachableUrls(downloads) {
  const urlResults = await verifyUrlTargets(collectUrlTargets(downloads), {
    attempts: URL_CHECK_ATTEMPTS,
    delayMs: URL_CHECK_DELAY_MS
  });
  const okByLabel = new Map(urlResults.map((entry) => [entry.label, entry.ok]));

  return {
    downloads: {
      ...downloads,
      releaseNotesUrl: okByLabel.get("releaseNotesUrl") ? downloads.releaseNotesUrl : null,
      sourceUrl: okByLabel.get("sourceUrl") ? downloads.sourceUrl : null,
      checksumsUrl: okByLabel.get("checksumsUrl") ? downloads.checksumsUrl : null,
      manifestUrl: okByLabel.get("manifestUrl") ? downloads.manifestUrl : null,
      artifacts: Object.fromEntries(
        Object.entries(downloads.artifacts).map(([key, artifact]) => [
          key,
          {
            ...artifact,
            latestUrl: okByLabel.get(`${key}.latestUrl`) ? artifact.latestUrl : null,
            versionedUrl: okByLabel.get(`${key}.versionedUrl`) ? artifact.versionedUrl : null
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
    let last = { ok: false, status: null, method: "GET", error: "URL check did not run" };
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      last = await headOrGet(entry.url);
      if (last.ok) {
        results.push({ ...entry, ...last, attemptsUsed: attempt });
        last = null;
        break;
      }
      if (attempt < attempts) {
        await delay(delayMs);
      }
    }
    if (last) {
      results.push({ ...entry, ...last, attemptsUsed: attempts });
    }
  }
  return results;
}

function isStructurallyReady(downloads) {
  return CORE_ARTIFACT_KEYS.every((key) => Boolean(downloads.artifacts?.[key]?.latestUrl))
    && Boolean(downloads.checksumsUrl)
    && Boolean(downloads.manifestUrl);
}

function isReady(downloads) {
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
    reasons.push("publicReleaseReady remained false after AWS publication.");
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

  const env = buildAwsEnv();
  const result = spawnSync(process.execPath, [
    path.join(repoRoot, "scripts", "verify-release-trust.mjs"),
    "--platform",
    platform,
    "--json"
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    env
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr || result.stdout || `Unable to determine ${platform} trust.`);
  }
  return JSON.parse(result.stdout);
}

async function putObject({ bucket, key, filePath, contentType, cacheControl }) {
  runAws([
    "s3api",
    "put-object",
    "--bucket",
    bucket,
    "--key",
    key,
    "--body",
    filePath,
    "--content-type",
    contentType,
    "--cache-control",
    cacheControl
  ]);
}

function makeUploadEntry({ siteUrl, key, filePath, cacheControl }) {
  return {
    key,
    filePath,
    publicUrl: joinUrl(siteUrl, key),
    contentType: inferContentType(filePath),
    cacheControl
  };
}

function stripOptionalUrl(value) {
  if (!value) {
    return null;
  }
  return stripTrailingSlash(value);
}

function dedupeUploadEntries(entries) {
  const deduped = new Map();
  for (const entry of entries) {
    deduped.set(entry.key, entry);
  }
  return [...deduped.values()];
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

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
