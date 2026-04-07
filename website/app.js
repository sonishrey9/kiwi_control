const RELEASES_URL = "https://github.com/sonishrey9/kiwi-control/releases/latest";
const RELEASES_API_URL = "https://api.github.com/repos/sonishrey9/kiwi-control/releases/latest";
const REPO_URL = "https://github.com/sonishrey9/kiwi-control";
const DEFAULT_VERSION = "0.2.0-beta.1";

const PLATFORM_CONFIG = {
  macos: {
    label: "macOS",
    heroLabel: "Download for macOS",
    description: "Desktop installer for Kiwi Control on macOS.",
    releaseNotesLabel: "macOS release notes"
  },
  windows: {
    label: "Windows",
    heroLabel: "Download for Windows",
    description: "Desktop installer for Kiwi Control on Windows.",
    releaseNotesLabel: "Windows release notes"
  }
};

const selectors = {
  version: "[data-release-version]",
  releaseNotes: "[data-release-notes]",
  checksums: "[data-release-checksums]",
  source: "[data-release-source]",
  releaseBadge: "[data-release-badge]",
  downloadCard: "[data-download-card]",
  downloadAnchor: "[data-download-link]",
  recommendedBanner: "[data-recommended-banner]",
  releaseFallback: "[data-release-fallback]",
  downloadMeta: "[data-download-meta]"
};

const latestRelease = {
  tagName: `v${DEFAULT_VERSION}`,
  version: DEFAULT_VERSION,
  htmlUrl: RELEASES_URL,
  checksumsUrl: RELEASES_URL,
  assets: []
};

init();

async function init() {
  const detectedPlatform = detectPlatform();
  updatePlatformLabels(detectedPlatform);

  let release = latestRelease;
  try {
    release = await loadLatestRelease();
  } catch (error) {
    console.warn("Falling back to latest release page:", error);
    document.querySelectorAll(selectors.releaseFallback).forEach((node) => {
      node.hidden = false;
    });
  }

  updateReleaseMetadata(release);
  updateDownloadLinks(release, detectedPlatform);
}

function detectPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("win")) {
    return { key: "windows", arch: "x64" };
  }

  if (userAgent.includes("mac")) {
    const isArm = userAgent.includes("arm") || navigator.platform.toLowerCase().includes("arm");
    return { key: "macos", arch: isArm ? "aarch64" : "x64" };
  }

  return { key: "unknown", arch: "x64" };
}

async function loadLatestRelease() {
  const response = await fetch(RELEASES_API_URL, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub release API returned ${response.status}`);
  }

  const payload = await response.json();
  return {
    tagName: payload.tag_name,
    version: payload.tag_name.replace(/^v/, ""),
    htmlUrl: payload.html_url,
    checksumsUrl: findAssetUrl(payload.assets, (asset) => asset.name === "SHA256SUMS.txt") ?? payload.html_url,
    assets: payload.assets ?? []
  };
}

function updatePlatformLabels(detectedPlatform) {
  document.querySelectorAll(selectors.recommendedBanner).forEach((node) => {
    if (detectedPlatform.key === "unknown") {
      node.textContent = "Choose the installer that matches your desktop OS.";
      return;
    }

    const config = PLATFORM_CONFIG[detectedPlatform.key];
    node.textContent = `Detected ${config.label}. We highlighted the recommended installer below.`;
  });

  document.querySelectorAll(selectors.downloadCard).forEach((card) => {
    const platform = card.getAttribute("data-platform");
    if (!platform || !PLATFORM_CONFIG[platform]) {
      return;
    }

    const labelNode = card.querySelector("[data-download-heading]");
    const config = PLATFORM_CONFIG[platform];
    if (labelNode) {
      labelNode.textContent = config.heroLabel;
    }

    if (platform === detectedPlatform.key) {
      card.classList.add("is-recommended");
      const badge = card.querySelector("[data-recommended-chip]");
      if (badge) {
        badge.hidden = false;
      }
    }
  });
}

function updateReleaseMetadata(release) {
  document.querySelectorAll(selectors.version).forEach((node) => {
    node.textContent = release.version;
  });

  document.querySelectorAll(selectors.releaseBadge).forEach((node) => {
    node.textContent = `Latest release: ${release.tagName}`;
  });

  document.querySelectorAll(selectors.releaseNotes).forEach((node) => {
    node.href = release.htmlUrl;
  });

  document.querySelectorAll(selectors.checksums).forEach((node) => {
    node.href = release.checksumsUrl;
  });

  document.querySelectorAll(selectors.source).forEach((node) => {
    node.href = RELEASES_URL;
  });
}

function updateDownloadLinks(release, detectedPlatform) {
  const macAsset = findPreferredAsset(release.assets, "macos", detectedPlatform.arch);
  const windowsAsset = findPreferredAsset(release.assets, "windows", "x64");

  bindDownload("macos", macAsset, release);
  bindDownload("windows", windowsAsset, release);
  bindDownloadMeta(release, macAsset, windowsAsset, detectedPlatform);
}

function bindDownload(platform, asset, release) {
  document.querySelectorAll(`${selectors.downloadAnchor}[data-platform='${platform}']`).forEach((node) => {
    const fallbackLabel = node.getAttribute("data-fallback-label") ?? "View release assets";
    if (asset) {
      node.href = asset.browser_download_url;
      node.textContent = node.getAttribute("data-primary-label") ?? node.textContent;
      return;
    }

    node.href = release.htmlUrl;
    node.textContent = fallbackLabel;
  });
}

function bindDownloadMeta(release, macAsset, windowsAsset, detectedPlatform) {
  document.querySelectorAll(selectors.downloadMeta).forEach((node) => {
    if (detectedPlatform.key === "macos" && macAsset) {
      node.textContent = `${PLATFORM_CONFIG.macos.label} installer: ${macAsset.name}`;
      return;
    }

    if (detectedPlatform.key === "windows" && windowsAsset) {
      node.textContent = `${PLATFORM_CONFIG.windows.label} installer: ${windowsAsset.name}`;
      return;
    }

    node.textContent = `GitHub Releases remains the source of truth for every installer and checksum in ${release.tagName}.`;
  });
}

function findPreferredAsset(assets, platform, preferredArch) {
  if (platform === "macos") {
    return (
      findAssetUrl(assets, (asset) => asset.name.includes("-macos-") && asset.name.includes(`-${preferredArch}.dmg`)) ??
      findAssetUrl(assets, (asset) => asset.name.includes("-macos-") && asset.name.endsWith(".dmg")) ??
      findAssetUrl(assets, (asset) => asset.name.includes("-macos-") && asset.name.endsWith(".tar.gz"))
    );
  }

  if (platform === "windows") {
    return (
      findAssetUrl(assets, (asset) => asset.name.includes("-windows-") && asset.name.endsWith(".msi")) ??
      findAssetUrl(assets, (asset) => asset.name.includes("-windows-") && asset.name.endsWith(".zip"))
    );
  }

  return null;
}

function findAssetUrl(assets, predicate) {
  return assets.find(predicate) ?? null;
}
