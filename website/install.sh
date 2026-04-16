#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${KIWI_CONTROL_DOWNLOAD_BASE_URL:-https://kiwi-control.kiwi-ai.in}"
INSTALL_DESKTOP=false

usage() {
  cat <<'EOF'
Kiwi Control CLI bootstrap installer

Usage:
  curl -fsSL https://kiwi-control.kiwi-ai.in/install.sh | bash
  curl -fsSL https://kiwi-control.kiwi-ai.in/install.sh | bash -s -- --desktop

Options:
  --desktop      Also install the desktop app when a real artifact exists for this OS.
  --cli-only     Install the CLI only. This is the default.
  -h, --help     Show this help.

Environment:
  KIWI_CONTROL_DOWNLOAD_BASE_URL  Override the public download base URL.
  KIWI_CONTROL_HOME               Override the user install state directory.
  KIWI_CONTROL_PATH_BIN           Override the directory where kc is linked.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --desktop|--install-desktop)
      INSTALL_DESKTOP=true
      shift
      ;;
    --cli-only)
      INSTALL_DESKTOP=false
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Kiwi Control install error: missing required command '$1'." >&2
    exit 1
  fi
}

require_command curl
require_command tar
require_command node

case "$(uname -s)" in
  Darwin)
    PLATFORM="macos"
    ;;
  Linux)
    PLATFORM="linux"
    ;;
  *)
    echo "Kiwi Control CLI bootstrap supports macOS and Linux. Use install.ps1 on Windows." >&2
    exit 1
    ;;
esac

case "$(uname -m)" in
  arm64|aarch64)
    ARCH="aarch64"
    ;;
  x86_64|amd64)
    ARCH="x64"
    ;;
  *)
    echo "Kiwi Control install error: unsupported CPU architecture $(uname -m)." >&2
    exit 1
    ;;
esac

TMPDIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

METADATA_PATH="$TMPDIR/latest-release.json"
ARCHIVE_PATH="$TMPDIR/kiwi-control-cli.tar.gz"
RUNTIME_ARCHIVE_PATH="$TMPDIR/kiwi-control-runtime.tar.gz"
BUNDLE_DIR="$TMPDIR/bundle"
mkdir -p "$BUNDLE_DIR"

curl -fsSL "$BASE_URL/data/latest-release.json" -o "$METADATA_PATH"

CLI_URL="$(
  node - "$METADATA_PATH" "$PLATFORM" "$ARCH" <<'NODE'
const fs = require("node:fs");
const [metadataPath, platform, arch] = process.argv.slice(2);
const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
const artifacts = metadata.artifacts ?? {};

const keys = platform === "macos"
  ? (arch === "aarch64" ? ["cliMacosAarch64", "cliMacos"] : ["cliMacosX64", "cliMacos"])
  : ["cliLinux"];

for (const key of keys) {
  const url = artifacts[key]?.latestUrl;
  if (url) {
    process.stdout.write(url);
    process.exit(0);
  }
}

console.error(`Kiwi Control CLI bundle is not published yet for ${platform}/${arch}.`);
process.exit(1);
NODE
)"

RUNTIME_URL="$(
  node - "$METADATA_PATH" "$PLATFORM" "$ARCH" <<'NODE'
const fs = require("node:fs");
const [metadataPath, platform, arch] = process.argv.slice(2);
const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
const artifacts = metadata.artifacts ?? {};

const keys = platform === "macos"
  ? (arch === "aarch64" ? ["runtimeMacosAarch64", "runtimeMacos"] : ["runtimeMacosX64", "runtimeMacos"])
  : platform === "linux"
    ? ["runtimeLinux"]
    : [];

for (const key of keys) {
  const url = artifacts[key]?.latestUrl;
  if (url) {
    process.stdout.write(url);
    process.exit(0);
  }
}
NODE
)"

echo "Downloading Kiwi Control CLI bundle for $PLATFORM/$ARCH"
curl -fsSL "$CLI_URL" -o "$ARCHIVE_PATH"
tar -xzf "$ARCHIVE_PATH" -C "$BUNDLE_DIR"

BUNDLE_INSTALLER="$(find "$BUNDLE_DIR" -maxdepth 3 -type f -name install.sh -print | head -n 1)"
if [[ -z "$BUNDLE_INSTALLER" ]]; then
  echo "Kiwi Control install error: downloaded CLI bundle did not contain install.sh." >&2
  exit 1
fi

if [[ -n "$RUNTIME_URL" ]]; then
  BUNDLE_ROOT="$(cd "$(dirname "$BUNDLE_INSTALLER")" && pwd)"
  RUNTIME_DIR="$BUNDLE_ROOT/node_modules/@shrey-junior/sj-core/dist/runtime"
  mkdir -p "$RUNTIME_DIR"
  echo "Downloading Kiwi Control runtime bundle for $PLATFORM/$ARCH"
  curl -fsSL "$RUNTIME_URL" -o "$RUNTIME_ARCHIVE_PATH"
  tar -xzf "$RUNTIME_ARCHIVE_PATH" -C "$RUNTIME_DIR"
fi

bash "$BUNDLE_INSTALLER"

resolve_install_bin() {
  if [[ -n "${KIWI_CONTROL_PATH_BIN:-}" ]]; then
    printf '%s\n' "$KIWI_CONTROL_PATH_BIN"
    return
  fi
  if [[ "${KIWI_CONTROL_INSTALL_SCOPE:-user}" == "machine" ]]; then
    printf '%s\n' "/usr/local/bin"
    return
  fi
  printf '%s\n' "$HOME/.local/bin"
}

INSTALL_BIN="$(resolve_install_bin)"
KC_PATH="$INSTALL_BIN/kc"
if [[ ! -x "$KC_PATH" ]]; then
  echo "Kiwi Control install error: expected kc at $KC_PATH after install." >&2
  exit 1
fi

"$KC_PATH" --help >/dev/null
echo "Verified: $KC_PATH --help"

if [[ "$INSTALL_DESKTOP" == "true" ]]; then
  if [[ "$PLATFORM" == "macos" ]]; then
    DESKTOP_URL="$(
      node - "$METADATA_PATH" <<'NODE'
const fs = require("node:fs");
const metadata = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.stdout.write(metadata.artifacts?.macosPkg?.latestUrl ?? "");
NODE
)"
    if [[ -z "$DESKTOP_URL" ]]; then
      echo "Kiwi Control Desktop for macOS is not published yet. CLI install remains complete."
    else
      PKG_PATH="$TMPDIR/kiwi-control.pkg"
      echo "Downloading Kiwi Control Desktop pkg for macOS"
      curl -fsSL "$DESKTOP_URL" -o "$PKG_PATH"
      echo "Installing Kiwi Control Desktop with the macOS installer"
      sudo installer -pkg "$PKG_PATH" -target /
      if [[ -d "/Applications/Kiwi Control.app" ]]; then
        echo "Verified: /Applications/Kiwi Control.app exists"
      else
        echo "Kiwi Control Desktop installer completed, but /Applications/Kiwi Control.app was not found." >&2
        exit 1
      fi
    fi
  else
    echo "Kiwi Control Desktop is not published for Linux. CLI install remains complete."
  fi
fi

echo "Kiwi Control CLI bootstrap complete."
