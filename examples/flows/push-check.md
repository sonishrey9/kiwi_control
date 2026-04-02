# Push Check

Use `push-check` only after a meaningful checkpoint exists.

```bash
node dist/cli.js push-check --target "/path/to/repo"
```

What it tells you:

- current branch
- staged / unstaged / untracked counts
- whether the latest checkpoint was complete
- whether validations were recorded
- whether warnings or open issues remain
- whether the repo looks push-ready, review-needed, blocked, or not applicable

What it does not do:

- commit changes
- push a branch
- mutate git state
