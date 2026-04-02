#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
TARGET="$TMP_DIR/sample-project"

cp -R "$ROOT/examples/sample-project" "$TARGET"

cd "$ROOT"

node dist/cli.js init --target "$TARGET" --profile product-build
node dist/cli.js sync --target "$TARGET" --dry-run --diff-summary
node dist/cli.js sync --target "$TARGET" --backup
node dist/cli.js run "stabilize repo-local instructions" --target "$TARGET" --profile product-build --mode assisted
node dist/cli.js fanout "stabilize repo-local instructions" --target "$TARGET" --profile strict-production --mode guarded
node dist/cli.js check --target "$TARGET" --profile product-build

echo "Smoke test passed in $TARGET"
