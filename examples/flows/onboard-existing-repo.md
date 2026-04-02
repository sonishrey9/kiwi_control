# Onboard Existing Repo Flow

1. Run `audit` against the repo.
2. Review existing `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md`.
3. Run `init --profile strict-production`.
4. Preview changes with `sync --dry-run --diff-summary`.
5. Apply with `sync --backup` once the managed plan looks correct.
