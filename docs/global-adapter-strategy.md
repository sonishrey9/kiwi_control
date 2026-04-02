# Global Adapter Strategy

The long-term goal is global discoverability without global mutation-by-default.

## Current phase

This phase adds:

- a documented machine-level home at `~/.shrey-junior/`
- a `bootstrap` command for initializing any folder or repo
- an explicit `scripts/install-global.sh` path that can create a stable launcher in `~/.local/bin` and starter defaults

This phase does not add:

- edits to `~/.codex`
- edits to `~/.claude`
- edits to VS Code user settings
- PATH mutation or shell rc edits
- background daemons
- automatic tool wiring

## Intended home layout

```text
~/.shrey-junior/
  configs/
  prompts/
  specialists/
  policies/
  mcp/
  defaults/
  adapters/
  bin/
```

## Design rule

Global discoverability should improve first-run ergonomics.
Repo-local operation should still own the actual working state.

That keeps the control plane portable, reviewable, and reversible.
