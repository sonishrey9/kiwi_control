# Demo Proof Bundle

This folder holds the April 13, 2026 Kiwi Control demo artifacts.

## Fresh artifacts from this pass

- `current-repo/`
  - live `kc` JSON outputs from the real repo
  - graph refresh proof
  - review artifact proof
- `site/`
  - fresh Playwright screenshots of the local built site
  - fresh screenshots and headers for the live public site
- `cli-ui-truth/`
  - fresh external temp repo summary
  - fresh queued, blocked, and recovered render-probe JSON
  - fresh CLI stdout and stderr captures copied from the proof run
- `rendered-desktop/`
  - fresh verifier pass log
  - copied raw temp verifier output when available
- `notes/manual-verify-rendered-desktop.*`
  - direct standalone rerun of `node scripts/verify-rendered-desktop.mjs`
  - use this as the strongest current rendered-desktop proof
- `notes/`
  - command metadata
  - extracted highlights for on-camera use

## Reused reference assets

- `reference-desktop/`
  - repo-native desktop screenshots copied from `output/phase2-proof`
  - used because fresh automated foreground screenshots were unreliable in this pass

## Important notes

- The public home page loaded during capture.
- The public `/install` and `/downloads` routes returned `AccessDenied` during this pass.
- The local built site in `dist/site` rendered cleanly and is the safer install-path surface to record today.
- The bundle runner can fall back to the last successful CLI↔desktop proof directory if the desktop app does not hydrate in time during a combined run.
