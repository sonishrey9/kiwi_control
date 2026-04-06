#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[product] workspace build"
npm run build

echo "[product] core feature matrix"
bash "$ROOT/scripts/test-core-features.sh"

echo "[product] cli feature matrix"
bash "$ROOT/scripts/test-cli-features.sh"

echo "[product] desktop feature matrix"
bash "$ROOT/scripts/test-desktop-features.sh"

echo "[product] smoke test"
bash "$ROOT/scripts/smoke-test.sh"
