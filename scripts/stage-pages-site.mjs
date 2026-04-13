#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { loadLocalEnv } from "./load-local-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv();
const args = parseArgs(process.argv.slice(2));
const siteRoot = path.resolve(args.siteRoot ?? path.join(repoRoot, "website"));
const outputDir = path.resolve(args.outputDir ?? path.join(repoRoot, "dist", "site"));
const downloadsUrl = stripTrailingSlash(firstNonEmpty(args.downloadsUrl, process.env.DOWNLOADS_URL, process.env.SITE_URL, ""));
const repoUrl = stripTrailingSlash(args.repoUrl ?? process.env.REPO_URL ?? "https://github.com/sonishrey9/kiwi-control-backup");
const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));

await fs.rm(outputDir, { recursive: true, force: true });
await fs.cp(siteRoot, outputDir, { recursive: true });
await removeMetadataArtifacts(outputDir);

const { release, source: downloadsSource } = await resolveReleaseMetadata({
  downloadsJsonPath: args.downloadsJson,
  downloadsUrl,
  repoUrl,
  version: packageJson.version,
  requireDownloadsJson: args.requireDownloadsJson
});

const dataDir = path.join(outputDir, "data");
await fs.mkdir(dataDir, { recursive: true });
await fs.writeFile(path.join(dataDir, "latest-release.json"), `${JSON.stringify(release, null, 2)}\n`, "utf8");
await hydrateStaticSite(outputDir, release);
await removeMetadataArtifacts(outputDir);

console.log(
  JSON.stringify(
    {
      ok: true,
      outputDir: path.relative(repoRoot, outputDir).replace(/\\/g, "/"),
      downloadsSource,
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
    return {
      release: JSON.parse(await fs.readFile(path.resolve(downloadsJsonPath), "utf8")),
      source: "local-json"
    };
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
        return {
          release: await response.json(),
          source: "remote-json"
        };
      }
      if (requireDownloadsJson) {
        throw new Error(`${remoteUrl} returned ${response.status}.`);
      }
    } catch {
      if (requireDownloadsJson) {
        throw new Error(`Missing required public downloads metadata at ${remoteUrl}.`);
      }
      // Fall back to the built-in release metadata when remote downloads metadata is unavailable.
    }
  } else if (requireDownloadsJson) {
    throw new Error("Missing required downloads metadata source. Pass --downloads-json or set DOWNLOADS_URL, SITE_URL, or --downloads-url.");
  }

  return {
    release: fallbackReleaseMetadata({ downloadsUrl, repoUrl, version }),
    source: "fallback"
  };
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
      macosPkg: {
        filename: "kiwi-control.pkg",
        latestUrl: null,
        versionedUrl: null
      },
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

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === "string" ? value.length > 0 : value != null) ?? "";
}

async function hydrateStaticSite(rootDir, release) {
  const files = await collectHtmlFiles(rootDir);
  for (const filePath of files) {
    const html = await fs.readFile(filePath, "utf8");
    const hydrated = hydrateHtml(html, release);
    await fs.writeFile(filePath, hydrated, "utf8");
  }
}

async function collectHtmlFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectHtmlFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
}

function hydrateHtml(html, release) {
  const state = getReleaseState(release);

  html = replaceTextByDataAttr(html, "data-release-version", state === "unpublished" ? "Public release coming soon" : release.version);
  html = replaceTextByDataAttr(
    html,
    "data-release-badge",
    state === "ready"
      ? `Latest release: ${release.tagName ?? release.version}`
      : state === "partial"
        ? `Published assets: ${release.tagName ?? release.version} (verification pending)`
        : "Public release coming soon"
  );
  html = replaceTextByDataAttr(
    html,
    "data-download-meta",
    state === "ready"
      ? `Latest public release: ${release.version}. Download links, checksums, and the release manifest below all point to the current published release artifacts.`
      : state === "partial"
        ? `Some public assets for ${release.version} are already live. Only the linked artifacts are published now; overall release readiness is still pending until the full desktop set, checksums, and manifest are all confirmed on the public host.`
        : "No public release is published yet. This page will list installers, checksums, and verification steps when the first release is ready."
  );
  html = replaceTextByDataAttr(
    html,
    "data-recommended-banner",
    state === "ready"
      ? "Choose the installer that matches your desktop OS. The downloads page keeps the platform-specific kc steps and the current proof status."
      : state === "partial"
        ? "Some installer assets are live now. Use the downloads page for the current published set, checksums, and the platform-specific proof caveats."
        : "Use the downloads page for the current release status and the exact verification commands once installers are published."
  );

  html = updateOptionalAnchor(html, "data-release-notes", release.releaseNotesUrl);
  html = updateOptionalAnchor(html, "data-release-checksums", release.checksumsUrl);
  html = updateOptionalAnchor(html, "data-release-manifest", release.manifestUrl);
  html = updateOptionalAnchor(html, "data-release-source", release.sourceUrl);
  html = updateDownloadAnchors(html, release);

  return html;
}

function updateDownloadAnchors(html, release) {
  return html.replace(/<a([^>]*data-download-kind="([^"]+)"[^>]*)>([\s\S]*?)<\/a>/g, (match, attrs, kind, currentText) => {
    const artifact = release.artifacts?.[kind];
    const primaryLabel = extractAttribute(attrs, "data-primary-label") ?? currentText;
    const unavailableLabel = extractAttribute(attrs, "data-unavailable-label") ?? "Public release coming soon";
    const href = artifact?.latestUrl ?? "/downloads/";
    let updatedAttrs = setAttribute(attrs, "href", href);

    if (artifact?.latestUrl) {
      updatedAttrs = removeAttribute(updatedAttrs, "aria-disabled");
      return `<a${updatedAttrs}>${escapeHtml(primaryLabel)}</a>`;
    }

    updatedAttrs = setAttribute(updatedAttrs, "aria-disabled", "true");
    return `<a${updatedAttrs}>${escapeHtml(unavailableLabel)}</a>`;
  });
}

function updateOptionalAnchor(html, dataAttr, url) {
  return html.replace(new RegExp(`<a([^>]*${dataAttr}[^>]*)>([\\s\\S]*?)<\\/a>`, "g"), (match, attrs, currentText) => {
    let updatedAttrs = attrs;
    if (url) {
      updatedAttrs = removeBooleanAttribute(updatedAttrs, "hidden");
      updatedAttrs = setAttribute(updatedAttrs, "href", url);
    } else {
      updatedAttrs = addBooleanAttribute(updatedAttrs, "hidden");
    }
    return `<a${updatedAttrs}>${currentText}</a>`;
  });
}

function replaceTextByDataAttr(html, dataAttr, text) {
  return html.replace(new RegExp(`(<[^>]*${dataAttr}[^>]*>)([\\s\\S]*?)(</[^>]+>)`, "g"), `$1${escapeHtml(text)}$3`);
}

function getReleaseState(release) {
  if (release.publicReleaseReady) {
    return "ready";
  }
  const hasPublishedArtifacts = Object.values(release.artifacts ?? {}).some((artifact) => Boolean(artifact?.latestUrl));
  if (hasPublishedArtifacts || release.checksumsUrl || release.manifestUrl) {
    return "partial";
  }
  return "unpublished";
}

function extractAttribute(attrs, name) {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : null;
}

function setAttribute(attrs, name, value) {
  if (new RegExp(`${name}="[^"]*"`).test(attrs)) {
    return attrs.replace(new RegExp(`${name}="[^"]*"`), `${name}="${escapeAttribute(value)}"`);
  }
  return `${attrs} ${name}="${escapeAttribute(value)}"`;
}

function removeAttribute(attrs, name) {
  return attrs.replace(new RegExp(`\\s${name}="[^"]*"`, "g"), "");
}

function addBooleanAttribute(attrs, name) {
  return new RegExp(`\\s${name}(\\s|$|>)`).test(`${attrs}>`) ? attrs : `${attrs} ${name}`;
}

function removeBooleanAttribute(attrs, name) {
  return attrs.replace(new RegExp(`\\s${name}(?=\\s|$)`, "g"), "");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
