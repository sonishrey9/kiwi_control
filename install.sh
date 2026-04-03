#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Kiwi Control install error: Node.js 22+ is required." >&2
  exit 1
fi

echo "Installing Kiwi Control from this source checkout"
npm install
npm run build
bash "$ROOT/scripts/install-global.sh"
