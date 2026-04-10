# Kiwi Control Desktop UI Audit

## 1. Audit summary

- Overall assessment: The desktop product is structurally solid and the runtime-backed pack flow now behaves like a real product feature, but the UI still feels too diagnostic, too repetitive, and occasionally state-stale. The app is usable. It is not clean.
- Ship readiness: ship with caveats
- Highest risk areas:
  - cross-view navigation and scroll behavior
  - trustworthiness of the log/history drawer
  - machine readiness messaging
  - token display formatting
  - stale inspector context
- Most broken interactions:
  - switching views while scrolled leaves the new view mid-page instead of resetting to the top
  - opening the execution history drawer shows an empty state even though the repo is in an active blocked workflow with runtime revisions and recovery guidance
  - large token counts render as `38284.5M`, which is not a credible user-facing unit
- Most misleading UI sections:
  - Machine view
  - Overview
  - Tokens
  - Feedback

## 2. Tested surfaces

- Real packaged desktop app:
  - `kc ui` launch path
  - same-repo pack selection click through the rendered MCP view
  - clear explicit pack through the rendered MCP view
  - live runtime revision updates after UI pack click
  - live runtime revision updates after CLI-side pack change
- Playwright-driven rendered UI preview of the current repo state:
  - top bar
  - sidebar navigation
  - execution mode
  - inspection mode
  - guide / next / review / validate / retry / run auto / checkpoint / handoff command strip presence
  - MCP / Tool Integrations view
  - pack expansion cards
  - blocked-pack disabled buttons
  - graph view
  - context view
  - system view
  - validation view
  - machine view
  - inspector panel
  - log/history drawer
  - validation tabs
  - graph node click
  - graph depth controls
  - context focus/include/exclude
  - context bulk undo/reset
  - narrow-width browser resize at 900px
- What was clicked:
  - execution / inspection mode toggles
  - theme toggle
  - open/close log drawer
  - validation/history log tabs
  - open/close inspector
  - every sidebar view button
  - first context focus/include/exclude controls
  - context undo and reset
  - graph depth up/down/reset
  - first visible graph node
  - validation all/issues/pending tabs
  - inspector approve/reject
  - real desktop pack select `web-qa-pack`
  - real desktop pack clear
- What could not be tested and why:
  - I cannot verify direct click execution of `guide`, `next`, `review`, `validate`, `retry`, `run auto`, `checkpoint`, and `handoff` inside the real desktop app. The Playwright audit used the browser preview path, which intentionally has no Tauri bridge, and the repo’s real desktop click harness currently only exposes rendered pack actions.
  - I cannot verify real desktop file-open actions from context/graph `Open` buttons through Playwright. Those actions depend on the Tauri bridge and OS shell integration.
  - I cannot verify packaged-app hover states or OS-native resize behavior precisely. I verified browser-rendered narrow-width behavior instead.

## 3. Functional bugs

### Bug 1
- Severity: medium
- Surface: sidebar navigation / center content
- Exact repro steps:
  1. Open the app on the current repo.
  2. Scroll down within one long view.
  3. Click another sidebar destination such as `MCPs`, `Machine`, or `System`.
- Expected behavior: The newly selected view should render from its own top header so the user can orient immediately.
- Actual behavior: The new view inherits the prior scroll position and lands mid-panel. Headers and overview content are often off-screen.
- Likely cause if inferable: The main scroll container is preserved across `activeView` changes and does not reset `scrollTop` on view switch.
- Evidence screenshot path: `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/nav-mcps-after.png`

### Bug 2
- Severity: medium
- Surface: execution history drawer
- Exact repro steps:
  1. Open the current repo state.
  2. Toggle the log/history drawer.
  3. Switch to the history tab.
- Expected behavior: The drawer should show recent runtime or execution activity for the currently blocked workflow, or it should explicitly say which source is missing.
- Actual behavior: The drawer shows `No execution history is recorded yet.` even while the repo is clearly in a blocked runtime state with revisioned workflow and recovery guidance.
- Likely cause if inferable: The drawer appears to be wired to a narrower history source than the runtime/event surfaces the main UI already trusts.
- Evidence screenshot path: `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/logs-open.png`

### Bug 3
- Severity: medium
- Surface: tokens view
- Exact repro steps:
  1. Open `Tokens`.
  2. Read the measured usage summary card.
- Expected behavior: Large token counts should be formatted in a human-readable way such as `38.3B` or comma-separated full numbers.
- Actual behavior: The UI renders `38284.5M`, which is mathematically possible but user-hostile and visually misleading.
- Likely cause if inferable: The token formatter only appears to support `K` and `M`, so billion-scale values collapse into giant `M` numbers.
- Evidence screenshot path: `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/nav-tokens-after.png`

## 4. State/parity issues

- Inspector state is stale across view changes. After selecting a context/graph item, the inspector continues to show that same item on unrelated views like `MCPs`, `System`, and `Machine` instead of clearing or re-scoping. Evidence:
  - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/nav-machine-after.png`
  - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/nav-system-after.png`
- Real CLI/UI parity for pack selection is good. I verified:
  - desktop click on `web-qa-pack` changed `selectedPack`
  - runtime revision incremented
  - repeated click on the selected pack was idempotent
  - clear returned to heuristic/default
  - no relaunch was required
  - Evidence: `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/evidence/desktop-pack-click-proof.json`
- CLI-side no-op churn for pack operations is good. Repeated `pack status`, repeated `pack set <same-pack>`, and repeated `pack clear` left hashes stable where expected. Evidence:
  - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/evidence/no-op-churn-proof.json`
- Launch/attach still has an observable hydration lag window. The CLI can report that the app is open while the desktop is still hydrating into a stable render. This is not a hard failure, but it still weakens confidence during the first seconds after launch.
- I cannot verify direct UI-command parity for `guide`, `next`, `review`, `validate`, `retry`, `run auto`, `checkpoint`, and `handoff` via actual desktop clicks.

## 5. UX issues

- Overview is too repetitive. The same blocking reason is repeated in the top sticky strip, the red blocked banner, the primary card, the next-action card, and the terminal recovery block.
- Machine view says `Setup looks ready` while also showing a stale badge and a concrete install command. That message is contradictory.
- Tokens view is diagnostic-heavy and over-precise for a human operator. The page feels like an internal analytics dump instead of decision support.
- Feedback view is almost entirely empty-state scaffolding. It consumes a top-level navigation slot without providing much user value in the common case.
- Context view local override controls are powerful, but the copy `Local-ui only until a CLI command runs` is easy to miss. The user is invited to perform local curation without much confidence about whether it matters.
- The Specialists view is just a long flat list. It lacks a clear summary of active/recommended specialist value at the top once you enter the screen mid-scroll.
- The MCP view now shows blocked packs honestly, but the list still mixes executable and blocked packs under the same `Available Packs` heading. The visual separation is weak.

## 6. Visual issues

- Light theme contrast is weak in many cards and micro-labels. The machine screen is the clearest example.
- The narrow-width layout keeps the full left rail and its verbose footer, which steals too much horizontal space at 900px.
- View headers disappear off-screen because the scroll position persists across navigation.
- The logs drawer visually competes with the main page instead of reading as a secondary layer.
- Token and machine cards use many small badges, pills, and metadata rows with very little hierarchy.
- Disabled blocked-pack buttons carry full long-form reasons as button labels. That is honest, but visually heavy and awkward.

## 7. Interaction inventory

| Control name | Location | Clickable or not | Result when clicked | Verdict |
| --- | --- | --- | --- | --- |
| Execution mode | top bar | clickable | switched to inspection/ execution modes correctly | correct |
| Inspection mode | top bar | clickable | switched modes correctly | correct |
| Theme toggle | top bar | clickable | switched light/dark theme | correct |
| Log drawer toggle | top bar | clickable | opened and closed drawer | correct |
| Validation log tab | log drawer | clickable | switched drawer tab | correct |
| History log tab | log drawer | clickable | switched tab but surfaced empty history | misleading |
| Inspector toggle | top bar | clickable | opened and closed inspector | correct |
| Overview nav | sidebar | clickable | view changed | correct |
| Context nav | sidebar | clickable | view changed but retained old scroll position | broken |
| Graph nav | sidebar | clickable | view changed but retained old scroll position | broken |
| Tokens nav | sidebar | clickable | view changed; token cards rendered | correct |
| Feedback nav | sidebar | clickable | view changed; mostly empty diagnostics rendered | misleading |
| MCPs nav | sidebar | clickable | view changed but retained old scroll position | broken |
| Specialists nav | sidebar | clickable | view changed; stale inspector stayed visible | misleading |
| System nav | sidebar | clickable | view changed but retained old scroll position | broken |
| Validation nav | sidebar | clickable | view changed; tabbed filters rendered | correct |
| Machine nav | sidebar | clickable | view changed but retained old scroll position | broken |
| Context focus | context tree | clickable | inspector focus changed | correct |
| Context include | context tree | clickable | local override changed include state | correct |
| Context exclude | context tree | clickable | local override changed exclude state | correct |
| Context undo | context view | clickable | reverted local override state | correct |
| Context reset local edits | context view | clickable | cleared local override state | correct |
| Graph depth up | graph view | clickable | graph redrew / depth state changed | correct |
| Graph depth down | graph view | clickable | graph redrew / depth state changed | correct |
| Graph reset view | graph view | clickable | no meaningful visible change at default position | no-op |
| Graph node click | graph canvas | clickable | node focus updated inspector | correct |
| Validation all tab | validation view | clickable | idempotent on already-active tab | no-op |
| Validation issues tab | validation view | clickable | filtered panel state changed | correct |
| Validation pending tab | validation view | clickable | filtered panel state changed | correct |
| Inspector approve | inspector panel | clickable | decision chip changed to approved | correct |
| Inspector reject | inspector panel | clickable | decision chip changed to rejected | correct |
| Inspector add to context | inspector panel | not clickable in tested state | disabled for current non-path focus | correct |
| Web QA Pack select | real desktop MCP view | clickable | selected pack changed, runtime revision incremented, no relaunch | correct |
| Web QA Pack repeated select | real desktop MCP view | clickable | idempotent, no extra revision | correct |
| Clear explicit pack | real desktop MCP view | clickable | returned to heuristic/default, runtime revision incremented | correct |
| AWS Pack unavailable button | real desktop + preview MCP metadata | not clickable | disabled with exact reason | correct |
| iOS Pack unavailable button | real desktop + preview MCP metadata | not clickable | disabled with exact reason | correct |
| Android Pack unavailable button | real desktop + preview MCP metadata | not clickable | disabled with exact reason | correct |

## 8. Recommended fixes

### Must fix before ship
- Reset the main scroll container when changing sidebar views.
- Fix the execution history drawer so it either shows real runtime/execution history or an honest source-specific empty state.
- Fix token number formatting for billion-scale values.
- Replace the contradictory `Setup looks ready` machine headline with a state that matches the stale badge and install guidance.

### Should fix next
- Clear or re-scope the inspector when switching to unrelated views.
- Reduce duplicate blocking copy on the overview screen.
- Improve visual separation between executable packs and blocked packs in the MCP view.
- Reduce low-signal empty scaffolding in Feedback.
- Rework the left rail footer at narrower widths.

### Polish later
- Improve light-theme contrast for small labels and low-emphasis text.
- Add clearer affordances to the graph view so node interactivity feels more intentional.
- Tighten copy in Context view around what local-only edits actually do.

## 9. Suggested implementation order

1. Reset scroll on `activeView` change.
2. Wire the log/history drawer to the same runtime/event authority the main shell already uses, or relabel it honestly.
3. Fix token formatter output for large numbers.
4. Rewrite machine readiness messaging so the headline, stale badge, and next-fix panel agree.
5. Clear or contextualize stale inspector focus when switching views.
6. De-duplicate the overview blocked-state copy.
7. Improve executable vs blocked pack presentation.
8. Trim low-value empty-state content and narrow-width rail density.

## 10. Evidence

- Audit folder:
  - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10`
- Report:
  - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/kiwi-desktop-ui-audit.md`
- Screenshots captured:
  - screenshot directory: `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots`
  - representative files:
    - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/audit-overview-initial.png`
    - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/nav-context-after.png`
    - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/nav-graph-after.png`
    - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/nav-tokens-after.png`
    - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/nav-mcps-after.png`
    - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/nav-system-after.png`
    - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/nav-machine-after.png`
    - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/nav-validation-after.png`
    - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/logs-open.png`
    - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/mcps-expand-1-after.png`
    - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/inspector-approve-after.png`
    - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/inspector-reject-after.png`
    - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots/narrow-width-overview.png`
- Console errors:
  - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/evidence/playwright-console.txt`
  - observed result: `Total messages: 0 (Errors: 0, Warnings: 0)`
- Network log:
  - `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/evidence/playwright-network.txt`
- Runtime/state proofs:
  - current pack status: `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/evidence/pack-status-current.json`
  - no-op churn proof: `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/evidence/no-op-churn-proof.json`
  - real desktop pack click proof: `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/evidence/desktop-pack-click-proof.json`
  - preview metadata: `/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/evidence/audit-metadata.json`

## Final verdict

ship with caveats
