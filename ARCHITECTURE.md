# Kiwi Control Architecture

## High-level overview

Kiwi Control is a repo-local, artifact-first control plane for coding agents. The repository remains authoritative through `.agent/` artifacts and canonical product inputs in `configs/`, `prompts/`, and `templates/`. Execution state is now owned by a standalone Rust runtime service backed by repo-local SQLite WAL storage, while the rest of the product remains split into a backend engine, a CLI layer, and a desktop shell.

```text
repo files + .agent artifacts
          |
          v
      packages/sj-core
          |
   +------+------+
   |             |
   v             v
packages/sj-cli  kiwi-control-runtime
   |             |
   +------+------+
          |
          v
   apps/sj-ui (Tauri desktop)
```

## Layers

### `packages/sj-core`

`sj-core` owns the control-plane logic:

- context discovery and context trees
- context selection and confidence
- execution plans and expected outcomes
- validation and retry strategies
- eval, feedback, and task-pattern memory
- repo-state aggregation for CLI and desktop UI
- machine advisory and ecosystem inventory

Important files:

- `packages/sj-core/src/core/execution-engine.ts`
- `packages/sj-core/src/core/execution-plan.ts`
- `packages/sj-core/src/core/context-tree.ts`
- `packages/sj-core/src/core/context-selector.ts`
- `packages/sj-core/src/core/context-feedback.ts`
- `packages/sj-core/src/core/task-pattern-memory.ts`
- `packages/sj-core/src/core/eval.ts`
- `packages/sj-core/src/core/task-intent.ts`
- `packages/sj-core/src/core/ui-state.ts`
- `packages/sj-core/src/runtime/ui-bridge.ts`
- `crates/kiwi-runtime/src/db.rs`
- `crates/kiwi-runtime/src/daemon.rs`

### `packages/sj-cli`

`sj-cli` is the operational shell over `sj-core`. It should remain thin and explicit.

Representative commands:

- `guide`
- `next`
- `retry`
- `resume`
- `status`
- `trace`
- `validate`
- `run --auto`
- `checkpoint`
- `handoff`
- `ui`

Important files:

- `packages/sj-cli/src/cli.ts`
- `packages/sj-cli/src/commands/guide.ts`
- `packages/sj-cli/src/commands/status.ts`
- `packages/sj-cli/src/commands/ui.ts`
- `packages/sj-cli/src/commands/checkpoint.ts`
- `packages/sj-cli/src/commands/handoff.ts`

### `apps/sj-ui`

The desktop app is a Tauri shell around repo-local state. It should never become authoritative, and it now consumes execution revisions from the Rust runtime instead of polling JSON files directly.

Responsibilities:

- load repo control state
- render operator-facing state
- invoke allowlisted Kiwi CLI commands
- provide native desktop affordances like file opening and app lifecycle handling

Important files:

- `apps/sj-ui/src/main.ts`
- `apps/sj-ui/src/styles.css`
- `apps/sj-ui/src-tauri/src/main.rs`
- `apps/sj-ui/src-tauri/tauri.conf.json`

## Runtime flows

### Repo state hydration

1. The desktop app invokes `load_repo_control_state`
2. Tauri opens the standalone Rust runtime and reads the canonical execution snapshot
3. The desktop still uses `buildRepoControlState(...)` for compatibility aggregation, but execution authority comes from the runtime-backed state path
4. `buildRepoControlState(...)` composes:
   - repo validation
   - context selection
   - execution plan
   - feedback and eval
   - specialists and MCP packs
   - machine advisory
   - token analytics
5. The desktop renderer paints a single `RepoControlState`

### Action execution

1. A user triggers a CLI command or clicks a desktop action
2. The CLI or Tauri command bridge runs the corresponding Kiwi command
3. The command mutates repo-local artifacts through `sj-core`
4. The UI refreshes repo state from repo-local truth

### Context + planning flow

1. Context tree and authority are built from bounded repo scanning
2. Context selector builds a file set plus confidence
3. Execution engine derives steps, expected outcomes, and retry strategy
4. Validation compares actual touched files to expected outcomes
5. Feedback and eval affect future context selection

## Architecture knowledge summary

A new contributor should understand Kiwi Control in this order:

1. The repo is authoritative, not the desktop app
2. `sj-core` owns planning, validation, selection, and state aggregation
3. `sj-cli` is the operational shell over `sj-core`
4. `sj-ui` is a thin Tauri shell that reads repo state and invokes allowlisted actions
5. `.agent/*` artifacts are the continuity, memory, and evaluation substrate

The design goals are:

- deterministic behavior
- inspectable state
- repo-local authority
- low dependency footprint
- additive changes instead of hidden automation

## Current contributor priorities

- continue splitting the desktop renderer into focused modules
- improve frontend test coverage
- normalize CLI output behavior
- keep machine-global setup clearly separate from repo-local truth
- preserve the thin-control-plane boundary
