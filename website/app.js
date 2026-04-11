const RELEASES_URL = "https://github.com/sonishrey9/kiwi-control/releases/latest";
const REPO_URL = "https://github.com/sonishrey9/kiwi-control";
const RELEASE_METADATA_URL = "/data/latest-release.json";
const DEFAULT_VERSION = "0.2.0-beta.1";

const PLATFORM_CONFIG = {
  macos: {
    label: "macOS",
    heroLabel: "Download for macOS"
  },
  windows: {
    label: "Windows",
    heroLabel: "Download for Windows"
  }
};

const TRUST_LABELS = {
  "local-beta-build-only": "Local beta build only. Do not treat download availability as notarization or public trust.",
  "signed-not-notarized": "Signed, but not notarized yet. Treat this as pre-public-release trust.",
  "signed-and-notarized": "Signed and notarized for public release.",
  "windows-runner-required": "Windows trust still requires signed installers proven on a Windows host or runner.",
  "unsigned-installers": "Installers exist, but Windows signing proof is not complete.",
  "signed-installers": "Windows installers are signed and verified on a Windows host."
};

const selectors = {
  version: "[data-release-version]",
  releaseNotes: "[data-release-notes]",
  checksums: "[data-release-checksums]",
  manifest: "[data-release-manifest]",
  source: "[data-release-source]",
  releaseBadge: "[data-release-badge]",
  downloadCard: "[data-download-card]",
  downloadAnchor: "[data-download-link]",
  recommendedBanner: "[data-recommended-banner]",
  releaseFallback: "[data-release-fallback]",
  downloadMeta: "[data-download-meta]",
  trust: "[data-trust-platform]"
};

const fallbackRelease = {
  tagName: `v${DEFAULT_VERSION}`,
  version: DEFAULT_VERSION,
  channel: DEFAULT_VERSION.includes("beta") ? "beta" : "stable",
  releaseNotesUrl: RELEASES_URL,
  sourceUrl: RELEASES_URL,
  checksumsUrl: RELEASES_URL,
  manifestUrl: RELEASES_URL,
  trust: {
    macos: "local-beta-build-only",
    windows: "windows-runner-required"
  },
  artifacts: {
    macosDmg: makeFallbackArtifact("kiwi-control.dmg"),
    macosAppTarball: makeFallbackArtifact("kiwi-control.app.tar.gz"),
    windowsNsis: makeFallbackArtifact("kiwi-control-setup.exe"),
    windowsMsi: makeFallbackArtifact("kiwi-control.msi"),
    cliMacos: makeFallbackArtifact("kiwi-control-cli.tar.gz"),
    cliWindows: makeFallbackArtifact("kiwi-control-cli.zip")
  }
};

init();

async function init() {
  const detectedPlatform = detectPlatform();
  updatePlatformLabels(detectedPlatform);

  let release = fallbackRelease;
  try {
    release = await loadLatestRelease();
  } catch (error) {
    console.warn("Falling back to bundled release metadata:", error);
    document.querySelectorAll(selectors.releaseFallback).forEach((node) => {
      node.hidden = false;
    });
  }

  updateReleaseMetadata(release);
  bindArtifactLinks(release);
  bindDownloadMeta(release, detectedPlatform);
  bindTrustNotes(release);
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
  const response = await fetch(RELEASE_METADATA_URL, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`release metadata returned ${response.status}`);
  }

  return normalizeRelease(await response.json());
}

function normalizeRelease(payload) {
  return {
    tagName: payload.tagName ?? fallbackRelease.tagName,
    version: payload.version ?? fallbackRelease.version,
    channel: payload.channel ?? fallbackRelease.channel,
    releaseNotesUrl: payload.releaseNotesUrl ?? fallbackRelease.releaseNotesUrl,
    sourceUrl: payload.sourceUrl ?? fallbackRelease.sourceUrl,
    checksumsUrl: payload.checksumsUrl ?? fallbackRelease.checksumsUrl,
    manifestUrl: payload.manifestUrl ?? fallbackRelease.manifestUrl,
    trust: {
      macos: payload.trust?.macos ?? fallbackRelease.trust.macos,
      windows: payload.trust?.windows ?? fallbackRelease.trust.windows
    },
    artifacts: {
      ...fallbackRelease.artifacts,
      ...payload.artifacts
    }
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
    if (labelNode) {
      labelNode.textContent = PLATFORM_CONFIG[platform].heroLabel;
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
    node.href = release.releaseNotesUrl;
  });

  document.querySelectorAll(selectors.checksums).forEach((node) => {
    node.href = release.checksumsUrl;
  });

  document.querySelectorAll(selectors.manifest).forEach((node) => {
    node.href = release.manifestUrl;
  });

  document.querySelectorAll(selectors.source).forEach((node) => {
    node.href = release.sourceUrl;
  });
}

function bindArtifactLinks(release) {
  document.querySelectorAll(selectors.downloadAnchor).forEach((node) => {
    const kind = node.getAttribute("data-download-kind");
    const mode = node.getAttribute("data-link-mode") ?? "latest";
    const primaryLabel = node.getAttribute("data-primary-label");
    const fallbackLabel = node.getAttribute("data-fallback-label") ?? "View release";
    const fallbackHref = node.getAttribute("data-fallback-href") ?? release.sourceUrl;
    const artifact = kind ? release.artifacts[kind] : null;
    const href = mode === "versioned"
      ? artifact?.versionedUrl ?? artifact?.latestUrl ?? fallbackHref
      : artifact?.latestUrl ?? artifact?.versionedUrl ?? fallbackHref;

    node.href = href;
    node.textContent = artifact ? (primaryLabel ?? node.textContent) : fallbackLabel;
  });
}

function bindDownloadMeta(release, detectedPlatform) {
  document.querySelectorAll(selectors.downloadMeta).forEach((node) => {
    if (detectedPlatform.key === "macos") {
      const artifact = release.artifacts.macosDmg;
      node.textContent = `macOS installer: ${artifact.filename}`;
      return;
    }

    if (detectedPlatform.key === "windows") {
      const artifact = release.artifacts.windowsNsis;
      node.textContent = `Windows installer: ${artifact.filename}`;
      return;
    }

    node.textContent = `Cloudflare hosts the public downloads for ${release.tagName}. Use /downloads for the full installer list and GitHub for release notes.`;
  });
}

function bindTrustNotes(release) {
  document.querySelectorAll(selectors.trust).forEach((node) => {
    const platform = node.getAttribute("data-trust-platform");
    if (!platform) {
      return;
    }
    const classification = release.trust?.[platform];
    if (!classification) {
      return;
    }
    node.textContent = TRUST_LABELS[classification] ?? classification;
  });
}

function makeFallbackArtifact(filename) {
  return {
    filename,
    latestUrl: RELEASES_URL,
    versionedUrl: `${REPO_URL}/releases/tag/v${DEFAULT_VERSION}`
  };
}
