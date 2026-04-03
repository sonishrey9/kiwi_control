# Tool-Global Rollbacks

The final global integration phase touches only these tool-global surfaces:

- `~/.codex/AGENTS.md`
- `~/.claude/CLAUDE.md`
- `~/Library/Application Support/Code/User/prompts/`
- `~/Library/Application Support/Code/User/mcp.json`

It also relies on the already-installed launcher surfaces:

- `~/.shrey-junior/`
- `~/.local/bin/shrey-junior`

## Backup first

Run:

```bash
bash scripts/backup-global.sh
```

The final integration phase created a timestamped backup like:

```text
~/.shrey-junior/backups/final-global-integration-YYYYMMDD-HHMMSS
```

For later hardening and proof runs, fresh snapshots may also exist under:

```text
~/.shrey-junior/backups/manual-YYYYMMDD-HHMMSS
```

## Restore the tool-global surfaces

Use:

```bash
bash scripts/restore-global.sh ~/.shrey-junior/backups/final-global-integration-YYYYMMDD-HHMMSS
```

That restores the backed up versions of:

- `~/.codex/AGENTS.md`
- `~/.claude/CLAUDE.md`
- `~/Library/Application Support/Code/User/mcp.json`
- `~/Library/Application Support/Code/User/prompts/`

Rollback has been tested against temporary file mutations:

- appended text markers in Codex, Claude, and VS Code prompt files
- a temporary JSON key in `mcp.json`

The restore flow removed those mutations and returned the files to the known-good hashes captured before the rollback test.

## Re-verify after restore

Run:

```bash
bash scripts/verify-global-hard.sh
```

Interpretation:

- pass: the marked blocks exist exactly once, the prompt file exists, `mcp.json` parses, and the restore script is executable
- fail: inspect the backed up files and rerun restore before any further mutation

## Remove Kiwi Control global install

If you also want to remove global Kiwi Control discoverability:

```bash
rm -f ~/.local/bin/shrey-junior
rm -rf ~/.shrey-junior
```

Only do this if you do not want the globally callable launcher anymore.
