<!-- SHREY-JUNIOR:FILE-START .agent/state/dispatch/README.md -->
# Dispatch Artifacts

This directory stores explicit multi-role coordination state.

Expected artifacts:

- one subdirectory per dispatch id
- `manifest.json` and `dispatch.md` inside each dispatch directory
- `results/` for role outputs
- `collect-latest.json` for collection summaries
- `latest-manifest.json`, `latest.md`, and `latest-collect.json` at the dispatch root when available

Use dispatch when planner / implementer / reviewer / tester outputs need to be coordinated through files instead of hidden memory.
<!-- SHREY-JUNIOR:FILE-END .agent/state/dispatch/README.md -->
