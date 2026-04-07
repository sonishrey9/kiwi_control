#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Cleaning AppleDouble sidecars in working tree..."
find "$ROOT" \
  -type f \
  \( -name '._*' -o -name '.DS_Store' \) \
  ! -path "$ROOT/.git/*" \
  -print -delete

echo
echo "Cleaning AppleDouble sidecars in .git..."
find "$ROOT/.git" \
  -type f \
  \( -name '._*' -o -name '.DS_Store' \) \
  -print -delete 2>/dev/null || true

echo
echo "AppleDouble cleanup complete."
