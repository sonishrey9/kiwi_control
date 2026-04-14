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

  await copyFiltered(cliDistDir, libDir);
  await copyFiltered(path.join(resolvedRepoRoot, "packages", "sj-core", "dist"), path.join(sjCorePackageDir, "dist"));
  await copyFiltered(path.join(resolvedRepoRoot, "packages", "sj-core", "package.json"), path.join(sjCorePackageDir, "package.json"));
  await copyFiltered(path.join(resolvedRepoRoot, "node_modules", "yaml"), yamlPackageDir);

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
  await writeFile(path.join(bundlePath, "uninstall.ps1"), renderCliBundleUninstallerPs1(version), "utf8");
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
  await copyFiltered(nodeBinaryPath, stagedNodePath);
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
INSTALL_SCOPE="\${KIWI_CONTROL_INSTALL_SCOPE:-user}"
RESULT_PATH="\${KIWI_CONTROL_RESULT_PATH:-}"

resolve_user_global_home() {
  if [[ -n "\${KIWI_CONTROL_HOME:-}" ]]; then
    printf '%s\\n' "$KIWI_CONTROL_HOME"
    return
  fi

  printf '%s\\n' "$HOME/.kiwi-control"
}

resolve_machine_global_home() {
  if [[ -n "\${KIWI_CONTROL_INSTALL_ROOT:-}" ]]; then
    printf '%s\\n' "$KIWI_CONTROL_INSTALL_ROOT"
    return
  fi

  printf '%s\\n' "/Library/Application Support/Kiwi Control"
}

if [[ "$INSTALL_SCOPE" == "machine" ]]; then
  GLOBAL_HOME="$(resolve_machine_global_home)"
  PATH_BIN="\${KIWI_CONTROL_PATH_BIN:-/usr/local/bin}"
  INSTALL_ROOT="$GLOBAL_HOME/cli/${PRODUCT_METADATA.release.artifactPrefix}-${version}"
else
  GLOBAL_HOME="$(resolve_user_global_home)"
  PATH_BIN="\${KIWI_CONTROL_PATH_BIN:-$HOME/.local/bin}"
  INSTALL_ROOT="$GLOBAL_HOME/releases/${PRODUCT_METADATA.release.artifactPrefix}-${version}"
fi
PREFERRED_NODE="\${KIWI_CONTROL_NODE_ABSOLUTE:-\${KIWI_CONTROL_NODE:-\${SHREY_JUNIOR_NODE:-}}}"
PATH_CHANGED=false
DETAIL=""

if [[ -z "$PREFERRED_NODE" ]] && ! command -v node >/dev/null 2>&1; then
  echo "${PRODUCT_METADATA.displayName} CLI install error: Node.js 22+ is required for the beta CLI bundle." >&2
  exit 1
fi

mkdir -p "$(dirname "$INSTALL_ROOT")" "$PATH_BIN"
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

if [[ "$INSTALL_SCOPE" == "machine" ]]; then
  DETAIL="${PRODUCT_METADATA.displayName} terminal commands installed system-wide."
  printf '%s\\n' "$DETAIL"
  printf '%s\\n' "Primary command: $PATH_BIN/${PRODUCT_METADATA.cli.primaryCommand}"
  printf '%s\\n' "Short alias: $PATH_BIN/${PRODUCT_METADATA.cli.shortCommand}"
  printf '%s\\n' "Shared PATH location: $PATH_BIN"
else
  printf '%s\\n' "${PRODUCT_METADATA.displayName} CLI installed."
  printf '%s\\n' "Primary command: $PATH_BIN/${PRODUCT_METADATA.cli.primaryCommand}"
  printf '%s\\n' "Short alias: $PATH_BIN/${PRODUCT_METADATA.cli.shortCommand}"
  if is_path_dir_on_path; then
    DETAIL="PATH already includes $PATH_BIN"
    printf '%s\\n' "$DETAIL"
  else
    PROFILE_PATH="$(resolve_shell_profile)"
    upsert_path_profile "$PROFILE_PATH"
    PATH_CHANGED=true
    DETAIL="PATH updated in $PROFILE_PATH"
    printf '%s\\n' "$DETAIL"
    printf '%s\\n' "Next step: open a new terminal window."
  fi
fi

if [[ -n "$RESULT_PATH" ]]; then
  python3 - "$RESULT_PATH" "$INSTALL_SCOPE" "$INSTALL_ROOT" "$PATH_BIN" "$PATH_CHANGED" "$DETAIL" "$PATH_BIN/${PRODUCT_METADATA.cli.primaryCommand}" "$PATH_BIN/${PRODUCT_METADATA.cli.shortCommand}" <<'PY'
from pathlib import Path
import json
import sys

result_path = Path(sys.argv[1])
payload = {
    "installScope": sys.argv[2],
    "installRoot": sys.argv[3],
    "installBinDir": sys.argv[4],
    "pathChanged": sys.argv[5].lower() == "true",
    "detail": sys.argv[6],
    "primaryCommandPath": sys.argv[7],
    "shortCommandPath": sys.argv[8],
}
result_path.parent.mkdir(parents=True, exist_ok=True)
result_path.write_text(json.dumps(payload, indent=2) + "\\n", encoding="utf-8")
PY
fi
`;
}

function renderCliBundleInstallerPs1(version) {
  return `param(
  [string]$InstallScope = $(if ($env:KIWI_CONTROL_INSTALL_SCOPE) { $env:KIWI_CONTROL_INSTALL_SCOPE } else { "user" }),
  [string]$InstallRoot = $(if ($env:KIWI_CONTROL_INSTALL_ROOT) { $env:KIWI_CONTROL_INSTALL_ROOT } else { "" }),
  [string]$PathBin = $(if ($env:KIWI_CONTROL_PATH_BIN) { $env:KIWI_CONTROL_PATH_BIN } else { "" }),
  [string]$ResultPath = $(if ($env:KIWI_CONTROL_RESULT_PATH) { $env:KIWI_CONTROL_RESULT_PATH } else { "" }),
  [string]$PreferredNodePath = $(if ($env:KIWI_CONTROL_NODE_ABSOLUTE) { $env:KIWI_CONTROL_NODE_ABSOLUTE } elseif ($env:KIWI_CONTROL_NODE) { $env:KIWI_CONTROL_NODE } elseif ($env:SHREY_JUNIOR_NODE) { $env:SHREY_JUNIOR_NODE } else { "" })
)

$ErrorActionPreference = "Stop"
$BundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$GlobalHome = if ($InstallScope -eq "machine") {
  if ([string]::IsNullOrWhiteSpace($InstallRoot)) {
    Join-Path $env:ProgramData "Kiwi Control"
  } else {
    $InstallRoot
  }
} else {
  if ($env:KIWI_CONTROL_HOME) { $env:KIWI_CONTROL_HOME } else { Join-Path $HOME ".kiwi-control" }
}
$PathBin = if ([string]::IsNullOrWhiteSpace($PathBin)) { Join-Path $GlobalHome "bin" } else { $PathBin }
$InstallRoot = if ($InstallScope -eq "machine") {
  Join-Path $GlobalHome "cli\\${PRODUCT_METADATA.release.artifactPrefix}-${version}"
} else {
  Join-Path $GlobalHome "releases\\${PRODUCT_METADATA.release.artifactPrefix}-${version}"
}
$ReceiptPath = if ([string]::IsNullOrWhiteSpace($ResultPath)) { Join-Path $GlobalHome "desktop-cli-install.json" } else { $ResultPath }
$PreferredNode = if (-not [string]::IsNullOrWhiteSpace($PreferredNodePath)) { $PreferredNodePath } else { $null }

if (-not $PreferredNode -and -not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "${PRODUCT_METADATA.displayName} CLI install error: Node.js 22+ is required for the beta CLI bundle."
  exit 1
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $InstallRoot) | Out-Null
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

$PathChanged = $false
$VerificationStatus = "failed"
$VerificationDetail = ""
$VerificationCommandPath = $null
$RequiresNewTerminal = $false
if ($InstallScope -eq "machine") {
  $MachinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $PathEntries = if ($MachinePath) { $MachinePath -split ';' | Where-Object { $_ } } else { @() }
  if ($PathEntries -notcontains $PathBin) {
    $NewMachinePath = if ($MachinePath) { "$PathBin;$MachinePath" } else { $PathBin }
    [Environment]::SetEnvironmentVariable("Path", $NewMachinePath, "Machine")
    $PathChanged = $true
    $PathUpdateMessage = "Machine PATH updated for future terminals."
  } else {
    $PathUpdateMessage = "Machine PATH already includes $PathBin"
  }
  $Detail = "${PRODUCT_METADATA.displayName} terminal commands installed system-wide."
} else {
  $CurrentUserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $PathEntries = if ($CurrentUserPath) { $CurrentUserPath -split ';' | Where-Object { $_ } } else { @() }
  if ($PathEntries -notcontains $PathBin) {
    $NewUserPath = if ($CurrentUserPath) { "$PathBin;$CurrentUserPath" } else { $PathBin }
    [Environment]::SetEnvironmentVariable("Path", $NewUserPath, "User")
    $PathChanged = $true
    $PathUpdateMessage = "PATH updated for future terminals."
  } else {
    $PathUpdateMessage = "PATH already includes $PathBin"
  }
  $Detail = "${PRODUCT_METADATA.displayName} CLI installed."
}

$VerificationScript = '$machine = [Environment]::GetEnvironmentVariable(''Path'', ''Machine''); ' +
  '$user = [Environment]::GetEnvironmentVariable(''Path'', ''User''); ' +
	  '$env:Path = @($machine, $user) -join '';''; ' +
	  '$command = Get-Command kc -ErrorAction Stop; ' +
	  '$commandPath = $command.Source; ' +
	  '& $commandPath --help | Out-Null; ' +
	  'Write-Output $commandPath'

try {
  $VerificationOutput = & powershell.exe -NoProfile -Command $VerificationScript 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0) {
    $ResolvedCommandPath = ($VerificationOutput.Trim() -split "\\r?\\n" | Select-Object -Last 1)
    $VerificationStatus = "passed"
    $VerificationCommandPath = if ([string]::IsNullOrWhiteSpace($ResolvedCommandPath)) { Join-Path $PathBin "${PRODUCT_METADATA.cli.shortCommand}.cmd" } else { $ResolvedCommandPath }
    $RequiresNewTerminal = $PathChanged
    $VerificationDetail = if ($InstallScope -eq "machine") {
      if ($PathChanged) {
        "Terminal commands are enabled system-wide. Open a new terminal to use kc."
      } else {
        "Terminal commands are already enabled system-wide."
      }
    } elseif ($PathChanged) {
      "Terminal commands are enabled for this user. Open a new terminal to use kc."
    } else {
      "Terminal commands are already enabled for this user."
    }
  } else {
    $VerificationDetail = $VerificationOutput.Trim()
  }
} catch {
  $VerificationDetail = $_.Exception.Message
}

Write-Host $Detail
Write-Host "Primary command: $PathBin\\${PRODUCT_METADATA.cli.primaryCommand}.cmd"
Write-Host "Short alias: $PathBin\\${PRODUCT_METADATA.cli.shortCommand}.cmd"
Write-Host $PathUpdateMessage
Write-Host $VerificationDetail
if ($RequiresNewTerminal) {
  Write-Host "Next step: open a new terminal window."
}

if (-not [string]::IsNullOrWhiteSpace($ReceiptPath)) {
  $payload = @{
    installScope = $InstallScope
    installRoot = $InstallRoot
    installBinDir = $PathBin
    pathChanged = $PathChanged
    detail = $Detail
    installedCommandPath = Join-Path $PathBin "${PRODUCT_METADATA.cli.shortCommand}.cmd"
    verificationStatus = $VerificationStatus
    verificationDetail = $VerificationDetail
    verificationCommandPath = $VerificationCommandPath
    requiresNewTerminal = $RequiresNewTerminal
    updatedAt = (Get-Date).ToString("o")
  } | ConvertTo-Json -Depth 5
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ReceiptPath) | Out-Null
  Set-Content -Path $ReceiptPath -Value $payload
}

if ($VerificationStatus -ne "passed") {
  if ([string]::IsNullOrWhiteSpace($VerificationDetail)) {
    Write-Error "Kiwi could not verify kc from a fresh shell after installation."
  } else {
    Write-Error $VerificationDetail
  }
  exit 1
}
`;
}

function renderCliBundleUninstallerPs1(version) {
  return `param(
  [string]$InstallScope = $(if ($env:KIWI_CONTROL_INSTALL_SCOPE) { $env:KIWI_CONTROL_INSTALL_SCOPE } else { "user" }),
  [string]$InstallRoot = $(if ($env:KIWI_CONTROL_INSTALL_ROOT) { $env:KIWI_CONTROL_INSTALL_ROOT } else { "" }),
  [string]$PathBin = $(if ($env:KIWI_CONTROL_PATH_BIN) { $env:KIWI_CONTROL_PATH_BIN } else { "" }),
  [string]$ResultPath = $(if ($env:KIWI_CONTROL_RESULT_PATH) { $env:KIWI_CONTROL_RESULT_PATH } else { "" })
)

$ErrorActionPreference = "Stop"
$GlobalHome = if ($InstallScope -eq "machine") {
  if ([string]::IsNullOrWhiteSpace($InstallRoot)) {
    Join-Path $env:ProgramData "Kiwi Control"
  } else {
    $InstallRoot
  }
} else {
  if ($env:KIWI_CONTROL_HOME) { $env:KIWI_CONTROL_HOME } else { Join-Path $HOME ".kiwi-control" }
}
$PathBin = if ([string]::IsNullOrWhiteSpace($PathBin)) { Join-Path $GlobalHome "bin" } else { $PathBin }
$InstallRoot = if ($InstallScope -eq "machine") {
  Join-Path $GlobalHome "cli\\${PRODUCT_METADATA.release.artifactPrefix}-${version}"
} else {
  Join-Path $GlobalHome "releases\\${PRODUCT_METADATA.release.artifactPrefix}-${version}"
}
$ReceiptPath = if ([string]::IsNullOrWhiteSpace($ResultPath)) { Join-Path $GlobalHome "desktop-cli-install.json" } else { $ResultPath }

function Remove-KiwiPathEntry([string]$Scope, [string]$TargetPath) {
  $CurrentPath = [Environment]::GetEnvironmentVariable("Path", $Scope)
  if ([string]::IsNullOrWhiteSpace($CurrentPath)) {
    return $false
  }

  $NormalizedTarget = $TargetPath.TrimEnd('\\')
  $ExistingEntries = @($CurrentPath -split ';' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  $FilteredEntries = @($ExistingEntries | Where-Object { $_.TrimEnd('\\') -ne $NormalizedTarget })
  if ($FilteredEntries.Count -eq $ExistingEntries.Count) {
    return $false
  }

  [Environment]::SetEnvironmentVariable("Path", ($FilteredEntries -join ';'), $Scope)
  return $true
}

$RemovedWrappers = @()
foreach ($CommandName in @("${PRODUCT_METADATA.cli.primaryCommand}", "${PRODUCT_METADATA.cli.shortCommand}")) {
  $WrapperPath = Join-Path $PathBin "$CommandName.cmd"
  if (Test-Path $WrapperPath) {
    Remove-Item -Force $WrapperPath
    $RemovedWrappers += $WrapperPath
  }
}

if (Test-Path $InstallRoot) {
  Remove-Item -Recurse -Force $InstallRoot
}

$PathChanged = if ($InstallScope -eq "machine") {
  Remove-KiwiPathEntry "Machine" $PathBin
} else {
  Remove-KiwiPathEntry "User" $PathBin
}

if (Test-Path $ReceiptPath) {
  Remove-Item -Force $ReceiptPath
}

foreach ($Candidate in @($PathBin, (Split-Path -Parent $InstallRoot), $GlobalHome)) {
  if (-not [string]::IsNullOrWhiteSpace($Candidate) -and (Test-Path $Candidate)) {
    try {
      if (-not (Get-ChildItem -Force $Candidate | Select-Object -First 1)) {
        Remove-Item -Force $Candidate
      }
    } catch {
      # Keep cleanup best-effort.
    }
  }
}

if (-not [string]::IsNullOrWhiteSpace($ResultPath)) {
  $payload = @{
    installScope = $InstallScope
    installRoot = $InstallRoot
    installBinDir = $PathBin
    pathChanged = $PathChanged
    removedWrappers = $RemovedWrappers
    updatedAt = (Get-Date).ToString("o")
  } | ConvertTo-Json -Depth 5
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ResultPath) | Out-Null
  Set-Content -Path $ResultPath -Value $payload
}
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
        await copyFiltered(path.join(resolvedDir, entry.name), path.join(resourcesRoot, "lib", entry.name));
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
      await copyFiltered(path.join(resolvedDir, entry.name), path.join(resourcesRoot, "node", entry.name));
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

async function copyFiltered(sourcePath, targetPath) {
  await cp(sourcePath, targetPath, {
    recursive: true,
    filter: (entryPath) => {
      const name = path.basename(entryPath);
      return name !== ".DS_Store" && !name.startsWith("._");
    }
  });
}
