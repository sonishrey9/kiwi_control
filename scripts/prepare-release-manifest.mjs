import path from "node:path";
import { chmod, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stageCliBundle as stagePublicCliBundle } from "./stage-cli-bundle.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootPackage = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
const { PRODUCT_METADATA } = await import(
  pathToFileURL(path.join(repoRoot, "packages", "sj-core", "dist", "core", "product.js")).href
);

const version = rootPackage.version;
const releaseDir = path.join(repoRoot, "dist", "release");
const manifestPath = path.join(releaseDir, "release-manifest.json");
const channel = version.includes("beta") ? "beta" : "stable";
const artifactPrefix = PRODUCT_METADATA.release.artifactPrefix;
const cliBundleRelativePath = "dist/release/cli-bundle";
const cliBundlePath = path.join(repoRoot, cliBundleRelativePath);

await mkdir(releaseDir, { recursive: true });
await stagePublicCliBundle({
  bundlePath: cliBundlePath,
  version,
  repoRoot
});

const cliArtifacts = [
  {
    platform: "macos",
    arch: "aarch64",
    artifactType: "cli",
    description: "Installable Kiwi Control CLI bundle with kiwi-control and kc",
    fileName: `${artifactPrefix}-cli-${version}-macos-aarch64.tar.gz`,
    sourcePath: cliBundleRelativePath,
    checksumAlgorithm: "sha256"
  },
  {
    platform: "macos",
    arch: "x64",
    artifactType: "cli",
    description: "Installable Kiwi Control CLI bundle with kiwi-control and kc",
    fileName: `${artifactPrefix}-cli-${version}-macos-x64.tar.gz`,
    sourcePath: cliBundleRelativePath,
    checksumAlgorithm: "sha256"
  },
  {
    platform: "linux",
    arch: "x64",
    artifactType: "cli",
    description: "Installable Kiwi Control CLI bundle with kiwi-control and kc",
    fileName: `${artifactPrefix}-cli-${version}-linux-x64.tar.gz`,
    sourcePath: cliBundleRelativePath,
    checksumAlgorithm: "sha256"
  },
  {
    platform: "windows",
    arch: "x64",
    artifactType: "cli",
    description: "Installable Kiwi Control CLI bundle with kiwi-control and kc",
    fileName: `${artifactPrefix}-cli-${version}-windows-x64.zip`,
    sourcePath: cliBundleRelativePath,
    checksumAlgorithm: "sha256"
  }
];

const platformBundles = [
  {
    platform: "macos",
    arch: "aarch64",
    artifactType: "desktop-app",
    description: "Direct macOS application bundle archive for manual installation or inspection",
    fileName: `${artifactPrefix}-${version}-macos-aarch64.app.tar.gz`,
    sourcePath: "apps/sj-ui/src-tauri/target/release/bundle/macos/Kiwi Control.app",
    packagingStrategy: "archive-directory",
    checksumAlgorithm: "sha256"
  },
  {
    platform: "macos",
    arch: "x64",
    artifactType: "desktop-app",
    description: "Direct macOS application bundle archive for manual installation or inspection",
    fileName: `${artifactPrefix}-${version}-macos-x64.app.tar.gz`,
    sourcePath: "apps/sj-ui/src-tauri/target/release/bundle/macos/Kiwi Control.app",
    packagingStrategy: "archive-directory",
    checksumAlgorithm: "sha256"
  },
  {
    platform: "macos",
    arch: "aarch64",
    artifactType: "desktop-dmg",
    description: "Signed or notarized macOS disk image when release signing is configured",
    fileName: `${artifactPrefix}-${version}-macos-aarch64.dmg`,
    localBuildCommand: "npm run ui:desktop:build",
    bundlePath: "apps/sj-ui/src-tauri/target/release/bundle/dmg",
    packagingStrategy: "copy-bundle-file",
    checksumAlgorithm: "sha256"
  },
  {
    platform: "macos",
    arch: "aarch64",
    artifactType: "desktop-pkg",
    description: "Primary macOS installer package with installer-owned CLI setup",
    fileName: `${artifactPrefix}-${version}-macos-aarch64.pkg`,
    localBuildCommand: "npm run ui:desktop:build",
    bundlePath: "apps/sj-ui/src-tauri/target/release/bundle/pkg",
    packagingStrategy: "copy-bundle-file",
    checksumAlgorithm: "sha256"
  },
  {
    platform: "macos",
    arch: "x64",
    artifactType: "desktop-dmg",
    description: "Signed or notarized macOS disk image when release signing is configured",
    fileName: `${artifactPrefix}-${version}-macos-x64.dmg`,
    localBuildCommand: "npm run ui:desktop:build",
    bundlePath: "apps/sj-ui/src-tauri/target/release/bundle/dmg",
    packagingStrategy: "copy-bundle-file",
    checksumAlgorithm: "sha256"
  },
  {
    platform: "macos",
    arch: "x64",
    artifactType: "desktop-pkg",
    description: "Primary macOS installer package with installer-owned CLI setup",
    fileName: `${artifactPrefix}-${version}-macos-x64.pkg`,
    localBuildCommand: "npm run ui:desktop:build",
    bundlePath: "apps/sj-ui/src-tauri/target/release/bundle/pkg",
    packagingStrategy: "copy-bundle-file",
    checksumAlgorithm: "sha256"
  },
  {
    platform: "windows",
    arch: "x64",
    artifactType: "desktop-nsis",
    description: "Primary Windows installer executable generated by NSIS",
    fileName: `${artifactPrefix}-${version}-windows-x64-setup.exe`,
    localBuildCommand: "npm run ui:desktop:build",
    bundlePath: "apps/sj-ui/src-tauri/target/release/bundle/nsis",
    packagingStrategy: "copy-bundle-file",
    checksumAlgorithm: "sha256"
  },
  {
    platform: "windows",
    arch: "x64",
    artifactType: "desktop-msi",
    description: "Windows MSI installer generated by WiX",
    fileName: `${artifactPrefix}-${version}-windows-x64.msi`,
    localBuildCommand: "npm run ui:desktop:build",
    bundlePath: "apps/sj-ui/src-tauri/target/release/bundle/msi",
    packagingStrategy: "copy-bundle-file",
    checksumAlgorithm: "sha256"
  },
  {
    platform: "linux",
    arch: "x64",
    artifactType: "desktop-appimage",
    description: "Linux AppImage desktop bundle",
    fileName: `${artifactPrefix}-${version}-linux-x64.AppImage`,
    localBuildCommand: "npm run ui:desktop:build",
    bundlePath: "apps/sj-ui/src-tauri/target/release/bundle/appimage",
    packagingStrategy: "copy-bundle-file",
    checksumAlgorithm: "sha256"
  }
];

const manifest = {
  product: artifactPrefix,
  displayName: PRODUCT_METADATA.displayName,
  version,
  channel,
  generatedAt: new Date().toISOString(),
  commands: {
    primary: PRODUCT_METADATA.cli.primaryCommand,
    aliases: [
      PRODUCT_METADATA.cli.shortCommand
    ]
  },
  artifactNaming: {
    cliMacLinux: `${artifactPrefix}-cli-\${version}-\${os}-\${arch}.tar.gz`,
    cliWindows: `${artifactPrefix}-cli-\${version}-windows-\${arch}.zip`,
    runtime: `${artifactPrefix}-runtime-\${version}-\${os}-\${arch}.tar.gz`,
    uiWeb: `${artifactPrefix}-ui-web-\${version}-\${os}-\${arch}.tar.gz`,
    desktopAppBundle: `${artifactPrefix}-\${version}-\${os}-\${arch}.app.tar.gz`,
    desktopDmg: `${artifactPrefix}-\${version}-\${os}-\${arch}.dmg`,
    desktopPkg: `${artifactPrefix}-\${version}-\${os}-\${arch}.pkg`,
    desktopNsis: `${artifactPrefix}-\${version}-windows-\${arch}-setup.exe`,
    desktopMsi: `${artifactPrefix}-\${version}-windows-\${arch}.msi`,
    desktopAppImage: `${artifactPrefix}-\${version}-linux-\${arch}.AppImage`
  },
  releaseTargets: [
    "github-releases",
    "homebrew",
    "winget",
    "manual-desktop-download"
  ],
  artifacts: [
    ...cliArtifacts,
    {
      artifactType: "runtime",
      description: "Bundled Kiwi Control runtime binary plus canonical configs, prompts, templates, docs, and scripts",
      fileName: `${artifactPrefix}-runtime-${version}-\${os}-\${arch}.tar.gz`,
      sourcePath: "packages/sj-core/dist/runtime",
      checksumAlgorithm: "sha256"
    },
    {
      artifactType: "ui-web",
      description: "Built web assets for the Kiwi Control desktop shell frontend",
      fileName: `${artifactPrefix}-ui-web-${version}-\${os}-\${arch}.tar.gz`,
      sourcePath: "apps/sj-ui/dist",
      checksumAlgorithm: "sha256"
    },
    ...platformBundles
  ],
  distribution: {
    homebrew: {
      formulaTemplate: "packaging/homebrew/kiwi-control.rb.template",
      formulaName: PRODUCT_METADATA.release.homebrewFormula,
      binaryName: PRODUCT_METADATA.cli.primaryCommand,
      compatibilityAliases: [
        PRODUCT_METADATA.cli.shortCommand
      ]
    },
    winget: {
      template: "packaging/winget/kiwi-control.installer.yaml.template",
      packageIdentifier: PRODUCT_METADATA.release.wingetIdentifier,
      installerType: "exe",
      binaryName: PRODUCT_METADATA.cli.primaryCommand
    },
    githubReleases: {
      releaseTagFormat: "v<version>",
      notes: [
        "Attach the staged CLI bundle, runtime bundle, UI web bundle, desktop bundles, checksums, and release manifest.",
        "The CLI bundle includes install.sh and install.ps1 for end-user local installs, but the primary desktop release path should point users to the macOS pkg or Windows setup EXE first.",
        "Do not claim signed desktop trust until signing and notarization steps were completed for that release."
      ]
    }
  },
  updateMetadata: {
    tauriUpdaterManifest: PRODUCT_METADATA.release.updaterManifestPath,
    updaterArtifactsEnabled: false,
    checksumFiles: ["SHA256SUMS.txt"],
    signingInputs: [
      "TAURI_SIGNING_PRIVATE_KEY",
      "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
      "APPLE_SIGNING_IDENTITY",
      "APPLE_INSTALLER_SIGNING_IDENTITY",
      "APPLE_CERTIFICATE",
      "APPLE_CERTIFICATE_PASSWORD",
      "APPLE_API_ISSUER",
      "APPLE_API_KEY",
      "APPLE_API_KEY_PATH",
      "APPLE_ID",
      "APPLE_PASSWORD",
      "APPLE_TEAM_ID",
      "WINDOWS_CERTIFICATE_PFX_B64",
      "WINDOWS_CERTIFICATE_PASSWORD",
      "WINDOWS_CERTIFICATE_THUMBPRINT",
      "WINDOWS_TIMESTAMP_URL"
    ],
    notes: [
      "Updater artifact generation stays disabled until Tauri updater signing inputs and plugin configuration are active.",
      "Do not claim auto-update support until signed updater metadata is shipping in published releases."
    ]
  },
  trustChecklist: {
    manualSteps: [
      "Run the local verification commands before packaging.",
      "Sign and notarize macOS app, dmg, and pkg installers before marking them trusted.",
      "Apply Windows code signing before publishing MSI artifacts.",
      "Publish SHA256 checksums alongside the release manifest.",
      "Only enable updater distribution after desktop signing inputs are configured."
    ],
    verificationNotes: [
      "Core operation stays local-first and repo-first with no mandatory cloud backend.",
      "Repo-local artifact schemas remain backward compatible during the beta rebrand.",
      "The public CLI bundle stays Node-backed during beta, so end-user install docs must state the Node 22+ requirement honestly."
    ]
  }
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`wrote release manifest to ${manifestPath}`);

async function stageCliBundle(options) {
  const cliDistDir = path.join(options.repoRoot, "packages", "sj-cli", "dist");
  const sjCorePackageDir = path.join(options.bundlePath, "node_modules", "@shrey-junior", "sj-core");
  const yamlPackageDir = path.join(options.bundlePath, "node_modules", "yaml");
  const binDir = path.join(options.bundlePath, "bin");
  const libDir = path.join(options.bundlePath, "lib");

  await rm(options.bundlePath, { recursive: true, force: true });
  await mkdir(binDir, { recursive: true });
  await mkdir(libDir, { recursive: true });
  await mkdir(sjCorePackageDir, { recursive: true });
  await mkdir(yamlPackageDir, { recursive: true });

  await cp(cliDistDir, libDir, { recursive: true });
  await cp(path.join(options.repoRoot, "packages", "sj-core", "dist"), path.join(sjCorePackageDir, "dist"), {
    recursive: true
  });
  await cp(path.join(options.repoRoot, "packages", "sj-core", "package.json"), path.join(sjCorePackageDir, "package.json"));
  await cp(path.join(options.repoRoot, "node_modules", "yaml"), yamlPackageDir, { recursive: true });

  const posixLaunchers = [
    PRODUCT_METADATA.cli.primaryCommand,
    PRODUCT_METADATA.cli.shortCommand,
    ...PRODUCT_METADATA.cli.compatibilityCommands
  ];

  for (const launcherName of posixLaunchers) {
    const launcherPath = path.join(binDir, launcherName);
    await writeFile(launcherPath, renderPosixCliLauncher(), "utf8");
    await chmod(launcherPath, 0o755);
  }

  for (const launcherName of posixLaunchers) {
    await writeFile(path.join(binDir, `${launcherName}.cmd`), renderWindowsCliLauncher(), "utf8");
  }

  await writeFile(path.join(options.bundlePath, "README.md"), renderCliBundleReadme(options.version), "utf8");
  await writeFile(path.join(options.bundlePath, "install.sh"), renderCliBundleInstaller(options.version), "utf8");
  await chmod(path.join(options.bundlePath, "install.sh"), 0o755);
  await writeFile(path.join(options.bundlePath, "install.ps1"), renderCliBundleInstallerPs1(options.version), "utf8");
  await removeAppleDoubleFiles(options.bundlePath);
}

function renderPosixCliLauncher() {
  return `#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
resolve_node_binary() {
  if [[ -n "\${KIWI_CONTROL_NODE:-}" && -x "\${KIWI_CONTROL_NODE}" ]]; then
    printf '%s\\n' "$KIWI_CONTROL_NODE"
    return
  fi

  if [[ -n "\${SHREY_JUNIOR_NODE:-}" && -x "\${SHREY_JUNIOR_NODE}" ]]; then
    printf '%s\\n' "$SHREY_JUNIOR_NODE"
    return
  fi

  local candidate=""
  if candidate="$(command -v node 2>/dev/null)"; then
    printf '%s\\n' "$candidate"
    return
  fi

  for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    if [[ -x "$candidate" ]]; then
      printf '%s\\n' "$candidate"
      return
    fi
  done

  printf '%s\\n' "${PRODUCT_METADATA.displayName} requires Node.js 22+ to run." >&2
  exit 1
}
NODE_BIN="$(resolve_node_binary)"
exec "$NODE_BIN" "$SCRIPT_DIR/../lib/cli.js" "$@"
`;
}

function renderWindowsCliLauncher() {
  return `@echo off
set SCRIPT_DIR=%~dp0
node "%SCRIPT_DIR%..\\lib\\cli.js" %*
`;
}

function renderCliBundleReadme(version) {
  return `# Kiwi Control CLI bundle

This bundle installs the public Kiwi Control commands:

- ${PRODUCT_METADATA.cli.primaryCommand}
- ${PRODUCT_METADATA.cli.shortCommand}

Beta compatibility aliases are also included:

- ${PRODUCT_METADATA.cli.compatibilityCommands.join("\n- ")}

## Install on macOS or Linux

Run:

\`\`\`bash
./install.sh
\`\`\`

## Install on Windows

Run in PowerShell:

\`\`\`powershell
.\\install.ps1
\`\`\`

## After install

Run:

\`\`\`bash
${PRODUCT_METADATA.cli.primaryCommand} --help
\`\`\`

Then, inside a repo or folder you want Kiwi Control to manage:

\`\`\`bash
cd /path/to/repo
${PRODUCT_METADATA.cli.primaryCommand} init
${PRODUCT_METADATA.cli.shortCommand} status
${PRODUCT_METADATA.cli.shortCommand} check
\`\`\`

This beta CLI bundle stays Node-backed. Install Node.js 22 or newer before using the installed commands.

Version: ${version}
`;
}

function renderCliBundleInstaller(version) {
  return `#!/usr/bin/env bash
set -euo pipefail

BUNDLE_ROOT="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
resolve_default_global_home() {
  if [[ -n "\${KIWI_CONTROL_HOME:-}" ]]; then
    printf '%s\\n' "$KIWI_CONTROL_HOME"
    return
  fi

  printf '%s\\n' "$HOME/.kiwi-control"
}

GLOBAL_HOME="$(resolve_default_global_home)"
PATH_BIN="\${KIWI_CONTROL_PATH_BIN:-$HOME/.local/bin}"
INSTALL_ROOT="$GLOBAL_HOME/releases/${artifactPrefix}-${version}"

if ! command -v node >/dev/null 2>&1; then
  echo "${PRODUCT_METADATA.displayName} CLI install error: Node.js 22+ is required for the beta CLI bundle." >&2
  exit 1
fi

mkdir -p "$GLOBAL_HOME/releases" "$PATH_BIN"
rm -rf "$INSTALL_ROOT"
cp -R "$BUNDLE_ROOT" "$INSTALL_ROOT"

chmod +x "$INSTALL_ROOT/bin/${PRODUCT_METADATA.cli.primaryCommand}" "$INSTALL_ROOT/bin/${PRODUCT_METADATA.cli.shortCommand}" "$INSTALL_ROOT/bin/${PRODUCT_METADATA.cli.compatibilityCommands[0]}" "$INSTALL_ROOT/bin/${PRODUCT_METADATA.cli.compatibilityCommands[1]}"

is_path_dir_on_path() {
  case ":$PATH:" in
    *":$PATH_BIN:"*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

resolve_shell_profile() {
  local shell_name="\${KIWI_CONTROL_SHELL:-\${SHELL##*/}}"
  case "$shell_name" in
    zsh)
      printf '%s\\n' "$HOME/.zshrc"
      ;;
    bash)
      if [[ "\${OSTYPE:-}" == darwin* ]]; then
        printf '%s\\n' "$HOME/.bash_profile"
      else
        printf '%s\\n' "$HOME/.bashrc"
      fi
      ;;
    *)
      printf '%s\\n' "$HOME/.profile"
      ;;
  esac
}

upsert_path_profile() {
  local profile_path="$1"
  local begin_marker="# >>> Kiwi Control PATH >>>"
  local end_marker="# <<< Kiwi Control PATH <<<"
  local block_body="export PATH=\\\"$PATH_BIN:\\$PATH\\\""

  mkdir -p "$(dirname "$profile_path")"
  if [[ ! -f "$profile_path" ]]; then
    : > "$profile_path"
  fi

  python3 - "$profile_path" "$begin_marker" "$end_marker" "$block_body" <<'PY'
from pathlib import Path
import sys

profile_path = Path(sys.argv[1])
begin_marker = sys.argv[2]
end_marker = sys.argv[3]
block_body = sys.argv[4]

block = f"{begin_marker}\\n{block_body}\\n{end_marker}"
content = profile_path.read_text(encoding="utf-8")

if begin_marker in content and end_marker in content:
    start = content.index(begin_marker)
    end = content.index(end_marker, start) + len(end_marker)
    updated = f"{content[:start].rstrip()}\\n{block}\\n{content[end:].lstrip()}"
else:
    separator = "\\n" if content and not content.endswith("\\n") else ""
    updated = f"{content}{separator}{block}\\n"

profile_path.write_text(updated, encoding="utf-8")
PY
}

write_wrapper() {
  local wrapper_path="$1"
  cat >"$wrapper_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail

resolve_node_binary() {
  if [[ -n "\${KIWI_CONTROL_NODE:-}" && -x "\${KIWI_CONTROL_NODE}" ]]; then
    printf '%s\\n' "\$KIWI_CONTROL_NODE"
    return
  fi

  if [[ -n "\${SHREY_JUNIOR_NODE:-}" && -x "\${SHREY_JUNIOR_NODE}" ]]; then
    printf '%s\\n' "\$SHREY_JUNIOR_NODE"
    return
  fi

  local candidate=""
  if candidate="\$(command -v node 2>/dev/null)"; then
    printf '%s\\n' "\$candidate"
    return
  fi

  for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    if [[ -x "\$candidate" ]]; then
      printf '%s\\n' "\$candidate"
      return
    fi
  done

  printf '%s\\n' "${PRODUCT_METADATA.displayName} requires Node.js 22+ to run." >&2
  exit 1
}

NODE_BIN="\$(resolve_node_binary)"
exec "\$NODE_BIN" "$INSTALL_ROOT/lib/cli.js" "\$@"
EOF
  chmod +x "$wrapper_path"
}

write_wrapper "$PATH_BIN/${PRODUCT_METADATA.cli.primaryCommand}"
write_wrapper "$PATH_BIN/${PRODUCT_METADATA.cli.shortCommand}"
write_wrapper "$PATH_BIN/${PRODUCT_METADATA.cli.compatibilityCommands[0]}"
write_wrapper "$PATH_BIN/${PRODUCT_METADATA.cli.compatibilityCommands[1]}"

printf '%s\\n' "${PRODUCT_METADATA.displayName} CLI installed."
printf '%s\\n' "Primary command: $PATH_BIN/${PRODUCT_METADATA.cli.primaryCommand}"
printf '%s\\n' "Short alias: $PATH_BIN/${PRODUCT_METADATA.cli.shortCommand}"
printf '%s\\n' "Compatibility aliases: $PATH_BIN/${PRODUCT_METADATA.cli.compatibilityCommands[0]}, $PATH_BIN/${PRODUCT_METADATA.cli.compatibilityCommands[1]}"
if is_path_dir_on_path; then
  printf '%s\\n' "PATH already includes $PATH_BIN"
else
  PROFILE_PATH="$(resolve_shell_profile)"
  upsert_path_profile "$PROFILE_PATH"
  printf '%s\\n' "PATH updated in $PROFILE_PATH"
  printf '%s\\n' "Next step: source $PROFILE_PATH"
fi
`;
}

function renderCliBundleInstallerPs1(version) {
  return `param()

$BundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$GlobalHome = if ($env:KIWI_CONTROL_HOME) { $env:KIWI_CONTROL_HOME } elseif ($env:SHREY_JUNIOR_HOME) { $env:SHREY_JUNIOR_HOME } else { Join-Path $HOME ".kiwi-control" }
$PathBin = if ($env:KIWI_CONTROL_PATH_BIN) { $env:KIWI_CONTROL_PATH_BIN } elseif ($env:SHREY_JUNIOR_PATH_BIN) { $env:SHREY_JUNIOR_PATH_BIN } else { Join-Path $HOME ".local/bin" }
$InstallRoot = Join-Path $GlobalHome "releases\\${artifactPrefix}-${version}"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "${PRODUCT_METADATA.displayName} CLI install error: Node.js 22+ is required for the beta CLI bundle."
  exit 1
}

New-Item -ItemType Directory -Force -Path (Join-Path $GlobalHome "releases") | Out-Null
New-Item -ItemType Directory -Force -Path $PathBin | Out-Null

if (Test-Path $InstallRoot) {
  Remove-Item -Recurse -Force $InstallRoot
}

Copy-Item -Recurse -Force $BundleRoot $InstallRoot

$PrimaryWrapper = "@echo off\`r\`nnode \`"$InstallRoot\\lib\\cli.js\`" %*\`r\`n"
$CompatibilityWrapper = $PrimaryWrapper

Set-Content -Path (Join-Path $PathBin "${PRODUCT_METADATA.cli.primaryCommand}.cmd") -Value $PrimaryWrapper -NoNewline
Set-Content -Path (Join-Path $PathBin "${PRODUCT_METADATA.cli.shortCommand}.cmd") -Value $PrimaryWrapper -NoNewline
Set-Content -Path (Join-Path $PathBin "${PRODUCT_METADATA.cli.compatibilityCommands[0]}.cmd") -Value $CompatibilityWrapper -NoNewline
Set-Content -Path (Join-Path $PathBin "${PRODUCT_METADATA.cli.compatibilityCommands[1]}.cmd") -Value $CompatibilityWrapper -NoNewline

Write-Host "${PRODUCT_METADATA.displayName} CLI installed."
Write-Host "Primary command: $PathBin\\${PRODUCT_METADATA.cli.primaryCommand}.cmd"
Write-Host "Short alias: $PathBin\\${PRODUCT_METADATA.cli.shortCommand}.cmd"
Write-Host "Compatibility aliases: $PathBin\\${PRODUCT_METADATA.cli.compatibilityCommands[0]}.cmd, $PathBin\\${PRODUCT_METADATA.cli.compatibilityCommands[1]}.cmd"
Write-Host "Add $PathBin to PATH if needed, then run ${PRODUCT_METADATA.cli.primaryCommand} --help."
`;
}

async function removeAppleDoubleFiles(rootPath) {
  const entries = await readdir(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.name.startsWith("._")) {
      await rm(entryPath, { force: true, recursive: entry.isDirectory() });
      continue;
    }

    if (entry.isDirectory()) {
      await removeAppleDoubleFiles(entryPath);
    }
  }
}
