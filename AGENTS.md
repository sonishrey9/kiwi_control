# Shrey Junior Repo Instructions

This repository builds and maintains a thin repo-local control plane.

## Mission

Keep `shrey-junior` small, additive, and portable.

Do not turn it into a new agent runtime.

## Non-negotiables

- Canonical truth lives only in `configs/`, `prompts/`, and `templates/`.
- Generated repo artifacts are outputs, not authority.
- Never modify user-global Codex, Claude, or Copilot settings from this repo.
- Never read or print secret values.
- Prefer additive managed blocks over rewriting existing repo instructions.
- Keep dependencies minimal and boring.

## Verification

Run:

- `npm run build`
- `npm test`
- `bash scripts/smoke-test.sh`

## Output expectations

Changes should preserve:

- safe metadata-only discovery
- managed marker ownership
- repo-local overlays only
- clear rollback by deleting generated managed files or blocks

