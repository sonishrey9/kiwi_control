# Repo-First Upgrade Closeout

## Purpose

This document records the final productization pass that moved Shrey Junior toward a repo-first, cloud-portable orchestration contract.

## Scope

- portable repo contract generation
- Copilot-native repo surfaces
- repo-local specialist role specs
- latest continuity pointer artifacts
- `standardize` support for existing repos
- CI contract verification template
- architecture and portability documentation

## Verification Checklist

- [x] `npm run build`
- [x] `npm test`
- [x] `bash scripts/verify-global.sh`
- [x] `bash scripts/verify-global-hard.sh`
- [x] repo-local `check` pass in the control-plane repo
- [x] fresh repo bootstrap proof
- [x] existing repo standardize proof
- [x] repo-authority conflict stand-down proof
- [x] selective contract generation proof
- [x] active-role-hints proof
- [x] stronger stale-pointer validation proof
- [x] first-read contract proof
- [x] machine-global accelerator deferral proof

## Commands Run

```bash
npm run build
npm test
bash scripts/verify-global.sh
bash scripts/verify-global-hard.sh
shrey-junior check
node dist/cli.js standardize --target "/Volumes/shrey ssd/shrey-junior/examples/sample-project" --dry-run
```

## Results

- `npm run build`: PASS
- `npm test`: PASS, 41/41 tests green
- `verify-global.sh`: PASS, including `check passed`, a bootstrap dry-run that previews the minimized portable repo contract, and a sequential rerun after rebuild showing `selected profile: product-build (global-accelerator)` through the PATH launcher
- `verify-global-hard.sh`: PASS, including versioned global marker counts, MCP JSON parse, Codex config marker validation, Claude settings validation, helper command validation, and restore script executability
- `shrey-junior check`: PASS in the control-plane repo itself
- `standardize --dry-run` on `examples/sample-project`: PASS, preserved `product-build (repo-authority)` and previewed the new role specs, Copilot surfaces, state directories, and CI contract workflow
- selective generation: PASS, including python and docs repo fixtures that no longer seed irrelevant frontend or backend instruction authority
- active-role hints: PASS, including bootstrap seed plus runtime pointer updates for task packets, handoff, dispatch, reconcile, next reads, checks, and next action
- stale-pointer validation: PASS, including a failing test when `active-role-hints.json` references missing artifacts
- CI push gate parity: PASS, with `.agent/scripts/verify-contract.sh` enforcing the portable artifact-backed gate and opportunistically running `shrey-junior push-check` when the CLI is available
- repo-facing instruction templates: PASS, now explicitly direct cooperative tools to read `.agent/state/active-role-hints.json` early for current role focus and latest continuity pointers
- first-read contract: PASS, with repo templates, active-role hints, packets, and machine-global accelerators all pointing tools to the same shortest repo-local read path
- machine-global accelerators: PASS, now covering Codex config, Claude settings, and Claude helper commands while explicitly deferring to repo-local truth
- control-plane validator coverage: PASS, now requiring the new minimization and active-role-hints architecture docs in addition to the portable contract templates and scripts

## Proven In This Pass

- bootstrap installs the expanded portable repo contract
- standardize upgrades an existing repo and can back up touched files
- bootstrap and standardize now generate a minimized contract instead of a maximal specialist and instruction dump
- specialist role specs and Copilot-friendly agent docs are generated repo-locally
- active-role-hints gives cooperative runtimes one repo-local file to read first for current role and latest pointers
- active-role-hints now also gives the next read set, checks to run, search guidance, stop conditions, and next action
- latest continuity pointers for handoff, dispatch, reconcile, and task packets are written in stable locations
- repo-local contract validation covers the expanded surfaces
- repo-local CI verification now enforces behavioral state constraints, not just existence
- repo-local CI verification now acts as a portable push gate and also runs `push-check` when the CLI is available
- repo-facing tool instructions now point agents at `active-role-hints.json` as the shortest repo-local continuity read
- machine-global accelerators now reinforce the same first-read contract instead of acting like an independent authority layer
- control-plane validation now guards the new architecture docs that explain contract minimization and active-role hints
- global accelerator scripts still verify cleanly after the repo-first upgrade
- runtime profile resolution now prefers explicit repo authority over generated overlay metadata
- sync now preserves repo-authority precedence, carries accurate project metadata forward, and stands down on explicit repo-local opt-out

## Structurally Supported But Not Fully Proven

- Copilot-like runtimes honoring `.github/instructions/*.instructions.md` and `.github/agents/*.md` consistently
- Claude-style runtimes treating `.agent/roles/*.md` as first-class role contracts without extra prompting
- cloud-hosted agents following the repo contract with the same fidelity as local agents

## Remaining Limits

- repo-local artifacts are portable, but they are not universal runtime enforcement
- machine-global accelerators are still machine-scoped
- Copilot and cloud-hosted runtimes can still ignore repo-local hints even when those hints are well-formed
- CI is the hard backstop where prompts and overlays are insufficient

## Audit Follow-Up

Critical issues found and fixed:

1. Runtime authority precedence was not truly repo-first outside bootstrap.
   - Fixed by reordering authority resolution and teaching runtime profile selection to inspect explicit repo authority before trusting generated overlay metadata.
2. `sync` and `init` could rewrite repo contract metadata using generic placeholder context.
   - Fixed by routing those commands through the same richer bootstrap-context preparation used by bootstrap itself.
3. `sync` did not preserve repo-authority opt-out.
   - Fixed by making `sync` stand down when repo authority explicitly requests repo-local-only behavior.
4. `check --target` only warned about missing required repo-contract files even after a repo was already initialized.
   - Fixed by promoting missing required contract files to hard errors for initialized repos and adding a test that proves the failure mode.

## Daily-Workflow Audit Follow-Up

Critical issue found and fixed:

1. The claimed first-read contract and the generated runtime artifacts had drifted apart.
   - `active-role-hints.json` was documented as the first repo-local read, but bootstrap summaries, task packet `read_first` data, and dispatch/handoff read-first lists still skipped it or used a narrower contract.
   - Fixed by separating the full repo read order from the post-hint `readNext` list, then wiring the full first-read contract into bootstrap summaries, packets, dispatch manifests, and handoff artifacts.
   - Additional packet cleanup removed duplicated continuity and validation sections so the packets got more useful instead of just longer.

Additional realism fixes applied during the same audit:

- Copilot-facing templates now say MCP eligibility is repo metadata, not proof that Copilot can invoke MCP tools directly.
- The new first-read contract is now command-backed in `verify-global.sh`, which shows `.agent/state/active-role-hints.json` at the front of the previewed read path.
