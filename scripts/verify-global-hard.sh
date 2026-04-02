#!/usr/bin/env bash
set -euo pipefail

CODEX_FILE="$HOME/.codex/AGENTS.md"
CLAUDE_FILE="$HOME/.claude/CLAUDE.md"
PROMPT_FILE="$HOME/Library/Application Support/Code/User/prompts/shrey-junior.instructions.md"
MCP_FILE="$HOME/Library/Application Support/Code/User/mcp.json"
RESTORE_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/restore-global.sh"

assert_count() {
  local expected="$1"
  local needle="$2"
  local file_path="$3"
  local actual
  actual=$(grep -c "$needle" "$file_path" || true)
  if [[ "$actual" != "$expected" ]]; then
    printf 'FAIL %s expected=%s actual=%s file=%s\n' "$needle" "$expected" "$actual" "$file_path" >&2
    exit 1
  fi
  printf 'PASS %s count=%s file=%s\n' "$needle" "$actual" "$file_path"
}

assert_file() {
  local file_path="$1"
  if [[ ! -f "$file_path" ]]; then
    printf 'FAIL missing file %s\n' "$file_path" >&2
    exit 1
  fi
  printf 'PASS file exists %s\n' "$file_path"
}

assert_file "$CODEX_FILE"
assert_file "$CLAUDE_FILE"
assert_file "$PROMPT_FILE"
assert_file "$MCP_FILE"

assert_count 1 "BEGIN SHREY_JUNIOR_GLOBAL_PREFS v1" "$CODEX_FILE"
assert_count 1 "END SHREY_JUNIOR_GLOBAL_PREFS v1" "$CODEX_FILE"
assert_count 1 "BEGIN SHREY_JUNIOR_GLOBAL_PREFS v1" "$CLAUDE_FILE"
assert_count 1 "END SHREY_JUNIOR_GLOBAL_PREFS v1" "$CLAUDE_FILE"
assert_count 1 "BEGIN SHREY_JUNIOR_GLOBAL_PROMPT v1" "$PROMPT_FILE"
assert_count 1 "END SHREY_JUNIOR_GLOBAL_PROMPT v1" "$PROMPT_FILE"

python3 - <<'PY'
from pathlib import Path
import json
path = Path.home() / "Library/Application Support/Code/User/mcp.json"
with path.open("r", encoding="utf-8") as handle:
    data = json.load(handle)
assert isinstance(data, dict)
assert "servers" in data
print(f"PASS json parses {path}")
PY

if [[ ! -x "$RESTORE_SCRIPT" ]]; then
  printf 'FAIL restore script not executable %s\n' "$RESTORE_SCRIPT" >&2
  exit 1
fi
printf 'PASS restore script executable %s\n' "$RESTORE_SCRIPT"

printf 'hard global verification passed\n'
