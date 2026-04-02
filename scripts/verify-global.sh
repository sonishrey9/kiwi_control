#!/usr/bin/env bash
set -euo pipefail

GLOBAL_HOME="${SHREY_JUNIOR_HOME:-$HOME/.shrey-junior}"
PATH_BIN="${SHREY_JUNIOR_PATH_BIN:-$HOME/.local/bin}"
TMP_TARGET="$(mktemp -d /tmp/sj-global-verify-XXXXXX)"
trap 'rm -rf "$TMP_TARGET"' EXIT

printf 'global home: %s\n' "$GLOBAL_HOME"
printf 'path launcher: %s\n' "$PATH_BIN/shrey-junior"
printf 'command -v shrey-junior: %s\n' "$(command -v shrey-junior || echo 'missing')"

test -f "$GLOBAL_HOME/defaults/bootstrap.yaml"
test -f "$GLOBAL_HOME/specialists/specialists.yaml"
test -f "$GLOBAL_HOME/mcp/mcp.servers.json"
test -x "$GLOBAL_HOME/bin/shrey-junior"
test -x "$PATH_BIN/shrey-junior"
test -f "$HOME/.codex/AGENTS.md"
test -f "$HOME/.codex/config.toml"
test -f "$HOME/.claude/CLAUDE.md"
test -f "$HOME/.claude/settings.json"
test -f "$HOME/.claude/commands/shrey-read-first.md"
test -f "$HOME/.claude/commands/shrey-serious-task.md"
test -f "$HOME/Library/Application Support/Code/User/prompts/shrey-junior.instructions.md"

grep -q "Shrey Junior Global Preference Layer" "$HOME/.codex/AGENTS.md"
grep -q "BEGIN SHREY_JUNIOR_CODEX_CONFIG v1" "$HOME/.codex/config.toml"
grep -q "Shrey Junior Global Preference Layer" "$HOME/.claude/CLAUDE.md"
python3 - <<'PY'
from pathlib import Path
import json
path = Path.home() / "Library/Application Support/Code/User/mcp.json"
with path.open("r", encoding="utf-8") as handle:
    data = json.load(handle)
assert isinstance(data, dict)
assert "servers" in data
PY

shrey-junior check
shrey-junior bootstrap --target "$TMP_TARGET" --dry-run

printf 'global verification passed\n'
