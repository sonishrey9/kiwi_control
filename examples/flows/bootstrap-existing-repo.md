# Bootstrap Existing Repo

```bash
node dist/cli.js bootstrap --target "/path/to/repo" --dry-run
node dist/cli.js bootstrap --target "/path/to/repo"
node dist/cli.js check --target "/path/to/repo"
```

Use this when the repo already has real authority files and you want Shrey Junior to append repo-local overlays safely instead of overwriting handwritten guidance.
