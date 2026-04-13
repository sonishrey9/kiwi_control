# Demo Recording Checklist

## Preflight

- Confirm you are on `main`.
- Confirm the only pre-existing unrelated local edit is still `scripts/package-release-assets.mjs`.
- Run `node scripts/run-demo-proof.mjs`.
- Keep `output/demo/2026-04-13-live-proof/README.md` open as the artifact index.
- Use the local built site for install-path recording unless the public `/install` and `/downloads` routes are fixed.
- Close distracting apps before taking desktop screenshots. Fresh automated foregrounding was unreliable during proof capture.

## Recording Order

### 1. Install path

- Start a local static server for `dist/site`.
- Show:
  - home page
  - install guide
  - downloads page
- Do not show the live public `/install` or `/downloads` routes unless you have rechecked them first.

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
- If the live app is slow to foreground, use the reference screenshots plus the fresh render-probe JSON from `output/demo/2026-04-13-live-proof/cli-ui-truth`.
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
- `output/demo/2026-04-13-live-proof/README.md`
- `output/demo/2026-04-13-live-proof/site/local-home.png`
- `output/demo/2026-04-13-live-proof/site/local-install.png`
- `output/demo/2026-04-13-live-proof/site/local-downloads.png`
- `output/demo/2026-04-13-live-proof/reference-desktop/current-ready.png`
- `output/demo/2026-04-13-live-proof/reference-desktop/external-blocked.png`
- `output/demo/2026-04-13-live-proof/reference-desktop/external-recovered.png`

## On-Screen Cleanliness

- Use a large terminal font.
- Keep one terminal tab for the current repo and one for the temp repo.
- Avoid scrolling giant JSON outputs by hand; use the proof files in `output/demo/2026-04-13-live-proof` for zoomed-in highlights.
- Keep the comparison segment to observed workflow differences only.

## Abort Conditions

- Public `/install` or `/downloads` still returns `AccessDenied` and you were planning to show the live public site.
- The desktop app is not foregrounding reliably enough for clean capture.
- `kc graph build` fails or reports stale output after refresh.
- `scripts/package-release-assets.mjs` changes further during recording.
