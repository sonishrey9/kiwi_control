import path from "node:path";
import { chmod, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { prepareRuntimeSidecar } from "./prepare-runtime-sidecar.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootPackage = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
const { PRODUCT_METADATA } = await import(
  pathToFileURL(path.join(repoRoot, "packages", "sj-core", "dist", "core", "product.js")).href
);

export async function stageCliBundle(options = {}) {
  const resolvedRepoRoot = options.repoRoot ? path.resolve(options.repoRoot) : repoRoot;
  const version = options.version ?? rootPackage.version;
  const bundlePath = path.resolve(resolvedRepoRoot, options.bundlePath ?? path.join("dist", "release", "cli-bundle"));
  const cliDistDir = path.join(resolvedRepoRoot, "packages", "sj-cli", "dist");
  const sjCorePackageDir = path.join(bundlePath, "node_modules", "@shrey-junior", "sj-core");
  const yamlPackageDir = path.join(bundlePath, "node_modules", "yaml");
  const binDir = path.join(bundlePath, "bin");
  const libDir = path.join(bundlePath, "lib");

  await prepareRuntimeSidecar({
    repoRoot: resolvedRepoRoot,
    cargoTargetDir: path.join(resolvedRepoRoot, "target", "runtime-sidecar")
  });

  await rm(bundlePath, { recursive: true, force: true });
  await mkdir(binDir, { recursive: true });
  await mkdir(libDir, { recursive: true });
  await mkdir(sjCorePackageDir, { recursive: true });
  await mkdir(yamlPackageDir, { recursive: true });

  await cp(cliDistDir, libDir, { recursive: true });
  await cp(path.join(resolvedRepoRoot, "packages", "sj-core", "dist"), path.join(sjCorePackageDir, "dist"), {
    recursive: true
  });
  await cp(path.join(resolvedRepoRoot, "packages", "sj-core", "package.json"), path.join(sjCorePackageDir, "package.json"));
  await cp(path.join(resolvedRepoRoot, "node_modules", "yaml"), yamlPackageDir, { recursive: true });

  const publicLaunchers = [
    PRODUCT_METADATA.cli.primaryCommand,
    PRODUCT_METADATA.cli.shortCommand
  ];

  for (const launcherName of publicLaunchers) {
    const launcherPath = path.join(binDir, launcherName);
    await writeFile(launcherPath, renderPosixCliLauncher(), "utf8");
    await chmod(launcherPath, 0o755);
  }

  for (const launcherName of publicLaunchers) {
    await writeFile(path.join(binDir, `${launcherName}.cmd`), renderWindowsCliLauncher(), "utf8");
  }

  await writeFile(path.join(bundlePath, "README.md"), renderCliBundleReadme(version), "utf8");
  await writeFile(path.join(bundlePath, "install.sh"), renderCliBundleInstaller(version), "utf8");
  await chmod(path.join(bundlePath, "install.sh"), 0o755);
  await writeFile(path.join(bundlePath, "install.ps1"), renderCliBundleInstallerPs1(version), "utf8");
  await removeAppleDoubleFiles(bundlePath);

  return bundlePath;
}

export async function stageDesktopInstallerResources(options = {}) {
  const resolvedRepoRoot = options.repoRoot ? path.resolve(options.repoRoot) : repoRoot;
  const version = options.version ?? rootPackage.version;
  const resourcesRoot = path.resolve(
    resolvedRepoRoot,
    options.resourcesRoot ?? path.join("apps", "sj-ui", "src-tauri", "resources", "desktop")
  );
  const nodeBinaryPath = path.resolve(options.nodeBinaryPath ?? process.execPath);
  const cliBundlePath = path.join(resourcesRoot, "cli-bundle");
  const nodeRuntimeDir = path.join(resourcesRoot, "node");
  const nodeLibDir = path.join(resourcesRoot, "lib");
  const stagedNodePath = path.join(nodeRuntimeDir, path.basename(nodeBinaryPath));

  await rm(resourcesRoot, { recursive: true, force: true });
  await mkdir(nodeRuntimeDir, { recursive: true });
  await mkdir(nodeLibDir, { recursive: true });
  await stageCliBundle({
    repoRoot: resolvedRepoRoot,
    version,
    bundlePath: cliBundlePath
  });
  await cp(nodeBinaryPath, stagedNodePath);
  await chmod(stagedNodePath, 0o755).catch(() => undefined);
  await stageNodeSupportFiles(nodeBinaryPath, resourcesRoot);
  await removeAppleDoubleFiles(resourcesRoot);

  return {
    resourcesRoot,
    cliBundlePath,
    stagedNodePath
  };
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
setlocal
set "PREFERRED_NODE="
if not "%KIWI_CONTROL_NODE%"=="" set "PREFERRED_NODE=%KIWI_CONTROL_NODE%"
if not "%SHREY_JUNIOR_NODE%"=="" set "PREFERRED_NODE=%SHREY_JUNIOR_NODE%"
if defined PREFERRED_NODE (
  "%PREFERRED_NODE%" "%~dp0..\\lib\\cli.js" %*
  exit /b %ERRORLEVEL%
)
node "%~dp0..\\lib\\cli.js" %*
`;
}

function renderCliBundleReadme(version) {
  return `# Kiwi Control CLI bundle

This bundle installs the public Kiwi Control commands:

- ${PRODUCT_METADATA.cli.primaryCommand}
- ${PRODUCT_METADATA.cli.shortCommand}

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

This beta CLI bundle stays Node-backed. Install Node.js 22 or newer before using the installed commands unless Kiwi Control Desktop installed the CLI for you.

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
INSTALL_ROOT="$GLOBAL_HOME/releases/${PRODUCT_METADATA.release.artifactPrefix}-${version}"
PREFERRED_NODE="\${KIWI_CONTROL_NODE_ABSOLUTE:-\${KIWI_CONTROL_NODE:-\${SHREY_JUNIOR_NODE:-}}}"

if [[ -z "$PREFERRED_NODE" ]] && ! command -v node >/dev/null 2>&1; then
  echo "${PRODUCT_METADATA.displayName} CLI install error: Node.js 22+ is required for the beta CLI bundle." >&2
  exit 1
fi

mkdir -p "$GLOBAL_HOME/releases" "$PATH_BIN"
rm -rf "$INSTALL_ROOT"
cp -R "$BUNDLE_ROOT" "$INSTALL_ROOT"

chmod +x "$INSTALL_ROOT/bin/${PRODUCT_METADATA.cli.primaryCommand}" "$INSTALL_ROOT/bin/${PRODUCT_METADATA.cli.shortCommand}"

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
  cat >"$wrapper_path" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

resolve_node_binary() {
  local preferred_node="__KIWI_CONTROL_PREFERRED_NODE__"
  if [[ -n "\$preferred_node" && -x "\$preferred_node" ]]; then
    printf '%s\\n' "\$preferred_node"
    return
  fi

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
exec "\$NODE_BIN" "__KIWI_CONTROL_INSTALL_ROOT__/lib/cli.js" "\$@"
EOF
  python3 - "$wrapper_path" "$PREFERRED_NODE" "$INSTALL_ROOT" <<'PY'
from pathlib import Path
import json
import sys

wrapper_path = Path(sys.argv[1])
preferred_node = json.dumps(sys.argv[2])[1:-1]
install_root = json.dumps(sys.argv[3])[1:-1]
content = wrapper_path.read_text(encoding="utf-8")
content = content.replace("__KIWI_CONTROL_PREFERRED_NODE__", preferred_node)
content = content.replace("__KIWI_CONTROL_INSTALL_ROOT__", install_root)
wrapper_path.write_text(content, encoding="utf-8")
PY
  chmod +x "$wrapper_path"
}

write_wrapper "$PATH_BIN/${PRODUCT_METADATA.cli.primaryCommand}"
write_wrapper "$PATH_BIN/${PRODUCT_METADATA.cli.shortCommand}"

printf '%s\\n' "${PRODUCT_METADATA.displayName} CLI installed."
printf '%s\\n' "Primary command: $PATH_BIN/${PRODUCT_METADATA.cli.primaryCommand}"
printf '%s\\n' "Short alias: $PATH_BIN/${PRODUCT_METADATA.cli.shortCommand}"
if is_path_dir_on_path; then
  printf '%s\\n' "PATH already includes $PATH_BIN"
else
  PROFILE_PATH="$(resolve_shell_profile)"
  upsert_path_profile "$PROFILE_PATH"
  printf '%s\\n' "PATH updated in $PROFILE_PATH"
  printf '%s\\n' "Next step: open a new terminal window."
fi
`;
}

function renderCliBundleInstallerPs1(version) {
  return `param()

$BundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$GlobalHome = if ($env:KIWI_CONTROL_HOME) { $env:KIWI_CONTROL_HOME } else { Join-Path $HOME ".kiwi-control" }
$PathBin = if ($env:KIWI_CONTROL_PATH_BIN) { $env:KIWI_CONTROL_PATH_BIN } else { Join-Path $GlobalHome "bin" }
$InstallRoot = Join-Path $GlobalHome "releases\\${PRODUCT_METADATA.release.artifactPrefix}-${version}"
$PreferredNode = if ($env:KIWI_CONTROL_NODE_ABSOLUTE) { $env:KIWI_CONTROL_NODE_ABSOLUTE } elseif ($env:KIWI_CONTROL_NODE) { $env:KIWI_CONTROL_NODE } elseif ($env:SHREY_JUNIOR_NODE) { $env:SHREY_JUNIOR_NODE } else { $null }

if (-not $PreferredNode -and -not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "${PRODUCT_METADATA.displayName} CLI install error: Node.js 22+ is required for the beta CLI bundle."
  exit 1
}

New-Item -ItemType Directory -Force -Path (Join-Path $GlobalHome "releases") | Out-Null
New-Item -ItemType Directory -Force -Path $PathBin | Out-Null

if (Test-Path $InstallRoot) {
  Remove-Item -Recurse -Force $InstallRoot
}

Copy-Item -Recurse -Force $BundleRoot $InstallRoot

$EscapedInstallRoot = $InstallRoot.Replace('"', '""')
$EscapedPreferredNode = if ($PreferredNode) { $PreferredNode.Replace('"', '""') } else { "" }
$Wrapper = @"
@echo off
setlocal
set "PREFERRED_NODE=$EscapedPreferredNode"
if not "%KIWI_CONTROL_NODE_ABSOLUTE%"=="" set "PREFERRED_NODE=%KIWI_CONTROL_NODE_ABSOLUTE%"
if not "%KIWI_CONTROL_NODE%"=="" set "PREFERRED_NODE=%KIWI_CONTROL_NODE%"
if not "%SHREY_JUNIOR_NODE%"=="" set "PREFERRED_NODE=%SHREY_JUNIOR_NODE%"
if defined PREFERRED_NODE (
  "%PREFERRED_NODE%" "$EscapedInstallRoot\\lib\\cli.js" %*
  exit /b %ERRORLEVEL%
)
node "$EscapedInstallRoot\\lib\\cli.js" %*
"@

Set-Content -Path (Join-Path $PathBin "${PRODUCT_METADATA.cli.primaryCommand}.cmd") -Value $Wrapper -NoNewline
Set-Content -Path (Join-Path $PathBin "${PRODUCT_METADATA.cli.shortCommand}.cmd") -Value $Wrapper -NoNewline

$CurrentUserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$PathEntries = if ($CurrentUserPath) { $CurrentUserPath -split ';' | Where-Object { $_ } } else { @() }
if ($PathEntries -notcontains $PathBin) {
  $NewUserPath = if ($CurrentUserPath) { "$PathBin;$CurrentUserPath" } else { $PathBin }
  [Environment]::SetEnvironmentVariable("Path", $NewUserPath, "User")
  $PathUpdateMessage = "PATH updated for future terminals."
} else {
  $PathUpdateMessage = "PATH already includes $PathBin"
}

Write-Host "${PRODUCT_METADATA.displayName} CLI installed."
Write-Host "Primary command: $PathBin\\${PRODUCT_METADATA.cli.primaryCommand}.cmd"
Write-Host "Short alias: $PathBin\\${PRODUCT_METADATA.cli.shortCommand}.cmd"
Write-Host $PathUpdateMessage
Write-Host "Next step: open a new terminal window."
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

async function stageNodeSupportFiles(nodeBinaryPath, resourcesRoot) {
  if (process.platform === "darwin") {
    const candidateLibDirs = [
      path.join(path.dirname(nodeBinaryPath), "..", "lib"),
      path.dirname(nodeBinaryPath)
    ];
    for (const candidateDir of candidateLibDirs) {
      const resolvedDir = path.resolve(candidateDir);
      if (!(await exists(resolvedDir))) {
        continue;
      }
      for (const entry of await readdir(resolvedDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.startsWith("libnode") || !entry.name.endsWith(".dylib")) {
          continue;
        }
        await cp(path.join(resolvedDir, entry.name), path.join(resourcesRoot, "lib", entry.name));
      }
    }
    return;
  }

  if (process.platform === "win32") {
    const resolvedDir = path.dirname(nodeBinaryPath);
    for (const entry of await readdir(resolvedDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".dll")) {
        continue;
      }
      await cp(path.join(resolvedDir, entry.name), path.join(resourcesRoot, "node", entry.name));
    }
  }
}

async function exists(candidatePath) {
  try {
    await readFile(candidatePath);
    return true;
  } catch {
    try {
      await readdir(candidatePath);
      return true;
    } catch {
      return false;
    }
  }
}
