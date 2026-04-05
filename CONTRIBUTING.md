# Contributing to Kiwi Control

## What Kiwi Control is

Kiwi Control is a repo-local agentic control plane. It is intentionally designed to be:

- deterministic
- artifact-first
- additive
- portable across repos
- thin at the desktop layer

Do not turn it into a hidden runtime or a destructive automation system.

## Local development

### Requirements

- Node.js 22+
- npm 10+
- Rust toolchain for Tauri desktop work
- Platform prerequisites for Tauri on macOS, Windows, or Linux

### Install dependencies

```bash
npm install
```

### Core verification loop

```bash
npm run build
npm test
bash scripts/smoke-test.sh
```

### Desktop development

```bash
npm run ui:dev
```

### Desktop production build

```bash
npm run ui:desktop:build
```

## Repository layout

- `packages/sj-core` — planning, context, eval, repo-state aggregation
- `packages/sj-cli` — installable command surface over `sj-core`
- `apps/sj-ui` — Tauri desktop shell
- `configs/`, `prompts/`, `templates/` — canonical product authority
- `.agent/` — repo-local generated continuity, context, memory, and eval artifacts

Read these first:

- [README.md](./README.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)

## Coding standards

- keep diffs minimal and targeted
- preserve repo-local authority boundaries
- prefer additive helpers over broad rewrites
- avoid speculative cleanup
- do not make `sj-ui` authoritative
- keep `sj-cli` thin where possible
- keep `sj-core` deterministic and inspectable

## High-value contribution areas

### UI modularization

The desktop app has historically concentrated too much renderer logic in `apps/sj-ui/src/main.ts`.

Good work here:

- extract more renderer/state helpers into focused modules
- tighten event handling boundaries
- improve keyboard and focus behavior

### Frontend testing

The backend and CLI are much better tested than the desktop app.

Good work here:

- renderer interaction tests
- Tauri invoke contract tests
- desktop smoke verification

### CLI output normalization

Some commands are polished, others still read like internal logs.

Good work here:

- shared output helpers
- consistent sections, tables, statuses, and machine-readable JSON

### Build hygiene

Good work here:

- prevent `._*` metadata leakage
- keep generated artifacts isolated
- improve local/CI parity for Tauri builds

## Pull requests

Please include:

- problem statement
- user-facing impact
- repo-local contract impact, if any
- build/test/smoke results
- platforms exercised for desktop changes
- known follow-up work or limitations

## Security and trust

Be extra careful when changing:

- Tauri command handlers
- CLI execution bridges
- file-opening flows
- repo path validation
- anything that touches `.agent/` authority artifacts

Never weaken:

- path boundary checks
- repo-local authority rules
- read-only machine advisory guarantees
- explicit command allowlists
