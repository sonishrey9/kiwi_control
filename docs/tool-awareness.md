# Tool Awareness

`shrey-junior` is not only a repo-local compiler. It is also the workflow model that Codex, Claude Code, and GitHub Copilot should follow inside repos that opt into it.

For a brand new folder or repo that has not opted in yet, bootstrap first. After the global integration phase, the preferred entry point is the globally callable `shrey-junior` launcher rather than a repo-local path.

This preference layer now exists both:

- globally through lightweight Codex / Claude / VS Code guidance surfaces
- locally through repo overlays and `.agent/*` state

## Authority first

For all tools:

1. existing trusted repo authority files already in the repo
2. promoted canonical docs explicitly referenced by those files
3. generated Shrey Junior overlays
4. `.agent/context/*`
5. fallback templates

Generated overlays are supporting control-plane outputs. They are not permission to ignore real repo truth.

If repo-local authority explicitly opts out of Shrey Junior routing or specialist escalation, that repo-local instruction wins. Global preference layers should then stand down and behave as advisory context only.

## Trivial vs non-trivial

Trivial work may stay direct when it is:

- typo or wording fix
- formatting-only adjustment
- one-line or one-file local fix
- clearly low-risk
- not contract, auth, data, security, release, or multi-file sensitive

Non-trivial work should use the control plane when it is:

- multi-file
- cross-cutting
- contract or interface changing
- auth, data, security, or release sensitive
- guarded
- better served by reviewer/tester separation

## Workflow escalation

- `run`: non-trivial single-owner work
- `fanout`: guarded or role-separated work
- `dispatch` + `collect` + `reconcile`: controlled simultaneous small-role work
- `checkpoint` + `handoff`: cross-tool continuity
- `push-check`: non-trivial or guarded push awareness
- `release-check` / `phase-close`: late-phase review, release, or closure boundaries
- `bootstrap`: first-run onboarding for an empty folder, existing project, or existing repo

## Tool expectations

### Codex

- if the folder is not initialized yet, prefer `bootstrap` before medium/high-complexity work
- use repo authority, promoted docs, current phase, latest handoff, and latest reconcile before medium/high complexity work
- stay direct only for truly trivial edits
- escalate to packets or coordination when work stops being local and low-risk

### Claude Code

- if the repo lacks `.agent/project.yaml` and native overlays, prefer `bootstrap` first
- treat repo authority and promoted docs as mandatory early context
- treat blocked policy or blocked reconcile state as a real gate, not advisory text
- prefer continuity artifacts before reconstructing context from scratch

### GitHub Copilot

- assume `bootstrap` or `sync` should establish repo-local guidance before non-trivial work in a fresh folder
- treat this repo as instruction-governed by Shrey Junior
- align suggestions with packets, checks, and profile boundaries
- avoid generic multi-file or contract-sensitive suggestions without packet-driven framing

## Proof limits

The global tool integration is guidance-first.

- it can strongly shape prompts, overlays, and visible workflow instructions
- it can prove idempotency, rollback, and repo-authority precedence through the Shrey Junior scripts
- it does not guarantee that every tool runtime will enforce those preferences without the surrounding repo-local artifacts

## Specialists and MCP

- prefer specialist-aware routing when a task clearly maps to python, QA, security, docs, refactor, or push/release work
- MCP usage is policy-driven by capability, trust, profile, specialist, and approval rules
- do not call MCP tools simply because they are available
