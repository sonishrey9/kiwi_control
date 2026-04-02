# MCP Inventory

Machine inventory captured safely on 2026-04-02 using metadata and config structure only.

## Active config surfaces

- Codex: `/Users/shreysoni/.codex/config.toml`
- Claude ECC: `/Users/shreysoni/.claude/ecc/mcp-configs/mcp-servers.json`
- Claude global settings: `/Users/shreysoni/.claude/settings.json`
- VS Code user MCP file: `/Users/shreysoni/Library/Application Support/Code/User/mcp.json`

## Findings

### Codex-configured MCPs

Configured in `~/.codex/config.toml` by section name:

- `memory`
- `sequential-thinking`
- `context7`
- `cloudflare-docs`
- `filesystem`
- `figma`
- `posthog`
- `atlassian-rovo`
- `brave-search`
- `exa`
- `tavily`
- `perplexity`
- `firecrawl`
- `postgres`
- `sqlite`
- `duckdb`
- `redis`
- `neon`
- `supabase`
- `upstash`
- `qdrant`
- `chroma`
- `aws-docs`
- `aws-cdk`
- `aws-cloudwatch`
- `aws-lambda`
- `aws-dynamodb`
- `aws-cost-explorer`
- `aws-ecs`
- `aws-terraform`
- `aws-nova-canvas`
- `docker`
- `kubernetes`
- `vercel`
- `sentry`
- `datadog`
- `axiom`
- `semgrep`
- `github`
- `linear`
- `slack`
- `notion`
- `gdrive`

### Claude ECC-configured MCPs

Configured in `~/.claude/ecc/mcp-configs/mcp-servers.json` by server name:

- `browser-use`
- `browserbase`
- `clickhouse`
- `cloudflare-docs`
- `cloudflare-observability`
- `cloudflare-workers-bindings`
- `cloudflare-workers-builds`
- `confluence`
- `context7`
- `exa-web-search`
- `fal-ai`
- `filesystem`
- `firecrawl`
- `github`
- `insaits`
- `magic`
- `memory`
- `playwright`
- `railway`
- `sequential-thinking`
- `supabase`
- `token-optimizer`
- `vercel`

### VS Code MCP

- `~/Library/Application Support/Code/User/mcp.json` exists
- current state appears inactive or malformed for JSON parsing
- no trusted server inventory could be derived from it safely

## Canonical registry status

Before this phase, Shrey Junior only tracked a narrow subset of six MCPs.
After hardening, the canonical registry includes the core engineering set:

- `context7`
- `memory`
- `sequential-thinking`
- `filesystem`
- `github`
- `playwright`
- `exa`
- `firecrawl`
- `brave-search`
- `docker`
- `figma`
- `supabase`
- `cloudflare-docs`

## Relevance by workflow

- App / web development: `filesystem`, `github`, `playwright`, `figma`, `docker`, `context7`, `cloudflare-docs`
- Python / backend: `filesystem`, `github`, `context7`, `docker`, `supabase`
- QA / testing: `playwright`, `github`, `context7`
- Docs / research: `context7`, `exa`, `firecrawl`, `brave-search`, `cloudflare-docs`
- Git / release: `github`, `playwright`, `context7`
- Browser / web tooling: `playwright`, `firecrawl`, `figma`, `cloudflare-docs`
- Filesystem / project analysis: `filesystem`, `github`, `memory`, `sequential-thinking`

## Redundancies

- `context7`, `filesystem`, `firecrawl`, `github`, `memory`, and `sequential-thinking` appear in both Codex and Claude surfaces
- `playwright` is present in Claude ECC but not in the current VS Code surface
- search tooling is split across `brave-search`, `exa`, `tavily`, `perplexity`, and `firecrawl`

## Recommended canonical vs reference-only split

Should be in Shrey Junior canonical registry:

- `context7`
- `filesystem`
- `github`
- `playwright`
- `exa`
- `firecrawl`
- `brave-search`
- `docker`
- `figma`
- `supabase`
- `cloudflare-docs`
- `sequential-thinking`

Should remain reference-only by default:

- `memory`
- hosted observability or release systems like `sentry`, `datadog`, `vercel`, `railway`
- project-management or comms tools like `linear`, `slack`, `notion`, `confluence`
- direct database/vector stores such as `postgres`, `sqlite`, `duckdb`, `redis`, `qdrant`, `chroma`

Those can be added later when a repo explicitly needs them.
