import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

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

type KiwiControlContextTreeStatus = "selected" | "candidate" | "excluded";

type KiwiControlContextTreeNode = {
  name: string;
  path: string;
  kind: "directory" | "file";
  status: KiwiControlContextTreeStatus;
  expanded: boolean;
  children: KiwiControlContextTreeNode[];
};

type KiwiControlContextTree = {
  nodes: KiwiControlContextTreeNode[];
  selectedCount: number;
  candidateCount: number;
  excludedCount: number;
};

type KiwiControlContextView = {
  task: string | null;
  selectedFiles: string[];
  excludedPatterns: string[];
  reason: string | null;
  confidence: string | null;
  confidenceDetail: string | null;
  keywordMatches: string[];
  tree: KiwiControlContextTree;
  timestamp: string | null;
};

type KiwiControlTokenAnalytics = {
  selectedTokens: number;
  fullRepoTokens: number;
  savingsPercent: number;
  fileCountSelected: number;
  fileCountTotal: number;
  estimationMethod: string | null;
  estimateNote: string | null;
  topDirectories: Array<{ directory: string; tokens: number; fileCount: number }>;
  task: string | null;
  timestamp: string | null;
};

type KiwiControlEfficiency = {
  instructionsGenerated: boolean;
  instructionsPath: string | null;
};

type NextActionItem = {
  action: string;
  file: string | null;
  command: string | null;
  reason: string;
  priority: "critical" | "high" | "normal" | "low";
};

type KiwiControlNextActions = {
  actions: NextActionItem[];
  summary: string;
};

type KiwiControlFeedback = {
  totalRuns: number;
  successRate: number;
  adaptationLevel: "limited" | "active";
  note: string;
  recentEntries: Array<{
    task: string;
    success: boolean;
    filesSelected: number;
    filesUsed: number;
    filesWasted: number;
    timestamp: string;
  }>;
  topBoostedFiles: Array<{ file: string; score: number }>;
  topPenalizedFiles: Array<{ file: string; score: number }>;
};

type KiwiControlExecution = {
  totalExecutions: number;
  totalTokensUsed: number;
  averageTokensPerRun: number;
  successRate: number;
  recentExecutions: Array<{
    task: string;
    success: boolean;
    tokensUsed: number;
    filesTouched: number;
    tool: string | null;
    timestamp: string;
  }>;
  tokenTrend: "improving" | "stable" | "worsening" | "insufficient-data";
};

type KiwiControlWastedFiles = {
  files: Array<{ file: string; tokens: number; reason: string }>;
  totalWastedTokens: number;
  removalSavingsPercent: number;
};

type KiwiControlHeavyDirectories = {
  directories: Array<{
    directory: string;
    tokens: number;
    fileCount: number;
    percentOfRepo: number;
    suggestion: string;
  }>;
};

type KiwiControlState = {
  contextView: KiwiControlContextView;
  tokenAnalytics: KiwiControlTokenAnalytics;
  efficiency: KiwiControlEfficiency;
  nextActions: KiwiControlNextActions;
  feedback: KiwiControlFeedback;
  execution: KiwiControlExecution;
  wastedFiles: KiwiControlWastedFiles;
  heavyDirectories: KiwiControlHeavyDirectories;
};

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
  kiwiControl?: KiwiControlState;
};

type LaunchRequestPayload = {
  requestId: string;
  targetRoot: string;
};

type SidebarView = "overview" | "context" | "tokens" | "feedback" | "validation";

const NAV_ITEMS: Array<{ id: SidebarView; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "◫" },
  { id: "context", label: "Context", icon: "◎" },
  { id: "tokens", label: "Tokens", icon: "◌" },
  { id: "feedback", label: "Feedback", icon: "◍" },
  { id: "validation", label: "Validation", icon: "◇" }
];

const BRIDGE_UNAVAILABLE_NEXT_STEP = "Confirm kiwi-control works in Terminal, then run kc ui again.";

const EMPTY_KC: KiwiControlState = {
  contextView: {
    task: null,
    selectedFiles: [],
    excludedPatterns: [],
    reason: null,
    confidence: null,
    confidenceDetail: null,
    keywordMatches: [],
    tree: { nodes: [], selectedCount: 0, candidateCount: 0, excludedCount: 0 },
    timestamp: null
  },
  tokenAnalytics: {
    selectedTokens: 0,
    fullRepoTokens: 0,
    savingsPercent: 0,
    fileCountSelected: 0,
    fileCountTotal: 0,
    estimationMethod: null,
    estimateNote: null,
    topDirectories: [],
    task: null,
    timestamp: null
  },
  efficiency: {
    instructionsGenerated: false,
    instructionsPath: null
  },
  nextActions: {
    actions: [],
    summary: ""
  },
  feedback: {
    totalRuns: 0,
    successRate: 0,
    adaptationLevel: "limited",
    note: "Adaptive feedback is idle.",
    recentEntries: [],
    topBoostedFiles: [],
    topPenalizedFiles: []
  },
  execution: {
    totalExecutions: 0,
    totalTokensUsed: 0,
    averageTokensPerRun: 0,
    successRate: 0,
    recentExecutions: [],
    tokenTrend: "insufficient-data"
  },
  wastedFiles: {
    files: [],
    totalWastedTokens: 0,
    removalSavingsPercent: 0
  },
  heavyDirectories: {
    directories: []
  }
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

let activeView: SidebarView = "overview";
let currentState = buildBridgeUnavailableState("");

app.innerHTML = buildShellHtml();

const activeTargetRootElement = requireElement<HTMLElement>("#active-target-root");
const activeTargetHintElement = requireElement<HTMLParagraphElement>("#active-target-hint");
const targetInputElement = requireElement<HTMLInputElement>("#target-root");
const loadButtonElement = requireElement<HTMLButtonElement>("#load-state");
const bridgeNoteElement = requireElement<HTMLParagraphElement>("#bridge-note");
const topbarElement = requireElement<HTMLElement>("#topbar");
const centerMainElement = requireElement<HTMLElement>("#center-main");
const inspectorElement = requireElement<HTMLElement>("#inspector");
const logDrawerElement = requireElement<HTMLElement>("#log-drawer");

let currentTargetRoot = "";
let isLoadingRepoState = false;
let queuedLaunchRequest: LaunchRequestPayload | null = null;
let lastHandledLaunchRequestId = "";

renderState(currentState);
bridgeNoteElement.textContent = buildBridgeNote(currentState, "shell");

loadButtonElement.addEventListener("click", () => {
  const targetRoot = targetInputElement.value.trim();
  if (!targetRoot) {
    bridgeNoteElement.textContent = "Enter a repo path to switch the active workspace.";
    return;
  }
  void loadAndRenderTarget(targetRoot, "manual");
});

app.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return;
  }

  const viewButton = target.closest<HTMLElement>("[data-view]");
  if (viewButton?.dataset.view) {
    activeView = viewButton.dataset.view as SidebarView;
    renderState(currentState);
  }
});

void boot();

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Shell mount point not found: ${selector}`);
  }
  return element;
}

function buildShellHtml(): string {
  return `
    <main class="ui-shell">
      <aside class="ui-sidebar">
        <div class="sidebar-brand">
          <div class="brand-mark">K</div>
          <div class="brand-copy">
            <strong>Kiwi Control</strong>
            <span>Repo control plane</span>
          </div>
        </div>
        <nav class="sidebar-nav" id="sidebar-nav">
          ${NAV_ITEMS.map((item) => `
            <button class="sidebar-link" data-view="${item.id}" type="button">
              <span class="sidebar-link-icon">${item.icon}</span>
              <span class="sidebar-link-label">${item.label}</span>
            </button>
          `).join("")}
        </nav>
        <section class="sidebar-switcher">
          <p class="section-label">Active repo</p>
          <strong id="active-target-root">No repo loaded yet</strong>
          <p id="active-target-hint">Run <code>kc ui</code> inside a repo to load it automatically.</p>
          <label class="repo-input-group">
            <span>Open another repo</span>
            <input id="target-root" type="text" placeholder="/path/to/repo" />
          </label>
          <button id="load-state" type="button">Load repo</button>
        </section>
        <p class="sidebar-note" id="bridge-note">
          Kiwi Control reads repo-local state directly. The desktop app is a control surface, never the source of truth.
        </p>
      </aside>

      <div class="ui-workspace">
        <header class="topbar" id="topbar"></header>
        <div class="workspace-body">
          <section class="center-main" id="center-main"></section>
          <aside class="inspector-panel" id="inspector"></aside>
        </div>
        <section class="log-drawer" id="log-drawer"></section>
      </div>
    </main>
  `;
}

async function boot(): Promise<void> {
  await registerLaunchRequestListener();

  const initialLaunchRequest = await consumeInitialLaunchRequest();
  if (initialLaunchRequest) {
    await logUiEvent("ui-initial-launch-request-consumed", initialLaunchRequest.requestId, initialLaunchRequest.targetRoot);
    await handleLaunchRequest(initialLaunchRequest);
  } else {
    await logUiEvent("ui-initial-launch-request-missing");
  }

  window.setInterval(() => {
    void pollPendingLaunchRequest();
  }, 250);
}

async function registerLaunchRequestListener(): Promise<void> {
  if (!isTauriBridgeAvailable()) {
    return;
  }

  try {
    await listen<LaunchRequestPayload>("desktop-launch-request", (event) => {
      void handleLaunchRequest(event.payload);
    });
  } catch {
    // Browser-only contexts do not need live retarget listeners.
  }
}

async function handleLaunchRequest(request: LaunchRequestPayload): Promise<void> {
  await logUiEvent("ui-launch-request-received", request.requestId, request.targetRoot);
  lastHandledLaunchRequestId = request.requestId;

  if (isLoadingRepoState) {
    queuedLaunchRequest = request;
    await logUiEvent("ui-launch-request-queued", request.requestId, request.targetRoot);
    return;
  }

  await loadAndRenderTarget(request.targetRoot, "cli", request.requestId);
}

async function pollPendingLaunchRequest(): Promise<void> {
  if (isLoadingRepoState || !isTauriBridgeAvailable()) {
    return;
  }

  const pendingLaunchRequest = await consumeInitialLaunchRequest();
  if (!pendingLaunchRequest || pendingLaunchRequest.requestId === lastHandledLaunchRequestId) {
    return;
  }

  await logUiEvent("ui-fallback-launch-request-consumed", pendingLaunchRequest.requestId, pendingLaunchRequest.targetRoot);
  await handleLaunchRequest(pendingLaunchRequest);
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
    source === "cli"
      ? `Opening ${targetRoot} from ${requestId ? "kc ui" : "the CLI"}...`
      : `Loading repo-local state for ${targetRoot}...`;

  const state = await loadRepoControlState(targetRoot);
  currentTargetRoot = state.targetRoot || targetRoot;
  currentState = state;
  renderState(state);
  targetInputElement.value = state.targetRoot || targetRoot;
  bridgeNoteElement.textContent = buildBridgeNote(state, source);
  await logUiEvent("ui-repo-state-rendered", requestId, state.targetRoot || targetRoot, state.repoState.mode);

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
  const detail = status === "ready" ? `Loaded repo-local state for ${targetRoot}.` : BRIDGE_UNAVAILABLE_NEXT_STEP;

  if (!isTauriBridgeAvailable()) {
    return;
  }

  try {
    await logUiEvent("ui-ack-attempt", requestId, targetRoot, status);
    await invoke("ack_launch_request", { requestId, targetRoot, status, detail });
    await logUiEvent("ui-ack-succeeded", requestId, targetRoot, status);
  } catch (error) {
    bridgeNoteElement.textContent = "Kiwi Control loaded this repo, but the desktop launch acknowledgement did not complete yet.";
    await logUiEvent("ui-ack-failed", requestId, targetRoot, error instanceof Error ? error.message : String(error));
  }
}

async function logUiEvent(event: string, requestId?: string, targetRoot?: string, detail?: string): Promise<void> {
  if (!isTauriBridgeAvailable()) {
    return;
  }

  try {
    await invoke("append_ui_launch_log", { event, requestId, targetRoot, detail });
  } catch {
    // Logging must never interrupt the product flow.
  }
}

function renderState(state: RepoControlState): void {
  currentState = state;

  const resolvedTargetRoot = state.targetRoot || "No repo loaded yet";
  activeTargetRootElement.textContent = resolvedTargetRoot;
  activeTargetRootElement.title = resolvedTargetRoot;
  activeTargetHintElement.textContent = buildActiveTargetHint(state);

  topbarElement.innerHTML = renderTopBar(state);
  centerMainElement.innerHTML = renderCenterView(state);
  inspectorElement.innerHTML = renderInspector(state);
  logDrawerElement.innerHTML = renderLogDrawer(state);

  syncSidebarSelection();
}

function syncSidebarSelection(): void {
  for (const item of NAV_ITEMS) {
    const button = app?.querySelector<HTMLElement>(`[data-view="${item.id}"]`);
    if (!button) {
      continue;
    }
    button.classList.toggle("is-active", item.id === activeView);
  }
}

function renderTopBar(state: RepoControlState): string {
  const repoName = getRepoLabel(state.targetRoot);
  const phase = getPanelValue(state.repoOverview, "Current phase");
  const activeRole = getPanelValue(state.repoOverview, "Active role");
  const validationState = getPanelValue(state.repoOverview, "Validation state");

  return `
    <div class="topbar-left">
      <div class="repo-badge">⌘</div>
      <div class="repo-meta">
        <strong>${escapeHtml(repoName)}</strong>
        <span>${escapeHtml(state.targetRoot || "No repo loaded yet")}</span>
      </div>
      <div class="topbar-chips">
        ${renderChip(state.repoState.title, state.repoState.mode)}
        ${renderChip(state.projectType, "neutral")}
        ${renderChip(phase, "neutral")}
      </div>
    </div>
    <div class="topbar-right">
      <button class="command-shell" type="button">
        <span>repo-local state only</span>
        <small>${escapeHtml(validationState)}</small>
      </button>
      <div class="operator-meta">
        <span>${escapeHtml(activeRole)}</span>
        <small>${escapeHtml(`${state.profileName} · ${state.executionMode}`)}</small>
      </div>
    </div>
  `;
}

function renderCenterView(state: RepoControlState): string {
  switch (activeView) {
    case "context":
      return renderContextView(state);
    case "tokens":
      return renderTokensView(state);
    case "feedback":
      return renderFeedbackView(state);
    case "validation":
      return renderValidationView(state);
    case "overview":
    default:
      return renderOverviewView(state);
  }
}

function renderOverviewView(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const primaryAction = kc.nextActions.actions[0] ?? null;
  const secondaryActions = kc.nextActions.actions.slice(1, 4);
  const currentFocus = getPanelValue(state.continuity, "Current focus");
  const latestCheckpoint = getPanelValue(state.continuity, "Latest checkpoint");
  const latestHandoff = getPanelValue(state.continuity, "Latest handoff");
  const selectedPreview = kc.contextView.selectedFiles.slice(0, 6);

  return `
    <div class="view-shell">
      <section class="hero-block">
        <div class="hero-meta">
          <span class="section-label">Primary action</span>
          ${primaryAction ? `<span class="priority-tag priority-${escapeHtml(primaryAction.priority)}">${escapeHtml(primaryAction.priority)}</span>` : ""}
        </div>
        <h1>${escapeHtml(primaryAction?.action ?? state.repoState.title)}</h1>
        <p>${escapeHtml(primaryAction?.reason ?? (kc.nextActions.summary || state.repoState.detail))}</p>
        <div class="hero-actions">
          ${primaryAction?.command ? `<code>${escapeHtml(primaryAction.command)}</code>` : ""}
          <span class="hero-support">${escapeHtml(currentFocus)}</span>
        </div>
      </section>

      <div class="workspace-columns">
        <section class="workspace-section">
          ${renderSectionHeader("Context in play", kc.contextView.task ?? "No prepared task")}
          ${kc.contextView.task
            ? `
              <div class="summary-strip">
                ${renderMetricTile(`${kc.contextView.selectedFiles.length}`, "selected")}
                ${renderMetricTile(`${kc.contextView.tree.excludedCount}`, "excluded")}
                ${renderMetricTile(kc.contextView.confidence?.toUpperCase() ?? "UNKNOWN", "confidence")}
              </div>
              ${selectedPreview.length > 0
                ? `<div class="scope-list">${selectedPreview.map((file) => `<span class="scope-chip">${escapeHtml(file)}</span>`).join("")}</div>`
                : `<p class="muted-copy">No selected files recorded yet.</p>`}
              ${kc.contextView.reason ? `<p class="body-copy">${escapeHtml(kc.contextView.reason)}</p>` : ""}
            `
            : renderEmptyBlock('Run kc prepare "your task" to seed the repo-aware file set.')}
        </section>

        <section class="workspace-section">
          ${renderSectionHeader("Continuity", state.repoState.detail)}
          <div class="kv-list">
            ${renderKeyValueRow("Current focus", currentFocus)}
            ${renderKeyValueRow("Latest checkpoint", latestCheckpoint)}
            ${renderKeyValueRow("Latest handoff", latestHandoff)}
            ${renderKeyValueRow("Repo health", state.repoState.title)}
          </div>
        </section>
      </div>

      <div class="workspace-columns workspace-columns-tight">
        <section class="workspace-section">
          ${renderSectionHeader("Feedback", kc.feedback.note)}
          <div class="summary-strip">
            ${renderMetricTile(String(kc.feedback.totalRuns), "successful runs")}
            ${renderMetricTile(`${kc.feedback.successRate}%`, "success rate")}
            ${renderMetricTile(kc.feedback.adaptationLevel, "adaptation")}
          </div>
          ${kc.feedback.topBoostedFiles.length > 0
            ? renderScoreList("Top boosted files", kc.feedback.topBoostedFiles)
            : `<p class="muted-copy">No feedback history yet. Learning begins after successful checkpoints or handoffs.</p>`}
        </section>

        <section class="workspace-section">
          ${renderSectionHeader("Queued after that", kc.nextActions.summary || "No additional actions recorded.")}
          ${secondaryActions.length > 0
            ? `<div class="stack-list">${secondaryActions.map(renderActionListRow).join("")}</div>`
            : `<p class="muted-copy">No follow-on actions are queued yet.</p>`}
        </section>
      </div>
    </div>
  `;
}

function renderContextView(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const ctx = kc.contextView;

  return `
    <div class="view-shell">
      <section class="view-header">
        <div>
          <p class="section-label">Context selection</p>
          <h1>${escapeHtml(ctx.task ?? "No prepared task")}</h1>
          <p>${escapeHtml(ctx.confidenceDetail ?? "Kiwi Control shows only files the selector actually considered.")}</p>
        </div>
        <div class="summary-strip">
          ${renderMetricTile(String(ctx.tree.selectedCount), "selected")}
          ${renderMetricTile(String(ctx.tree.candidateCount), "candidate")}
          ${renderMetricTile(String(ctx.tree.excludedCount), "excluded")}
        </div>
      </section>

      <div class="context-layout">
        <section class="workspace-section tree-column">
          ${renderSectionHeader("Repo tree", "Selected, candidate, and excluded files are grounded in the actual selector state.")}
          ${ctx.tree.nodes.length > 0
            ? renderContextTree(ctx.tree)
            : renderEmptyBlock('Run kc prepare "your task" to build a tree from live repo selection signals.')}
        </section>

        <section class="workspace-section detail-column">
          ${renderSectionHeader("Selection state", ctx.reason ?? "No selection reason recorded.")}
          <div class="kv-list">
            ${renderKeyValueRow("Confidence", ctx.confidence?.toUpperCase() ?? "UNKNOWN")}
            ${renderKeyValueRow("Selected files", String(ctx.selectedFiles.length))}
            ${renderKeyValueRow("Excluded patterns", String(ctx.excludedPatterns.length))}
            ${renderKeyValueRow("Keyword matches", ctx.keywordMatches.length > 0 ? ctx.keywordMatches.slice(0, 6).join(", ") : "none recorded")}
          </div>
          ${ctx.selectedFiles.length > 0
            ? `<div class="file-stack">${ctx.selectedFiles.map((file) => renderFileCard(file, "selected")).join("")}</div>`
            : `<p class="muted-copy">No active files are selected yet.</p>`}
        </section>
      </div>
    </div>
  `;
}

function renderTokensView(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const tokens = kc.tokenAnalytics;

  return `
    <div class="view-shell">
      <section class="view-header">
        <div>
          <p class="section-label">Token analytics</p>
          <h1>${escapeHtml(tokens.task ?? "No token estimate yet")}</h1>
          <p>${escapeHtml(tokens.estimateNote ?? 'Run kc prepare "your task" to compute a repo-local rough estimate.')}</p>
        </div>
        <div class="summary-strip">
          ${renderMetricTile(`~${formatTokensShort(tokens.selectedTokens)}`, "selected")}
          ${renderMetricTile(`~${formatTokensShort(tokens.fullRepoTokens)}`, "full repo")}
          ${renderMetricTile(`~${tokens.savingsPercent}%`, "saved")}
          ${renderMetricTile(`${tokens.fileCountSelected}/${tokens.fileCountTotal}`, "measured files")}
        </div>
      </section>

      <section class="workspace-section">
        ${renderSectionHeader("Scope efficiency", tokens.estimationMethod ?? "No estimate method recorded.")}
        ${renderMeterRow("Selected vs repo", tokens.selectedTokens, tokens.fullRepoTokens)}
        ${kc.wastedFiles.files.length > 0 ? renderMeterRow("Wasted inside selection", kc.wastedFiles.totalWastedTokens, tokens.selectedTokens) : ""}
      </section>

      <div class="workspace-columns">
        <section class="workspace-section">
          ${renderSectionHeader("Top directories", "Measured directories with the largest share of estimated token usage.")}
          ${tokens.topDirectories.length > 0
            ? `<div class="bar-list">${tokens.topDirectories.slice(0, 6).map((directory) => renderDirectoryBar(directory.directory, directory.tokens, tokens.fullRepoTokens, `${directory.fileCount} files`)).join("")}</div>`
            : `<p class="muted-copy">No directory analytics recorded yet.</p>`}
        </section>

        <section class="workspace-section">
          ${renderSectionHeader("Wasted files", kc.wastedFiles.files.length > 0 ? `${kc.wastedFiles.removalSavingsPercent}% of the current selection could be removed.` : "Nothing is marked as wasted for the current task.")}
          ${kc.wastedFiles.files.length > 0
            ? `<div class="file-stack">${kc.wastedFiles.files.slice(0, 6).map((file) => renderAnnotatedFileCard(file.file, formatTokensShort(file.tokens), file.reason)).join("")}</div>`
            : `<p class="muted-copy">No wasted files recorded in the active selection.</p>`}
        </section>
      </div>

      <section class="workspace-section">
        ${renderSectionHeader("Heavy directories", "Directories that dominate token volume and may benefit from tighter scope rules.")}
        ${kc.heavyDirectories.directories.length > 0
          ? `<div class="file-stack">${kc.heavyDirectories.directories.slice(0, 4).map((directory) => renderAnnotatedFileCard(directory.directory, `${directory.percentOfRepo}% of repo`, directory.suggestion)).join("")}</div>`
          : `<p class="muted-copy">No heavy-directory warnings are recorded for this repo right now.</p>`}
      </section>
    </div>
  `;
}

function renderFeedbackView(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const feedback = kc.feedback;

  return `
    <div class="view-shell">
      <section class="view-header">
        <div>
          <p class="section-label">Adaptive feedback</p>
          <h1>${escapeHtml(feedback.adaptationLevel === "active" ? "Live learning is in play" : "Learning is still limited")}</h1>
          <p>${escapeHtml(feedback.note)}</p>
        </div>
        <div class="summary-strip">
          ${renderMetricTile(String(feedback.totalRuns), "valid runs")}
          ${renderMetricTile(`${feedback.successRate}%`, "success rate")}
          ${renderMetricTile(feedback.adaptationLevel, "state")}
        </div>
      </section>

      <div class="workspace-columns">
        <section class="workspace-section">
          ${renderSectionHeader("Boosted files", "Files that have helped on recent successful runs in this task scope.")}
          ${feedback.topBoostedFiles.length > 0
            ? renderScoreList("Boosted", feedback.topBoostedFiles)
            : `<p class="muted-copy">No boosted files yet.</p>`}
        </section>

        <section class="workspace-section">
          ${renderSectionHeader("Penalized files", "Files that the system is learning to avoid for this task scope.")}
          ${feedback.topPenalizedFiles.length > 0
            ? renderScoreList("Penalized", feedback.topPenalizedFiles)
            : `<p class="muted-copy">No penalized files yet.</p>`}
        </section>
      </div>

      <section class="workspace-section">
        ${renderSectionHeader("Recent completions", "Only valid successful completions are used to improve future selection behavior.")}
        ${feedback.recentEntries.length > 0
          ? `<div class="timeline-list">${feedback.recentEntries.map((entry) => `
              <article class="timeline-entry">
                <div class="timeline-dot ${entry.success ? "timeline-dot-success" : "timeline-dot-warn"}"></div>
                <div>
                  <strong>${escapeHtml(entry.task)}</strong>
                  <p>${escapeHtml(`${entry.filesUsed}/${entry.filesSelected} files used · ${formatTimestamp(entry.timestamp)}`)}</p>
                </div>
              </article>
            `).join("")}</div>`
          : `<p class="muted-copy">No recent feedback events are available yet.</p>`}
      </section>
    </div>
  `;
}

function renderValidationView(state: RepoControlState): string {
  return `
    <div class="view-shell">
      <section class="hero-block hero-block-compact">
        <div class="hero-meta">
          <span class="section-label">Validation</span>
          ${renderChip(state.repoState.title, state.repoState.mode)}
        </div>
        <h1>${escapeHtml(state.repoState.title)}</h1>
        <p>${escapeHtml(state.repoState.detail)}</p>
      </section>

      <div class="workspace-columns">
        <section class="workspace-section">
          ${renderSectionHeader("Repo contract", state.repoState.sourceOfTruthNote)}
          <div class="summary-strip">
            ${renderMetricTile(String(state.validation.errors), "errors")}
            ${renderMetricTile(String(state.validation.warnings), "warnings")}
            ${renderMetricTile(state.validation.ok ? "OK" : "Needs repair", "state")}
          </div>
          <div class="kv-list">
            ${state.repoOverview.map((item) => renderKeyValueRow(item.label, item.value, item.tone === "warn" ? "warn" : "default")).join("")}
          </div>
        </section>

        <section class="workspace-section">
          ${renderSectionHeader("Repo memory", "Presence of repo-local memory and continuity surfaces.")}
          <div class="memory-list">
            ${state.memoryBank.length > 0
              ? state.memoryBank.map((entry) => `
                  <div class="memory-row ${entry.present ? "memory-row-present" : "memory-row-missing"}">
                    <span>${escapeHtml(entry.label)}</span>
                    <strong>${entry.present ? "present" : "missing"}</strong>
                  </div>
                `).join("")
              : `<p class="muted-copy">No repo-local memory entries are available.</p>`}
          </div>
        </section>
      </div>

      <section class="workspace-section">
        ${renderSectionHeader("Continuity", "Latest checkpoint, handoff, reconcile, focus, and open-risk state.")}
        <div class="kv-list">
          ${state.continuity.map((item) => renderKeyValueRow(item.label, item.value, item.tone === "warn" ? "warn" : "default")).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderInspector(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const primaryAction = kc.nextActions.actions[0] ?? null;
  const supportingFiles = primaryAction?.file
    ? [primaryAction.file, ...kc.contextView.selectedFiles.filter((file) => file !== primaryAction.file).slice(0, 4)]
    : kc.contextView.selectedFiles.slice(0, 5);

  return `
    <div class="inspector-shell">
      <div class="inspector-header">
        <div>
          <p class="section-label">Inspector</p>
          <h2>${escapeHtml(primaryAction?.action ?? "No blocking action")}</h2>
        </div>
        ${primaryAction ? renderChip(primaryAction.priority, primaryAction.priority) : renderChip("stable", "neutral")}
      </div>

      <section class="inspector-section">
        <p class="inspector-label">Why now</p>
        <p class="inspector-copy">${escapeHtml(primaryAction?.reason ?? (kc.nextActions.summary || state.repoState.detail))}</p>
      </section>

      <section class="inspector-section">
        <p class="inspector-label">Command</p>
        ${primaryAction?.command
          ? `<code class="inspector-command">${escapeHtml(primaryAction.command)}</code>`
          : `<p class="inspector-copy">No command recorded for the current state.</p>`}
      </section>

      <section class="inspector-section">
        <p class="inspector-label">Affected scope</p>
        ${supportingFiles.length > 0
          ? `<div class="file-stack">${supportingFiles.map((file) => renderFileCard(file, "selected")).join("")}</div>`
          : `<p class="inspector-copy">No file scope is selected yet.</p>`}
      </section>

      <section class="inspector-section">
        <p class="inspector-label">State gates</p>
        <div class="gate-list">
          ${renderGateRow("Repo validation", state.validation.ok ? "passing" : `${state.validation.errors} errors / ${state.validation.warnings} warnings`, state.validation.ok ? "success" : "warn")}
          ${renderGateRow("Instructions", kc.efficiency.instructionsGenerated ? "ready" : "not generated", kc.efficiency.instructionsGenerated ? "success" : "warn")}
          ${renderGateRow("Feedback", `${kc.feedback.adaptationLevel} (${kc.feedback.totalRuns} runs)`, kc.feedback.adaptationLevel === "active" ? "success" : "default")}
          ${renderGateRow("Token estimate", kc.tokenAnalytics.estimationMethod ?? "not generated", kc.tokenAnalytics.estimationMethod ? "default" : "warn")}
        </div>
      </section>

      <section class="inspector-section">
        <p class="inspector-label">Queued after that</p>
        ${kc.nextActions.actions.slice(1, 4).length > 0
          ? `<div class="stack-list">${kc.nextActions.actions.slice(1, 4).map(renderActionListRow).join("")}</div>`
          : `<p class="inspector-copy">No secondary actions are queued.</p>`}
      </section>
    </div>
  `;
}

function renderLogDrawer(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const continuityLines = state.continuity.slice(0, 3).map((item) => ({
    label: item.label,
    value: item.value
  }));
  const executionLines = kc.execution.recentExecutions.slice(0, 4).map((entry) => ({
    label: entry.success ? "run" : "run failed",
    value: `${entry.task} · ${entry.filesTouched} files · ${formatTimestamp(entry.timestamp)}`
  }));
  const lines = [...executionLines, ...continuityLines].slice(0, 6);

  return `
    <div class="log-header">
      <div>
        <p class="section-label">Repo activity</p>
        <h3>${escapeHtml(state.repoState.title)}</h3>
      </div>
      <div class="log-summary">
        <span>${escapeHtml(`${kc.execution.totalExecutions} executions`)}</span>
        <span>${escapeHtml(`${kc.feedback.totalRuns} feedback runs`)}</span>
      </div>
    </div>
    <div class="log-body">
      ${lines.length > 0
        ? lines.map((line) => `
            <div class="log-line">
              <span class="log-key">${escapeHtml(line.label)}</span>
              <span class="log-value">${escapeHtml(line.value)}</span>
            </div>
          `).join("")
        : `<p class="muted-copy">No repo activity is recorded yet.</p>`}
    </div>
    <div class="log-footer">${escapeHtml(state.repoState.sourceOfTruthNote)}</div>
  `;
}

function renderSectionHeader(title: string, description: string): string {
  return `
    <header class="section-header">
      <div>
        <p class="section-label">${escapeHtml(title)}</p>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <p>${escapeHtml(description)}</p>
    </header>
  `;
}

function renderMetricTile(value: string, label: string): string {
  return `
    <div class="metric-tile">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function renderKeyValueRow(label: string, value: string, tone: "default" | "warn" = "default"): string {
  return `
    <div class="kv-row">
      <span>${escapeHtml(label)}</span>
      <strong class="${tone === "warn" ? "kv-warn" : ""}">${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderActionListRow(action: NextActionItem): string {
  return `
    <article class="stack-row">
      <div>
        <p>${escapeHtml(action.action)}</p>
        <span>${escapeHtml(action.reason)}</span>
      </div>
      ${renderChip(action.priority, action.priority)}
    </article>
  `;
}

function renderFileCard(file: string, status: KiwiControlContextTreeStatus): string {
  return `
    <div class="file-card">
      <span class="file-card-icon">${contextTreeStatusIcon(status)}</span>
      <div>
        <strong>${escapeHtml(file.split("/").pop() ?? file)}</strong>
        <span>${escapeHtml(file)}</span>
      </div>
    </div>
  `;
}

function renderAnnotatedFileCard(file: string, metric: string, note: string): string {
  return `
    <div class="file-card annotated">
      <div>
        <strong>${escapeHtml(file)}</strong>
        <span>${escapeHtml(note)}</span>
      </div>
      <em>${escapeHtml(metric)}</em>
    </div>
  `;
}

function renderScoreList(label: string, files: Array<{ file: string; score: number }>): string {
  return `
    <div class="score-list">
      <p class="inspector-label">${escapeHtml(label)}</p>
      ${files.slice(0, 6).map((file) => `
        <div class="score-row">
          <span>${escapeHtml(file.file)}</span>
          <strong>${file.score > 0 ? `+${file.score}` : `${file.score}`}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderGateRow(label: string, value: string, tone: "default" | "warn" | "success"): string {
  return `
    <div class="gate-row">
      <span>${escapeHtml(label)}</span>
      <strong class="gate-${tone}">${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderMeterRow(label: string, value: number, total: number): string {
  if (total <= 0) {
    return "";
  }

  const ratio = Math.max(0, Math.min(100, Math.round((value / total) * 100)));

  return `
    <div class="meter-row">
      <div class="meter-copy">
        <span>${escapeHtml(label)}</span>
        <strong>${ratio}%</strong>
      </div>
      <div class="meter-track">
        <div class="meter-fill" style="width: ${ratio}%"></div>
      </div>
    </div>
  `;
}

function renderDirectoryBar(label: string, tokens: number, total: number, meta: string): string {
  const ratio = total > 0 ? Math.max(4, Math.round((tokens / total) * 100)) : 4;
  return `
    <div class="directory-row">
      <div class="directory-copy">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(`${formatTokensShort(tokens)} · ${meta}`)}</span>
      </div>
      <div class="directory-bar">
        <div class="directory-bar-fill" style="width: ${ratio}%"></div>
      </div>
    </div>
  `;
}

function renderContextTree(tree: KiwiControlContextTree): string {
  return `
    <div class="tree-shell">
      <div class="tree-legend">
        <span><strong>✓</strong> selected</span>
        <span><strong>•</strong> candidate</span>
        <span><strong>×</strong> excluded</span>
      </div>
      <div class="tree-root">
        ${tree.nodes.map((node) => renderContextTreeNode(node)).join("")}
      </div>
    </div>
  `;
}

function renderContextTreeNode(node: KiwiControlContextTreeNode): string {
  if (node.kind === "file") {
    return `
      <div class="tree-node tree-file tree-${escapeHtml(node.status)}">
        <span class="tree-row">
          <span class="tree-status">${contextTreeStatusIcon(node.status)}</span>
          <span class="tree-name">${escapeHtml(node.name)}</span>
        </span>
      </div>
    `;
  }

  return `
    <details class="tree-node tree-directory tree-${escapeHtml(node.status)}" ${node.expanded ? "open" : ""}>
      <summary class="tree-row">
        <span class="tree-caret"></span>
        <span class="tree-status">${contextTreeStatusIcon(node.status)}</span>
        <span class="tree-name">${escapeHtml(node.name)}/</span>
      </summary>
      <div class="tree-children">
        ${node.children.map((child) => renderContextTreeNode(child)).join("")}
      </div>
    </details>
  `;
}

function renderChip(label: string, tone: RepoControlMode | NextActionItem["priority"] | "neutral"): string {
  const normalizedTone = tone === "bridge-unavailable" ? "warn" : tone;
  return `<span class="chip chip-${escapeHtml(normalizedTone)}">${escapeHtml(label)}</span>`;
}

function renderEmptyBlock(message: string): string {
  return `<p class="muted-copy">${escapeHtml(message)}</p>`;
}

function contextTreeStatusIcon(status: KiwiControlContextTreeStatus): string {
  switch (status) {
    case "selected":
      return "✓";
    case "excluded":
      return "×";
    default:
      return "•";
  }
}

function formatTokensShort(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return String(count);
}

function formatTimestamp(timestamp: string): string {
  if (!timestamp) {
    return "unknown time";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getPanelValue(items: PanelItem[], label: string): string {
  return items.find((item) => item.label === label)?.value ?? "none recorded";
}

function getRepoLabel(targetRoot: string): string {
  if (!targetRoot) {
    return "No repo loaded";
  }

  const segments = targetRoot.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? targetRoot;
}

function buildActiveTargetHint(state: RepoControlState): string {
  if (!state.targetRoot) {
    return "Run kc ui inside a repo to load it automatically.";
  }

  switch (state.repoState.mode) {
    case "healthy":
      return "Repo-local state is loaded and ready.";
    case "repo-not-initialized":
      return "This folder is not initialized yet. Run kc init in Terminal to get started.";
    case "initialized-invalid":
      return "This repo needs repair before continuity is fully trustworthy.";
    case "initialized-with-warnings":
      return "Repo is usable with a few warnings worth addressing.";
    case "bridge-unavailable":
    default:
      return BRIDGE_UNAVAILABLE_NEXT_STEP;
  }
}

function buildBridgeNote(state: RepoControlState, source: "cli" | "manual" | "shell"): string {
  if (!state.targetRoot) {
    return "Run kc ui inside a repo to load it automatically.";
  }
  if (state.repoState.mode === "bridge-unavailable") {
    return BRIDGE_UNAVAILABLE_NEXT_STEP;
  }
  if (source === "cli") {
    return `Loaded ${state.targetRoot} from kc ui.`;
  }
  if (source === "manual") {
    return `Loaded ${state.targetRoot}.`;
  }
  return `Repo-local state for ${state.targetRoot} is ready.`;
}

async function consumeInitialLaunchRequest(): Promise<LaunchRequestPayload | null> {
  if (!isTauriBridgeAvailable()) {
    return null;
  }

  try {
    return await invoke<LaunchRequestPayload | null>("consume_initial_launch_request");
  } catch {
    return null;
  }
}

async function loadRepoControlState(targetRoot: string): Promise<RepoControlState> {
  if (!isTauriBridgeAvailable()) {
    return buildBridgeUnavailableState(targetRoot);
  }

  try {
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
        : "Run kc ui inside a repo to load it automatically, or use the sidebar switcher to change repos.",
      sourceOfTruthNote:
        "Repo-local artifacts under .agent/ and promoted repo instruction files remain the source of truth. The desktop app never replaces that state."
    },
    repoOverview: [
      { label: "Project type", value: hasTargetRoot ? "unknown (awaiting repo bridge)" : "no repo loaded", ...(hasTargetRoot ? { tone: "warn" as const } : {}) },
      { label: "Active role", value: "none recorded" },
      { label: "Next file", value: hasTargetRoot ? ".agent/project.yaml" : "run kc ui inside a repo" },
      { label: "Next command", value: hasTargetRoot ? "kc ui" : "kc init" },
      { label: "Validation state", value: hasTargetRoot ? "bridge unavailable" : "waiting for repo", ...(hasTargetRoot ? { tone: "warn" as const } : {}) },
      { label: "Current phase", value: hasTargetRoot ? "restore repo bridge" : "load a repo" }
    ],
    continuity: [
      { label: "Latest checkpoint", value: "none recorded" },
      { label: "Latest handoff", value: "none recorded" },
      { label: "Latest reconcile", value: "none recorded" },
      { label: "Current focus", value: hasTargetRoot ? `reload repo-local state for ${resolvedTargetRoot}` : "open a repo from the CLI" },
      { label: "Open risks", value: hasTargetRoot ? "Cannot read repo-local state yet." : "No repo loaded.", tone: "warn" }
    ],
    memoryBank: [],
    specialists: {
      recommendedSpecialist: "review-specialist",
      handoffTargets: [],
      safeParallelHint: "Restore repo-local visibility first."
    },
    mcpPacks: {
      suggestedPack: { id: "core-pack", description: "Default repo-first pack." },
      available: []
    },
    validation: { ok: false, errors: hasTargetRoot ? 1 : 0, warnings: hasTargetRoot ? 0 : 1 },
    kiwiControl: EMPTY_KC
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

function isTauriBridgeAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
