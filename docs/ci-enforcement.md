# CI Enforcement

## Purpose

Prompts and local guidance can be ignored. CI is the hard backstop.

## Generated CI Surface

- `.github/workflows/shrey-junior-contract.yml`
- `.agent/scripts/verify-contract.sh`

## What The Workflow Verifies

- the repo-local verification script exists and runs
- required repo-local contract files from `.agent/project.yaml` are present
- command and capability discovery docs are present
- `specialists.md` and the repo-local memory bank are present
- only the selected instruction and specialist surfaces are required
- `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` still contain managed markers
- `.agent/state/current-phase.json` and `.agent/state/active-role-hints.json` parse and declare the expected artifact types
- `active-role-hints.json` carries `readNext`, `checksToRun`, `nextAction`, and `searchGuidance`
- `active-role-hints.json` also carries next-specialist, MCP-pack, and latest-memory-focus pointers
- latest checkpoint JSON and Markdown exist and carry minimal continuity metadata
- `repo-facts.json`, `current-focus.json`, and `open-risks.json` parse and carry the expected schema basics
- latest pointers referenced by `active-role-hints.json` point to existing files
- latest handoff, dispatch, reconcile, and task packet pointer files parse when present
- handoff artifacts must carry compact continuity fields such as from-role, to-role, next file, next command, evidence, and checkpoint pointer
- latest pointer JSON files carry minimal metadata such as `artifactType` plus a timestamp
- generic repos do not drag backend/frontend instruction noise by default when the CLI-backed validator is available
- latest reconcile must not still be blocked or review-required
- a portable repo-local push gate runs from the generated verifier
- `shrey-junior push-check --target <repo>` also runs when the CLI is available in the environment
- repo-specific commands declared in `.agent/checks.yaml` are executed when present

## What It Does Not Verify

- deployment or release workflows beyond the repo-local contract gate
- universal compliance by every tool runtime
- machine-global accelerators

Repo-specific build or test commands are only enforced here when the repo explicitly declares them in `.agent/checks.yaml`.

## Push And Review Backstop

Current local readiness gating uses:

- `push-check`
- latest phase state
- latest reconcile state
- git summary

The CI contract workflow is stronger than the earlier existence-only check. It now behaves like a portable push gate for the repo-local contract, and it opportunistically runs `push-check` where the CLI is available. It still cannot guarantee tool obedience in hosted runtimes.
