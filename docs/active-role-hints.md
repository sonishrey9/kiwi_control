# Active Role Hints

## Purpose

`.agent/state/active-role-hints.json` is the repo-local “open this first” state file for cooperative runtimes.

It exists so an agent does not need to infer the current lead role from:

- packet folders
- current phase
- handoff
- dispatch
- reconcile

## Artifact

Path:

- `.agent/state/active-role-hints.json`

Fields:

- `artifactType`
- `version`
- `updatedAt`
- `activeRole`
- `supportingRoles`
- `authoritySource`
- `projectType`
- `readNext`
- `writeTargets`
- `checksToRun`
- `stopConditions`
- `nextAction`
- `searchGuidance`
- `latestTaskPacket`
- `latestHandoff`
- `latestDispatchManifest`
- `latestReconcile`

## Update Rules

- bootstrap seeds the file from project type and starter specialist selection
- `run` updates the active role and latest task packet pointer
- `fanout` updates the active role to the planner specialist and records supporting role specialists
- `dispatch` updates the active role, supporting roles, latest task packet pointer, and latest dispatch manifest pointer
- `handoff` updates the latest handoff pointer
- `reconcile` updates the latest reconcile pointer
- `checkpoint` refreshes source and project metadata if needed

## Interpretation

- `activeRole` is the current lead specialist contract for the next cooperative tool to read first
- `supportingRoles` are additional likely specialist contracts for the same phase
- `readNext` is the shortest safe file list to open before deeper exploration
- `writeTargets` narrows the expected output area for the current step
- `checksToRun` makes the relevant validation path obvious
- `stopConditions` mark when the current actor should pause instead of improvising
- `nextAction` gives one plain-language next move for the current role
- `searchGuidance` reduces wasteful external lookup and clarifies when docs or internet search are justified
- `latest*` fields point to the stable latest-pointer artifacts when those artifacts exist

## Proven

- bootstrap writes the seeded artifact
- runtime commands keep the artifact updated
- `status` now surfaces the active role hints directly, including next action, read-next files, checks, and write targets
- validation fails when the file is missing in an initialized repo or when its latest pointers are stale

## Limit

This file improves portability and continuity. It does not guarantee that every tool runtime will choose to obey it.
