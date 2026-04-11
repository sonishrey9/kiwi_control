const REPO_URL = "https://github.com/sonishrey9/kiwi-control-backup";
const RELEASE_METADATA_URL = "/data/latest-release.json";
const DEFAULT_VERSION = "0.2.0-beta.1";

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

const TRUST_LABELS = {
  "local-beta-build-only": "Local beta build only. Do not treat public website availability as notarization or public trust.",
  "signed-not-notarized": "Signed, but not notarized yet. Treat this as pre-public-release trust.",
  "signed-and-notarized": "Signed and notarized for public release.",
  "windows-runner-required": "Windows trust still requires signed installers proven on a Windows host or runner.",
  "unsigned-installers": "Installers exist, but Windows signing proof is not complete.",
  "signed-installers": "Windows installers are signed and verified on a Windows host."
};

const fallbackRelease = {
  publicReleaseReady: false,
  tagName: null,
  version: DEFAULT_VERSION,
  channel: DEFAULT_VERSION.includes("beta") ? "beta" : "stable",
  releaseNotesUrl: null,
  sourceUrl: REPO_URL,
  checksumsUrl: null,
  manifestUrl: null,
  trust: {
    macos: "local-beta-build-only",
    windows: "windows-runner-required"
  },
  artifacts: {}
};

init();

async function init() {
  let release = fallbackRelease;
  try {
    release = normalizeRelease(await loadLatestRelease());
  } catch (error) {
    console.warn("Falling back to bundled release metadata:", error);
    document.querySelectorAll(selectors.releaseFallback).forEach((node) => {
      node.hidden = false;
    });
  }

  updateReleaseMetadata(release);
  bindDownloadState(release);
  bindTrustNotes(release);
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

  return response.json();
}

function normalizeRelease(payload) {
  return {
    publicReleaseReady: payload.publicReleaseReady === true,
    tagName: payload.tagName ?? null,
    version: payload.version ?? fallbackRelease.version,
    channel: payload.channel ?? fallbackRelease.channel,
    releaseNotesUrl: payload.releaseNotesUrl ?? null,
    sourceUrl: payload.sourceUrl ?? fallbackRelease.sourceUrl,
    checksumsUrl: payload.checksumsUrl ?? null,
    manifestUrl: payload.manifestUrl ?? null,
    trust: {
      macos: payload.trust?.macos ?? fallbackRelease.trust.macos,
      windows: payload.trust?.windows ?? fallbackRelease.trust.windows
    },
    artifacts: payload.artifacts ?? {}
  };
}

function updateReleaseMetadata(release) {
  document.querySelectorAll(selectors.version).forEach((node) => {
    node.textContent = release.publicReleaseReady ? release.version : "Public release coming soon";
  });

  document.querySelectorAll(selectors.releaseBadge).forEach((node) => {
    node.textContent = release.publicReleaseReady && release.tagName
      ? `Latest release: ${release.tagName}`
      : "Public release coming soon";
  });

  updateOptionalLink(selectors.releaseNotes, release.releaseNotesUrl);
  updateOptionalLink(selectors.checksums, release.checksumsUrl);
  updateOptionalLink(selectors.manifest, release.manifestUrl);
  updateOptionalLink(selectors.source, release.sourceUrl);
}

function bindDownloadState(release) {
  document.querySelectorAll(selectors.downloadAnchor).forEach((node) => {
    if (release.publicReleaseReady) {
      const kind = node.getAttribute("data-download-kind");
      const artifact = kind ? release.artifacts[kind] : null;
      if (artifact?.latestUrl) {
        node.href = artifact.latestUrl;
        node.textContent = node.getAttribute("data-primary-label") ?? node.textContent;
        node.removeAttribute("aria-disabled");
        return;
      }
    }

    node.href = "/downloads/";
    node.textContent = node.getAttribute("data-unavailable-label") ?? "Public release coming soon";
    node.setAttribute("aria-disabled", "true");
  });

  document.querySelectorAll(selectors.downloadMeta).forEach((node) => {
    node.textContent = release.publicReleaseReady
      ? `Latest public release: ${release.version}. Download links, checksums, and the release manifest below all point to the current published release artifacts.`
      : "No public release is published yet. This page will list installers, checksums, and verification steps when the first release is ready.";
  });

  document.querySelectorAll(selectors.recommendedBanner).forEach((node) => {
    node.textContent = release.publicReleaseReady
      ? "Choose the installer that matches your desktop OS. Optional kc verification commands stay on the downloads page."
      : "Public release coming soon. The first installers will appear here once the desktop release is published.";
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

function updateOptionalLink(selector, url) {
  document.querySelectorAll(selector).forEach((node) => {
    if (!url) {
      node.hidden = true;
      return;
    }
    node.hidden = false;
    node.href = url;
  });
}
