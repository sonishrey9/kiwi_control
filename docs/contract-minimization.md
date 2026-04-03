# Contract Minimization

## Purpose

The repo-first contract is now selective rather than maximal. Kiwi Control no longer installs every Copilot instruction, every specialist role spec, and every agent surface into every repo by default.

## Classification Model

Generated surfaces now fall into five buckets:

- **Universal core**
  - `AGENTS.md`
  - `CLAUDE.md`
  - `.github/copilot-instructions.md`
  - `.agent/project.yaml`
  - `.agent/checks.yaml`
  - `.agent/context/*`
  - `.agent/templates/role-result.md`
  - `.agent/state/current-phase.json`
  - `.agent/state/active-role-hints.json`
  - `.agent/state/*/README.md`
  - `.agent/scripts/verify-contract.sh`
  - `.github/agents/shrey-junior.md`
  - `.github/workflows/shrey-junior-contract.yml`

- **Project-type-specific**
  - `.github/instructions/backend.instructions.md`
  - `.github/instructions/frontend.instructions.md`
  - `.github/instructions/docs.instructions.md`
  - `.github/instructions/data.instructions.md`

- **Specialist-specific**
  - `.agent/roles/<specialist>.md`
  - `.github/agents/<specialist>.md`

- **Optional runtime state**
  - `.agent/tasks/*`
  - `.agent/state/handoff/latest.json`
  - `.agent/state/dispatch/latest-manifest.json`
  - `.agent/state/dispatch/latest-collect.json`
  - `.agent/state/reconcile/latest.json`
  - `.agent/state/latest-task-packets.json`

- **Dead weight**
  - instruction or specialist surfaces that are irrelevant to the detected repo shape and starter specialist set

## Current Minimization Rules

### Instruction surfaces

- `python` repos get backend-oriented instruction surfaces
- `node` repos get backend and frontend instruction surfaces
- `docs` repos get docs instruction surfaces
- `data-platform` repos get data instruction surfaces
- `generic` repos only get domain-specific instruction surfaces when starter specialists clearly imply them

### Specialist surfaces

Repo-local specialist contracts now include:

- starter specialists chosen during bootstrap
- planner / reviewer / tester default specialists needed for operational continuity
- no full specialist matrix by default

## Self-Description

`.agent/project.yaml` now records:

- generated core surfaces
- generated instruction surfaces
- generated agent surfaces
- generated role specs
- generated state artifacts
- generated CI surfaces
- skipped surfaces that were intentionally left out as irrelevant

This makes the contract portable without depending on the local machine to recompute the same decision.

## Proven

- contract generation is selective by repo shape
- docs-only repos no longer seed backend instruction authority
- generic and existing repos no longer receive unrelated instruction surfaces by default
- standardize summaries now call out skipped irrelevant surfaces

## Still Limited

- later runtime work can still need additional specialist surfaces beyond the initial seed set
- cloud-hosted runtimes may ignore the generated tool-specific repo surfaces even when present
