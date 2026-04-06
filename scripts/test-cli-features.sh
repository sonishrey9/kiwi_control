#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_PKG="$ROOT/packages/sj-cli"

echo "[cli] building CLI test artifacts"
npm --prefix "$CLI_PKG" run build

echo "[cli] running operator workflow suites"
node --test \
  "$ROOT/packages/sj-cli/dist/tests/bootstrap.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/check.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/checkpoint.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/cli-ux.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/collect.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/dispatch.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/handoff.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/prepare.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/sj-init.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/specialists.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/standardize.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/sync.test.js"
