# Kiwi Control Demo Script

## Narration

### 0:00 to 0:25

This is Kiwi Control running on a real repo, not a mocked marketing flow. I’m going to show the desktop-first install path, the `kc` terminal workflow, a bounded coding task, and the repo-local artifacts Kiwi creates before, during, and after model work.

### 0:25 to 0:55

Start with the install surface. Kiwi is meant to be usable from the desktop first, with terminal commands added as a power-user path. The important part here is that the install path and release state are visible, and the CLI setup is treated as product behavior, not tribal setup knowledge.

### 0:55 to 1:35

Now in the repo, I’ll ask Kiwi what the machine and repo know. `kc setup status` shows machine-global setup and compatibility helpers. `kc setup verify` turns that into actionable checks. `kc parity` is the higher-level summary: runtime-backed truth, repo graph, packs, review intelligence, and CLI-to-desktop parity are repo-local capabilities, while machine setup stays explicitly separate.

### 1:35 to 2:10

Next is repo truth. `kc status` tells me the repo state, the current execution lifecycle, the next command, and the exact artifacts behind that answer. Then `kc graph build` refreshes the runtime-backed graph, and `kc graph status` shows that the canonical graph lives in runtime SQLite while JSON exports remain compatibility views. `kc pack status` shows which pack is active and which packs are blocked.

### 2:10 to 2:55

For the coding flow, I switch to a clean temp repo. `kc init` lays down the repo-local contract. `kc guide` tells me the current step, likely files, and what the tool wants read first. `kc prepare "update README docs"` narrows the task before any model starts wandering. In the proof run for this repo, Kiwi selected one file and estimated roughly thirty-seven selected tokens versus roughly twenty-nine hundred for the full repo scan, using its built-in heuristic. That is the kind of noise reduction Kiwi is aiming for.

### 2:55 to 3:40

Now I start the agent workflow. `kc run` creates task packets, including a Claude-oriented packet. That packet is the key handoff: read-first files, write targets, checks, stop conditions, and next actions are all repo-local and reviewable. Kiwi is not coding instead of the model. It is structuring the repo so the model has less scope to drift.

### 3:40 to 4:20

Here is the sync story. The CLI and the desktop app are both reading the same runtime-backed state. In the proof run, the temp repo moved from queued to blocked to recovered, and those transitions were captured in both CLI outputs and desktop render probes. That matters because the app is not inventing hidden state. It is reporting repo state.

### 4:20 to 4:55

After the task, Kiwi helps with review. `kc review` ranks what to inspect first, calls out likely missing validation, and provides reviewer and coding-tool handoff reads. That makes the work easier to inspect and easier to continue across tools.

### 4:55 to 5:20

The practical difference versus raw agent use is simple. Without Kiwi, I start from a repo scan and an open-ended prompt. With Kiwi, I get setup truth, runtime truth, graph truth, pack truth, a bounded task packet, and a review path. The model still does the work. Kiwi makes that work lower-noise and easier to trust.

## Lower Thirds And Callouts

- `Repo-local truth, not hidden app state`
- `Runtime SQLite is canonical`
- `Pack selection is explicit policy`
- `Bounded task packet for Claude, Codex, or Copilot`
- `CLI and desktop read the same repo state`
- `Review pack after the run, not just before it`

## Avoid Saying

- `Kiwi saves X percent of tokens overall`
- `Kiwi makes the model smarter`
- `Kiwi guarantees better code`

## Safe Phrasing

- `Kiwi narrows the starting surface`
- `Kiwi keeps repo state explicit and reviewable`
- `Kiwi gives the model a smaller, clearer packet`
- `Kiwi keeps CLI and desktop in sync by reading the same repo-local state`
