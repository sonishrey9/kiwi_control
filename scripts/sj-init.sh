#!/usr/bin/env bash
set -euo pipefail

print_help() {
  cat <<'EOF'
sj-init

Make the target folder Kiwi Control-ready using the existing repo-first control plane.

Usage:
  sj-init [--dry-run] [--force] [--type <type>] [--target <path>] [--no-check] [--verbose]
  sj-init --help

Modes:
  empty or effectively empty folder -> bootstrap
  existing project or git repo      -> standardize

Options:
  --dry-run      Preview the selected mode without writing files
  --force        Continue past a conflicting dry-run preflight and attempt the real apply
  --type <type>  Override detected project type (python|node|docs|data-platform|generic)
  --target <p>   Target folder (default: current working directory)
  --no-check     Skip post-apply status and check
  --verbose      Print underlying command output instead of only the final summary
  --help         Show this help
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SJ_BIN="${KIWI_CONTROL_BIN:-${SHREY_JUNIOR_BIN:-kiwi-control}}"
TARGET_INPUT="."
PROJECT_TYPE=""
DRY_RUN=0
FORCE=0
NO_CHECK=0
VERBOSE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --type)
      [[ $# -ge 2 ]] || { echo "sj-init error: --type requires a value" >&2; exit 2; }
      PROJECT_TYPE="$2"
      shift 2
      ;;
    --target)
      [[ $# -ge 2 ]] || { echo "sj-init error: --target requires a value" >&2; exit 2; }
      TARGET_INPUT="$2"
      shift 2
      ;;
    --no-check)
      NO_CHECK=1
      shift
      ;;
    --verbose)
      VERBOSE=1
      shift
      ;;
    --help)
      print_help
      exit 0
      ;;
    *)
      echo "sj-init error: unknown argument: $1" >&2
      print_help >&2
      exit 2
      ;;
  esac
done

if ! command -v python3 >/dev/null 2>&1; then
  echo "sj-init error: python3 is required" >&2
  exit 1
fi

if ! command -v "$SJ_BIN" >/dev/null 2>&1; then
  echo "sj-init error: Kiwi Control CLI is not available on PATH (tried '$SJ_BIN'). Set KIWI_CONTROL_BIN or SHREY_JUNIOR_BIN if you need a custom launcher." >&2
  exit 1
fi

TARGET_ABS="$(python3 - "$TARGET_INPUT" <<'PY'
from pathlib import Path
import sys
print(str(Path(sys.argv[1]).expanduser().resolve(strict=False)))
PY
)"

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/sj-init.XXXXXX")"
trap 'rm -rf "$TEMP_DIR"' EXIT

PREVIEW_BOOTSTRAP_JSON="$TEMP_DIR/bootstrap-probe.json"
MODE_PLAN_JSON="$TEMP_DIR/mode-plan.json"
STATUS_LOG="$TEMP_DIR/status.log"
CHECK_LOG="$TEMP_DIR/check.log"
APPLY_LOG="$TEMP_DIR/apply.log"

run_capture() {
  local __outvar="$1"
  shift
  local output rc
  if output="$("$@" 2>&1)"; then
    rc=0
  else
    rc=$?
  fi
  printf -v "$__outvar" '%s' "$output"
  return "$rc"
}

parse_plan_field() {
  local plan_file="$1"
  local field_path="$2"
  python3 - "$plan_file" "$field_path" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], "r", encoding="utf-8") as handle:
        data = json.load(handle)
except Exception:
    print("")
    raise SystemExit(0)

value = data
for part in sys.argv[2].split("."):
    if not part:
        continue
    if isinstance(value, dict):
        value = value.get(part)
    else:
        value = None
        break

if value is None:
    print("")
elif isinstance(value, bool):
    print("true" if value else "false")
else:
    print(value)
PY
}

render_summary() {
  local plan_file="$1"
  local mode_used="$2"
  local status_result="$3"
  local check_result="$4"
  local dry_run_value="$5"
  python3 - "$plan_file" "$TARGET_ABS" "$mode_used" "$status_result" "$check_result" "$dry_run_value" <<'PY'
import json
from pathlib import Path
import sys

plan_path = Path(sys.argv[1])
target_root = Path(sys.argv[2])
mode_used = sys.argv[3]
status_result = sys.argv[4]
check_result = sys.argv[5]
dry_run = sys.argv[6] == "1"

plan = json.loads(plan_path.read_text(encoding="utf-8"))

active_path = target_root / ".agent" / "state" / "active-role-hints.json"
phase_path = target_root / ".agent" / "state" / "current-phase.json"
active = json.loads(active_path.read_text(encoding="utf-8")) if active_path.exists() else {}
phase = json.loads(phase_path.read_text(encoding="utf-8")) if phase_path.exists() else {}

def compact(items, limit=8):
    items = [item for item in items if item]
    if not items:
        return "none"
    if len(items) <= limit:
        return ", ".join(items)
    return f"{', '.join(items[:limit])} (+{len(items) - limit} more)"

read_next = active.get("readNext") or []
write_targets = active.get("writeTargets") or []
next_file = active.get("nextFileToRead") or plan.get("nextFileToRead")
if not next_file:
    for candidate in read_next:
        if candidate in {".agent/state/active-role-hints.json", ".agent/state/current-phase.json"}:
            continue
        if "*" in candidate:
            continue
        next_file = candidate
        break
if not next_file:
    for candidate in write_targets:
        if "*" in candidate:
            continue
        next_file = candidate
        break
if not next_file:
    next_file = ".agent/state/active-role-hints.json"

next_command = active.get("nextSuggestedCommand") or plan.get("nextSuggestedCommand") or plan.get("recommendedNextCommand") or "none"
next_action = active.get("nextAction") or phase.get("nextRecommendedStep")
if not next_action:
    if next_file == ".agent/context/architecture.md":
        next_action = "Fill in .agent/context/architecture.md, then record a checkpoint."
    elif next_command and next_command != "none":
        next_action = "Use the suggested next command after opening the next file."
    else:
        next_action = "Open the next file and continue from the repo-local contract."

print("sj-init summary")
print(f"- mode: {mode_used} | dry-run={'yes' if dry_run else 'no'}")
print(f"- target: {target_root}")
print(f"- authority: {plan.get('profileSource', 'unknown')}")
print(f"- project type: {plan.get('inspection', {}).get('projectType', 'unknown')}")
print(f"- active role: {active.get('activeRole') or plan.get('activeRole', 'unknown')}")
print(f"- core installed: {compact(plan.get('coreContractSurfaces', []))}")
print(f"- optional installed: {compact(plan.get('optionalContractSurfaces', []))}")
print(f"- irrelevant skipped: {compact(plan.get('skippedContractSurfaces', []))}")
print(f"- next file: {next_file}")
print(f"- next command: {next_command}")
print(f"- next action: {next_action}")
print(f"- status/check: {status_result} / {check_result}")
PY
}

MODE_ARGS=(--target "$TARGET_ABS" --dry-run --json)
if [[ -n "$PROJECT_TYPE" ]]; then
  MODE_ARGS+=(--project-type "$PROJECT_TYPE")
fi

BOOTSTRAP_OUTPUT=""
BOOTSTRAP_RC=0
if ! run_capture BOOTSTRAP_OUTPUT "$SJ_BIN" bootstrap "${MODE_ARGS[@]}"; then
  BOOTSTRAP_RC=$?
fi
printf '%s\n' "$BOOTSTRAP_OUTPUT" > "$PREVIEW_BOOTSTRAP_JSON"

TARGET_KIND="$(parse_plan_field "$PREVIEW_BOOTSTRAP_JSON" "inspection.targetKind")"
if [[ -z "$TARGET_KIND" ]]; then
  echo "sj-init error: unable to determine target kind" >&2
  printf '%s\n' "$BOOTSTRAP_OUTPUT" >&2
  exit "${BOOTSTRAP_RC:-1}"
fi

MODE="standardize"
if [[ "$TARGET_KIND" == "empty-folder" ]]; then
  MODE="bootstrap"
fi

MODE_OUTPUT=""
MODE_RC=0
if ! run_capture MODE_OUTPUT "$SJ_BIN" "$MODE" "${MODE_ARGS[@]}"; then
  MODE_RC=$?
fi
printf '%s\n' "$MODE_OUTPUT" > "$MODE_PLAN_JSON"

AUTHORITY_OPTOUT="$(parse_plan_field "$MODE_PLAN_JSON" "inspection.authorityOptOut")"
if [[ -n "$AUTHORITY_OPTOUT" ]]; then
  render_summary "$MODE_PLAN_JSON" "$MODE" "skipped" "skipped" "$DRY_RUN"
  echo "- stand down reason: $AUTHORITY_OPTOUT"
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  render_summary "$MODE_PLAN_JSON" "$MODE" "skipped (dry-run)" "skipped (dry-run)" "1"
  exit "$MODE_RC"
fi

if [[ "$MODE_RC" -ne 0 && "$FORCE" -ne 1 ]]; then
  echo "sj-init error: preflight reported conflicts or unsafe writes; rerun with --force to attempt the real apply." >&2
  render_summary "$MODE_PLAN_JSON" "$MODE" "skipped" "skipped" "0" >&2
  exit "$MODE_RC"
fi

APPLY_ARGS=(--target "$TARGET_ABS")
if [[ -n "$PROJECT_TYPE" ]]; then
  APPLY_ARGS+=(--project-type "$PROJECT_TYPE")
fi

if [[ "$VERBOSE" -eq 1 ]]; then
  "$SJ_BIN" "$MODE" "${APPLY_ARGS[@]}"
else
  APPLY_OUTPUT=""
  if ! run_capture APPLY_OUTPUT "$SJ_BIN" "$MODE" "${APPLY_ARGS[@]}"; then
    printf '%s\n' "$APPLY_OUTPUT" >&2
    exit 1
  fi
  printf '%s\n' "$APPLY_OUTPUT" > "$APPLY_LOG"
fi

STATUS_RESULT="skipped (--no-check)"
CHECK_RESULT="skipped (--no-check)"

if [[ "$NO_CHECK" -eq 0 ]]; then
  if [[ "$VERBOSE" -eq 1 ]]; then
    "$SJ_BIN" status --target "$TARGET_ABS"
    "$SJ_BIN" check --target "$TARGET_ABS"
    STATUS_RESULT="ok"
    CHECK_RESULT="ok"
  else
    STATUS_OUTPUT=""
    if ! run_capture STATUS_OUTPUT "$SJ_BIN" status --target "$TARGET_ABS"; then
      printf '%s\n' "$STATUS_OUTPUT" >&2
      exit 1
    fi
    printf '%s\n' "$STATUS_OUTPUT" > "$STATUS_LOG"
    STATUS_RESULT="ok"

    CHECK_OUTPUT=""
    if ! run_capture CHECK_OUTPUT "$SJ_BIN" check --target "$TARGET_ABS"; then
      printf '%s\n' "$CHECK_OUTPUT" >&2
      exit 1
    fi
    printf '%s\n' "$CHECK_OUTPUT" > "$CHECK_LOG"
    CHECK_RESULT="ok"
  fi
fi

render_summary "$MODE_PLAN_JSON" "$MODE" "$STATUS_RESULT" "$CHECK_RESULT" "0"
