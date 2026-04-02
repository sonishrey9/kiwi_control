# New Repo Flow

1. Run `node dist/cli.js init --target "/path/to/repo" --profile product-build`.
2. Fill in `.agent/context/architecture.md`, `.agent/context/conventions.md`, and `.agent/context/runbooks.md`.
3. Run `node dist/cli.js check --target "/path/to/repo" --profile product-build`.
4. Generate packets with `run` or `fanout`.
