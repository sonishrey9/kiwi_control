#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GLOBAL_HOME="${KIWI_CONTROL_HOME:-${SHREY_JUNIOR_HOME:-$HOME/.shrey-junior}}"
PATH_BIN="${KIWI_CONTROL_PATH_BIN:-${SHREY_JUNIOR_PATH_BIN:-$HOME/.local/bin}}"
CLI_ENTRYPOINT="$ROOT/packages/sj-cli/dist/cli.js"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
BACKUP_DIR="$GLOBAL_HOME/backups/install-$TIMESTAMP"
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

if [[ "$DRY_RUN" -eq 0 && ! -f "$CLI_ENTRYPOINT" ]]; then
  echo "Kiwi Control global install error: $CLI_ENTRYPOINT is missing. Run 'npm run build' first." >&2
  exit 1
fi

log() {
  printf '%s\n' "$1"
}

make_dir() {
  local dir_path="$1"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "[dry-run] mkdir -p $dir_path"
    return
  fi
  mkdir -p "$dir_path"
}

write_file() {
  local file_path="$1"
  local content="$2"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "[dry-run] write $file_path"
    return
  fi
  mkdir -p "$(dirname "$file_path")"
  printf '%s' "$content" > "$file_path"
}

copy_file() {
  local source_path="$1"
  local target_path="$2"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "[dry-run] copy $source_path -> $target_path"
    return
  fi
  mkdir -p "$(dirname "$target_path")"
  cp "$source_path" "$target_path"
}

is_path_dir_on_path() {
  case ":$PATH:" in
    *":$PATH_BIN:"*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

backup_if_exists() {
  local file_path="$1"
  if [[ ! -e "$file_path" ]]; then
    return
  fi

  local backup_path="$BACKUP_DIR${file_path#$HOME}"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "[dry-run] backup $file_path -> $backup_path"
    return
  fi

  mkdir -p "$(dirname "$backup_path")"
  cp -R "$file_path" "$backup_path"
}

ensure_symlink() {
  local target_path="$1"
  local link_path="$2"

  if [[ -L "$link_path" ]]; then
    local current_target
    current_target="$(readlink "$link_path")"
    if [[ "$current_target" == "$target_path" ]]; then
      return
    fi
  elif [[ -e "$link_path" ]]; then
    echo "refusing to replace existing non-symlink path: $link_path" >&2
    exit 1
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "[dry-run] symlink $link_path -> $target_path"
    return
  fi

  mkdir -p "$(dirname "$link_path")"
  rm -f "$link_path"
  ln -s "$target_path" "$link_path"
}

for dir_name in configs prompts specialists policies mcp defaults adapters bin backups; do
  make_dir "$GLOBAL_HOME/$dir_name"
done
make_dir "$PATH_BIN"
if [[ "$DRY_RUN" -eq 0 ]]; then
  mkdir -p "$BACKUP_DIR"
fi

for existing in \
  "$GLOBAL_HOME/bin/kiwi-control" \
  "$GLOBAL_HOME/bin/kc" \
  "$GLOBAL_HOME/bin/shrey-junior" \
  "$GLOBAL_HOME/bin/sj" \
  "$GLOBAL_HOME/bin/sj-init" \
  "$GLOBAL_HOME/defaults/bootstrap.yaml" \
  "$GLOBAL_HOME/specialists/specialists.yaml" \
  "$GLOBAL_HOME/policies/policies.yaml" \
  "$GLOBAL_HOME/mcp/mcp.servers.json" \
  "$GLOBAL_HOME/adapters/tool-awareness.md" \
  "$GLOBAL_HOME/adapters/global-adapter-strategy.md" \
  "$PATH_BIN/kiwi-control" \
  "$PATH_BIN/kc" \
  "$PATH_BIN/shrey-junior" \
  "$PATH_BIN/sj" \
  "$PATH_BIN/sj-init"; do
  backup_if_exists "$existing"
done

LAUNCHER_CONTENT=$(cat <<EOF
#!/usr/bin/env bash
exec node "$CLI_ENTRYPOINT" "\$@"
EOF
)
write_file "$GLOBAL_HOME/bin/kiwi-control" "$LAUNCHER_CONTENT"
if [[ "$DRY_RUN" -eq 0 ]]; then
  chmod +x "$GLOBAL_HOME/bin/kiwi-control"
fi
ensure_symlink "$GLOBAL_HOME/bin/kiwi-control" "$GLOBAL_HOME/bin/kc"
ensure_symlink "$GLOBAL_HOME/bin/kiwi-control" "$GLOBAL_HOME/bin/shrey-junior"
ensure_symlink "$GLOBAL_HOME/bin/kiwi-control" "$GLOBAL_HOME/bin/sj"

SJ_INIT_CONTENT=$(cat <<EOF
#!/usr/bin/env bash
exec "$ROOT/scripts/sj-init.sh" "\$@"
EOF
)
write_file "$GLOBAL_HOME/bin/sj-init" "$SJ_INIT_CONTENT"
if [[ "$DRY_RUN" -eq 0 ]]; then
  chmod +x "$GLOBAL_HOME/bin/sj-init"
fi

PATH_WRAPPER=$(cat <<EOF
#!/usr/bin/env bash
exec "$GLOBAL_HOME/bin/kiwi-control" "\$@"
EOF
)
write_file "$PATH_BIN/kiwi-control" "$PATH_WRAPPER"
if [[ "$DRY_RUN" -eq 0 ]]; then
  chmod +x "$PATH_BIN/kiwi-control"
fi
ensure_symlink "$PATH_BIN/kiwi-control" "$PATH_BIN/kc"
ensure_symlink "$PATH_BIN/kiwi-control" "$PATH_BIN/shrey-junior"
ensure_symlink "$PATH_BIN/kiwi-control" "$PATH_BIN/sj"
ensure_symlink "$GLOBAL_HOME/bin/sj-init" "$PATH_BIN/sj-init"

copy_file "$ROOT/configs/specialists.yaml" "$GLOBAL_HOME/specialists/specialists.yaml"
copy_file "$ROOT/configs/policies.yaml" "$GLOBAL_HOME/policies/policies.yaml"
copy_file "$ROOT/configs/mcp.servers.json" "$GLOBAL_HOME/mcp/mcp.servers.json"
copy_file "$ROOT/docs/tool-awareness.md" "$GLOBAL_HOME/adapters/tool-awareness.md"
copy_file "$ROOT/docs/global-adapter-strategy.md" "$GLOBAL_HOME/adapters/global-adapter-strategy.md"

BOOTSTRAP_DEFAULTS=$(cat <<'EOF'
version: 1
default_profile: product-build
project_type_profiles:
  python: product-build
  node: product-build
  docs: documentation-heavy
  data-platform: data-platform
  generic: product-build
project_type_specialists:
  python:
    - python-specialist
    - backend-specialist
    - qa-specialist
    - security-specialist
  node:
    - fullstack-specialist
    - frontend-specialist
    - qa-specialist
  docs:
    - docs-specialist
    - qa-specialist
  data-platform:
    - backend-specialist
    - qa-specialist
    - security-specialist
  generic:
    - architecture-specialist
    - review-specialist
    - qa-specialist
    - docs-specialist
EOF
)
write_file "$GLOBAL_HOME/defaults/bootstrap.yaml" "$BOOTSTRAP_DEFAULTS"

log "Kiwi Control global bootstrap home: $GLOBAL_HOME"
log "PATH-visible launcher: $PATH_BIN/kiwi-control"
log "PATH-visible aliases: $PATH_BIN/kc, $PATH_BIN/shrey-junior, $PATH_BIN/sj"
log "PATH-visible sj-init: $PATH_BIN/sj-init"
log "home launcher: $GLOBAL_HOME/bin/kiwi-control"
log "home compatibility aliases: $GLOBAL_HOME/bin/kc, $GLOBAL_HOME/bin/shrey-junior, $GLOBAL_HOME/bin/sj"
log "home sj-init: $GLOBAL_HOME/bin/sj-init"
if [[ "$DRY_RUN" -eq 0 ]]; then
  log "backup dir: $BACKUP_DIR"
fi
if is_path_dir_on_path; then
  log "PATH already includes $PATH_BIN"
else
  log "PATH update required: add this to your shell profile"
  log "export PATH=\"$PATH_BIN:\$PATH\""
fi
log "No Codex, Claude, Copilot, or VS Code global settings were modified."
