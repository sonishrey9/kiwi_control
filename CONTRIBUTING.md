# Contributing to Kiwi Control

## Development principles

Kiwi Control is a repo-local control plane. Keep these rules intact:

- repo-local artifacts are authoritative
- `sj-core` owns decision logic
- `sj-cli` stays thin where possible
- `sj-ui` stays a shell, not a second source of truth
- additive changes beat rewrites
- generic repos stay quiet unless explicitly initialized

## Environment setup

Requirements:

- Node.js 22+
- npm 10+
- Rust toolchain for Tauri desktop work
- platform prerequisites for Tauri on macOS, Windows, or Linux

Install dependencies:

```bash
npm install
```

## Verification

Use this as the default local loop:

```bash
npm run build
npm test
bash scripts/smoke-test.sh
```

Desktop dev:

```bash
npm run ui:dev
```

Desktop production build:

```bash
npm run ui:desktop:build
```

## Repository map

- `packages/sj-core` — planning, selection, validation, eval, repo-state aggregation
- `packages/sj-cli` — command surface over `sj-core`
- `apps/sj-ui` — Tauri desktop shell
- `configs/`, `prompts/`, `templates/` — canonical product authority
- `.agent/` — generated repo-local state and continuity artifacts

Start with:

- [README.md](./README.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)

## Coding standards

- keep diffs minimal and targeted
- avoid speculative cleanup
- preserve repo-local authority boundaries
- do not add heavy dependencies casually
- keep command surfaces explicit
- keep desktop-native operations allowlisted and path-safe

## High-value contribution areas

### 1. UI modularization

The desktop renderer still has too much logic concentrated in `apps/sj-ui/src/main.ts`.

Helpful work:

- split more view/state logic into focused modules
- improve event handling boundaries
- improve keyboard and focus behavior

### 2. Frontend tests

The backend and CLI are much better tested than the desktop app.

Helpful work:

- renderer interaction tests
- Tauri invoke contract tests
- desktop smoke verification

### 3. CLI output normalization

Some commands are polished, others still feel like internal logs.

Helpful work:

- shared CLI output helpers
- consistent sections, tables, statuses, and JSON behavior

### 4. Build hygiene

Helpful work:

- stop `._*` macOS metadata junk from polluting working trees
- keep generated artifacts isolated
- improve local and CI parity for Tauri builds

## Pull requests

Please include:

- problem statement
- user-facing impact
- repo-local contract impact, if any
- build/test/smoke results
- platform(s) exercised for desktop changes
- remaining limitations or follow-up work

## Security and trust

Be extra careful when touching:

- Tauri command handlers
- CLI execution bridges
- file opening behavior
- repo path validation
- `.agent/` authority artifacts

Never weaken:

- path boundary checks
- explicit command allowlists
- repo-local authority rules
- read-only machine advisory guarantees
