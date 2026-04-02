# Bootstrap Empty Folder

```bash
mkdir -p /tmp/new-service
node dist/cli.js bootstrap --target "/tmp/new-service" --dry-run
node dist/cli.js bootstrap --target "/tmp/new-service" --profile product-build
node dist/cli.js status --target "/tmp/new-service"
```

Use this when you want a brand new folder to start with repo-local overlays, starter context, and a selected profile without touching any global tool config.
