#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_PKG="$ROOT/packages/sj-cli"

echo "[desktop] building CLI test artifacts"
npm --prefix "$CLI_PKG" run build

echo "[desktop] running pure UI helper tests"
npm run test -w @shrey-junior/sj-ui

echo "[desktop] running desktop and machine advisory suites"
node --test \
  "$ROOT/packages/sj-cli/dist/tests/machine-advisory.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/product-surfaces.ui-json.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/product-surfaces.desktop-launch.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/product-surfaces.desktop-bundles.test.js"

echo "[desktop] verifying installed-user launch targeting"
node "$ROOT/scripts/verify-installed-launch-flow.mjs"

echo "[desktop] packaging desktop bundle"
npm run ui:desktop:build

echo "[desktop] verifying bundled CLI install resources"
node "$ROOT/scripts/verify-bundled-cli-install.mjs" --platform macos
node "$ROOT/scripts/verify-bundled-cli-install.mjs" --platform windows

echo "[desktop] rendered desktop probe is available separately via npm run test:desktop:rendered"
