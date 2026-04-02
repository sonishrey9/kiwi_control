# Migration Plan

## V2 adoption path

1. Run `audit` against a target repo.
2. Review the generated report and the detected authority files.
3. Run `init --profile <profile-name>` to create `.agent/*` and add managed routing blocks to native repo surfaces.
4. Review the resulting diffs.
5. Run `check` to validate config, profile resolution, routing, and generated overlays.
6. Use `run` and `fanout` to create aligned task packets for the selected workflow.
7. Re-run `sync --dry-run --diff-summary` before applying updates to established repos.
8. Use `--backup` when updating stricter repos or when large managed changes are expected.

## What v2 still does not migrate

- user-global Codex config
- Claude global settings
- VS Code user or workspace storage state
- secret stores
- MCP env values
- agent session history

## Recommended onboarding sequences

### Start a new repo

1. `init --profile product-build`
2. fill in `.agent/context/*`
3. `check`
4. `run` or `fanout`

### Onboard an existing repo

1. `audit`
2. review existing `AGENTS.md`, `CLAUDE.md`, and Copilot instructions
3. `init --profile strict-production` or the closest fit
4. `sync --dry-run --diff-summary`
5. `sync --backup` once the plan looks correct

## Still out of scope

- path-specific Copilot instructions
- invasive repo-local `.claude` runtime config
- global mutation or machine-wide agent installs
