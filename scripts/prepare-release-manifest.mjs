import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootPackage = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
const version = rootPackage.version;
const releaseDir = path.join(repoRoot, "dist", "release");
const manifestPath = path.join(releaseDir, "release-manifest.json");

const manifest = {
  product: "shrey-junior",
  version,
  channel: version.includes("beta") ? "beta" : "stable",
  generatedAt: new Date().toISOString(),
  artifactNaming: {
    cli: `shrey-junior-cli-\${version}-\${os}-\${arch}.tar.gz`,
    runtime: `shrey-junior-runtime-\${version}-\${os}-\${arch}.tar.gz`,
    uiWeb: `shrey-junior-ui-web-\${version}-\${os}-\${arch}.tar.gz`,
    uiDesktop: `shrey-junior-desktop-\${version}-\${os}-\${arch}.\${ext}`
  },
  releaseTargets: ["github-releases", "homebrew", "winget", "manual-desktop-download"],
  updateMetadata: {
    tauriUpdaterManifest: "apps/sj-ui/src-tauri/updater.json",
    signingPlaceholders: [
      "TAURI_SIGNING_PRIVATE_KEY",
      "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
      "APPLE_SIGNING_IDENTITY",
      "WINDOWS_CODESIGN_CERT_SHA1",
      "WINDOWS_CODESIGN_PASSWORD"
    ]
  },
  notes: [
    "Core operation stays local-first and repo-first with no mandatory cloud backend.",
    "Desktop bundles remain optional until platform signing secrets are configured."
  ]
};

await mkdir(releaseDir, { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`wrote release manifest to ${manifestPath}`);
