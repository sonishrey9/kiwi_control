# Machine Setup Parity Checklist

This checklist tracks what Kiwi Control now covers from the practical `ai-setup` workflow and where Kiwi still relies on compatibility helpers or external binaries.

## Covered natively by Kiwi

- machine tool detection across PATH, `~/.local/bin`, Homebrew, cargo, and npm/pnpm-style bin roots
- machine-global setup status and verify surfaces
- repo contract init or sync through Kiwi bootstrap flows
- runtime-backed repo graph refresh through Kiwi graph build
- repo hygiene updates for supported setup artifacts
- repo assistant compatibility wiring for `.omc/` and Copilot MCP repo metadata
- desktop onboarding entry point for machine setup

## Wrapped from existing Kiwi-owned scripts

- `scripts/install-global.sh`
- `scripts/apply-global-preferences.sh`
- `scripts/sj-init.sh`

These remain the write engines for the global CLI and global preferences because they already own the exact file shapes and compatibility paths.

## Wrapped from external tools when available

- `lean-ctx init`
- `repomix --compress --output .repomix-output.xml`

Kiwi verifies and reports these steps, but does not pretend to vendor-install those binaries.

## Still intentionally separate

- local `ai-setup` remains a detected compatibility helper
- runtime SQLite remains the canonical repo execution authority
- `.agent/state/*` compatibility JSON files remain derived outputs, not machine setup truth
- blocked packs remain blocked until real runtime integrations exist

## Required proofs

- `kc setup status --json --target /path/to/repo`
- `kc setup verify --json --target /path/to/repo`
- `kc setup --profile full-dev-machine --target /path/to/repo --dry-run`
- repeat the same setup action twice and confirm the second run is a no-op
- confirm `kc pack set` and `kc pack clear` remain no-op on repeated identical actions
- confirm desktop render-probe shows `aiSetupDetected` and `machineSetupStatus`
