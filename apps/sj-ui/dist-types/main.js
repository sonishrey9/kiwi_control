import "./styles.css";
const app = document.querySelector("#app");
if (!app) {
    throw new Error("App root not found");
}
const initialState = buildBridgeUnavailableState("");
app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <p class="eyebrow">Kiwi Control</p>
      <h1>Repo-first local control for coding agents</h1>
      <p class="lede">
        Kiwi Control reads repo-local artifacts, mirrors the CLI contract, and stays honest about what each runtime can and cannot do.
      </p>
    </header>
    <section class="control-bar">
      <label class="repo-target">
        <span>Target repo</span>
        <input id="target-root" type="text" placeholder="/path/to/repo" />
      </label>
      <button id="load-state" type="button">Load repo state</button>
      <p id="bridge-note" class="bridge-note">
        The desktop app is a local control surface. Repo-local artifacts under <code>.agent/</code> stay authoritative.
      </p>
    </section>
    <section id="repo-state-banner" class="repo-state-banner"></section>
    <section class="grid"></section>
    <footer class="footer">
      <p id="source-of-truth-note">${initialState.repoState.sourceOfTruthNote}</p>
    </footer>
  </main>
`;
const targetInput = document.querySelector("#target-root");
const loadButton = document.querySelector("#load-state");
const bridgeNote = document.querySelector("#bridge-note");
const grid = document.querySelector(".grid");
const repoStateBanner = document.querySelector("#repo-state-banner");
const sourceOfTruthNote = document.querySelector("#source-of-truth-note");
if (!targetInput || !loadButton || !bridgeNote || !grid || !repoStateBanner || !sourceOfTruthNote) {
    throw new Error("UI shell is missing required elements");
}
const gridElement = grid;
const repoStateBannerElement = repoStateBanner;
const sourceOfTruthNoteElement = sourceOfTruthNote;
renderState(initialState);
loadButton.addEventListener("click", async () => {
    const targetRoot = targetInput.value.trim();
    if (!targetRoot) {
        bridgeNote.textContent = "Enter a target repo path to load real repo-local state.";
        return;
    }
    bridgeNote.textContent = `Loading repo-local state for ${targetRoot}...`;
    const state = await loadRepoControlState(targetRoot);
    renderState(state);
    bridgeNote.textContent =
        state.repoState.mode === "bridge-unavailable"
            ? "Kiwi Control could not reach the local CLI bridge. The shell is showing a bridge-unavailable fallback instead of repo-local state."
            : `Loaded repo-local state from ${state.targetRoot}`;
});
function renderState(state) {
    gridElement.innerHTML = renderPanels(state);
    repoStateBannerElement.className = `repo-state-banner repo-state-${state.repoState.mode}`;
    repoStateBannerElement.innerHTML = `
    <p class="repo-state-kicker">Repo state</p>
    <h2>${state.repoState.title}</h2>
    <p>${state.repoState.detail}</p>
  `;
    sourceOfTruthNoteElement.textContent = state.repoState.sourceOfTruthNote;
}
function renderPanels(state) {
    return [
        renderPanel("Repo Overview", state.repoOverview),
        renderPanel("Continuity", state.continuity),
        renderPanel("Memory Bank", state.memoryBank.map((entry) => ({
            label: entry.label,
            value: `${entry.present ? "present" : "missing"} (${entry.path})`,
            ...(entry.present ? {} : { tone: "warn" })
        }))),
        renderPanel("Specialists", [
            { label: "Recommended", value: state.specialists.recommendedSpecialist },
            { label: "Targets", value: state.specialists.handoffTargets.join(", ") || "none recorded" },
            { label: "Parallel hint", value: state.specialists.safeParallelHint }
        ]),
        renderPanel("MCP Packs", [
            { label: "Suggested", value: `${state.mcpPacks.suggestedPack.id}: ${state.mcpPacks.suggestedPack.description}` },
            ...state.mcpPacks.available.slice(0, 3).map((pack) => ({
                label: pack.id,
                value: pack.realismNotes[0] ?? pack.description,
                tone: "warn"
            }))
        ]),
        renderPanel("Validation", [
            { label: "OK", value: String(state.validation.ok) },
            { label: "Errors", value: String(state.validation.errors), ...(state.validation.errors ? { tone: "warn" } : {}) },
            { label: "Warnings", value: String(state.validation.warnings), ...(state.validation.warnings ? { tone: "warn" } : {}) }
        ])
    ].join("");
}
function renderPanel(title, items) {
    return `
    <section class="panel">
      <div class="panel-header">
        <h2>${title}</h2>
      </div>
      <dl class="panel-list">
        ${items
        .map((item) => `
              <div class="panel-row ${item.tone === "warn" ? "panel-row-warn" : ""}">
                <dt>${item.label}</dt>
                <dd>${item.value}</dd>
              </div>
            `)
        .join("")}
      </dl>
    </section>
  `;
}
async function loadRepoControlState(targetRoot) {
    try {
        const { invoke } = await import("@tauri-apps/api/core");
        return await invoke("load_repo_control_state", { targetRoot });
    }
    catch {
        return buildBridgeUnavailableState(targetRoot);
    }
}
function buildBridgeUnavailableState(targetRoot) {
    const resolvedTargetRoot = targetRoot || "no target loaded";
    return {
        targetRoot: resolvedTargetRoot,
        profileName: "default",
        executionMode: "local",
        projectType: "unknown",
        repoState: {
            mode: "bridge-unavailable",
            title: "Local CLI bridge unavailable",
            detail: "Kiwi Control could not reach the local CLI bridge. Contributors should run `npm run build` and `npm run ui:dev`. Installed users should confirm `kiwi-control --help` works in a terminal, or set `KIWI_CONTROL_CLI` to the installed CLI launcher path.",
            sourceOfTruthNote: "Repo-local artifacts under .agent/ and promoted repo instruction files remain the source of truth. The desktop app never replaces that state with hidden app-owned storage."
        },
        repoOverview: [
            { label: "Project type", value: "unknown (bridge unavailable)", tone: "warn" },
            { label: "Active role", value: "none recorded" },
            { label: "Next file", value: ".agent/project.yaml" },
            { label: "Next command", value: "npm run build" },
            { label: "Validation state", value: "bridge unavailable", tone: "warn" },
            { label: "Current phase", value: "desktop setup" }
        ],
        continuity: [
            { label: "Latest checkpoint", value: "none recorded" },
            { label: "Latest handoff", value: "none recorded" },
            { label: "Latest reconcile", value: "none recorded" },
            { label: "Current focus", value: `connect the desktop bridge for ${resolvedTargetRoot}` },
            { label: "Open risks", value: "The desktop shell cannot read repo-local state until the local CLI bridge is available.", tone: "warn" }
        ],
        memoryBank: [
            { label: "Repo Facts", path: ".agent/memory/repo-facts.json", present: false },
            { label: "Architecture Decisions", path: ".agent/memory/architecture-decisions.md", present: false },
            { label: "Domain Glossary", path: ".agent/memory/domain-glossary.md", present: false },
            { label: "Known Gotchas", path: ".agent/memory/known-gotchas.md", present: false },
            { label: "Last Successful Patterns", path: ".agent/memory/last-successful-patterns.md", present: false }
        ],
        specialists: {
            recommendedSpecialist: "architecture-specialist",
            handoffTargets: ["review-specialist", "docs-specialist"],
            safeParallelHint: "Do not fan out work yet. First restore the local CLI bridge so repo-local continuity, specialists, and validation can be read from the target repo."
        },
        mcpPacks: {
            suggestedPack: {
                id: "core-pack",
                description: "Default repo-first pack for filesystem, git-aware reasoning, and contract inspection."
            },
            available: [
                {
                    id: "core-pack",
                    description: "Default repo-first pack for filesystem, git-aware reasoning, and contract inspection.",
                    realismNotes: ["Pack guidance is curated advice, not a universal runtime guarantee."]
                },
                {
                    id: "web-qa-pack",
                    description: "Browser and verification guidance for web apps, UI review, and smoke testing.",
                    realismNotes: ["Playwright MCP strength depends on the active runtime and installed tooling."]
                }
            ]
        },
        validation: {
            ok: false,
            errors: 1,
            warnings: 0
        }
    };
}
