#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Installing local dependencies for shrey-junior"
npm install

echo "Building local CLI"
npm run build

echo "Local install ready. Run: node dist/cli.js check"

