# Demo Recording Checklist

## Preflight

- Confirm you are on `main`.
- Run `node scripts/run-demo-proof.mjs`.
- Keep `output/demo/2026-04-14-live-demo-final/README.md` open as the artifact index.
- Confirm the live public routes return `200`: `/`, `/install/`, and `/downloads/`.
- Close distracting apps before taking desktop screenshots. Fresh automated foregrounding was unreliable during proof capture.
- Hide `.env` and any secret-bearing windows before screen recording.

## Recording Order

### 1. Install path

- Use the live site.
- Show:
  - home page
  - install guide
  - downloads page
- Fallback to `dist/site` only if the live route check fails.

### 2. Current repo truth

- Run:
  - `kc setup status --json --target "$ROOT"`
  - `kc setup verify --json --target "$ROOT"`
  - `kc parity --json`
  - `kc status --json --target "$ROOT"`
  - `kc graph build --json --target "$ROOT"`
  - `kc graph status --json --target "$ROOT"`
  - `kc pack status --json --target "$ROOT"`
- Highlight:
  - `sourceOfTruthNote`
  - `graphAuthorityPath`
  - `selectedPack`
  - `overallStatus`

### 3. Clean temp repo

- Run `scripts/demo-replay.sh`.
- Follow the printed commands in order.
- Keep the temp repo path visible once, then copy-paste from there.

### 4. Bounded task

- Show:
  - `kc guide`
  - `kc prepare "update README docs"`
  - `kc status --json`
- Highlight:
  - `currentStep`
  - `readFirst`
  - selected file count
  - next command

### 5. Agent packet

- Show `.agent/state/latest-task-packets.json`.
- Open the generated `claude.md` packet.
- Highlight:
  - read-first files
  - write targets
  - checks
  - stop conditions

### 6. Desktop sync

- Run `kc ui --target "$DEMO_REPO"`.
- If the live app is slow to foreground, use the reference screenshots plus the fresh render-probe JSON from `output/demo/2026-04-14-live-demo-final/cli-ui-truth`.
- Highlight:
  - queued state
  - blocked state
  - recovered state

### 7. Review

- Run `kc review --json --target "$ROOT"`.
- Highlight:
  - `summary`
  - `reviewOrder`
  - `likelyMissingValidation`
  - `reviewerHandoff.readFirst`

## Exact Assets To Have Open

- `docs/live-demo-guide.md`
- `docs/demo-script.md`
- `output/demo/2026-04-14-live-demo-final/README.md`
- `output/demo/2026-04-14-live-demo-final/site/live-home.png`
- `output/demo/2026-04-14-live-demo-final/site/live-install.png`
- `output/demo/2026-04-14-live-demo-final/site/live-downloads.png`
- `output/demo/2026-04-14-live-demo-final/reference-desktop/current-ready.png`
- `output/demo/2026-04-14-live-demo-final/reference-desktop/external-blocked.png`
- `output/demo/2026-04-14-live-demo-final/reference-desktop/external-recovered.png`

## On-Screen Cleanliness

- Use a large terminal font.
- Keep one terminal tab for the current repo and one for the temp repo.
- Avoid scrolling giant JSON outputs by hand; use the proof files in `output/demo/2026-04-13-live-proof` for zoomed-in highlights.
- Keep the comparison segment to observed workflow differences only.

## Abort Conditions

- Public `/install` or `/downloads` still returns `AccessDenied` and you were planning to show the live public site.
- The desktop app is not foregrounding reliably enough for clean capture.
- `kc graph build` fails or reports stale output after refresh.
- Any secret-bearing window is visible during recording.

## Final Video Files

- Use `output/demo/2026-04-14-video-final/final/kiwi-control-demo-complete-github.mov` as the main shareable demo.
- Use `output/demo/2026-04-14-video-final/final/kiwi-control-demo-short.mov` for a short preview.
- Raw recordings and local helper scripts are intentionally ignored and not part of the repo deliverable.
