# Demo Video Bundle Verification

This package was checked against the existing A/B evidence and live proof page.

Verified inputs:

- Primary demo repo: `/Volumes/shrey ssd/my ssd-playground/test-B`
- Comparison repo: `/Volumes/shrey ssd/my ssd-playground/test-A`
- Public proof page: `https://kiwi-control.kiwi-ai.in/proof/`
- Repo proof bundle: `docs/proof/ab-run-2026-04-15/`

Verified claims:

- Repo A used Claude Code directly before implementation.
- Repo B used Kiwi Control workflow help before implementation.
- Direct Claude JSON usage data exists for both runs.
- The metrics in `proof-summary.md`, `script.md`, and `captions.md` match the measured proof bundle.
- The bundle states that the result is one controlled run, not a universal benchmark.
- Claude Code availability was checked with `claude --version` and a `CLAUDE_READY` smoke prompt.

No new usage or savings claims were introduced beyond the measured A/B run.
