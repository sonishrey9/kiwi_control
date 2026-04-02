# Tool-Aware Claude Flow

1. Read repo authority, promoted docs, current phase, latest handoff, and latest reconcile.
2. Use `run` or `fanout` framing instead of rebuilding context from scratch.
3. Treat blocked reconcile or blocked policy results as mandatory gates.
4. Use `handoff` when returning work to Codex or another tool.
