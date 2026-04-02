# Dispatch Collect Reconcile

1. Generate or refresh the role packets:

```bash
node dist/cli.js dispatch "refactor the billing flow safely" --target "/path/to/repo" --profile strict-production --mode guarded
```

2. Let each tool or person work from the assigned packet and write a repo-local result file into the dispatch result paths.

3. Summarize what has been completed:

```bash
node dist/cli.js collect --target "/path/to/repo"
```

4. Reconcile the outputs:

```bash
node dist/cli.js reconcile --target "/path/to/repo" --profile strict-production
```

5. If the reconcile report says `ready-for-next-phase`, record a checkpoint and handoff.

6. If it says `review-required` or `blocked`, resolve the listed gaps first.
