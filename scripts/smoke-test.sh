#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
TARGET="$TMP_DIR/sample-project"
CLI="$ROOT/packages/sj-cli/dist/cli.js"

cp -R "$ROOT/examples/sample-project" "$TARGET"

cd "$ROOT"

node "$CLI" init --target "$TARGET" --profile product-build
node "$CLI" sync --target "$TARGET" --dry-run --diff-summary
node "$CLI" sync --target "$TARGET" --backup
node "$CLI" run "stabilize repo-local instructions" --target "$TARGET" --profile product-build --mode assisted
node "$CLI" fanout "stabilize repo-local instructions" --target "$TARGET" --profile strict-production --mode guarded
node "$CLI" check --target "$TARGET" --profile product-build

echo "Smoke test passed in $TARGET"
