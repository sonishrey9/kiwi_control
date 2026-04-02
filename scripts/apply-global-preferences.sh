#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=1
      ;;
    *)
      echo "unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

CODEX_FILE="$HOME/.codex/AGENTS.md"
CLAUDE_FILE="$HOME/.claude/CLAUDE.md"
PROMPTS_DIR="$HOME/Library/Application Support/Code/User/prompts"
PROMPT_FILE="$PROMPTS_DIR/shrey-junior.instructions.md"
MCP_FILE="$HOME/Library/Application Support/Code/User/mcp.json"

CODEX_BLOCK=$(cat <<'EOF'
BEGIN SHREY_JUNIOR_GLOBAL_PREFS v1
## Shrey Junior Global Preference Layer

For serious repository work on this machine, treat `shrey-junior` as the preferred control plane.

Authority order:
1. Existing trusted repo authority files
2. Promoted repo-local canonical docs explicitly referenced by that authority
3. Repo-local Shrey Junior overlays and `.agent/state/*`
4. Generic global guidance in this file

Before medium or high complexity work, check:
- repo authority files and promoted canonical docs
- `.agent/state/current-phase.json` if present
- latest handoff and latest reconcile result if present
- active profile via `shrey-junior status --target "<repo>"`

Treat work as trivial only when it is clearly local and low risk, such as:
- typo or wording fix
- one-line formatting or comment cleanup
- narrow non-contract local fix in a single file

Escalate beyond trivial work when any of these are true:
- multi-file change
- interface, contract, or schema change
- auth, data, security, release, or push-sensitive work
- guarded refactor or cross-cutting workflow change
- reviewer/tester separation would materially improve confidence

Preferred workflow:
- `shrey-junior status --target "<repo>"` before serious work
- `shrey-junior check --target "<repo>"` before medium or higher risk work
- `shrey-junior run "<goal>" ...` for focused non-trivial work
- `shrey-junior fanout "<goal>" ...` for guarded or multi-role planning
- `shrey-junior dispatch "<goal>" ...` when planner/implementer/reviewer/tester should work in parallel
- `shrey-junior collect --target "<repo>"` and `shrey-junior reconcile --target "<repo>"` before phase close on coordinated work
- `shrey-junior checkpoint "<milestone>" ...` at meaningful phase boundaries
- `shrey-junior handoff --target "<repo>" --to <tool>` when switching tools
- `shrey-junior push-check --target "<repo>"` before any push or release discussion
- use `release-check` and `phase-close` if the repo exposes them

Specialists and MCPs:
- prefer specialist-aware routing for Python, frontend, backend, QA, security, docs, refactor, release, and push work
- MCP use is policy-driven, not ad hoc; follow repo profile, capability, trust, approval, and specialist rules
- do not treat global MCP availability as blanket permission to call tools

If a serious repo is not initialized yet, do not improvise a replacement control layer first. Prefer:
- `shrey-junior bootstrap --target "<repo>" --dry-run`

Repo authority still wins. Shrey Junior is the default workflow layer, not a license to ignore repo truth.
END SHREY_JUNIOR_GLOBAL_PREFS v1
EOF
)

CLAUDE_BLOCK=$(cat <<'EOF'
BEGIN SHREY_JUNIOR_GLOBAL_PREFS v1
## Shrey Junior Global Preference Layer

For serious repository work on this machine, treat `shrey-junior` as the preferred repo control layer.

Authority order:
1. Existing trusted repo authority files
2. Promoted repo-local canonical docs explicitly referenced by that authority
3. Repo-local Shrey Junior overlays and `.agent/state/*`
4. Generic global guidance in this file

Before medium or high complexity work, prefer:
- `shrey-junior status --target "<repo>"`
- repo authority files and promoted canonical docs
- `.agent/state/current-phase.json` if present
- latest handoff, latest dispatch, and latest reconcile result if present
- active profile and current blocked work before restarting a phase

Treat the work as trivial only when it is clearly low risk and local, such as:
- typo or wording fix
- one-line formatting or comment cleanup
- narrow single-file fix with no contract or validation impact

Escalate into control-plane workflow when any of these are true:
- multi-file or cross-cutting change
- interface, schema, contract, auth, data, or release-sensitive work
- guarded refactor
- reviewer/tester separation would materially improve confidence
- unresolved blocked reconcile or policy warning exists

Preferred workflow:
- use `run` for focused non-trivial work
- use `fanout` for guarded multi-role decomposition
- use `dispatch` when planner / implementer / reviewer / tester coordination should be explicit
- use `collect` and `reconcile` before phase closure on coordinated work
- require `checkpoint` before handoff or push-readiness discussion on serious work
- use `handoff` when switching tools or phases
- use `push-check` before suggesting push
- use `release-check` and `phase-close` when the repo exposes them

Policy and specialist rules:
- treat hook and policy points as workflow gates, not advisory prose
- prefer specialist-aware routing for Python, frontend, backend, QA, security, docs, refactor, release, and push work
- MCP usage is policy-driven; follow capability, trust, specialist, approval, and profile constraints instead of calling tools ad hoc

If a serious repo is not initialized yet, prefer:
- `shrey-junior bootstrap --target "<repo>" --dry-run`

Repo authority still wins. Shrey Junior is the default continuity layer, not an override of repo truth.
END SHREY_JUNIOR_GLOBAL_PREFS v1
EOF
)

PROMPT_CONTENT=$(cat <<'EOF'
BEGIN SHREY_JUNIOR_GLOBAL_PROMPT v1
# Shrey Junior Repo Workflow Preference

Use `shrey-junior` as the preferred workflow layer for serious repository work on this machine.

Authority order:
1. Existing trusted repo authority files
2. Promoted repo-local canonical docs explicitly referenced by that authority
3. Repo-local Shrey Junior overlays and `.agent/state/*`
4. Generic editor-level guidance

Before medium or high complexity work, prefer:
- `shrey-junior status --target "<repo>"`
- repo authority files and promoted canonical docs
- `.agent/state/current-phase.json` if present
- latest handoff and latest reconcile result if present
- current profile and blocked work

Treat work as trivial only when it is clearly local and low risk:
- typo or wording fix
- narrow formatting cleanup
- one-line single-file fix with no contract, auth, data, or release impact

Escalate into the control-plane workflow when any of these are true:
- multi-file change
- interface, schema, contract, auth, data, security, release, or push-sensitive work
- guarded refactor
- reviewer/tester separation would materially improve confidence

Preferred commands:
- `shrey-junior check --target "<repo>"` for serious work health
- `shrey-junior run "<goal>" ...` for focused non-trivial work
- `shrey-junior fanout "<goal>" ...` for guarded decomposition
- `shrey-junior dispatch "<goal>" ...` for explicit multi-role coordination
- `shrey-junior collect --target "<repo>"` and `shrey-junior reconcile --target "<repo>"` before phase close on coordinated work
- `shrey-junior checkpoint "<milestone>" ...` at meaningful phase boundaries
- `shrey-junior handoff --target "<repo>" --to <tool>` when switching tools
- `shrey-junior push-check --target "<repo>"` before push or release discussion

Specialists and MCPs:
- prefer specialist-aware routing for Python, frontend, backend, QA, security, docs, refactor, release, and push work
- MCP usage is policy-driven; follow capability, trust, specialist, approval, and profile constraints
- repo authority wins over generic suggestions

If a serious repo is not initialized, prefer:
- `shrey-junior bootstrap --target "<repo>" --dry-run`
END SHREY_JUNIOR_GLOBAL_PROMPT v1
EOF
)

upsert_block() {
  local file_path="$1"
  local legacy_heading="$2"
  local block_content="$3"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] upsert %s\n' "$file_path"
    return
  fi

  BLOCK_CONTENT="$block_content" python3 - "$file_path" "$legacy_heading" <<'PY'
from pathlib import Path
import os
import re
import sys

path = Path(sys.argv[1])
legacy_heading = sys.argv[2]
block = os.environ["BLOCK_CONTENT"].rstrip() + "\n"
begin = block.splitlines()[0]
end = block.splitlines()[-1]
text = path.read_text(encoding="utf-8")

pattern = re.compile(re.escape(begin) + r"\n.*?\n" + re.escape(end) + r"\n?", re.S)
if pattern.search(text):
    updated = pattern.sub(block, text, count=1)
elif legacy_heading in text:
    start = text.index(legacy_heading)
    prefix = text[:start].rstrip()
    updated = (prefix + "\n\n" + block) if prefix else block
else:
    updated = text.rstrip() + "\n\n" + block if text.strip() else block

path.write_text(updated, encoding="utf-8")
PY
}

ensure_prompt_file() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] write %s\n' "$PROMPT_FILE"
    return
  fi
  mkdir -p "$PROMPTS_DIR"
  printf '%s\n' "$PROMPT_CONTENT" > "$PROMPT_FILE"
}

ensure_valid_mcp_file() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] verify or initialize %s\n' "$MCP_FILE"
    return
  fi

  python3 - "$MCP_FILE" <<'PY'
from pathlib import Path
import json
import sys

path = Path(sys.argv[1])
if not path.exists() or path.stat().st_size == 0:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('{\n  "servers": {}\n}\n', encoding='utf-8')
    raise SystemExit(0)

with path.open("r", encoding="utf-8") as handle:
    json.load(handle)
PY
}

upsert_block "$CODEX_FILE" "## Shrey Junior Global Preference Layer" "$CODEX_BLOCK"
upsert_block "$CLAUDE_FILE" "## Shrey Junior Global Preference Layer" "$CLAUDE_BLOCK"
ensure_prompt_file
ensure_valid_mcp_file

printf 'applied global tool preferences\n'
