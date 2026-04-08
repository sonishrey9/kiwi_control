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
node "$CLI" prepare "update README docs" --target "$TARGET"
test -f "$TARGET/.agent/state/runtime.sqlite3"
node -e "const fs=require('node:fs');const s=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(s.lifecycle!=='packet-created'){throw new Error('expected packet-created lifecycle after prepare, got '+s.lifecycle)}" "$TARGET/.agent/state/execution-state.json"
node "$CLI" run "stabilize repo-local instructions" --target "$TARGET" --profile product-build --mode assisted
node -e "const fs=require('node:fs');const s=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(s.lifecycle!=='queued'){throw new Error('expected queued lifecycle after run, got '+s.lifecycle)}" "$TARGET/.agent/state/execution-state.json"
node "$CLI" fanout "stabilize repo-local instructions" --target "$TARGET" --profile strict-production --mode guarded
node "$CLI" check --target "$TARGET" --profile product-build

echo "Smoke test passed in $TARGET"
