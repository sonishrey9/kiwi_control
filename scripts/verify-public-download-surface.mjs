#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { loadLocalEnv } from "./load-local-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_ARTIFACT_KINDS = ["macosPkg", "macosAppTarball", "windowsNsis", "windowsMsi"];

loadLocalEnv();
const args = parseArgs(process.argv.slice(2));

await main();

async function main() {
  const downloadsUrl = stripTrailingSlash(args.downloadsUrl ?? process.env.DOWNLOADS_URL ?? "");
  const payload = args.siteDir
    ? await verifyLocalSite(path.resolve(args.siteDir), {
        downloadsUrl,
        requireReady: args.requireReady
      })
    : await verifyRemoteSite({
        siteUrl: stripTrailingSlash(args.siteUrl ?? process.env.SITE_URL ?? ""),
        downloadsUrl,
        requireReady: args.requireReady
      });

  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = payload.ok ? 0 : 1;
}

function parseArgs(argv) {
  const parsed = {
    siteUrl: null,
    downloadsUrl: null,
    siteDir: null,
    requireReady: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--site-url") {
      parsed.siteUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--downloads-url") {
      parsed.downloadsUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--site-dir") {
      parsed.siteDir = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--require-ready") {
      parsed.requireReady = true;
    }
  }

  return parsed;
}

async function verifyLocalSite(siteDir, { downloadsUrl, requireReady }) {
  const indexHtml = await fs.readFile(path.join(siteDir, "index.html"), "utf8");
  const downloadsHtml = await fs.readFile(path.join(siteDir, "downloads", "index.html"), "utf8");
  const installHtml = await fs.readFile(path.join(siteDir, "install", "index.html"), "utf8");
  const metadata = JSON.parse(await fs.readFile(path.join(siteDir, "data", "latest-release.json"), "utf8"));
  const sidecars = await findMetadataArtifacts(siteDir);
  const releaseReady = metadata.publicReleaseReady === true;
  const missingPhrases = [
    ...missingPhrase(downloadsHtml, "Public hosting does not replace signing proof")
  ];
  const platformSplitMissing = [
    ...missingPhrase(indexHtml, "macOS pkg installer is the intended default path"),
    ...missingPhrase(downloadsHtml, "setup EXE is the intended default Windows path"),
    ...missingPhrase(installHtml, "proof is still pending on a real Windows host"),
    ...missingPhrase(downloadsHtml, "curl -fsSL https://kiwi-control.kiwi-ai.in/install.sh | bash"),
    ...missingPhrase(downloadsHtml, "irm https://kiwi-control.kiwi-ai.in/install.ps1 | iex"),
    ...missingPhrase(downloadsHtml, expectedWindowsCliPhrase(metadata)),
    ...missingPhrase(downloadsHtml, expectedWindowsDesktopPhrase(metadata))
  ];
  const invalidReleaseReadyMetadata = releaseReady ? validateReleaseReadyMetadata(metadata) : [];
  const renderedLinkIssues = validateRenderedLinks(downloadsHtml, metadata);
  const readinessErrors = requireReady && !releaseReady ? ["publicReleaseReady remained false"] : [];
  const oldWordings = [
    ...containsPhrase(indexHtml, "GitHub Releases stays the source of truth"),
    ...containsPhrase(downloadsHtml, "GitHub Releases is the source of truth")
  ];
  const overclaims = [
    ...containsPhrase(indexHtml, "ready by default"),
    ...containsPhrase(downloadsHtml, "ready by default"),
    ...containsPhrase(installHtml, "ready by default")
  ];

  let downloadsMirrorMismatch = [];
  let downloadsMetadataSummary = null;
  if (downloadsUrl) {
    const remoteDownloads = await fetchJsonOrThrow(`${downloadsUrl}/latest/downloads.json`);
    downloadsMetadataSummary = {
      remoteUrl: `${downloadsUrl}/latest/downloads.json`,
      mirrored: normalizeMetadata(metadata)
    };
    downloadsMirrorMismatch = compareMetadata(metadata, remoteDownloads);
  }

  return {
    ok:
      missingPhrases.length === 0
      && platformSplitMissing.length === 0
      && sidecars.length === 0
      && oldWordings.length === 0
      && overclaims.length === 0
      && invalidReleaseReadyMetadata.length === 0
      && renderedLinkIssues.length === 0
      && readinessErrors.length === 0
      && downloadsMirrorMismatch.length === 0,
    mode: "local",
    siteDir: path.relative(repoRoot, siteDir).replace(/\\/g, "/"),
    downloadsUrl: downloadsUrl || null,
    missingPhrases,
    platformSplitMissing,
    sidecars,
    oldWordings,
    overclaims,
    readinessErrors,
    invalidReleaseReadyMetadata,
    renderedLinkIssues,
    downloadsMirrorMismatch,
    downloadsMetadataSummary,
    metadataSummary: {
      tagName: metadata.tagName,
      checksumsUrl: metadata.checksumsUrl,
      manifestUrl: metadata.manifestUrl
    }
  };
}

async function verifyRemoteSite({ siteUrl, downloadsUrl, requireReady }) {
  if (!siteUrl) {
    throw new Error("Missing site URL. Pass --site-url or set SITE_URL.");
  }

  const siteResponse = await fetchOrThrow(siteUrl);
  const downloadsResponse = await fetchOrThrow(`${siteUrl}/downloads/`);
  const installResponse = await fetchOrThrow(`${siteUrl}/install/`);
  const metadataResponse = await fetchOrThrow(`${siteUrl}/data/latest-release.json`);
  const metadataContentType = metadataResponse.headers.get("content-type") ?? "";
  const metadata = await metadataResponse.json();

  const siteHtml = await siteResponse.text();
  const downloadsHtml = await downloadsResponse.text();
  const installHtml = await installResponse.text();
  const releaseReady = metadata.publicReleaseReady === true;
  const missingPhrases = [
    ...missingPhrase(downloadsHtml, "Public hosting does not replace signing proof")
  ];
  const platformSplitMissing = [
    ...missingPhrase(siteHtml, "macOS pkg installer is the intended default path"),
    ...missingPhrase(downloadsHtml, "setup EXE is the intended default Windows path"),
    ...missingPhrase(installHtml, "proof is still pending on a real Windows host"),
    ...missingPhrase(downloadsHtml, "curl -fsSL https://kiwi-control.kiwi-ai.in/install.sh | bash"),
    ...missingPhrase(downloadsHtml, "irm https://kiwi-control.kiwi-ai.in/install.ps1 | iex"),
    ...missingPhrase(downloadsHtml, expectedWindowsCliPhrase(metadata)),
    ...missingPhrase(downloadsHtml, expectedWindowsDesktopPhrase(metadata))
  ];
  const invalidReleaseReadyMetadata = releaseReady ? validateReleaseReadyMetadata(metadata) : [];
  const renderedLinkIssues = validateRenderedLinks(downloadsHtml, metadata);
  const readinessErrors = requireReady && !releaseReady ? ["publicReleaseReady remained false"] : [];
  const oldWordings = [
    ...containsPhrase(siteHtml, "GitHub Releases stays the source of truth"),
    ...containsPhrase(downloadsHtml, "GitHub Releases is the source of truth")
  ];
  const overclaims = [
    ...containsPhrase(siteHtml, "ready by default"),
    ...containsPhrase(downloadsHtml, "ready by default"),
    ...containsPhrase(installHtml, "ready by default")
  ];
  const invalidMetadataContentType = metadataContentType.includes("application/json") ? [] : [metadataContentType || "missing content-type"];
  const publishedUrlResults = await verifyPublishedUrls(collectPublishedUrls(metadata));
  const artifactResults = publishedUrlResults.filter((entry) => entry.kind === "artifact");
  const auxiliaryResults = publishedUrlResults.filter((entry) => entry.kind !== "artifact");

  let downloadsMirrorMismatch = [];
  let downloadsMetadataUrl = null;
  if (downloadsUrl) {
    downloadsMetadataUrl = `${downloadsUrl}/latest/downloads.json`;
    const remoteDownloads = await fetchJsonOrThrow(downloadsMetadataUrl);
    downloadsMirrorMismatch = compareMetadata(metadata, remoteDownloads);
  }

  return {
    ok:
      missingPhrases.length === 0
      && platformSplitMissing.length === 0
      && oldWordings.length === 0
      && overclaims.length === 0
      && readinessErrors.length === 0
      && invalidReleaseReadyMetadata.length === 0
      && renderedLinkIssues.length === 0
      && invalidMetadataContentType.length === 0
      && downloadsMirrorMismatch.length === 0
      && publishedUrlResults.every((entry) => entry.ok),
    mode: "remote",
    siteUrl,
    downloadsUrl: downloadsUrl || null,
    downloadsMetadataUrl,
    missingPhrases,
    platformSplitMissing,
    oldWordings,
    overclaims,
    readinessErrors,
    invalidReleaseReadyMetadata,
    renderedLinkIssues,
    invalidMetadataContentType,
    downloadsMirrorMismatch,
    metadataResults: auxiliaryResults,
    artifactResults
  };
}

async function fetchJsonOrThrow(url) {
  const response = await fetchOrThrow(url);
  return response.json();
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

async function fetchOrThrow(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response;
}

function missingPhrase(content, phrase) {
  return content.includes(phrase) ? [] : [phrase];
}

function containsPhrase(content, phrase) {
  return content.includes(phrase) ? [phrase] : [];
}

function expectedWindowsCliPhrase(metadata) {
  return metadata.artifacts?.cliWindows?.latestUrl
    ? "Windows PowerShell bootstrap"
    : "Windows CLI bundle coming soon";
}

function expectedWindowsDesktopPhrase(metadata) {
  return metadata.artifacts?.windowsNsis?.latestUrl || metadata.artifacts?.windowsMsi?.latestUrl
    ? "Download Windows setup EXE"
    : "Windows setup EXE coming soon";
}

function validateReleaseReadyMetadata(metadata) {
  const issues = [];
  if (!metadata.checksumsUrl) {
    issues.push("checksumsUrl");
  }
  if (!metadata.manifestUrl) {
    issues.push("manifestUrl");
  }
  for (const kind of REQUIRED_ARTIFACT_KINDS) {
    if (!metadata.artifacts?.[kind]?.latestUrl) {
      issues.push(`${kind}.latestUrl`);
    }
  }
  return issues;
}

function validateRenderedLinks(downloadsHtml, metadata) {
  const issues = [];
  for (const [key, artifact] of Object.entries(metadata.artifacts ?? {})) {
    if (artifact?.latestUrl && !downloadsHtml.includes(artifact.latestUrl)) {
      issues.push(`downloads page does not render ${key}.latestUrl`);
    }
  }
  return issues;
}

function collectPublishedUrls(metadata) {
  const urls = [
    { label: "releaseNotesUrl", url: metadata.releaseNotesUrl, kind: "metadata" },
    { label: "sourceUrl", url: metadata.sourceUrl, kind: "metadata" },
    { label: "checksumsUrl", url: metadata.checksumsUrl, kind: "metadata" },
    { label: "manifestUrl", url: metadata.manifestUrl, kind: "metadata" }
  ];

  for (const [key, artifact] of Object.entries(metadata.artifacts ?? {})) {
    if (artifact?.latestUrl) {
      urls.push({ label: `${key}.latestUrl`, url: artifact.latestUrl, kind: "artifact" });
    }
    if (artifact?.versionedUrl) {
      urls.push({ label: `${key}.versionedUrl`, url: artifact.versionedUrl, kind: "artifact" });
    }
  }

  return urls.filter((entry) => Boolean(entry.url));
}

async function verifyPublishedUrls(entries) {
  const results = [];
  for (const entry of entries) {
    const check = await headOrGet(entry.url);
    results.push({
      ...entry,
      ...check
    });
  }
  return results;
}

function compareMetadata(siteMetadata, remoteMetadata) {
  const left = JSON.stringify(normalizeMetadata(siteMetadata));
  const right = JSON.stringify(normalizeMetadata(remoteMetadata));
  return left === right ? [] : ["site metadata does not mirror downloads metadata exactly"];
}

function normalizeMetadata(metadata) {
  return {
    publicReleaseReady: metadata.publicReleaseReady === true,
    tagName: metadata.tagName ?? null,
    version: metadata.version ?? null,
    channel: metadata.channel ?? null,
    releaseNotesUrl: metadata.releaseNotesUrl ?? null,
    sourceUrl: metadata.sourceUrl ?? null,
    checksumsUrl: metadata.checksumsUrl ?? null,
    manifestUrl: metadata.manifestUrl ?? null,
    trust: {
      macos: metadata.trust?.macos ?? null,
      windows: metadata.trust?.windows ?? null
    },
    artifacts: Object.fromEntries(
      Object.entries(metadata.artifacts ?? {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, artifact]) => [
          key,
          {
            filename: artifact?.filename ?? null,
            latestUrl: artifact?.latestUrl ?? null,
            versionedUrl: artifact?.versionedUrl ?? null
          }
        ])
    )
  };
}

async function findMetadataArtifacts(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const artifacts = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      artifacts.push(...(await findMetadataArtifacts(fullPath)));
      continue;
    }
    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) {
      artifacts.push(path.relative(rootDir, fullPath).replace(/\\/g, "/"));
    }
  }
  return artifacts;
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
