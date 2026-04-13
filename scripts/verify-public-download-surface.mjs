#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));

await main();

async function main() {
  const payload = args.siteDir
    ? await verifyLocalSite(path.resolve(args.siteDir))
    : await verifyRemoteSite({
        siteUrl: stripTrailingSlash(args.siteUrl ?? process.env.SITE_URL ?? "")
      });

  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = payload.ok ? 0 : 1;
}

function parseArgs(argv) {
  const parsed = {
    siteUrl: null,
    downloadsUrl: null,
    siteDir: null,
    metadataOnly: false
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
    if (token === "--metadata-only") {
      parsed.metadataOnly = true;
    }
  }

  return parsed;
}

async function verifyLocalSite(siteDir) {
  const indexHtml = await fs.readFile(path.join(siteDir, "index.html"), "utf8");
  const downloadsHtml = await fs.readFile(path.join(siteDir, "downloads", "index.html"), "utf8");
  const installHtml = await fs.readFile(path.join(siteDir, "install", "index.html"), "utf8");
  const metadata = JSON.parse(await fs.readFile(path.join(siteDir, "data", "latest-release.json"), "utf8"));
  const sidecars = await findMetadataArtifacts(siteDir);
  const releaseReady = metadata.publicReleaseReady === true;
  const missingPhrases = releaseReady === false
    ? missingPhrase(downloadsHtml, "Cloudflare hosting does not replace signing proof")
    : [];
  const platformSplitMissing = [
    ...missingPhrase(downloadsHtml, "setup EXE is the intended default Windows path"),
    ...missingPhrase(installHtml, "macOS: launch the app once"),
    ...missingPhrase(installHtml, "Public automatic-readiness wording on Windows stays gated")
  ];
  const invalidReleaseReadyMetadata = releaseReady ? validateReleaseReadyMetadata(metadata) : [];

  const oldWordings = [
    ...containsPhrase(indexHtml, "GitHub Releases stays the source of truth"),
    ...containsPhrase(downloadsHtml, "GitHub Releases is the source of truth")
  ];
  const overclaims = [
    ...containsPhrase(indexHtml, "ready by default"),
    ...containsPhrase(downloadsHtml, "ready by default"),
    ...containsPhrase(installHtml, "ready by default")
  ];

  return {
    ok:
      missingPhrases.length === 0 &&
      platformSplitMissing.length === 0 &&
      sidecars.length === 0 &&
      oldWordings.length === 0 &&
      overclaims.length === 0 &&
      invalidReleaseReadyMetadata.length === 0,
    mode: "local",
    siteDir: path.relative(repoRoot, siteDir).replace(/\\/g, "/"),
    missingPhrases,
    platformSplitMissing,
    sidecars,
    oldWordings,
    overclaims,
    invalidReleaseReadyMetadata,
    metadataSummary: {
      tagName: metadata.tagName,
      checksumsUrl: metadata.checksumsUrl,
      manifestUrl: metadata.manifestUrl
    }
  };
}

async function verifyRemoteSite({ siteUrl }) {
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
  const missingPhrases = releaseReady === false
    ? missingPhrase(downloadsHtml, "Cloudflare hosting does not replace signing proof")
    : [];
  const platformSplitMissing = [
    ...missingPhrase(downloadsHtml, "setup EXE is the intended default Windows path"),
    ...missingPhrase(installHtml, "macOS: launch the app once"),
    ...missingPhrase(installHtml, "Public automatic-readiness wording on Windows stays gated")
  ];
  const invalidReleaseReadyMetadata = releaseReady ? validateReleaseReadyMetadata(metadata) : [];
  const oldWordings = [
    ...containsPhrase(siteHtml, "GitHub Releases stays the source of truth"),
    ...containsPhrase(downloadsHtml, "GitHub Releases is the source of truth")
  ];
  const overclaims = [
    ...containsPhrase(siteHtml, "ready by default"),
    ...containsPhrase(downloadsHtml, "ready by default"),
    ...containsPhrase(installHtml, "ready by default")
  ];
  const metadataResults = releaseReady
    ? await verifyReleaseReadyUrls(collectReleaseUrls(metadata))
    : [];
  const artifactResults = metadataResults.filter((entry) => entry.kind === "artifact");
  const auxiliaryResults = metadataResults.filter((entry) => entry.kind !== "artifact");
  const invalidMetadataContentType = metadataContentType.includes("application/json") ? [] : [metadataContentType || "missing content-type"];

  return {
    ok:
      missingPhrases.length === 0 &&
      platformSplitMissing.length === 0 &&
      oldWordings.length === 0 &&
      overclaims.length === 0 &&
      invalidReleaseReadyMetadata.length === 0 &&
      invalidMetadataContentType.length === 0 &&
      metadataResults.every((entry) => entry.ok),
    mode: "remote",
    siteUrl,
    downloadsUrl: null,
    metadataOnly: false,
    missingPhrases,
    platformSplitMissing,
    oldWordings,
    overclaims,
    invalidReleaseReadyMetadata,
    invalidMetadataContentType,
    metadataResults: auxiliaryResults,
    artifactResults
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
        method: "HEAD"
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
      method: "GET"
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

function validateReleaseReadyMetadata(metadata) {
  const issues = [];
  if (!metadata.releaseNotesUrl) {
    issues.push("releaseNotesUrl");
  }
  if (!metadata.sourceUrl) {
    issues.push("sourceUrl");
  }
  if (!metadata.checksumsUrl) {
    issues.push("checksumsUrl");
  }
  if (!metadata.manifestUrl) {
    issues.push("manifestUrl");
  }
  const primaryArtifactKinds = ["macosDmg", "macosAppTarball", "windowsNsis", "windowsMsi"];
  if (!primaryArtifactKinds.some((kind) => Boolean(metadata.artifacts?.[kind]?.latestUrl))) {
    issues.push("at least one desktop artifact latestUrl");
  }
  return issues;
}

function collectReleaseUrls(metadata) {
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
    if (artifact?.versionedUrl && artifact.versionedUrl !== artifact?.latestUrl) {
      urls.push({ label: `${key}.versionedUrl`, url: artifact.versionedUrl, kind: "artifact" });
    }
  }

  return urls;
}

async function verifyReleaseReadyUrls(entries) {
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
