# Repo Lifecycle

## 1. New Project

Recommended flow:

```bash
shrey-junior bootstrap --target /path/to/new-folder
shrey-junior status --target /path/to/new-folder
shrey-junior check --target /path/to/new-folder
```

Outcome:

- full portable repo contract installed
- starter profile chosen from safe metadata and defaults
- specialist suggestions seeded

## 2. Existing Project Or Existing Repo

Recommended flow:

```bash
shrey-junior standardize --target /path/to/repo --dry-run
shrey-junior standardize --target /path/to/repo --backup
```

Outcome:

- existing repo gains the portable contract without pretending it is a fresh project
- backups are kept for touched repo-local files where applicable

## 3. External Cloned Repo

Recommended flow:

1. inspect repo authority first
2. run `standardize --dry-run`
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
shrey-junior status --target <repo>
shrey-junior check --target <repo>
shrey-junior run|fanout|dispatch ...
shrey-junior collect --target <repo>
shrey-junior reconcile --target <repo>
shrey-junior checkpoint "<milestone>" --target <repo>
shrey-junior handoff --target <repo> --to <tool>
shrey-junior push-check --target <repo>
```
