#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
resolve_default_global_home() {
  if [[ -n "${KIWI_CONTROL_HOME:-}" ]]; then
    printf '%s\n' "$KIWI_CONTROL_HOME"
    return
  fi

  if [[ -n "${SHREY_JUNIOR_HOME:-}" ]]; then
    printf '%s\n' "$SHREY_JUNIOR_HOME"
    return
  fi

  local kiwi_control_home="$HOME/.kiwi-control"
  local legacy_home="$HOME/.shrey-junior"
  if [[ -d "$kiwi_control_home" || ! -d "$legacy_home" ]]; then
    printf '%s\n' "$kiwi_control_home"
    return
  fi

  printf '%s\n' "$legacy_home"
}

render_node_backed_launcher() {
  local cli_entrypoint="$1"
  cat <<EOF
#!/usr/bin/env bash
set -euo pipefail

resolve_node_binary() {
  if [[ -n "\${KIWI_CONTROL_NODE:-}" && -x "\${KIWI_CONTROL_NODE}" ]]; then
    printf '%s\n' "\$KIWI_CONTROL_NODE"
    return
  fi

  if [[ -n "\${SHREY_JUNIOR_NODE:-}" && -x "\${SHREY_JUNIOR_NODE}" ]]; then
    printf '%s\n' "\$SHREY_JUNIOR_NODE"
    return
  fi

  local candidate=""
  if candidate="\$(command -v node 2>/dev/null)"; then
    printf '%s\n' "\$candidate"
    return
  fi

  for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    if [[ -x "\$candidate" ]]; then
      printf '%s\n' "\$candidate"
      return
    fi
  done

  printf '%s\n' "Kiwi Control requires Node.js 22+ to run." >&2
  exit 1
}

NODE_BIN="\$(resolve_node_binary)"
exec "\$NODE_BIN" "$cli_entrypoint" "\$@"
EOF
}

GLOBAL_HOME="$(resolve_default_global_home)"
PATH_BIN="${KIWI_CONTROL_PATH_BIN:-${SHREY_JUNIOR_PATH_BIN:-$HOME/.local/bin}}"
CLI_ENTRYPOINT="$ROOT/packages/sj-cli/dist/cli.js"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
BACKUP_DIR="$GLOBAL_HOME/backups/install-$TIMESTAMP"
DRY_RUN=0
PROFILE_PATH=""

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

resolve_shell_profile() {
  local shell_name="${KIWI_CONTROL_SHELL:-${SHELL##*/}}"
  case "$shell_name" in
    zsh)
      printf '%s\n' "$HOME/.zshrc"
      ;;
    bash)
      if [[ "${OSTYPE:-}" == darwin* ]]; then
        printf '%s\n' "$HOME/.bash_profile"
      else
        printf '%s\n' "$HOME/.bashrc"
      fi
      ;;
    *)
      printf '%s\n' "$HOME/.profile"
      ;;
  esac
}

upsert_path_profile() {
  local profile_path="$1"
  local begin_marker="# >>> Kiwi Control PATH >>>"
  local end_marker="# <<< Kiwi Control PATH <<<"
  local block_body="export PATH=\"$PATH_BIN:\$PATH\""

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "[dry-run] update shell profile $profile_path"
    return
  fi

  mkdir -p "$(dirname "$profile_path")"
  if [[ ! -f "$profile_path" ]]; then
    : > "$profile_path"
  fi

  python3 - "$profile_path" "$begin_marker" "$end_marker" "$block_body" <<'PY'
from pathlib import Path
import sys

profile_path = Path(sys.argv[1])
begin_marker = sys.argv[2]
end_marker = sys.argv[3]
block_body = sys.argv[4]

block = f"{begin_marker}\n{block_body}\n{end_marker}"
content = profile_path.read_text(encoding="utf-8")

if begin_marker in content and end_marker in content:
    start = content.index(begin_marker)
    end = content.index(end_marker, start) + len(end_marker)
    updated = f"{content[:start].rstrip()}\n{block}\n{content[end:].lstrip()}"
else:
    separator = "\n" if content and not content.endswith("\n") else ""
    updated = f"{content}{separator}{block}\n"

profile_path.write_text(updated, encoding="utf-8")
PY
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
    if [[ "$DRY_RUN" -eq 1 ]]; then
      log "[dry-run] replace existing managed path $link_path with symlink -> $target_path"
      return
    fi
    rm -rf "$link_path"
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

LAUNCHER_CONTENT="$(render_node_backed_launcher "$CLI_ENTRYPOINT")"
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

log "Kiwi Control install root: $GLOBAL_HOME"
log "Installed commands:"
log "- $PATH_BIN/kiwi-control"
log "- $PATH_BIN/kc"
log "Temporary beta compatibility aliases:"
log "- $PATH_BIN/shrey-junior"
log "- $PATH_BIN/sj"
if [[ "$DRY_RUN" -eq 0 ]]; then
  log "backup dir: $BACKUP_DIR"
fi
if is_path_dir_on_path; then
  log "PATH already includes $PATH_BIN"
else
  PROFILE_PATH="$(resolve_shell_profile)"
  upsert_path_profile "$PROFILE_PATH"
  log "PATH updated in $PROFILE_PATH"
  log "Next step: source $PROFILE_PATH"
fi
log "No Codex, Claude, Copilot, or VS Code global settings were modified."

if [[ "$DRY_RUN" -eq 0 && "$(uname -s)" == "Darwin" ]]; then
  if [[ -d "/Applications/Kiwi Control.app" ]]; then
    open -g -a "Kiwi Control" >/dev/null 2>&1 || true
    log "macOS warmup: opened Kiwi Control once for app registration"
  fi
fi
