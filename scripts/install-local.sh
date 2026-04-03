#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Installing local dependencies for Kiwi Control"
npm install

echo "Building workspace packages"
npm run build

echo "Local install ready."
echo "Run the CLI from source with: npm run cli -- status --target ."
echo "Run the desktop app from source with: npm run ui:dev"
