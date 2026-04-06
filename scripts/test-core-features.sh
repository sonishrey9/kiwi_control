#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_PKG="$ROOT/packages/sj-cli"

echo "[core] building CLI test artifacts"
npm --prefix "$CLI_PKG" run build

echo "[core] running repo reasoning and state suites"
node --test \
  "$ROOT/packages/sj-cli/dist/tests/context-feedback.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/context-selector.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/context.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/fs.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/git.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/packets.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/profiles.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/project-detect.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/reconcile.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/redact.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/router.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/runtime.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/state.test.js" \
  "$ROOT/packages/sj-cli/dist/tests/workflow-engine.test.js"
