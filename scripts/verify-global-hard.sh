#!/usr/bin/env bash
set -euo pipefail

CODEX_FILE="$HOME/.codex/AGENTS.md"
CODEX_CONFIG="$HOME/.codex/config.toml"
CLAUDE_FILE="$HOME/.claude/CLAUDE.md"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
CLAUDE_READ_FIRST_COMMAND="$HOME/.claude/commands/shrey-read-first.md"
CLAUDE_SERIOUS_TASK_COMMAND="$HOME/.claude/commands/shrey-serious-task.md"
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
assert_file "$CODEX_CONFIG"
assert_file "$CLAUDE_FILE"
assert_file "$CLAUDE_SETTINGS"
assert_file "$CLAUDE_READ_FIRST_COMMAND"
assert_file "$CLAUDE_SERIOUS_TASK_COMMAND"
assert_file "$PROMPT_FILE"
assert_file "$MCP_FILE"

assert_count 1 "BEGIN SHREY_JUNIOR_GLOBAL_PREFS v1" "$CODEX_FILE"
assert_count 1 "END SHREY_JUNIOR_GLOBAL_PREFS v1" "$CODEX_FILE"
assert_count 1 "BEGIN SHREY_JUNIOR_GLOBAL_PREFS v1" "$CLAUDE_FILE"
assert_count 1 "END SHREY_JUNIOR_GLOBAL_PREFS v1" "$CLAUDE_FILE"
assert_count 1 "BEGIN SHREY_JUNIOR_GLOBAL_PROMPT v1" "$PROMPT_FILE"
assert_count 1 "END SHREY_JUNIOR_GLOBAL_PROMPT v1" "$PROMPT_FILE"
assert_count 1 "BEGIN SHREY_JUNIOR_CODEX_CONFIG v1" "$CODEX_CONFIG"
assert_count 1 "END SHREY_JUNIOR_CODEX_CONFIG v1" "$CODEX_CONFIG"

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

python3 - <<'PY'
from pathlib import Path
import json
path = Path.home() / ".claude/settings.json"
data = json.loads(path.read_text(encoding="utf-8"))
allow = data.get("permissions", {}).get("allow", [])
required = {
    "Bash(shrey-junior status:*)",
    "Bash(shrey-junior check:*)",
    "Bash(shrey-junior run:*)",
    "Bash(shrey-junior fanout:*)",
    "Bash(shrey-junior dispatch:*)",
    "Bash(shrey-junior collect:*)",
    "Bash(shrey-junior reconcile:*)",
    "Bash(shrey-junior checkpoint:*)",
    "Bash(shrey-junior handoff:*)",
    "Bash(shrey-junior push-check:*)",
    "Bash(shrey-junior standardize:*)",
    "Bash(shrey-junior bootstrap:*)",
}
missing = sorted(required - set(allow))
if missing:
    raise SystemExit(f"FAIL missing Claude settings permissions: {', '.join(missing)}")
print(f"PASS Claude settings permissions {path}")
PY

grep -q "Shrey Junior Read-First" "$CLAUDE_READ_FIRST_COMMAND"
printf 'PASS command content %s\n' "$CLAUDE_READ_FIRST_COMMAND"
grep -q "Shrey Junior Serious Task" "$CLAUDE_SERIOUS_TASK_COMMAND"
printf 'PASS command content %s\n' "$CLAUDE_SERIOUS_TASK_COMMAND"

if [[ ! -x "$RESTORE_SCRIPT" ]]; then
  printf 'FAIL restore script not executable %s\n' "$RESTORE_SCRIPT" >&2
  exit 1
fi
printf 'PASS restore script executable %s\n' "$RESTORE_SCRIPT"

printf 'hard global verification passed\n'
