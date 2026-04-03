import "./styles.css";

type PanelItem = {
  label: string;
  value: string;
  tone?: "default" | "warn";
};

type RepoControlMode =
  | "bridge-unavailable"
  | "repo-not-initialized"
  | "initialized-invalid"
  | "initialized-with-warnings"
  | "healthy";

type RepoControlState = {
  targetRoot: string;
  profileName: string;
  executionMode: string;
  projectType: string;
  repoState: {
    mode: RepoControlMode;
    title: string;
    detail: string;
    sourceOfTruthNote: string;
  };
  repoOverview: PanelItem[];
  continuity: PanelItem[];
  memoryBank: Array<{ label: string; path: string; present: boolean }>;
  specialists: {
    recommendedSpecialist: string;
    available?: Array<{ specialistId: string; displayName?: string }>;
    handoffTargets: string[];
    safeParallelHint: string;
  };
  mcpPacks: {
    suggestedPack: { id: string; description: string };
    available: Array<{ id: string; description: string; realismNotes: string[] }>;
  };
  validation: {
    ok: boolean;
    errors: number;
    warnings: number;
  };
};

type LaunchRequestPayload = {
  requestId: string;
  targetRoot: string;
};

const BRIDGE_UNAVAILABLE_NEXT_STEP = "Confirm kiwi-control works in Terminal, then run kc ui again.";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

const initialState = buildBridgeUnavailableState("");

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <p class="eyebrow">Kiwi Control</p>
      <h1>The current repo, already in view.</h1>
      <p class="lede">
        Launch from Terminal with <code>kc ui</code>. Kiwi Control opens, comes forward, and reads the repo you are standing in without moving authority out of the repo.
      </p>
    </header>
    <section class="control-bar">
      <div class="active-target">
        <span>Active repo</span>
        <strong id="active-target-root">No repo loaded yet</strong>
        <p id="active-target-hint">Run <code>kc ui</code> inside a repo to load it automatically.</p>
      </div>
      <details class="manual-switcher">
        <summary>Load another repo</summary>
        <div class="manual-switcher-body">
          <label class="repo-target">
            <span>Repo path</span>
            <input id="target-root" type="text" placeholder="/path/to/another/repo" />
          </label>
          <button id="load-state" type="button">Load another repo</button>
        </div>
      </details>
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

const activeTargetRoot = document.querySelector<HTMLElement>("#active-target-root");
const activeTargetHint = document.querySelector<HTMLParagraphElement>("#active-target-hint");
const targetInput = document.querySelector<HTMLInputElement>("#target-root");
const loadButton = document.querySelector<HTMLButtonElement>("#load-state");
const bridgeNote = document.querySelector<HTMLParagraphElement>("#bridge-note");
const grid = document.querySelector<HTMLElement>(".grid");
const repoStateBanner = document.querySelector<HTMLElement>("#repo-state-banner");
const sourceOfTruthNote = document.querySelector<HTMLElement>("#source-of-truth-note");

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
let queuedLaunchRequest: LaunchRequestPayload | null = null;

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

void boot();

async function boot(): Promise<void> {
  await registerLaunchRequestListener();

  const initialLaunchRequest = await consumeInitialLaunchRequest();
  if (initialLaunchRequest) {
    await handleLaunchRequest(initialLaunchRequest);
  }
}

async function registerLaunchRequestListener(): Promise<void> {
  try {
    const { listen } = await import("@tauri-apps/api/event");
    await listen<LaunchRequestPayload>("desktop-launch-request", (event) => {
      void handleLaunchRequest(event.payload);
    });
  } catch {
    // Tauri bridge is not available in browser-only contexts.
  }
}

async function handleLaunchRequest(request: LaunchRequestPayload): Promise<void> {
  if (isLoadingRepoState) {
    queuedLaunchRequest = request;
    return;
  }

  await loadAndRenderTarget(request.targetRoot, "cli", request.requestId);
}

async function loadAndRenderTarget(targetRoot: string, source: "cli" | "manual", requestId?: string): Promise<void> {
  if (isLoadingRepoState) {
    if (requestId) {
      queuedLaunchRequest = { requestId, targetRoot };
    }
    return;
  }

  isLoadingRepoState = true;
  currentTargetRoot = targetRoot;
  targetInputElement.value = targetRoot;
  bridgeNoteElement.textContent =
    source === "cli" ? `Opening ${targetRoot} from ${requestId ? "kc ui" : "the CLI"}...` : `Loading repo-local state for ${targetRoot}...`;

  const state = await loadRepoControlState(targetRoot);
  currentTargetRoot = state.targetRoot || targetRoot;
  renderState(state);
  targetInputElement.value = state.targetRoot || targetRoot;
  bridgeNoteElement.textContent = buildBridgeNote(state, source);

  if (requestId) {
    await acknowledgeLaunchRequest(requestId, state);
  }

  isLoadingRepoState = false;

  if (queuedLaunchRequest && queuedLaunchRequest.requestId !== requestId) {
    const nextRequest = queuedLaunchRequest;
    queuedLaunchRequest = null;
    await handleLaunchRequest(nextRequest);
    return;
  }

  queuedLaunchRequest = null;
}

async function acknowledgeLaunchRequest(requestId: string, state: RepoControlState): Promise<void> {
  const targetRoot = state.targetRoot || currentTargetRoot;
  const status = state.repoState.mode === "bridge-unavailable" ? "error" : "ready";
  const detail =
    status === "ready" ? `Loaded repo-local state for ${targetRoot}.` : BRIDGE_UNAVAILABLE_NEXT_STEP;

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("ack_launch_request", {
      requestId,
      targetRoot,
      status,
      detail
    });
  } catch {
    // Browser-only contexts do not need launch acknowledgements.
  }
}

function renderState(state: RepoControlState): void {
  const resolvedTargetRoot = state.targetRoot || "No repo loaded yet";
  activeTargetRootElement.textContent = resolvedTargetRoot;
  activeTargetRootElement.title = resolvedTargetRoot;
  activeTargetHintElement.textContent = buildActiveTargetHint(state);
  gridElement.innerHTML = renderPanels(state);
  repoStateBannerElement.className = `repo-state-banner repo-state-${state.repoState.mode}`;
  repoStateBannerElement.innerHTML = `
    <p class="repo-state-kicker">Repo health</p>
    <h2>${escapeHtml(state.repoState.title)}</h2>
    <p>${escapeHtml(state.repoState.detail)}</p>
  `;
  sourceOfTruthNoteElement.textContent = state.repoState.sourceOfTruthNote;
}

function buildActiveTargetHint(state: RepoControlState): string {
  if (!state.targetRoot) {
    return "Run kc ui inside a repo to load it automatically. Use “Load another repo” only when you want a different folder.";
  }

  switch (state.repoState.mode) {
    case "healthy":
      return "Repo-local state is loaded and ready. Load another repo only when you intentionally want a different folder.";
    case "repo-not-initialized":
      return "This folder is not initialized yet. Run kc init in Terminal when you want to standardize it.";
    case "initialized-invalid":
      return "This repo needs a little repair before continuity is fully trustworthy.";
    case "initialized-with-warnings":
      return "This repo is usable now, with a few warnings still worth addressing.";
    case "bridge-unavailable":
    default:
      return BRIDGE_UNAVAILABLE_NEXT_STEP;
  }
}

function buildBridgeNote(state: RepoControlState, source: "cli" | "manual" | "shell"): string {
  if (!state.targetRoot) {
    return "Run kc ui inside a repo to load it automatically. Keep manual switching as fallback only.";
  }

  if (state.repoState.mode === "bridge-unavailable") {
    return BRIDGE_UNAVAILABLE_NEXT_STEP;
  }

  if (source === "cli") {
    return `Loaded ${state.targetRoot} from kc ui. Use “Load another repo” only when you want to move to a different folder.`;
  }

  if (source === "manual") {
    return `Loaded ${state.targetRoot}. You can switch again whenever you intentionally want a different repo.`;
  }

  return `Repo-local state for ${state.targetRoot} is ready.`;
}

function renderPanels(state: RepoControlState): string {
  return [
    renderPanel("Repo Overview", [
      { label: "Repo", value: state.targetRoot || "No repo loaded yet", ...(state.targetRoot ? {} : { tone: "warn" as const }) },
      ...state.repoOverview
    ]),
    renderPanel("Continuity", state.continuity),
    renderPanel(
      "Memory Bank",
      state.memoryBank.map((entry) => ({
        label: entry.label,
        value: `${entry.present ? "present" : "missing"} (${entry.path})`,
        ...(entry.present ? {} : { tone: "warn" as const })
      }))
    ),
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
        tone: "warn" as const
      }))
    ]),
    renderPanel("Validation", [
      { label: "OK", value: String(state.validation.ok) },
      { label: "Errors", value: String(state.validation.errors), ...(state.validation.errors ? { tone: "warn" as const } : {}) },
      { label: "Warnings", value: String(state.validation.warnings), ...(state.validation.warnings ? { tone: "warn" as const } : {}) }
    ])
  ].join("");
}

function renderPanel(title: string, items: PanelItem[]): string {
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>${escapeHtml(title)}</h2>
      </div>
      <dl class="panel-list">
        ${items
          .map(
            (item) => `
              <div class="panel-row ${item.tone === "warn" ? "panel-row-warn" : ""}">
                <dt>${escapeHtml(item.label)}</dt>
                <dd>${escapeHtml(item.value)}</dd>
              </div>
            `
          )
          .join("")}
      </dl>
    </section>
  `;
}

async function consumeInitialLaunchRequest(): Promise<LaunchRequestPayload | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<LaunchRequestPayload | null>("consume_initial_launch_request");
  } catch {
    return null;
  }
}

async function loadRepoControlState(targetRoot: string): Promise<RepoControlState> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<RepoControlState>("load_repo_control_state", { targetRoot });
  } catch {
    return buildBridgeUnavailableState(targetRoot);
  }
}

function buildBridgeUnavailableState(targetRoot: string): RepoControlState {
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
        ? "Kiwi Control could not read repo-local state for this folder yet."
        : "Run kc ui inside a repo to load it automatically, or use “Load another repo” only when you want a different folder.",
      sourceOfTruthNote:
        "Repo-local artifacts under .agent/ and promoted repo instruction files remain the source of truth. The desktop app never replaces that state with hidden app-owned storage."
    },
    repoOverview: [
      {
        label: "Project type",
        value: hasTargetRoot ? "unknown (awaiting repo bridge)" : "no repo loaded",
        ...(hasTargetRoot ? { tone: "warn" as const } : {})
      },
      { label: "Active role", value: "none recorded" },
      { label: "Next file", value: hasTargetRoot ? ".agent/project.yaml" : "run kc ui inside a repo" },
      { label: "Next command", value: hasTargetRoot ? "kc ui" : "kc init" },
      {
        label: "Validation state",
        value: hasTargetRoot ? "bridge unavailable" : "waiting for repo",
        ...(hasTargetRoot ? { tone: "warn" as const } : {})
      },
      { label: "Current phase", value: hasTargetRoot ? "restore repo bridge" : "load a repo" }
    ],
    continuity: [
      { label: "Latest checkpoint", value: "none recorded" },
      { label: "Latest handoff", value: "none recorded" },
      { label: "Latest reconcile", value: "none recorded" },
      {
        label: "Current focus",
        value: hasTargetRoot ? `reload repo-local state for ${resolvedTargetRoot}` : "open a repo from the CLI or switch repos manually"
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
      safeParallelHint:
        "Restore repo-local visibility first. Once Kiwi Control can read the repo again, continuity, specialists, and validation will update automatically."
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
