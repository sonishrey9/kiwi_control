#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <backup-dir>" >&2
  exit 1
fi

BACKUP_DIR="$1"
HOME_ROOT="$HOME"

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "backup dir not found: $BACKUP_DIR" >&2
  exit 1
fi

restore_file() {
  local relative_path="$1"
  local source_path="$BACKUP_DIR/$relative_path"
  local target_path="$HOME_ROOT/$relative_path"
  if [[ ! -e "$source_path" ]]; then
    return
  fi
  mkdir -p "$(dirname "$target_path")"
  rm -rf "$target_path"
  cp -R "$source_path" "$target_path"
}

restore_file ".codex/AGENTS.md"
restore_file ".codex/config.toml"
restore_file ".claude/CLAUDE.md"
restore_file ".claude/settings.json"
restore_file ".claude/commands/shrey-read-first.md"
restore_file ".claude/commands/shrey-serious-task.md"
restore_file ".shrey-junior/defaults/bootstrap.yaml"
restore_file ".shrey-junior/specialists/specialists.yaml"
restore_file ".shrey-junior/policies/policies.yaml"
restore_file ".shrey-junior/mcp/mcp.servers.json"
restore_file ".shrey-junior/adapters/tool-awareness.md"
restore_file ".shrey-junior/adapters/global-adapter-strategy.md"
restore_file ".shrey-junior/bin/shrey-junior"
restore_file ".shrey-junior/bin/sj-init"
restore_file ".local/bin/shrey-junior"
restore_file ".local/bin/sj-init"
restore_file "Library/Application Support/Code/User/mcp.json"
restore_file "Library/Application Support/Code/User/prompts"

printf 'restored global tool surfaces from %s\n' "$BACKUP_DIR"
