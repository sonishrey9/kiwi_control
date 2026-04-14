# Kiwi Control Package Architecture

## Goal

Make Kiwi Control a real local product without giving up the repo-first model.

## User-facing product identity

- product name: `Kiwi Control`
- primary CLI command: `kiwi-control`
- short alias: `kc`
- compatibility aliases: `shrey-junior`, `sj`
- desktop app title: `Kiwi Control`
- installed-user docs should lead with `kiwi-control` and `kc`, not `npm run ...`

This is a visible rebrand only for `0.2.0-beta.9`. Repo-local schema and artifact IDs remain `shrey-junior/*` for compatibility.

## Compatibility note

- internal packages remain `sj-core`, `sj-cli`, `sj-ui`
- repo-local schema and artifact IDs remain `shrey-junior/*`
- `sj` and `shrey-junior` still work temporarily
- `kiwi-control` and `kc` are the primary public commands

## Internal package boundaries

### `packages/sj-core`

Owns:

- artifact schemas
- canonical specialist registry
- curated MCP pack registry
- routing and recommendations
- checkpoints and handoffs
- repo memory bank handling
- validation
- repo contract generation
- product metadata used by CLI, UI, and release outputs
- runtime assets copied from canonical repo sources

`sj-core` is the platform-neutral business-logic layer.

### `packages/sj-cli`

Owns:

- installable command surface
- human-readable output
- JSON output for automation and the desktop bridge
- thin wrappers over `sj-core`

The CLI is intentionally thin. It must not become a second authority layer.

### `apps/sj-ui`

Owns:

- local desktop control surface
- Repo Overview
- Continuity
- Memory Bank
- Specialists
- MCP Packs
- Validation
- local Tauri packaging configuration

The UI reads repo-local truth through the local CLI bridge. It does not own hidden authoritative state.

## Repo-local continuity contract

Portable continuity remains inside the target repo:

- `.agent/state/`
- `.agent/memory/`
- native repo instruction surfaces such as `AGENTS.md`
- generated selective role and workflow files

The package split does not move authority out of the repo.

## Memory bank model

Baseline repo-local memory surfaces:

- `.agent/memory/repo-facts.json`
- `.agent/memory/current-focus.json`
- `.agent/memory/open-risks.json`
- `.agent/memory/architecture-decisions.md`
- `.agent/memory/domain-glossary.md`
- `.agent/memory/known-gotchas.md`
- `.agent/memory/last-successful-patterns.md`

Repo-local memory is authoritative. MCP memory and machine-global memory remain accelerators only.

## Specialist model

Kiwi Control uses one canonical specialist registry end to end.

That registry feeds:

- routing
- active-role hints
- current phase
- next recommended specialist
- handoff `fromRole` / `toRole`
- selective role generation
- UI labels
- CLI output
- docs

Legacy naming can remain as compatibility aliases inside the registry, but user-facing surfaces should show the canonical specialist IDs and names.

## MCP pack model

Curated packs are advisory and runtime-dependent:

- `core-pack`
- `research-pack`
- `web-qa-pack`
- `aws-pack`
- `ios-pack`
- `android-pack`

The architecture intentionally does not claim universal MCP parity across runtimes.

## Runtime design constraints

- repo-first beats machine-global convenience
- CI is the enforcement layer
- desktop UX is optional; the CLI remains complete on its own
- no hidden cloud backend is required for core operation
- no destructive automation
- generic repos stay quiet until explicitly initialized
