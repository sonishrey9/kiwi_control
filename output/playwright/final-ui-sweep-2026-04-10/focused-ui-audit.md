# Kiwi Control Focused UI Audit

Date: 2026-04-10
Target: `/Volumes/shrey ssd/shrey-junior`
Mode: browser preview generated from current `kiwi-control ui --json` state, plus real desktop verification via `node scripts/verify-rendered-desktop.mjs`

## Verified fixes

- History drawer now shows real runtime-backed history instead of a false empty state.
  - Proof: `evidence/overview-state.json` reports `historyLineCount: 10`.
- Main-center scroll resets on sidebar view change.
  - Proof: `evidence/machine-scroll-before-reset.json` reports `scrollTop: 1200`.
  - Proof: `evidence/context-scroll-after-reset.json` reports `scrollTop: 0`.
- Machine messaging is now internally consistent when machine data is stale.
  - Proof: `screenshots/machine-light-clean-final.png` shows `Machine advisory is stale` with a stale badge and refresh-first guidance.
- Token formatting no longer uses broken `38284.5M`-style output.
  - Proof: `evidence/tokens-formatting.json` includes compact values like `38.3B`, `598.4K`, and `176.6K`.
- MCP / pack grouping clearly separates executable packs from blocked packs.
  - Proof: `evidence/mcps-pack-groups.json` reports `blockedPacks: 3`.
  - Proof: `screenshots/mcps-clean-final.png` shows the executable research pack surface and the quieter blocked-pack grouping below.
- Real desktop runtime-backed proof still passes after the UI simplification patch.
  - Proof: `node scripts/verify-rendered-desktop.mjs` passed.

## Surfaces clicked or checked

- Sidebar navigation: overview, context, graph, tokens, feedback, mcps, system, validation, machine
- Graph interaction: first graph node selected
- Pack surface: core-pack details expanded inside MCP view
- Theme: dark to light toggle
- Layout: resized to `900x900`
- Chrome toggles: log drawer and inspector collapse behavior checked in preview

## Remaining noisy or misleading sections

1. The blocked-state reason still appears in both the top runtime banner and the per-view hero card.
   - This is much smaller than before, but the duplication is still visible on every major screen.
2. The inspector is still open by default and can dominate non-inspection views.
   - It is truthful, but still visually heavy when the user only wants the main workflow surface.
3. The top metadata row is still crowded in light theme.
   - The readability is improved, but the repo chip, phase chip, mode chip, and status chips still pack tightly.
4. Feedback is quiet now, but it is still mostly a placeholder when there is no real signal.
   - It is no longer misleading, but it is still low-value until more feedback exists.

## Evidence index

- Overview: `screenshots/overview-final.png`
- Context: `screenshots/context-view.png`
- Scroll reset proof: `screenshots/context-after-scroll-reset.png`
- Graph: `screenshots/graph-node-selected.png`
- Tokens: `screenshots/tokens-view.png`
- Feedback: `screenshots/feedback-view.png`
- MCPs: `screenshots/mcps-clean-final.png`
- Validation: `screenshots/validation-view.png`
- Machine dark: `screenshots/machine-dark.png`
- Machine light: `screenshots/machine-light-clean-final.png`
- Machine narrow: `screenshots/machine-light-narrow.png`
- Console warnings: `evidence/console-warning.txt`
- Console errors: `evidence/console-error.txt`

## Final audit verdict

The UI is materially cleaner and more trustworthy than the pre-fix state. The remaining issues are mostly density and emphasis problems, not broken authority, false status, or drift.
