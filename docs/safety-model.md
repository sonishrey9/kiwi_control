# Safety Model

## Principles

- Never echo credentials or secret values.
- Never ingest risky files directly.
- Prefer metadata-only inspection for local tool state.
- Preserve existing working behavior.
- Require explicit human approval for destructive or global changes.
- Keep repo-local overlays portable and machine-local state reference-only.
- Use dry-run and backup support before touching established repos.

## Sensitive path classifier

Any path containing one of these patterns is treated as sensitive by default:

- `.env`
- `secret`
- `token`
- `password`
- `key`
- `pem`
- `ssh`
- `aws`
- `render`
- `credential`
- `workspaceStorage`
- `session`
- `chat`

## Read policy

### Safe direct read

- `AGENTS.md`
- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.agent/project.yaml`
- `.agent/checks.yaml`
- `.agent/context/*`
- canonical docs under `docs/`
- templates and prompts inside this repo

### Metadata-only

- `settings.json`
- `settings.local.json`
- `launch.json`
- MCP config files
- hook config files

### Refuse direct ingest

- `.env*`
- `*.pem`
- SSH keys
- local credential stores
- session logs
- workspace storage payloads
- temp secret files

## Output policy

- reports are sanitized
- JSON summaries list keys, server names, and file roles only
- any redacted text uses placeholder tokens
- `sync --dry-run` previews planned managed changes without writing
- `sync --backup` stores touched file backups under `.agent/backups/shrey-junior/`
