#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));

const publishRoot = path.resolve(args.publishRoot ?? path.join(repoRoot, "dist", "release", "publish"));
const manifestPath = path.join(publishRoot, "release-manifest.json");
const outputPath = path.resolve(args.output ?? path.join(publishRoot, "downloads.json"));
const repo = args.repo ?? process.env.GITHUB_REPOSITORY ?? "";
const repoUrl = stripTrailingSlash(args.repoUrl ?? process.env.REPO_URL ?? "https://github.com/sonishrey9/kiwi-control-backup");
const releaseTag = args.releaseTag ?? "";

if (!repo) {
  throw new Error("Missing GitHub repository. Pass --repo or set GITHUB_REPOSITORY.");
}

if (!releaseTag) {
  throw new Error("Missing release tag. Pass --release-tag.");
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const release = await resolveRelease({
  repo,
  releaseTag,
  releaseJsonPath: args.releaseJson
});

const assetUrls = new Map(
  (release.assets ?? [])
    .filter((asset) => typeof asset.name === "string" && typeof asset.browser_download_url === "string")
    .map((asset) => [asset.name, asset.browser_download_url])
);

const macosTrust = await readTrustPayload(args.macosTrustJson, "macos");
const windowsTrust = await readTrustPayload(args.windowsTrustJson, "windows");

const payload = buildDownloadsPayload({
  manifest,
  repoUrl,
  releaseTag,
  assetUrls,
  macosTrust,
  windowsTrust
});

await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      repo,
      releaseTag,
      output: path.relative(repoRoot, outputPath).replace(/\\/g, "/"),
      publicReleaseReady: payload.publicReleaseReady,
      publishedArtifacts: Object.entries(payload.artifacts)
        .filter(([, artifact]) => Boolean(artifact.latestUrl))
        .map(([key]) => key),
      trust: payload.trust
    },
    null,
    2
  )
);

function parseArgs(argv) {
  const parsed = {
    publishRoot: null,
    repo: null,
    repoUrl: null,
    releaseTag: null,
    releaseJson: null,
    output: null,
    macosTrustJson: null,
    windowsTrustJson: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--publish-root") {
      parsed.publishRoot = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--repo") {
      parsed.repo = argv[index + 1] ?? null;
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
    if (token === "--release-json") {
      parsed.releaseJson = argv[index + 1] ?? null;
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
  }

  return parsed;
}

async function resolveRelease({ repo, releaseTag, releaseJsonPath }) {
  if (releaseJsonPath) {
    return JSON.parse(await fs.readFile(path.resolve(releaseJsonPath), "utf8"));
  }

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "kiwi-control-release-metadata"
  };
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${releaseTag}`, {
    headers
  });

  if (!response.ok) {
    throw new Error(`GitHub release lookup failed for ${repo}@${releaseTag}: ${response.status}`);
  }

  return await response.json();
}

async function readTrustPayload(filePath, fallbackClassification) {
  if (!filePath) {
    return fallbackClassification;
  }

  try {
    const payload = JSON.parse(await fs.readFile(path.resolve(filePath), "utf8"));
    return payload.classification ?? fallbackClassification;
  } catch {
    return fallbackClassification;
  }
}

function buildDownloadsPayload({
  manifest,
  repoUrl,
  releaseTag,
  assetUrls,
  macosTrust,
  windowsTrust
}) {
  const artifactDescriptors = {
    macosPkg: {
      filename: "kiwi-control.pkg",
      candidates: findManifestAssets(manifest, "desktop-pkg", "macos")
    },
    macosDmg: {
      filename: "kiwi-control.dmg",
      candidates: findManifestAssets(manifest, "desktop-dmg", "macos")
    },
    macosAppTarball: {
      filename: "kiwi-control.app.tar.gz",
      candidates: findManifestAssets(manifest, "desktop-app", "macos")
    },
    windowsNsis: {
      filename: "kiwi-control-setup.exe",
      candidates: findManifestAssets(manifest, "desktop-nsis", "windows")
    },
    windowsMsi: {
      filename: "kiwi-control.msi",
      candidates: findManifestAssets(manifest, "desktop-msi", "windows")
    },
    cliMacos: {
      filename: "kiwi-control-cli.tar.gz",
      candidates: findManifestAssets(manifest, "cli", "macos")
    },
    cliMacosAarch64: {
      filename: "kiwi-control-cli-macos-aarch64.tar.gz",
      candidates: findManifestAssets(manifest, "cli", "macos", "aarch64")
    },
    cliMacosX64: {
      filename: "kiwi-control-cli-macos-x64.tar.gz",
      candidates: findManifestAssets(manifest, "cli", "macos", "x64")
    },
    runtimeMacos: {
      filename: "kiwi-control-runtime.tar.gz",
      candidates: findManifestAssets(manifest, "runtime", "macos")
    },
    runtimeMacosAarch64: {
      filename: "kiwi-control-runtime-macos-aarch64.tar.gz",
      candidates: findManifestAssets(manifest, "runtime", "macos", "aarch64")
    },
    runtimeMacosX64: {
      filename: "kiwi-control-runtime-macos-x64.tar.gz",
      candidates: findManifestAssets(manifest, "runtime", "macos", "x64")
    },
    cliLinux: {
      filename: "kiwi-control-cli-linux-x64.tar.gz",
      candidates: findManifestAssets(manifest, "cli", "linux", "x64")
    },
    runtimeLinux: {
      filename: "kiwi-control-runtime-linux-x64.tar.gz",
      candidates: findManifestAssets(manifest, "runtime", "linux", "x64")
    },
    cliWindows: {
      filename: "kiwi-control-cli.zip",
      candidates: findManifestAssets(manifest, "cli", "windows", "x64")
    },
    runtimeWindows: {
      filename: "kiwi-control-runtime-windows-x64.tar.gz",
      candidates: findManifestAssets(manifest, "runtime", "windows", "x64")
    }
  };

  const artifacts = Object.fromEntries(
    Object.entries(artifactDescriptors).map(([key, descriptor]) => [
      key,
      selectPublishedArtifact(descriptor.filename, descriptor.candidates, assetUrls)
    ])
  );

  const checksumsUrl = assetUrls.get("SHA256SUMS.txt") ?? null;
  const manifestUrl = assetUrls.get("release-manifest.json") ?? null;
  const hasDesktopAsset = [
    artifacts.macosDmg.latestUrl,
    artifacts.macosAppTarball.latestUrl,
    artifacts.windowsNsis.latestUrl,
    artifacts.windowsMsi.latestUrl
  ].some(Boolean);

  return {
    publicReleaseReady: Boolean(checksumsUrl && manifestUrl && hasDesktopAsset),
    tagName: releaseTag,
    version: manifest.version,
    channel: manifest.channel ?? inferChannel(manifest.version),
    releaseNotesUrl: `${repoUrl}/releases/tag/${releaseTag}`,
    sourceUrl: `${repoUrl}/releases`,
    checksumsUrl,
    manifestUrl,
    trust: {
      macos: macosTrust,
      windows: windowsTrust
    },
    artifacts
  };
}

function selectPublishedArtifact(filename, candidates, assetUrls) {
  const match = candidates
    .map((candidate) => ({
      fileName: candidate.fileName,
      url: assetUrls.get(candidate.fileName) ?? null
    }))
    .find((candidate) => candidate.url);

  if (!match) {
    return {
      filename,
      latestUrl: null,
      versionedUrl: null
    };
  }

  return {
    filename,
    latestUrl: match.url,
    versionedUrl: match.url
  };
}

function findManifestAssets(manifest, artifactType, platform, arch) {
  return manifest.artifacts
    .filter((artifact) => (
      artifact.artifactType === artifactType
      && (!platform || !artifact.platform || artifact.platform === platform)
      && (!arch || !artifact.arch || artifact.arch === arch)
    ))
    .map((artifact) => ({
      ...artifact,
      fileName: renderTemplateArtifactName(
        artifact.fileName,
        platform ?? artifact.platform ?? "linux",
        arch ?? artifact.arch ?? "x64"
      )
    }))
    .sort((left, right) => archPriority(left.arch) - archPriority(right.arch));
}

function renderTemplateArtifactName(template, platformValue, archValue) {
  return template.replaceAll("${os}", platformValue).replaceAll("${arch}", archValue);
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

function inferChannel(version) {
  return version.includes("beta") ? "beta" : "stable";
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
