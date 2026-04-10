# Specialist, Pack, and MCP Audit

This is a file-by-file audit of what Kiwi Control currently treats as runtime-backed behavior versus descriptive metadata.

## Specialists

### `configs/specialists.yaml`
- Classification: `metadata-only`
- What it is: canonical specialist definitions, routing bias, risk posture, and compatibility aliases
- What it changes: nothing by itself; it becomes active only when loaded by config/runtime code

### `packages/sj-core/src/core/specialists.ts`
- Classification: `runtime-backed`
- What it is: executable specialist selection and MCP capability filtering logic
- What it changes:
  - specialist selection for routing
  - recommended specialist resolution
  - compatible MCP capability filtering by specialist

### `packages/sj-core/src/core/ui-state.ts`
- Classification: `runtime-backed`
- What it is: projection of active/recommended specialists into CLI and desktop state
- What it changes:
  - `status --json`
  - `guide --json`
  - `ui --json`
  - desktop shell specialist surfaces

### `docs/specialists.md`
- Classification: `documentation-only`
- What it is: public explanation of canonical specialist IDs
- What it changes: no runtime behavior

## Packs

### `packages/sj-core/src/core/recommendations.ts`
- Classification: `metadata-only`
- What it is: pack names, descriptions, guidance, and recommendation hints
- What it changes:
  - heuristic pack recommendation
  - human-facing pack copy
- Not sufficient alone for execution

### `packages/sj-core/src/core/mcp-pack-selection.ts`
- Classification: `runtime-backed`
- What it is: pack policy layer
- What it changes:
  - allowed capability ids
  - preferred capability ids
  - blocked/unavailable reasoning
  - selected-pack artifact annotation
- Current executable packs:
  - `core-pack`
  - `research-pack`
  - `web-qa-pack`
- Current blocked packs:
  - `aws-pack`
  - `ios-pack`
  - `android-pack`

### `crates/kiwi-runtime/src/db.rs`
- Classification: `runtime-backed`
- What it is: canonical runtime persistence for explicit selected-pack state and revision updates
- What it changes:
  - runtime revision on semantic pack set/clear
  - repo-pack selection status loaded by CLI and desktop

### `packages/sj-cli/src/commands/pack.ts`
- Classification: `executable`
- What it is: public pack command surface
- What it changes:
  - `pack status`
  - `pack set`
  - `pack clear`
  - no-op short-circuit for repeated identical actions

### `apps/sj-ui/src/main.ts`
- Classification: `runtime-backed`
- What it is: desktop pack interaction layer
- What it changes:
  - pack set/clear from desktop
  - render-probe pack proof
  - selected/default/blocked pack presentation

## MCP integrations

### `configs/mcp.servers.json`
- Classification: `metadata-only`
- What it is: sanitized registry of known MCP/tool integrations
- What it changes:
  - available capability catalog after config load
  - compatible specialist lists
- It does not prove machine availability by itself

### `packages/sj-core/src/core/specialists.ts`
- Classification: `runtime-backed`
- What it is: capability selection from the registry
- What it changes:
  - available MCP capabilities for the active profile
  - eligible MCP capabilities for a selected specialist

### `packages/sj-core/src/integrations/machine-advisory.ts`
- Classification: `runtime-backed`
- What it is: machine-local detection and advisory reporting
- What it changes:
  - detected tool/integration inventory
  - machine guidance surfaces

### `packages/sj-core/src/integrations/machine-parity.ts`
- Classification: `runtime-backed`
- What it is: parity summary across covered, partial, missing, and optional machine-global capabilities
- What it changes:
  - machine parity outputs used by CLI and desktop

### `docs/mcp-inventory.md`
- Classification: `documentation-only`
- What it is: compatibility placeholder
- What it changes: no runtime behavior

### `docs/skill-inventory.md`
- Classification: `documentation-only`
- What it is: compatibility placeholder
- What it changes: no runtime behavior

## Classification summary

### Executable
- `packages/sj-cli/src/commands/pack.ts`

### Runtime-backed
- `packages/sj-core/src/core/specialists.ts`
- `packages/sj-core/src/core/mcp-pack-selection.ts`
- `packages/sj-core/src/core/ui-state.ts`
- `packages/sj-core/src/integrations/machine-advisory.ts`
- `packages/sj-core/src/integrations/machine-parity.ts`
- `crates/kiwi-runtime/src/db.rs`
- `apps/sj-ui/src/main.ts`

### UI-only
- current desktop grouping/presentation behavior in `apps/sj-ui/src/main.ts` and `apps/sj-ui/src/ui/*`

### Metadata-only
- `configs/specialists.yaml`
- `configs/mcp.servers.json`
- `packages/sj-core/src/core/recommendations.ts`

### Blocked
- `aws-pack`
- `ios-pack`
- `android-pack`

### Planned but not implemented
- real AWS-specific runtime inventory support for `aws-pack`
- real Xcode/simulator runtime inventory support for `ios-pack`
- real Android-specific runtime inventory support for `android-pack`

## Cleanup notes

- Pack descriptions in `recommendations.ts` are advisory until combined with `mcp-pack-selection.ts` and runtime state.
- `configs/mcp.servers.json` lists capability registry metadata, but machine availability must still come from machine advisory or actual runtime wiring.
- Specialists are routing constructs, not MCPs, and should remain absent from MCP/tool inventories.
