# Package Architecture

## Goal

Turn Shrey Junior into an installable local software product without giving up the repo-first model.

## Packages

### `packages/sj-core`

Owns:

- artifact schemas
- specialist registry
- MCP pack registry
- routing
- handoff logic
- checkpoints
- repo memory bank
- validation
- repo contract generation
- product runtime assets copied from `configs/`, `prompts/`, `templates/`, `docs/`, `examples/`, and `scripts/`

`sj-core` is the business-logic layer used by both the CLI and the desktop shell.

### `packages/sj-cli`

Owns:

- installable command surface
- thin command wrappers over `sj-core`
- human-readable output
- JSON output for automation and the desktop bridge

The CLI is intentionally thin. It does not become a second authority layer.

### `apps/sj-ui`

Owns:

- local desktop control surface
- repo overview
- continuity views
- memory bank visibility
- specialist and MCP-pack guidance views
- Tauri packaging scaffold

The UI must read repo-local truth and avoid creating hidden authoritative state.

## Contract continuity

Repo-local continuity remains the same:

- `.agent/state/`
- `.agent/memory/`
- native repo instruction surfaces
- generated role and workflow files

The package split does not move authority out of the repo.

## Runtime assets

The source repo keeps canonical truth in:

- `configs/`
- `prompts/`
- `templates/`

During `sj-core` build, those sources are copied into the package runtime payload so the installed CLI can behave like a real product without depending on the source checkout.

## Design constraints

- repo-first always beats machine-global convenience
- CI is the enforcement layer
- MCP guidance must stay honest about runtime differences
- desktop UX must remain optional; CLI remains complete on its own
