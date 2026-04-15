# Shot List

## 0:00-0:15 - What Kiwi Control Is

Visuals:
- Open the live homepage: `https://kiwi-control.kiwi-ai.in/`
- Briefly show the proof callout on the homepage.

Narrative purpose:
- Establish the product: a repo-first control plane for coding agents.
- Make the video feel concrete immediately.

On-screen caption:
- `Repo-first control plane for coding agents`

## 0:15-0:45 - Real Repo + Kiwi Setup

Visuals:
- Terminal in `/Volumes/shrey ssd/my ssd-playground/test-B`
- Show repo files with `ls`
- Show `.agent/`, `.github/`, `AGENTS.md`, `CLAUDE.md`
- Run `kc status --json`

Narrative purpose:
- Show this is a real repo with real Kiwi setup, not a mock page.

On-screen caption:
- `Real repo. Real Kiwi setup.`

## 0:45-1:20 - Kiwi Status, Guide, Graph, Pack, Review

Visuals:
- Run the core Kiwi commands from `commands.md`
- Show saved JSON outputs in `ab-output/kc/`
- Optionally open Kiwi desktop UI with `kc ui --target "$PWD"`

Narrative purpose:
- Show Kiwi gives Claude a repo-aware starting surface before implementation.

On-screen caption:
- `Status -> Guide -> Graph -> Pack -> Review`

## 1:20-2:00 - Claude Code Fits Into The Workflow

Visuals:
- Show `claude --version`
- Show `ab-output/logs/20-claude-run-b.json`
- Show `ab-output/task-prompt.md`
- Mention that Claude Code did the implementation work.

Narrative purpose:
- Kiwi does not replace Claude. It structures the repo and handoff before Claude works.

On-screen caption:
- `Kiwi frames the work. Claude writes the code.`

## 2:00-2:40 - App Result

Visuals:
- Run or show `npm test`
- Run or show `npm run build`
- Start the app with `npm run dev -- --host 127.0.0.1 --port 4174`
- Open `http://127.0.0.1:4174/`
- Create/edit/delete/tag/filter/search a note briefly.

Narrative purpose:
- Show the task result is real and runnable.

On-screen caption:
- `Same task. Passing tests. Working app.`

## 2:40-3:15 - Measured A/B Proof

Visuals:
- Open `https://kiwi-control.kiwi-ai.in/proof/`
- Show the chart section with Repo A and Repo B bars.
- Show the raw proof links.

Narrative purpose:
- Tie product value to measured evidence.

On-screen caption:
- `One controlled run. Direct Claude JSON usage data.`

## 3:15-End - Try It

Visuals:
- Open `https://kiwi-control.kiwi-ai.in/downloads/`
- Show Windows EXE/MSI and macOS links are live.

Narrative purpose:
- End with action, not more explanation.

On-screen caption:
- `Inspect the proof. Download the beta.`
