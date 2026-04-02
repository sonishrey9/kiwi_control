# Final Global Closeout

Date: 2026-04-03  
Repo: `/Volumes/shrey ssd/shrey-junior`

## Executive Summary

This closeout pass finished the last hardening work for the global integration layer:

- captured a fresh repo and global pre-flight snapshot
- proved idempotent reapplication of the global preference layer
- proved rollback against real global surfaces
- proved repo-authority-first behavior, including explicit repo-local opt-out
- validated shallow project detection across common repo shapes
- added final verification and restore scripts
- prepared the repo for preservation in a new remote

The global integration remains guidance-first, explicit, and reversible. It does not introduce daemons, secret reads, auto-push, or hidden automation.

## Commands Run

```bash
pwd
git status --short --branch
git branch --show-current
git remote -v
python3 - <<'PY'
from pathlib import Path
root=Path('/Volumes/shrey ssd/shrey-junior')
for name in sorted(p.name for p in root.iterdir() if not p.name.startswith('._')):
    print(name)
PY

for p in \
  "$HOME/.codex/AGENTS.md" \
  "$HOME/.claude/CLAUDE.md" \
  "$HOME/Library/Application Support/Code/User/prompts/shrey-junior.instructions.md" \
  "$HOME/Library/Application Support/Code/User/mcp.json"; do
  test -e "$p" && echo "exists $p"
done

shasum -a 256 \
  "$HOME/.codex/AGENTS.md" \
  "$HOME/.claude/CLAUDE.md" \
  "$HOME/Library/Application Support/Code/User/prompts/shrey-junior.instructions.md" \
  "$HOME/Library/Application Support/Code/User/mcp.json"

bash scripts/backup-global.sh
bash scripts/apply-global-preferences.sh
bash scripts/apply-global-preferences.sh
bash scripts/verify-global-hard.sh
bash scripts/backup-global.sh

bash scripts/restore-global.sh ~/.shrey-junior/backups/manual-20260403-000949

node dist/cli.js status --target /tmp/sj-precedence-...
node dist/cli.js bootstrap --target /tmp/sj-precedence-... --dry-run

node dist/cli.js status --target /tmp/sj-detection-...
node dist/cli.js bootstrap --target /tmp/sj-detection-... --dry-run

npm run build
npm test
bash scripts/verify-global.sh
bash scripts/verify-global-hard.sh
git status --short --branch
```

## Pre-flight Backup and Hashes

Fresh backup snapshot:

- `~/.shrey-junior/backups/manual-20260403-000614`

Known-good backup after idempotency hardening:

- `~/.shrey-junior/backups/manual-20260403-000949`

Pre-flight hashes:

- `~/.codex/AGENTS.md`: `13def779d3b97bbf5e49a59a7b4cbb7497a544ae472af23b559edaf6dc64a750`
- `~/.claude/CLAUDE.md`: `e5f5f515c9030e973269b4cc15128f95834d5731bdde3731e69a50e6299f1992`
- `~/Library/Application Support/Code/User/prompts/shrey-junior.instructions.md`: `74f32dc2d572d09dcaf0444ced53f1d00a213f590190d74902e0a4c30c31ea0b`
- `~/Library/Application Support/Code/User/mcp.json`: `ccd376d91a60545d0dbe2f89377847d29ea93b0cbac5b650ccaa3e300708fefe`

Post-idempotency known-good hashes:

- `~/.codex/AGENTS.md`: `db30b76b89d29852a9825a52554e8dcd91a57de1ce027087c341f802a7cda4e9`
- `~/.claude/CLAUDE.md`: `352374e6037c0045e6f7fca029f5056af26305864b99a5ebea3ddd9dc34d4619`
- `~/Library/Application Support/Code/User/prompts/shrey-junior.instructions.md`: `a9c4b96d81eb5da1261919e12e33d8fdb7a36b9d253466415f8a4fa1c55da327`
- `~/Library/Application Support/Code/User/mcp.json`: `ccd376d91a60545d0dbe2f89377847d29ea93b0cbac5b650ccaa3e300708fefe`

## Idempotency Result

Changes made:

- added explicit versioned markers to Codex and Claude global preference blocks
- added explicit versioned markers to the VS Code prompt file
- added `scripts/apply-global-preferences.sh`
- added `scripts/verify-global-hard.sh`

Markers:

- `BEGIN SHREY_JUNIOR_GLOBAL_PREFS v1`
- `END SHREY_JUNIOR_GLOBAL_PREFS v1`
- `BEGIN SHREY_JUNIOR_GLOBAL_PROMPT v1`
- `END SHREY_JUNIOR_GLOBAL_PROMPT v1`

Reapply proof:

- `apply-global-preferences.sh` was run twice
- `verify-global-hard.sh` then confirmed exactly one marked block in Codex and Claude
- the prompt file existed exactly once
- `mcp.json` parsed correctly
- `restore-global.sh` was executable

Result: PASS

## Rollback Result

Rollback proof used:

- `~/.shrey-junior/backups/manual-20260403-000949`

Test mutations:

- appended `TEMP-ROLLBACK-TEST` to `~/.codex/AGENTS.md`
- appended `TEMP-ROLLBACK-TEST` to `~/.claude/CLAUDE.md`
- appended `TEMP-ROLLBACK-TEST` to `~/Library/Application Support/Code/User/prompts/shrey-junior.instructions.md`
- added `_tempRollbackTest: true` to `~/Library/Application Support/Code/User/mcp.json`

Restore proof:

- `bash scripts/restore-global.sh ~/.shrey-junior/backups/manual-20260403-000949`

Verification:

- `TEMP-ROLLBACK-TEST` absent from all restored text surfaces
- `_tempRollbackTest` absent from `mcp.json`
- post-restore hashes matched the known-good hashes captured before mutation

Result: PASS

## Repo Authority Result

Temp repos created under:

- `/tmp/sj-precedence-Dt8yDO/empty-folder`
- `/tmp/sj-precedence-Dt8yDO/repo-no-local-instructions`
- `/tmp/sj-precedence-Dt8yDO/repo-local-aligned`
- `/tmp/sj-precedence-Dt8yDO/repo-local-conflict`

Observed behavior:

- `empty-folder`: global guidance assisted normally
- `repo-no-local-instructions`: global defaults applied normally
- `repo-local-aligned`: repo-local `AGENTS.md` influenced profile selection
- `repo-local-conflict`: `status` surfaced repo-local opt-out, and `bootstrap --dry-run` stood down instead of scaffolding

Result matrix:

| Repo | Expected | Observed | Result |
|---|---|---|---|
| empty-folder | normal bootstrap guidance | normal global-default bootstrap | PASS |
| repo-no-local-instructions | normal bootstrap guidance | normal global-default bootstrap | PASS |
| repo-local-aligned | repo-local authority respected | `product-build (repo-authority)` | PASS |
| repo-local-conflict | repo-local conflict overrides global preference | bootstrap stood down with explicit warning | PASS |

## Detection Matrix

Detection test base:

- `/tmp/sj-detection-wU08Vd`

| Shape | Detected Type | Starter Specialists | Assessment |
|---|---|---|---|
| docs-only | `docs` | `docs-specialist`, `qa-specialist` | sane |
| node-app | `node` | `fullstack`, `frontend`, `qa`, `backend` | sane |
| python-repo | `python` | `python`, `backend`, `qa`, `security` | sane |
| monorepo with `apps/` + `packages/` | `node` | `fullstack`, `frontend`, `qa`, `backend` | sane |
| package-only | `node` | `fullstack`, `frontend`, `qa`, `backend` | sane |
| docker-only | `generic` | `fullstack`, `qa`, `docs` | conservative but acceptable |
| mixed docs + app | `node` | `fullstack`, `frontend`, `qa`, `backend` | sane |
| nested workspace-like repo | `node` | `fullstack`, `frontend`, `qa`, `backend` | sane |

The only detection fix needed in this pass was already applied before this matrix: obvious app monorepos are no longer misclassified as docs.

## Live Tool Behavior Result

Prompt suite used for manual evaluation:

- Prompt A: “In this repo, rename one typo in a markdown file and do not use any multi-step orchestration.”
- Prompt B: “Analyze this repo, determine likely architecture, suggest whether this should be routed through Shrey Junior orchestration, and explain which specialist modes fit best.”
- Prompt C: “Follow the best workflow for this repo.” run in the conflicting local-instruction repo.
- Prompt D: “Bootstrap a new project here using the preferred starter logic.”
- Prompt E: “Run against the remote-jobs repo.”

Environment evidence:

- Codex: partial live evidence only. This environment can verify the global Codex surface exists and is marked, but it does not give a second clean Codex runtime to replay the prompts independently.
- Claude: structural evidence only. The global Claude surface is patched and rollback-tested, but no live Claude run was executed from this environment.
- Copilot / VS Code: structural evidence only. The VS Code prompt surface exists and `mcp.json` is valid, but no live Copilot session replay was executed from this environment.

Result:

- Codex: PARTIAL
- Claude: PARTIAL
- Copilot / VS Code: PARTIAL

This phase proves the guidance surfaces and control-plane behavior, not hard runtime enforcement inside every tool UI.

## Documentation and Verification Additions

Added or updated:

- `scripts/apply-global-preferences.sh`
- `scripts/verify-global-hard.sh`
- `scripts/restore-global.sh`
- `docs/global-integration.md`
- `docs/tool-awareness.md`
- `docs/tool-global-rollbacks.md`

New guarantees documented:

- versioned global markers
- idempotent reapply path
- rollback-tested status
- explicit repo-authority opt-out behavior
- hard verification path and its interpretation

## Final Verification Status

Final verification run:

- `npm run build`: PASS
- `npm test`: PASS (31/31)
- `bash scripts/verify-global.sh`: PASS
- `bash scripts/verify-global-hard.sh`: PASS

Repo hygiene:

- machine-specific AppleDouble clutter is now ignored via `.gitignore` rule `._*`
- ignored directories such as `dist/` and `node_modules/` stay out of the commit
- no repo-local backups or secret-bearing global files are staged

## Pass / Fail Checklist

- Pre-flight snapshot captured: PASS
- Fresh backup created before mutation: PASS
- Idempotency proven: PASS
- Rollback proven: PASS
- Repo-authority precedence proven: PASS
- Detection matrix sane: PASS
- Live tool behavior fully replayed in all tools: PARTIAL
- Docs hardened: PASS
- Repo ready for local preservation commit: PASS

## Evidence Notes

- latest known-good rollback snapshot: `~/.shrey-junior/backups/manual-20260403-000949`
- final hard verification command: `bash scripts/verify-global-hard.sh`
- repo-authority conflict proof is visible directly in `status` and `bootstrap --dry-run`
- `remote-jobs` remains repo-authority-first and now detects as `node`

## Final Recommendation

Shrey Junior is ready to preserve as the current baseline for global integration hardening. The global layer is now explicit, marker-based, idempotent, rollback-tested, and subordinate to repo-local authority. The next step is to commit this repo locally and then push it to a brand new empty remote so the work is not stranded on this machine.
