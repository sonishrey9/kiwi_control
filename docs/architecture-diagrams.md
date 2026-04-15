# Kiwi Control Architecture Diagrams

These diagrams describe the current Kiwi Control architecture as implemented in this repository. They are intentionally repo-first: the repository owns the durable contract, the CLI and desktop app read that contract, and outside coding agents use it as structured context.

## High-Level System Flow

```mermaid
flowchart LR
    User["Developer"] --> CLI["kc / kiwi-control CLI"]
    User --> Desktop["Kiwi Control Desktop (Tauri)"]
    User --> Agent["Claude Code / Codex / Cursor / Copilot"]

    subgraph Repo["Target repository"]
        Authority["Trusted repo authority<br/>README, AGENTS.md, CLAUDE.md, Copilot instructions"]
        AgentDir[".agent/ contract<br/>project, checks, context, memory, state"]
        Source["Repo source files"]
    end

    subgraph Core["packages/sj-core"]
        Context["Context selection"]
        Intelligence["Repo intelligence<br/>graphs, impact, review packs"]
        Workflow["Workflow engine<br/>run, fanout, dispatch, reconcile"]
        Checks["Validation and push readiness"]
        Usage["Token and usage intelligence"]
    end

    subgraph CLICommands["packages/sj-cli"]
        Status["status"]
        Guide["guide"]
        Graph["graph"]
        Pack["pack"]
        Review["review"]
        Check["check"]
    end

    subgraph Runtime["Desktop/runtime surfaces"]
        Tauri["apps/sj-ui Tauri shell"]
        Bridge["runtime UI bridge"]
        Watcher["state watcher"]
    end

    CLI --> CLICommands
    CLICommands --> Core
    Core --> AgentDir
    Core --> Source
    Authority --> Core
    Desktop --> Runtime
    Runtime --> AgentDir
    Runtime --> Core
    Agent --> Authority
    Agent --> AgentDir
```

## Repo Lifecycle Flow

```mermaid
flowchart TD
    Start["Existing repo or empty folder"] --> Detect["Detect project shape and authority"]
    Detect --> InitChoice{"Initialized for Kiwi Control?"}
    InitChoice -- "No" --> Init["kc init / bootstrap"]
    InitChoice -- "Yes" --> Status["kc status"]
    Init --> Seed["Seed .agent/project.yaml, checks, context, memory, state"]
    Seed --> Status
    Status --> Guide["kc guide"]
    Guide --> GraphStatus["kc graph status"]
    GraphStatus --> GraphBuild["kc graph build"]
    GraphBuild --> Pack["kc pack status"]
    Pack --> Review["kc review"]
    Review --> Work["Agent or human implements task"]
    Work --> Check["kc check"]
    Check --> Checkpoint["kc checkpoint"]
    Checkpoint --> Handoff["kc handoff or push-check"]
```

## CLI To Core To Desktop Interaction

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant CLI as packages/sj-cli
    participant Core as packages/sj-core
    participant Repo as .agent repo state
    participant UI as apps/sj-ui
    participant Runtime as kiwi runtime bridge

    Dev->>CLI: kc status --json
    CLI->>Core: derive repo control state
    Core->>Repo: read authority, context, memory, state
    Repo-->>Core: repo-local truth
    Core-->>CLI: machine-readable JSON
    CLI-->>Dev: actionable status

    Dev->>CLI: kc ui
    CLI->>Runtime: launch or attach desktop
    Runtime->>UI: deliver active target and revision
    UI->>Repo: watch state and context
    UI-->>Dev: visual repo control surface
```

## Review, Check, Pack, And State Decision Flow

```mermaid
flowchart TD
    Task["Task or current diff"] --> Context["Context selector ranks files within a budget"]
    Context --> Graph["Repo intelligence builds repo map, dependency graph, impact map, review graph"]
    Graph --> Pack["Pack selection chooses the safest available MCP/tool guidance"]
    Graph --> Review["Review pack orders risky files and likely validations"]
    Pack --> Guide["Guide output tells the agent what to read and do next"]
    Review --> Check["Check validates repo-local contract and workflow assumptions"]
    Check --> Decision{"Ready?"}
    Decision -- "Clean enough" --> PushCheck["push-check can recommend review or push readiness"]
    Decision -- "Warnings or blockers" --> Fix["Fix repo-side issue or update checkpoint"]
    Fix --> Task
```

## Token-Efficiency Feedback Loop

```mermaid
flowchart LR
    Repo["Repo files and authority"] --> Select["Selective context and graph packs"]
    Select --> Agent["Coding agent receives narrower repo context"]
    Agent --> Work["Implementation / review loop"]
    Work --> Usage["Measured or estimated usage signals"]
    Usage --> Feedback["Context feedback and token intelligence"]
    Feedback --> Select
```

This loop does not guarantee savings. It is the architecture that makes lower waste plausible: better repo awareness, fewer broad reads, smaller context packs, and review surfaces that point agents at the files most likely to matter.
