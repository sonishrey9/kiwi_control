# Generated Artifacts Policy

Kiwi Control is repo-first, but not every repo-local artifact should be hand-edited or committed.

This document explains which generated outputs are part of the portable repo contract and which should be restored or ignored after local verification.

## Source of truth versus generated state

Kiwi Control keeps canonical human-maintained inputs in:

- `configs/`
- `prompts/`
- `templates/`
- public docs such as `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `docs/*.md`

Generated outputs exist to help the desktop app, CLI, or cooperative tools, but they do not all belong in version control.

## Keep tracked

These are intended to stay in Git:

- repo contract docs and templates
- managed contract surfaces such as:
  - `.agent/project.yaml`
  - `.agent/checks.yaml`
  - `.agent/context/*.md`
  - `.agent/roles/*.md`
  - `.agent/templates/*.md`
  - `.agent/scripts/verify-contract.sh`
  - `.agent/state/*/README.md`
- canonical source files under `apps/`, `packages/`, `crates/`, `scripts/`, `docs/`, `website/`, `configs/`, `prompts/`, and `templates/`

## Generated: restore or ignore after proofs

These are generated runtime, proof, or preview artifacts and should not be treated as hand-edited source:

- `.agent/context-authority.json`
- `.agent/context/*.json`
- `.agent/context/generated-instructions.md`
- `.agent/eval/**`
- `.agent/memory/*.json`
- `.agent/state/**/*.json`
- `.agent/state/**/*.ndjson`
- `.agent/tasks/**`
- `.playwright-cli/**`
- `output/playwright/**`
- `dist/release/**`
- AppleDouble sidecars such as `._*`

## Verification workflow

When running local proofs, desktop checks, or release packaging:

1. generate whatever local runtime or evidence files are needed
2. inspect the results
3. restore or ignore generated artifacts before committing

Typical cleanup commands:

```bash
git restore .agent
git restore .playwright-cli
git restore output/playwright
git restore dist/release
```

If the repo intentionally tracks a generated contract seed or README, keep it. If it is volatile runtime or proof output, restore it before commit.

## Open-source expectation

An external contributor should be able to clone the repo and understand:

- which files are source
- which files are generated
- which files are safe to delete and regenerate

If a future change adds new proof or preview output directories, update this document and `.gitignore` in the same patch.
