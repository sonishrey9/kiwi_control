#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_ROOT="${1:-"$(mktemp -d)/kiwi-demo-repo"}"

mkdir -p "$DEMO_ROOT/src"

cat >"$DEMO_ROOT/package.json" <<'EOF'
{
  "name": "kiwi-demo-repo",
  "private": true
}
EOF

cat >"$DEMO_ROOT/README.md" <<'EOF'
# Kiwi Demo Repo

This repo exists only for the Kiwi Control live demo.
EOF

cat >"$DEMO_ROOT/src/app.ts" <<'EOF'
export const app = true;
EOF

git -C "$DEMO_ROOT" init >/dev/null
git -C "$DEMO_ROOT" add . >/dev/null
git -C "$DEMO_ROOT" -c user.name=kiwi -c user.email=kiwi@example.com commit -m "init" >/dev/null

cat <<EOF
Demo repo prepared at:
  $DEMO_ROOT

Recommended live sequence:

1. Current repo truth
  cd "$ROOT"
  kc setup status --json --target "$ROOT"
  kc setup verify --json --target "$ROOT"
  kc parity --json
  kc status --json --target "$ROOT"
  kc graph build --json --target "$ROOT"
  kc graph status --json --target "$ROOT"
  kc pack status --json --target "$ROOT"
  kc review --json --target "$ROOT"

2. Clean repo init and bounded task
  cd "$DEMO_ROOT"
  kc init
  kc status
  kc guide
  kc prepare "update README docs"
  kc status --json
  kc run "update README docs"
  kc status --json

3. Packet and desktop sync
  cat .agent/state/latest-task-packets.json
  kc ui --target "$DEMO_ROOT"

4. Optional evidence refresh
  cd "$ROOT"
  node scripts/run-demo-proof.mjs

The proof bundle lands at:
  $ROOT/output/demo/2026-04-13-live-proof
EOF
