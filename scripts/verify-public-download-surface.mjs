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
        siteUrl: stripTrailingSlash(args.siteUrl ?? process.env.SITE_URL ?? ""),
        downloadsUrl: stripTrailingSlash(args.downloadsUrl ?? process.env.DOWNLOADS_URL ?? "")
      });

  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = payload.ok ? 0 : 1;
}

function parseArgs(argv) {
  const parsed = {
    siteUrl: null,
    downloadsUrl: null,
    siteDir: null
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
    }
  }

  return parsed;
}

async function verifyLocalSite(siteDir) {
  const indexHtml = await fs.readFile(path.join(siteDir, "index.html"), "utf8");
  const downloadsHtml = await fs.readFile(path.join(siteDir, "downloads", "index.html"), "utf8");
  const metadata = JSON.parse(await fs.readFile(path.join(siteDir, "data", "latest-release.json"), "utf8"));
  const sidecars = await findMetadataArtifacts(siteDir);

  const missingPhrases = [
    ...missingPhrase(indexHtml, "Enable terminal commands (kc)"),
    ...missingPhrase(downloadsHtml, "Get-Command kc"),
    ...missingPhrase(downloadsHtml, "command -v kc"),
    ...missingPhrase(downloadsHtml, "Checksums"),
    ...missingPhrase(downloadsHtml, "Release manifest"),
    ...missingPhrase(downloadsHtml, "Cloudflare hosts the public")
  ];

  const cloudflareHostedArtifacts = [
    metadata.artifacts?.macosDmg?.latestUrl,
    metadata.artifacts?.windowsNsis?.latestUrl,
    metadata.checksumsUrl,
    metadata.manifestUrl
  ].filter(Boolean);

  const nonCloudflareLinks = cloudflareHostedArtifacts.filter((entry) => entry.includes("github.com"));

  return {
    ok: missingPhrases.length === 0 && sidecars.length === 0 && nonCloudflareLinks.length === 0,
    mode: "local",
    siteDir: path.relative(repoRoot, siteDir).replace(/\\/g, "/"),
    missingPhrases,
    sidecars,
    nonCloudflareLinks,
    metadataSummary: {
      tagName: metadata.tagName,
      checksumsUrl: metadata.checksumsUrl,
      manifestUrl: metadata.manifestUrl
    }
  };
}

async function verifyRemoteSite({ siteUrl, downloadsUrl }) {
  if (!siteUrl) {
    throw new Error("Missing site URL. Pass --site-url or set SITE_URL.");
  }
  if (!downloadsUrl) {
    throw new Error("Missing downloads URL. Pass --downloads-url or set DOWNLOADS_URL.");
  }

  const siteResponse = await fetchOrThrow(siteUrl);
  const downloadsResponse = await fetchOrThrow(`${siteUrl}/downloads/`);
  const metadataResponse = await fetchOrThrow(`${siteUrl}/data/latest-release.json`);
  const metadata = await metadataResponse.json();
  const downloadsJsonResponse = await fetchOrThrow(`${downloadsUrl}/latest/downloads.json`);
  await downloadsJsonResponse.json();

  const artifactResults = [];
  for (const url of collectArtifactUrls(metadata)) {
    artifactResults.push(await headOrGet(url));
  }

  const siteHtml = await siteResponse.text();
  const downloadsHtml = await downloadsResponse.text();
  const missingPhrases = [
    ...missingPhrase(siteHtml, "Enable terminal commands (kc)"),
    ...missingPhrase(downloadsHtml, "Get-Command kc"),
    ...missingPhrase(downloadsHtml, "command -v kc"),
    ...missingPhrase(downloadsHtml, "Cloudflare hosting does not replace signing proof")
  ];

  return {
    ok: artifactResults.every((entry) => entry.ok) && missingPhrases.length === 0,
    mode: "remote",
    siteUrl,
    downloadsUrl,
    missingPhrases,
    artifactResults
  };
}

function collectArtifactUrls(metadata) {
  const urls = new Set([
    metadata.checksumsUrl,
    metadata.manifestUrl,
    ...Object.values(metadata.artifacts ?? {}).flatMap((entry) => [entry?.latestUrl, entry?.versionedUrl])
  ]);
  return [...urls].filter(Boolean);
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
