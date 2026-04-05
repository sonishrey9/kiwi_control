# Architecture

## System overview

Kiwi Control is a repo-local, artifact-first control plane for coding agents. It is intentionally not a new agent runtime. The repository remains the source of truth through `.agent/` artifacts, canonical config in `configs/`, prompts in `prompts/`, and templates in `templates/`. The product is split into a backend engine, a CLI shell, and a desktop shell.

### Layer diagram

```text
repo files + .agent artifacts
          |
          v
      packages/sj-core
          |
   +------+------+
   |             |
   v             v
packages/sj-cli  runtime/ui-bridge
   |             |
   +------+------+
          |
          v
   apps/sj-ui (Tauri desktop)
```

## Layers

### `packages/sj-core`

`sj-core` owns the platform-neutral control plane:

- context discovery and context trees
- context selection and confidence scoring
- execution planning
- expected outcome validation
- adaptive feedback and eval summaries
- repo state aggregation for CLI and UI
- machine advisory and ecosystem discovery

Important files:

- `src/core/execution-engine.ts`
- `src/core/execution-plan.ts`
- `src/core/context-tree.ts`
- `src/core/context-selector.ts`
- `src/core/context-feedback.ts`
- `src/core/task-pattern-memory.ts`
- `src/core/eval.ts`
- `src/core/ui-state.ts`
- `src/core/task-intent.ts`
- `src/runtime/ui-bridge.ts`

### `packages/sj-cli`

`sj-cli` is the installable command surface over `sj-core`. It should stay thin. Commands load or mutate repo-local state through the core package and report the results in human-readable or JSON form.

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

- `src/cli.ts`
- `src/commands/guide.ts`
- `src/commands/status.ts`
- `src/commands/ui.ts`
- `src/commands/checkpoint.ts`
- `src/commands/handoff.ts`

### `apps/sj-ui`

The desktop app is a Tauri shell around repo-local state. It must never become authoritative. Its job is to:

- load repo control state
- visualize context, plans, validation, tokens, feedback, and machine data
- trigger allowlisted Kiwi CLI flows
- provide a native desktop entrypoint for repo-local control

Important files:

- `src/main.ts`
- `src/styles.css`
- `src-tauri/src/main.rs`
- `src-tauri/tauri.conf.json`

## Key runtime flows

### Repo state hydration

1. Desktop invokes `load_repo_control_state`
2. Tauri calls the runtime bridge in `sj-core`
3. `buildRepoControlState(...)` composes:
   - validation
   - context selection
   - execution plan
   - feedback and eval
   - specialists and MCP packs
   - machine advisory
   - token analytics
4. UI renders a single control-state object

### Command execution

1. User clicks an action in the desktop UI or runs a CLI command directly
2. The CLI or Tauri allowlist triggers the corresponding command
3. The command mutates repo-local artifacts through `sj-core`
4. The UI refreshes repo state and re-renders from fresh repo-local truth

### Context and planning flow

1. Repo tree and context authority are built from safe repo scanning
2. Context selector builds a bounded file set and confidence score
3. Execution engine builds hierarchical plan + expected outcomes
4. Validation compares actual touched files against expected outcomes
5. Feedback and eval logs adjust future selection behavior

## Architecture knowledge summary

A new contributor should understand Kiwi Control in this order:

1. The repo is the authority, not the desktop app
2. `sj-core` is the engine and should hold decision logic
3. `sj-cli` is the operational shell over `sj-core`
4. `sj-ui` is a thin Tauri shell that reads repo state and runs allowlisted actions
5. `.agent/*` artifacts are the long-lived substrate for continuity, memory, plans, and evaluation

The project’s design goal is to keep all important behavior:

- deterministic
- inspectable
- repo-local
- low-dependency
- additive rather than magic

## Current contributor priorities

- continue splitting the desktop renderer into smaller modules
- improve frontend test coverage
- normalize CLI output formatting
- keep machine-global behavior clearly separated from repo-local authority
- preserve the “thin control plane” principle
