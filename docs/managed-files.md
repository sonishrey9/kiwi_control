# Managed Files

`shrey-junior` uses managed markers so generated content can be updated safely without overwriting human-authored text.

## Marker format

### Managed block

```html
<!-- SHREY-JUNIOR:START codex -->
... managed content ...
<!-- SHREY-JUNIOR:END codex -->
```

### Fully managed file

Markdown files use HTML comment markers.
YAML files use comment markers so the file remains parseable.

```html
<!-- SHREY-JUNIOR:FILE-START AGENTS.md -->
... managed content ...
<!-- SHREY-JUNIOR:FILE-END AGENTS.md -->
```

```yaml
# SHREY-JUNIOR:FILE-START .agent/project.yaml
version: 1
# SHREY-JUNIOR:FILE-END .agent/project.yaml
```

## Ownership rules

- `configs/`, `prompts/`, and `templates/` are canonical.
- `.agent/*` files are fully managed outputs.
- `.agent/state/*` files are fully managed repo-local continuity outputs.
- Managed or generated does not automatically mean tracked in Git. Volatile runtime JSON, proof outputs, and local preview artifacts should follow [generated-artifacts.md](./generated-artifacts.md) and be restored or ignored before commit.
- `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` may contain both human-authored text and one `shrey-junior` managed block.
- generated task packets under `.agent/tasks/*` are derived outputs and may be regenerated freely

## Update policy

- If a target file does not exist, `init` creates a managed file.
- If a target file exists and already contains `shrey-junior` markers, `sync` updates only the managed region.
- If a target file exists without markers, `init` or `sync` appends a new managed block rather than replacing the file.
- If a fully managed file path already exists without `shrey-junior` file markers, the command refuses to overwrite it and reports a conflict.
- `sync --dry-run` previews the planned managed updates only.
- `sync --diff-summary` reports added and removed line counts per touched file.
- `sync --backup` stores pre-change file copies under `.agent/backups/shrey-junior/`.
- `checkpoint` updates `.agent/state/current-phase.json` and appends a history JSON record.
- `handoff` writes `.agent/state/handoff/*.md`, `.json`, and `.brief.md` artifacts for the selected tool.

## Rollback

- Remove a managed block by deleting the marker-bounded region.
- Remove a fully managed file by deleting the file.
- Remove a continuity checkpoint by deleting or replacing the corresponding files under `.agent/state/`.
- Restore a backed-up file from `.agent/backups/shrey-junior/` if `--backup` was used.
- Re-run `check` to verify the repo is clean.
