import "./styles.css";
const demoState = {
    repoOverview: [
        { label: "Project type", value: "node" },
        { label: "Active role", value: "fullstack-specialist" },
        { label: "Next file", value: ".agent/context/architecture.md" },
        { label: "Next command", value: "shrey-junior checkpoint \"beta package split\" --target <repo>" },
        { label: "Validation", value: "warnings only", tone: "warn" },
        { label: "Current phase", value: "package extraction" }
    ],
    continuity: [
        { label: "Latest checkpoint", value: "package split / in-progress" },
        { label: "Latest handoff", value: "review-specialist -> qa-specialist" },
        { label: "Latest reconcile", value: "dispatch-2026-04-03 / aligned" },
        { label: "Current focus", value: "ship workspace split without breaking repo-local truth" },
        { label: "Open risks", value: "desktop bridge still uses scaffold data", tone: "warn" }
    ],
    memoryBank: [
        { label: "Repo facts", path: ".agent/memory/repo-facts.json", present: true },
        { label: "Architecture decisions", path: ".agent/memory/architecture-decisions.md", present: true },
        { label: "Glossary", path: ".agent/memory/domain-glossary.md", present: true },
        { label: "Known gotchas", path: ".agent/memory/known-gotchas.md", present: true },
        { label: "Successful patterns", path: ".agent/memory/last-successful-patterns.md", present: true }
    ],
    specialists: {
        recommendedSpecialist: "review-specialist",
        handoffTargets: ["qa-specialist", "docs-specialist"],
        safeParallelHint: "split by disjoint file ownership"
    },
    mcpPacks: {
        suggestedPack: {
            id: "web-qa-pack",
            description: "Browser and verification guidance for web apps, UI review, and smoke testing."
        },
        available: [
            {
                id: "core-pack",
                description: "Default repo-first pack for filesystem, git-aware reasoning, and contract inspection.",
                realismNotes: ["Pack guidance is curated advice, not a universal runtime guarantee"]
            },
            {
                id: "web-qa-pack",
                description: "Browser and verification guidance for web apps, UI review, and smoke testing.",
                realismNotes: ["Playwright MCP strength depends on the active runtime and installed tooling"]
            }
        ]
    },
    validation: {
        ok: true,
        errors: 0,
        warnings: 1
    }
};
const app = document.querySelector("#app");
if (!app) {
    throw new Error("App root not found");
}
app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <p class="eyebrow">Shrey Junior</p>
      <h1>Repo-first local control for coding agents</h1>
      <p class="lede">
        The desktop shell reads repo-local artifacts, mirrors the CLI contract, and stays honest about what each runtime can and cannot do.
      </p>
    </header>
    <section class="control-bar">
      <label class="repo-target">
        <span>Target repo</span>
        <input id="target-root" type="text" placeholder="/path/to/repo" />
      </label>
      <button id="load-state" type="button">Load repo state</button>
      <p id="bridge-note" class="bridge-note">Desktop bridge not detected. Showing scaffold data.</p>
    </section>
    <section class="grid">
      ${renderPanels(demoState)}
    </section>
    <footer class="footer">
      <p>This shell is designed to consume repo-local artifacts and a thin local backend. It must never replace repo-local truth with hidden app state.</p>
    </footer>
  </main>
`;
const targetInput = document.querySelector("#target-root");
const loadButton = document.querySelector("#load-state");
const bridgeNote = document.querySelector("#bridge-note");
const grid = document.querySelector(".grid");
if (!targetInput || !loadButton || !bridgeNote || !grid) {
    throw new Error("UI shell is missing required elements");
}
loadButton.addEventListener("click", async () => {
    const targetRoot = targetInput.value.trim();
    if (!targetRoot) {
        bridgeNote.textContent = "Enter a target repo path to load real repo-local state.";
        return;
    }
    const state = await loadRepoControlState(targetRoot);
    grid.innerHTML = renderPanels(state);
    bridgeNote.textContent = isDemoState(state)
        ? "Desktop bridge unavailable. Showing scaffold data until the local bridge is active."
        : `Loaded repo-local state from ${targetRoot}`;
});
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
        return demoState;
    }
}
function isDemoState(state) {
    return state.continuity.some((item) => item.value.includes("desktop bridge still uses scaffold data"));
}
