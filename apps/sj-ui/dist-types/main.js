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
        Kiwi Control reads repo-local artifacts directly, mirrors the CLI contract, and keeps the current repo obvious from the moment the desktop app opens.
      </p>
    </header>
    <section class="control-bar">
      <div class="active-target">
        <span>Active repo</span>
        <strong id="active-target-root">No repo loaded yet</strong>
        <p id="active-target-hint">Run <code>kc ui</code> inside a repo to load it automatically.</p>
      </div>
      <label class="repo-target">
        <span>Switch repo manually (optional)</span>
        <input id="target-root" type="text" placeholder="/path/to/another/repo" />
      </label>
      <button id="load-state" type="button">Load another repo</button>
      <p id="bridge-note" class="bridge-note">
        Kiwi Control reads repo-local artifacts directly. The desktop app is a control surface, never the source of truth.
      </p>
    </section>
    <section id="repo-state-banner" class="repo-state-banner"></section>
    <section class="grid"></section>
    <footer class="footer">
      <p id="source-of-truth-note">${escapeHtml(initialState.repoState.sourceOfTruthNote)}</p>
    </footer>
  </main>
`;
const activeTargetRoot = document.querySelector("#active-target-root");
const activeTargetHint = document.querySelector("#active-target-hint");
const targetInput = document.querySelector("#target-root");
const loadButton = document.querySelector("#load-state");
const bridgeNote = document.querySelector("#bridge-note");
const grid = document.querySelector(".grid");
const repoStateBanner = document.querySelector("#repo-state-banner");
const sourceOfTruthNote = document.querySelector("#source-of-truth-note");
if (!activeTargetRoot || !activeTargetHint || !targetInput || !loadButton || !bridgeNote || !grid || !repoStateBanner || !sourceOfTruthNote) {
    throw new Error("UI shell is missing required elements");
}
const activeTargetRootElement = activeTargetRoot;
const activeTargetHintElement = activeTargetHint;
const targetInputElement = targetInput;
const loadButtonElement = loadButton;
const bridgeNoteElement = bridgeNote;
const gridElement = grid;
const repoStateBannerElement = repoStateBanner;
const sourceOfTruthNoteElement = sourceOfTruthNote;
let currentTargetRoot = "";
let isLoadingRepoState = false;
renderState(initialState);
bridgeNoteElement.textContent = buildBridgeNote(initialState, "shell");
loadButtonElement.addEventListener("click", () => {
    const targetRoot = targetInputElement.value.trim();
    if (!targetRoot) {
        bridgeNoteElement.textContent = "Enter a repo path only if you want to switch away from the current repo.";
        return;
    }
    void loadAndRenderTarget(targetRoot, "manual");
});
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        void syncLaunchRequest();
    }
});
window.setInterval(() => {
    void syncLaunchRequest();
}, 1500);
void boot();
async function boot() {
    await syncLaunchRequest();
}
async function syncLaunchRequest() {
    if (isLoadingRepoState) {
        return;
    }
    const targetRoot = await consumeLaunchTargetRoot();
    if (!targetRoot || targetRoot === currentTargetRoot) {
        return;
    }
    await loadAndRenderTarget(targetRoot, "cli");
}
async function loadAndRenderTarget(targetRoot, source) {
    isLoadingRepoState = true;
    currentTargetRoot = targetRoot;
    targetInputElement.value = targetRoot;
    bridgeNoteElement.textContent =
        source === "cli" ? `Loading ${targetRoot} from the CLI...` : `Loading repo-local state for ${targetRoot}...`;
    const state = await loadRepoControlState(targetRoot);
    currentTargetRoot = state.targetRoot || targetRoot;
    renderState(state);
    targetInputElement.value = state.targetRoot || targetRoot;
    bridgeNoteElement.textContent = buildBridgeNote(state, source);
    isLoadingRepoState = false;
}
function renderState(state) {
    const resolvedTargetRoot = state.targetRoot || "No repo loaded yet";
    activeTargetRootElement.textContent = resolvedTargetRoot;
    activeTargetHintElement.textContent = buildActiveTargetHint(state);
    gridElement.innerHTML = renderPanels(state);
    repoStateBannerElement.className = `repo-state-banner repo-state-${state.repoState.mode}`;
    repoStateBannerElement.innerHTML = `
    <p class="repo-state-kicker">Repo state</p>
    <h2>${escapeHtml(state.repoState.title)}</h2>
    <p>${escapeHtml(state.repoState.detail)}</p>
  `;
    sourceOfTruthNoteElement.textContent = state.repoState.sourceOfTruthNote;
}
function buildActiveTargetHint(state) {
    if (!state.targetRoot) {
        return "Run kc ui inside a repo to load it automatically, or switch repos below.";
    }
    switch (state.repoState.mode) {
        case "healthy":
            return "Repo-local state is loaded and ready. Switch repos only if you want a different folder.";
        case "repo-not-initialized":
            return "This folder is not initialized yet. Run kc init in a terminal when you want to standardize it.";
        case "initialized-invalid":
            return "This repo needs attention before continuity is fully trustworthy.";
        case "initialized-with-warnings":
            return "This repo is usable now, with a few warnings still worth addressing.";
        case "bridge-unavailable":
        default:
            return "Automatic loading did not complete for this repo yet.";
    }
}
function buildBridgeNote(state, source) {
    if (!state.targetRoot) {
        return "Run kc ui inside a repo to load it automatically, or switch repos below.";
    }
    if (state.repoState.mode === "bridge-unavailable") {
        return "Kiwi Control could not load this repo automatically. Confirm kiwi-control works in Terminal, then run kc ui again.";
    }
    if (source === "cli") {
        return `Loaded repo-local state for ${state.targetRoot} from the CLI. Use the switch repo field only if you want a different folder.`;
    }
    if (source === "manual") {
        return `Loaded repo-local state for ${state.targetRoot}. Use the switch repo field only when you want to move to another repo.`;
    }
    return `Repo-local state for ${state.targetRoot} is ready.`;
}
function renderPanels(state) {
    return [
        renderPanel("Repo Overview", [
            { label: "Repo", value: state.targetRoot || "No repo loaded yet", ...(state.targetRoot ? {} : { tone: "warn" }) },
            ...state.repoOverview
        ]),
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
        <h2>${escapeHtml(title)}</h2>
      </div>
      <dl class="panel-list">
        ${items
        .map((item) => `
              <div class="panel-row ${item.tone === "warn" ? "panel-row-warn" : ""}">
                <dt>${escapeHtml(item.label)}</dt>
                <dd>${escapeHtml(item.value)}</dd>
              </div>
            `)
        .join("")}
      </dl>
    </section>
  `;
}
async function consumeLaunchTargetRoot() {
    try {
        const { invoke } = await import("@tauri-apps/api/core");
        return await invoke("consume_launch_target_root");
    }
    catch {
        return null;
    }
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
    const hasTargetRoot = targetRoot.trim().length > 0;
    const resolvedTargetRoot = hasTargetRoot ? targetRoot : "";
    return {
        targetRoot: resolvedTargetRoot,
        profileName: "default",
        executionMode: "local",
        projectType: "unknown",
        repoState: {
            mode: "bridge-unavailable",
            title: hasTargetRoot ? "Could not load this repo yet" : "Open a repo",
            detail: hasTargetRoot
                ? "Kiwi Control could not read repo-local state for this folder yet. Confirm kiwi-control works in Terminal, then run kc ui again."
                : "Run kc ui inside a repo to load it automatically, or switch repos manually below.",
            sourceOfTruthNote: "Repo-local artifacts under .agent/ and promoted repo instruction files remain the source of truth. The desktop app never replaces that state with hidden app-owned storage."
        },
        repoOverview: [
            {
                label: "Project type",
                value: hasTargetRoot ? "unknown (awaiting repo bridge)" : "no repo loaded",
                ...(hasTargetRoot ? { tone: "warn" } : {})
            },
            { label: "Active role", value: "none recorded" },
            { label: "Next file", value: hasTargetRoot ? ".agent/project.yaml" : "run kc ui inside a repo" },
            { label: "Next command", value: hasTargetRoot ? "kc ui" : "kc init" },
            {
                label: "Validation state",
                value: hasTargetRoot ? "bridge unavailable" : "waiting for repo",
                ...(hasTargetRoot ? { tone: "warn" } : {})
            },
            { label: "Current phase", value: hasTargetRoot ? "restore repo bridge" : "load a repo" }
        ],
        continuity: [
            { label: "Latest checkpoint", value: "none recorded" },
            { label: "Latest handoff", value: "none recorded" },
            { label: "Latest reconcile", value: "none recorded" },
            {
                label: "Current focus",
                value: hasTargetRoot ? `reload repo-local state for ${resolvedTargetRoot}` : "open a repo from the CLI or switch repo manually"
            },
            {
                label: "Open risks",
                value: hasTargetRoot
                    ? "Kiwi Control cannot read repo-local state for this folder yet."
                    : "No repo is loaded yet, so continuity and validation are still waiting on a target folder.",
                tone: "warn"
            }
        ],
        memoryBank: [
            { label: "Repo Facts", path: ".agent/memory/repo-facts.json", present: false },
            { label: "Architecture Decisions", path: ".agent/memory/architecture-decisions.md", present: false },
            { label: "Domain Glossary", path: ".agent/memory/domain-glossary.md", present: false },
            { label: "Known Gotchas", path: ".agent/memory/known-gotchas.md", present: false },
            { label: "Last Successful Patterns", path: ".agent/memory/last-successful-patterns.md", present: false }
        ],
        specialists: {
            recommendedSpecialist: "review-specialist",
            handoffTargets: ["qa-specialist", "docs-specialist"],
            safeParallelHint: "Restore repo-local visibility first. Once Kiwi Control can read the repo again, continuity, specialists, and validation will update automatically."
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
            errors: hasTargetRoot ? 1 : 0,
            warnings: hasTargetRoot ? 0 : 1
        }
    };
}
function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
