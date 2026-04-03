# Repo Lifecycle

## 0. One Command From Any Folder

Install the global entrypoint once:

```bash
bash /path/to/shrey-junior/scripts/install-global.sh
```

Then, from any folder:

```bash
sj-init
```

Use `sj-init` when you want Kiwi Control to decide between `bootstrap` and `standardize` automatically. It preserves repo-authority precedence, stands down on explicit opt-out, and runs `status` plus `check` after a real apply unless `--no-check` is passed.

## 1. New Project

Recommended flow:

```bash
sj-init --target /path/to/new-folder
```

Outcome:

- full portable repo contract installed
- starter profile chosen from safe metadata and defaults
- specialist suggestions seeded
- repo-local memory bank seeded under `.agent/memory/`
- curated specialist registry seeded at `.agent/context/specialists.md`
- generic repos stay quiet by default and do not install backend/frontend instruction noise unless real repo signals justify them
- the next useful file is usually `.agent/context/architecture.md`
- the next useful command is usually `kiwi-control checkpoint "<milestone>" --target <repo>` after you seed real repo context

## 2. Existing Project Or Existing Repo

Recommended flow:

```bash
sj-init --target /path/to/repo --dry-run
sj-init --target /path/to/repo
```

Outcome:

- existing repo gains the portable contract without pretending it is a fresh project
- backups are kept for touched repo-local files where applicable
- `commands.md`, `specialists.md`, `tool-capabilities.md`, and `mcp-capabilities.md` make the operating model visible to tools that only see the repo
- the shared memory bank gives a portable place for repo facts, current focus, risks, and durable gotchas

## 3. External Cloned Repo

Recommended flow:

1. inspect repo authority first
2. run `sj-init --dry-run`
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
kiwi-control status --target <repo>
kiwi-control check --target <repo>
kiwi-control run|fanout|dispatch ...
kiwi-control collect --target <repo>
kiwi-control reconcile --target <repo>
kiwi-control checkpoint "<milestone>" --target <repo>
kiwi-control handoff --target <repo> --to <tool>
kiwi-control push-check --target <repo>
```

At each serious boundary, the shortest continuity path is:

1. `.agent/state/active-role-hints.json`
2. `.agent/state/current-phase.json`
3. `.agent/memory/current-focus.json`
4. `.agent/state/checkpoints/latest.json`
5. latest packet / handoff / reconcile pointers
6. `.agent/context/commands.md`
