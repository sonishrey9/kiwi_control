# Global Bootstrap

`kiwi-control bootstrap` makes the control plane discoverable from any new folder while keeping the actual operation repo-local.

## Goal

- detect whether the target is a brand new folder, an existing project, or an existing git repo
- infer a safe starter project type from filenames and top-level folders only
- select a starter profile without ignoring real repo authority
- scaffold the normal repo-local overlays and `.agent/*` state
- avoid blind overwrites of existing trusted files
- work cleanly with the global launcher when `shrey-junior` is installed into `~/.local/bin`

## Command

```bash
node dist/cli.js bootstrap --target "/path/to/folder"
node dist/cli.js bootstrap --target "/path/to/folder" --profile product-build
node dist/cli.js bootstrap --target "/path/to/folder" --project-type python
node dist/cli.js bootstrap --target "/path/to/folder" --dry-run
```

## What bootstrap inspects

Bootstrap uses safe top-level metadata only:

- `AGENTS.md`
- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.agent/project.yaml` when present
- top-level files such as `pyproject.toml`, `package.json`, `dbt_project.yml`, `mkdocs.yml`
- top-level folders such as `docs/`, `models/`, or `dags/`
- `.git/` to distinguish git repos from plain folders

It does not deep-crawl the repo and does not inspect risky files.

Optional global defaults may be read from `~/.shrey-junior/defaults/bootstrap.yaml`, but only as starter hints.

## Output

Bootstrap prints a first-run summary with:

- detected target kind
- detected or explicit project type
- selected profile and where it came from
- existing authority files found
- created or preserved files
- warnings
- recommended next command

## Safety

- existing repo authority is never overwritten blindly
- managed marker writes are still used for native tool surfaces
- `--dry-run` shows the exact write plan before mutation
- global defaults are reference-only hints, not a license to overrule repo truth
