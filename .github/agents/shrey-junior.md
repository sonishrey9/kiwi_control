<!-- SHREY-JUNIOR:FILE-START .github/agents/shrey-junior.md -->
# Shrey Junior Repo Agent Contract

This repository uses Shrey Junior as the portable repo-local control plane.

Use this order of truth:

1. existing trusted repo authority files
2. promoted repo-local canonical docs explicitly referenced by that authority
3. `.agent/state/active-role-hints.json`
4. `.agent/state/current-phase.json`
5. latest task packet, latest handoff, latest reconcile, latest dispatch manifest
6. relevant `.github/instructions/*.instructions.md`
7. relevant `.github/agents/*.md` and `.agent/roles/*.md`
8. `.agent/checks.yaml` and `.agent/scripts/verify-contract.sh`
9. `.agent/project.yaml`
10. generated overlays and supporting instructions

Do not assume:

- machine-local prompts are portable
- cloud-hosted runtimes can see `~/.codex`, `~/.claude`, or editor-local files
- generic MCP availability implies permission to use an MCP
- a hosted runtime can invoke the local CLI even when it can read the repo

Use direct work only for clearly trivial changes.
Use `run`, `fanout`, or `dispatch` for non-trivial work.
Use `checkpoint`, `handoff`, `collect`, `reconcile`, and `push-check` to preserve continuity and trust.
<!-- SHREY-JUNIOR:FILE-END .github/agents/shrey-junior.md -->
