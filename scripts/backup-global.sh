#!/usr/bin/env bash
set -euo pipefail

GLOBAL_HOME="${SHREY_JUNIOR_HOME:-$HOME/.shrey-junior}"
PATH_BIN="${SHREY_JUNIOR_PATH_BIN:-$HOME/.local/bin}"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
BACKUP_DIR="$GLOBAL_HOME/backups/manual-$TIMESTAMP"
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

backup_if_exists() {
  local file_path="$1"
  if [[ ! -e "$file_path" ]]; then
    return
  fi

  local backup_path="$BACKUP_DIR${file_path#$HOME}"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] backup %s -> %s\n' "$file_path" "$backup_path"
    return
  fi

  mkdir -p "$(dirname "$backup_path")"
  cp -R "$file_path" "$backup_path"
}

if [[ "$DRY_RUN" -eq 0 ]]; then
  mkdir -p "$BACKUP_DIR"
fi

for existing in \
  "$GLOBAL_HOME/bin/shrey-junior" \
  "$GLOBAL_HOME/defaults/bootstrap.yaml" \
  "$GLOBAL_HOME/specialists/specialists.yaml" \
  "$GLOBAL_HOME/policies/policies.yaml" \
  "$GLOBAL_HOME/mcp/mcp.servers.json" \
  "$GLOBAL_HOME/adapters/tool-awareness.md" \
  "$GLOBAL_HOME/adapters/global-adapter-strategy.md" \
  "$PATH_BIN/shrey-junior" \
  "$HOME/.codex/AGENTS.md" \
  "$HOME/.codex/config.toml" \
  "$HOME/.claude/CLAUDE.md" \
  "$HOME/.claude/settings.json" \
  "$HOME/.claude/commands/shrey-read-first.md" \
  "$HOME/.claude/commands/shrey-serious-task.md" \
  "$HOME/Library/Application Support/Code/User/mcp.json" \
  "$HOME/Library/Application Support/Code/User/prompts"; do
  backup_if_exists "$existing"
done

printf 'backup dir: %s\n' "$BACKUP_DIR"
