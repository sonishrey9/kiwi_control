# Repo Lifecycle

## 0. One Command From Any Folder

Install Kiwi Control once using the public install flow in [docs/install.md](/Volumes/shrey%20ssd/shrey-junior/docs/install.md).

Then, from any folder:

```bash
kc init
```

Use `kiwi-control init` when you want Kiwi Control to decide between `bootstrap` and `standardize` automatically. It preserves repo-authority precedence and stands down on explicit opt-out.

## 1. New Project

Recommended flow:

```bash
cd /path/to/new-folder
kiwi-control init
```

Outcome:

- full portable repo contract installed
- starter profile chosen from safe metadata and defaults
- specialist suggestions seeded
- repo-local memory bank seeded under `.agent/memory/`
- curated specialist registry seeded at `.agent/context/specialists.md`
- generic repos stay quiet by default and do not install backend/frontend instruction noise unless real repo signals justify them
- the next useful file is usually `.agent/context/architecture.md`
- the next useful command is usually `kiwi-control checkpoint "<milestone>"` after you seed real repo context

## 2. Existing Project Or Existing Repo

Recommended flow:

```bash
kiwi-control standardize --target /path/to/repo --dry-run
cd /path/to/repo && kiwi-control init
```

Outcome:

- existing repo gains the portable contract without pretending it is a fresh project
- backups are kept for touched repo-local files where applicable
- `commands.md`, `specialists.md`, `tool-capabilities.md`, and `mcp-capabilities.md` make the operating model visible to tools that only see the repo
- the shared memory bank gives a portable place for repo facts, current focus, risks, and durable gotchas

## 3. External Cloned Repo

Recommended flow:

1. inspect repo authority first
2. run `kiwi-control standardize --target /path/to/repo --dry-run`
3. only apply if repo authority does not opt out

## 4. Cloud-Only Environment

If only the repo is visible:

- repo-local overlays, role specs, packets, and continuity artifacts still provide orientation
- machine-global accelerators are unavailable
- local CLI invocation may be unavailable
- CI remains the strongest enforcement layer

## 5. Ongoing Serious Work

Recommended sequence:

```bash
kiwi-control status
kiwi-control check
kiwi-control run|fanout|dispatch ...
kiwi-control collect
kiwi-control reconcile
kiwi-control checkpoint "<milestone>"
kiwi-control handoff --to qa-specialist
kiwi-control push-check
```

At each serious boundary, the shortest continuity path is:

1. `.agent/state/active-role-hints.json`
2. `.agent/state/current-phase.json`
3. `.agent/memory/current-focus.json`
4. `.agent/state/checkpoints/latest.json`
5. latest packet / handoff / reconcile pointers
6. `.agent/context/commands.md`
