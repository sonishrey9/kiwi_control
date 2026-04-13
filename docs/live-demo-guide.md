# Kiwi Control Live Demo Guide

## Demo Gap Diagnosis

### Strong today

- `kc` and `kiwi-control` are installed globally on this machine.
- `kc setup status`, `kc setup verify`, `kc parity`, `kc status`, `kc graph build`, `kc graph status`, `kc pack status`, `kc repo-map`, `kc agent-pack --review`, and `kc review` all ran successfully on April 13, 2026.
- `bash scripts/smoke-test.sh` passed on a fresh temp repo and showed a bounded `prepare` selecting 1 file with an estimated `~37` selected tokens versus `~2.9K` full-repo tokens for that repo.
- `node scripts/verify-cli-ui-truth.mjs --external-temp-repo` passed and produced queued, blocked, and recovered CLI-to-desktop proof artifacts.
- `node scripts/verify-rendered-desktop.mjs` passed in a direct standalone run, and that pass is saved into the demo bundle.
- The locally built site in `dist/site` rendered correctly for home, install, and downloads capture.

### Weak or risky today

- Fresh automated `kc ui` screenshots did not reliably foreground the Kiwi desktop window during this pass. The proof bundle therefore uses fresh render-probe JSON plus existing repo-native reference screenshots from `output/phase2-proof`.
- The combined `scripts/run-demo-proof.mjs` bundle can fall back to the last successful CLI↔desktop proof directory when desktop hydration times out. Treat that as evidence packaging, not as a claim that the desktop proof is perfectly deterministic.
- The live public home page loaded, but the live public `/install` and `/downloads` routes returned `AccessDenied` pages during this pass. For recording, prefer the public home page or the locally built site unless the public routes are fixed first.
- The repo was already dirty before this task because `scripts/package-release-assets.mjs` had local edits.

## Tooling Used

- Graph-first repo inspection via `code-review-graph`.
- Existing repo-native proof scripts:
  - `scripts/smoke-test.sh`
  - `scripts/verify-cli-ui-truth.mjs`
  - `scripts/verify-rendered-desktop.mjs`
- Browser automation via the locally installed `playwright` CLI.
- No dedicated desktop-video MCP/plugin was available in this environment, so capture falls back to repo-native proof scripts plus browser screenshots and OS screenshots where possible.

## Shot Plan

| Scene | What is shown | Exact commands | Expected outcome | Why it matters |
|---|---|---|---|---|
| 1 | Install surface and desktop-first message | `python3 -m http.server 8765 --directory dist/site` | Local home, install, and downloads pages load cleanly from the built site | Shows the intended onboarding path without depending on the currently flaky public `/install` and `/downloads` routes |
| 2 | Current repo setup and parity truth | `kc setup status --json --target "$ROOT"` and `kc setup verify --json --target "$ROOT"` and `kc parity --json` | Machine setup, compatibility helpers, and repo-local parity are reported explicitly | Establishes that Kiwi knows what is machine-global versus repo-local |
| 3 | Runtime, graph, and pack truth in the real repo | `kc status --json --target "$ROOT"` and `kc graph build --json --target "$ROOT"` and `kc graph status --json --target "$ROOT"` and `kc pack status --json --target "$ROOT"` | Status shows repo-local source of truth, graph build refreshes to fresh, pack selection is explicit | Shows runtime-backed truth, graph truth, and pack truth on a real repo |
| 4 | Reviewability after live repo inspection | `kc review --json --target "$ROOT"` and `kc repo-map --changed --limit 8 --json --target "$ROOT"` | Review order, likely missing validation, artifact paths, and ranked areas appear | Demonstrates that Kiwi is useful after coding, not only before it |
| 5 | Clean temp repo initialization | `scripts/demo-replay.sh` | A small throwaway repo is created with Git history and clear commands to replay | Keeps the coding segment believable and bounded |
| 6 | Bounded task preparation | `kc init` and `kc guide` and `kc prepare "update README docs"` and `kc status --json` inside the temp repo | Repo contract appears, next actions are explicit, and selected scope stays small | Shows how Kiwi reduces drift before the coding model starts doing work |
| 7 | Agent workflow packet for Claude Code or a comparable terminal agent | `kc run "update README docs"` and then open `.agent/state/latest-task-packets.json` plus the generated `claude.md` packet | The task produces repo-local packets with read-first, write targets, checks, and stop conditions | Shows Kiwi structuring a real agent workflow without replacing the model |
| 8 | CLI and desktop stay in sync | `kc ui --target "$DEMO_REPO"` or show fresh proof from `output/demo/2026-04-13-live-proof/cli-ui-truth` | Queued, blocked, and recovered states are reflected in both CLI logs and desktop render probes | Shows CLI↔desktop continuity with evidence, not marketing claims |
| 9 | Honest comparison against raw agent use | No extra tool beyond the already captured outputs | Compare raw repo scan versus Kiwi `guide` and `prepare` output | Keeps the comparison compact and evidence-based |

## Honest Comparison Segment

Use this framing:

- Raw agent use starts with repo exploration and ambiguous next steps.
- Kiwi does not replace the model. It gives the model a smaller, clearer starting surface:
  - `kc guide` exposes the current step and likely files
  - `kc prepare` creates a bounded packet and reports selected scope
  - `kc repo-map` and `kc graph status` expose repo structure without a broad scan
  - `kc review` creates a review order and handoff reads after the change
  - `kc status` and the desktop app read the same repo-local runtime state

Avoid this framing:

- do not claim universal token savings
- do not claim benchmarked speedups
- do not claim better code quality than the model itself

Safe claim for this pass:

- On the fresh sample repo used by `scripts/smoke-test.sh`, Kiwi selected `1` file for a docs task and estimated `~37` selected tokens versus `~2.9K` full-repo tokens using Kiwi's chars-per-token heuristic. That is a bounded-context example, not a universal benchmark.

## Strongest Assets To Show

- `output/demo/2026-04-13-live-proof/site/local-home.png`
- `output/demo/2026-04-13-live-proof/site/local-install.png`
- `output/demo/2026-04-13-live-proof/site/local-downloads.png`
- `output/demo/2026-04-13-live-proof/current-repo/status.json`
- `output/demo/2026-04-13-live-proof/current-repo/parity.json`
- `output/demo/2026-04-13-live-proof/current-repo/graph-build.json`
- `output/demo/2026-04-13-live-proof/current-repo/review.json`
- `output/demo/2026-04-13-live-proof/cli-ui-truth/summary.json`
- `output/demo/2026-04-13-live-proof/cli-ui-truth/render-probe-blocked.json`
- `output/demo/2026-04-13-live-proof/cli-ui-truth/render-probe-recovered.json`
- `output/demo/2026-04-13-live-proof/reference-desktop/current-ready.png`
- `output/demo/2026-04-13-live-proof/reference-desktop/external-blocked.png`
- `output/demo/2026-04-13-live-proof/reference-desktop/external-recovered.png`

## Recording Notes

- Record from `main`, but do not touch the pre-existing local edit in `scripts/package-release-assets.mjs`.
- Prefer the local site for install-path recording until the public `/install` and `/downloads` routes stop returning `AccessDenied`.
- Keep terminal zoomed and use `kc`, not `node packages/sj-cli/dist/cli.js`, on camera.
- Keep the current repo segment short. The clean temp repo is the safer place for the agent workflow segment.
