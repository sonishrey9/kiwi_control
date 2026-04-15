# Narration Script

## Opening

Kiwi Control is a repo-first control plane for coding agents. It does not replace Claude Code. It gives Claude a cleaner, explicit repo workflow: status, guide, graph, pack, review, and handoff artifacts that live inside the repo.

## Real Repo

This is a real repo from the A/B proof run: `test-B`. It has a real Vite React app, tests, a production build, Kiwi repo-local state, and captured Claude Code logs.

## Kiwi Setup

First I ask Kiwi what the repo knows. `kc status` shows repo state. `kc guide` gives the next useful step. `kc graph build` refreshes the repo graph. `kc pack status` shows the selected pack. `kc review` gives a review-oriented read of the current work.

## Claude Code

Claude Code still does the implementation. In this run, Claude built the Markdown Notes Organizer. Kiwi’s role was to shape the repo context before Claude started, and to leave proof artifacts after the run.

## App Result

The app is a real local Markdown Notes Organizer. It can create notes, edit notes, delete notes, tag notes, filter by tag, search by title and content, persist to localStorage, and show simple stats. The tests and build pass.

## Measured Proof

Then we ran the same task twice. Repo A used Claude Code directly. Repo B used Kiwi Control before implementation. This was one controlled greenfield run on the same machine, using direct Claude JSON usage data.

Measured result from that run:

- Repo A used 3 Claude invocations and 37 turns.
- Repo B used 2 Claude invocations and 28 turns.
- Repo A cost was 1.386074 USD.
- Repo B cost was 0.869697 USD.
- Repo A Claude wall-clock time was 432 seconds.
- Repo B Claude wall-clock time was 177 seconds.

That is useful evidence for this task. It is not a universal benchmark.

## Close

If you want to inspect the claims, the proof page links to the raw report, metrics JSON, Claude logs, and Kiwi outputs. If you want to try the product, the downloads page has the current beta installers.
