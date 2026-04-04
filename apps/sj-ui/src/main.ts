import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// ---------------------------------------------------------------------------
// Types — mirror KiwiControlState from sj-core/ui-state.ts
// ---------------------------------------------------------------------------

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

type KiwiControlContextView = {
  task: string | null;
  selectedFiles: string[];
  excludedPatterns: string[];
  reason: string | null;
  confidence: string | null;
  keywordMatches: string[];
  timestamp: string | null;
};

type KiwiControlTokenAnalytics = {
  selectedTokens: number;
  fullRepoTokens: number;
  savingsPercent: number;
  fileCountSelected: number;
  fileCountTotal: number;
  estimationMethod: string | null;
  topDirectories: Array<{ directory: string; tokens: number; fileCount: number }>;
  costEstimates: Array<{ model: string; selectedCost: string; fullRepoCost: string; savingsCost: string }>;
  task: string | null;
  timestamp: string | null;
};

type KiwiControlEfficiency = {
  avoidedRepoScan: boolean;
  avoidedWebSearch: boolean;
  minimalEditMode: boolean;
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BRIDGE_UNAVAILABLE_NEXT_STEP = "Confirm kiwi-control works in Terminal, then run kc ui again.";

const EMPTY_KC: KiwiControlState = {
  contextView: {
    task: null, selectedFiles: [], excludedPatterns: [], reason: null,
    confidence: null, keywordMatches: [], timestamp: null
  },
  tokenAnalytics: {
    selectedTokens: 0, fullRepoTokens: 0, savingsPercent: 0,
    fileCountSelected: 0, fileCountTotal: 0, estimationMethod: null,
    topDirectories: [], costEstimates: [], task: null, timestamp: null
  },
  efficiency: {
    avoidedRepoScan: false, avoidedWebSearch: false, minimalEditMode: false,
    instructionsGenerated: false, instructionsPath: null
  },
  nextActions: { actions: [], summary: "" },
  feedback: { totalRuns: 0, successRate: 0, recentEntries: [], topBoostedFiles: [], topPenalizedFiles: [] },
  execution: { totalExecutions: 0, totalTokensUsed: 0, averageTokensPerRun: 0, successRate: 0, recentExecutions: [], tokenTrend: "insufficient-data" },
  wastedFiles: { files: [], totalWastedTokens: 0, removalSavingsPercent: 0 },
  heavyDirectories: { directories: [] }
};

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

const initialState = buildBridgeUnavailableState("");

// All dynamic values are escaped via escapeHtml() — safe for local Tauri context
app.innerHTML = buildShellHtml(initialState);

const activeTargetRootElement = document.querySelector<HTMLElement>("#active-target-root")!;
const activeTargetHintElement = document.querySelector<HTMLParagraphElement>("#active-target-hint")!;
const targetInputElement = document.querySelector<HTMLInputElement>("#target-root")!;
const loadButtonElement = document.querySelector<HTMLButtonElement>("#load-state")!;
const bridgeNoteElement = document.querySelector<HTMLParagraphElement>("#bridge-note")!;
const gridElement = document.querySelector<HTMLElement>(".grid")!;
const repoStateBannerElement = document.querySelector<HTMLElement>("#repo-state-banner")!;
const sourceOfTruthNoteElement = document.querySelector<HTMLElement>("#source-of-truth-note")!;

let currentTargetRoot = "";
let isLoadingRepoState = false;
let queuedLaunchRequest: LaunchRequestPayload | null = null;
let lastHandledLaunchRequestId = "";

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

// ---------------------------------------------------------------------------
// Shell HTML (static structure)
// ---------------------------------------------------------------------------

function buildShellHtml(state: RepoControlState): string {
  return `
  <main class="shell">
    <header class="hero">
      <p class="eyebrow">Kiwi Control</p>
      <h1>Your repo, already in view.</h1>
      <p class="lede">
        Launch from Terminal with <code>kc ui</code>. The desktop app reads repo-local state directly &mdash; it never owns or replaces it.
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
      <p id="source-of-truth-note">${escapeHtml(state.repoState.sourceOfTruthNote)}</p>
    </footer>
  </main>
  `;
}

// ---------------------------------------------------------------------------
// Boot & Launch Request Lifecycle
// ---------------------------------------------------------------------------

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
  if (!isTauriBridgeAvailable()) return;
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
  if (isLoadingRepoState || !isTauriBridgeAvailable()) return;

  const pendingLaunchRequest = await consumeInitialLaunchRequest();
  if (!pendingLaunchRequest || pendingLaunchRequest.requestId === lastHandledLaunchRequestId) return;

  await logUiEvent("ui-fallback-launch-request-consumed", pendingLaunchRequest.requestId, pendingLaunchRequest.targetRoot);
  await handleLaunchRequest(pendingLaunchRequest);
}

async function loadAndRenderTarget(targetRoot: string, source: "cli" | "manual", requestId?: string): Promise<void> {
  if (isLoadingRepoState) {
    if (requestId) queuedLaunchRequest = { requestId, targetRoot };
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
  await logUiEvent("ui-repo-state-rendered", requestId, state.targetRoot || targetRoot, state.repoState.mode);

  if (requestId) await acknowledgeLaunchRequest(requestId, state);

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

  if (!isTauriBridgeAvailable()) return;

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
  if (!isTauriBridgeAvailable()) return;
  try {
    await invoke("append_ui_launch_log", { event, requestId, targetRoot, detail });
  } catch {
    // Logging must never interrupt the product flow.
  }
}

// ---------------------------------------------------------------------------
// Render — Main State
// ---------------------------------------------------------------------------

function renderState(state: RepoControlState): void {
  const resolvedTargetRoot = state.targetRoot || "No repo loaded yet";
  activeTargetRootElement.textContent = resolvedTargetRoot;
  activeTargetRootElement.title = resolvedTargetRoot;
  activeTargetHintElement.textContent = buildActiveTargetHint(state);

  // All values are escaped via escapeHtml() — safe for local Tauri desktop context
  gridElement.innerHTML = renderPanels(state);

  repoStateBannerElement.className = `repo-state-banner repo-state-${state.repoState.mode}`;
  repoStateBannerElement.textContent = "";
  const kickerP = document.createElement("p");
  kickerP.className = "repo-state-kicker";
  kickerP.textContent = "Repo health";
  const titleH2 = document.createElement("h2");
  titleH2.textContent = state.repoState.title;
  const detailP = document.createElement("p");
  detailP.textContent = state.repoState.detail;
  repoStateBannerElement.appendChild(kickerP);
  repoStateBannerElement.appendChild(titleH2);
  repoStateBannerElement.appendChild(detailP);

  sourceOfTruthNoteElement.textContent = state.repoState.sourceOfTruthNote;
}

// ---------------------------------------------------------------------------
// Panel Rendering — 6 Required Components
// ---------------------------------------------------------------------------

function renderPanels(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;

  return [
    // 1. Dashboard — high-level stats at a glance
    renderDashboardPanel(state, kc),
    // 2. What Next — decision engine output (CRITICAL panel)
    renderWhatNextPanel(kc),
    // 3. Context Panel — file selection details
    renderContextPanel(kc),
    // 4. Token Analytics — visual bars, wasted files, heavy dirs
    renderTokenAnalyticsPanel(kc),
    // 5. Feedback Panel — adaptive learning history
    renderFeedbackPanel(kc),
    // 6. Execution Panel — run history + token trends
    renderExecutionPanel(kc)
  ].join("");
}

// ── Panel 1: Dashboard ──

function renderDashboardPanel(state: RepoControlState, kc: KiwiControlState): string {
  const savingsColor = kc.tokenAnalytics.savingsPercent >= 50 ? "stat-value-success" : "stat-value-warn";
  const successColor = kc.feedback.successRate >= 70 ? "stat-value-success" : kc.feedback.successRate > 0 ? "stat-value-warn" : "";
  const trendHtml = kc.execution.tokenTrend !== "insufficient-data"
    ? `<span class="trend-badge trend-${escapeHtml(kc.execution.tokenTrend)}">${trendIcon(kc.execution.tokenTrend)} ${escapeHtml(kc.execution.tokenTrend)}</span>`
    : "";

  const statsHtml = [
    renderStatCard(`${kc.tokenAnalytics.savingsPercent}%`, "Token savings", savingsColor),
    renderStatCard(String(kc.tokenAnalytics.fileCountSelected), "Files selected", ""),
    renderStatCard(formatTokensShort(kc.tokenAnalytics.selectedTokens), "Selected tokens", ""),
    renderStatCard(kc.feedback.totalRuns > 0 ? `${kc.feedback.successRate}%` : "\u2014", "Success rate", successColor),
    renderStatCard(kc.execution.totalExecutions > 0 ? String(kc.execution.totalExecutions) : "\u2014", "Total runs", "")
  ].join("");

  const tokenBarHtml = renderTokenBar("Selected vs Full Repo", kc.tokenAnalytics.selectedTokens, kc.tokenAnalytics.fullRepoTokens, "accent");
  const wastedBarHtml = kc.wastedFiles.totalWastedTokens > 0
    ? renderTokenBar("Wasted tokens in selection", kc.wastedFiles.totalWastedTokens, kc.tokenAnalytics.selectedTokens, "warn")
    : "";

  const rows = [
    renderPanelRow("Profile", escapeHtml(state.profileName)),
    renderPanelRow("Project", escapeHtml(state.projectType)),
    renderPanelRow("Instructions", kc.efficiency.instructionsGenerated ? "Ready" : "Not generated"),
    kc.contextView.task ? renderPanelRow("Active task", escapeHtml(kc.contextView.task)) : ""
  ].join("");

  return `
    <section class="panel panel-full">
      <div class="panel-header">
        <span class="panel-icon panel-icon-accent">&#9632;</span>
        <h2>Dashboard</h2>
        ${trendHtml}
      </div>
      <div class="stat-grid">${statsHtml}</div>
      ${tokenBarHtml}
      ${wastedBarHtml}
      <dl class="panel-list">${rows}</dl>
    </section>
  `;
}

// ── Panel 2: What Next (Decision Engine) ──

function renderWhatNextPanel(kc: KiwiControlState): string {
  const actions = kc.nextActions.actions;

  let content: string;
  if (actions.length === 0) {
    content = renderActionCard("low", "All systems nominal", "Context, instructions, and feedback are in order. You're ready for work.", null);
  } else {
    content = actions.slice(0, 5).map((a) =>
      renderActionCard(a.priority, a.action, a.reason, a.command)
    ).join("");
  }

  return `
    <section class="panel">
      <div class="panel-header">
        <span class="panel-icon panel-icon-warn">&#9654;</span>
        <h2>What Next</h2>
      </div>
      ${content}
    </section>
  `;
}

// ── Panel 3: Context Panel ──

function renderContextPanel(kc: KiwiControlState): string {
  const ctx = kc.contextView;

  if (!ctx.task) {
    return `
      <section class="panel">
        <div class="panel-header">
          <span class="panel-icon panel-icon-accent">&#9881;</span>
          <h2>Context Selection</h2>
        </div>
        ${renderActionCard("normal", "No context yet", 'Run kc prepare "your task" to select files and generate AI instructions.', null)}
      </section>
    `;
  }

  const confidenceClass = ctx.confidence === "high" ? "panel-row-success" : ctx.confidence === "low" ? "panel-row-warn" : "";
  const fileItems = ctx.selectedFiles.slice(0, 10).map((f) =>
    `<li><span class="file-name">${escapeHtml(f)}</span></li>`
  ).join("");
  const moreCount = ctx.selectedFiles.length - 10;

  const rows = [
    renderPanelRow("Task", escapeHtml(ctx.task)),
    `<div class="panel-row ${confidenceClass}"><dt>Confidence</dt><dd>${escapeHtml(ctx.confidence ?? "unknown")}</dd></div>`,
    renderPanelRow("Files", `${ctx.selectedFiles.length} selected / ${kc.tokenAnalytics.fileCountTotal} total`),
    ctx.keywordMatches.length > 0 ? renderPanelRow("Keywords", escapeHtml(ctx.keywordMatches.slice(0, 6).join(", "))) : "",
    ctx.reason ? renderPanelRow("Reason", escapeHtml(ctx.reason)) : ""
  ].join("");

  return `
    <section class="panel">
      <div class="panel-header">
        <span class="panel-icon panel-icon-accent">&#9881;</span>
        <h2>Context Selection</h2>
      </div>
      <dl class="panel-list">${rows}</dl>
      <ul class="file-list">
        ${fileItems}
        ${moreCount > 0 ? `<li><span class="file-name">+${moreCount} more files</span></li>` : ""}
      </ul>
    </section>
  `;
}

// ── Panel 4: Token Analytics ──

function renderTokenAnalyticsPanel(kc: KiwiControlState): string {
  const ta = kc.tokenAnalytics;

  if (!ta.task) {
    return `
      <section class="panel">
        <div class="panel-header">
          <span class="panel-icon panel-icon-accent">&#9879;</span>
          <h2>Token Analytics</h2>
        </div>
        ${renderActionCard("normal", "No token data yet", 'Run kc prepare "task" to compute token savings and cost estimates.', null)}
      </section>
    `;
  }

  const costRows = ta.costEstimates.slice(0, 3).map((c) =>
    renderPanelRow(escapeHtml(c.model), `${escapeHtml(c.selectedCost)} selected &middot; ${escapeHtml(c.savingsCost)} saved`)
  ).join("");

  const dirRows = ta.topDirectories.slice(0, 4).map((d) =>
    renderPanelRow(escapeHtml(d.directory), `${formatTokensShort(d.tokens)} &middot; ${d.fileCount} files`)
  ).join("");

  // Wasted files section
  const wf = kc.wastedFiles;
  let wastedHtml = "";
  if (wf.files.length > 0) {
    const wastedItems = wf.files.slice(0, 5).map((f) => `
      <li>
        <div>
          <span class="file-name">${escapeHtml(f.file)}</span>
          <div class="file-reason">${escapeHtml(f.reason)}</div>
        </div>
        <span class="file-tokens">${formatTokensShort(f.tokens)}</span>
      </li>
    `).join("");

    wastedHtml = `
      ${renderPanelRow("Wasted", `${formatTokensShort(wf.totalWastedTokens)} (${wf.removalSavingsPercent}% of selection)`)}
      <ul class="file-list">${wastedItems}</ul>
    `;
  }

  // Heavy directories section
  const hd = kc.heavyDirectories;
  let heavyHtml = "";
  if (hd.directories.length > 0) {
    const heavyItems = hd.directories.slice(0, 3).map((d) => `
      <li>
        <div>
          <span class="file-name">${escapeHtml(d.directory)} (${d.percentOfRepo}%)</span>
          <div class="file-reason">${escapeHtml(d.suggestion)}</div>
        </div>
        <span class="file-tokens">${formatTokensShort(d.tokens)}</span>
      </li>
    `).join("");

    heavyHtml = `
      ${renderPanelRow("Heavy dirs", `${hd.directories.length} director${hd.directories.length === 1 ? "y" : "ies"} over 15% of repo`)}
      <ul class="file-list">${heavyItems}</ul>
    `;
  }

  const tokenBarHtml = renderTokenBar(
    `${formatTokensShort(ta.selectedTokens)} selected of ${formatTokensShort(ta.fullRepoTokens)}`,
    ta.selectedTokens, ta.fullRepoTokens,
    ta.savingsPercent >= 50 ? "success" : "warn"
  );

  const mainRows = [
    renderPanelRow("Savings", `${ta.savingsPercent}%`),
    renderPanelRow("Files", `${ta.fileCountSelected} / ${ta.fileCountTotal}`),
    ta.estimationMethod ? renderPanelRow("Method", escapeHtml(ta.estimationMethod)) : "",
    costRows,
    dirRows,
    wastedHtml,
    heavyHtml
  ].join("");

  return `
    <section class="panel">
      <div class="panel-header">
        <span class="panel-icon panel-icon-accent">&#9879;</span>
        <h2>Token Analytics</h2>
      </div>
      ${tokenBarHtml}
      <dl class="panel-list">${mainRows}</dl>
    </section>
  `;
}

// ── Panel 5: Feedback Panel ──

function renderFeedbackPanel(kc: KiwiControlState): string {
  const fb = kc.feedback;

  if (fb.totalRuns === 0) {
    return `
      <section class="panel">
        <div class="panel-header">
          <span class="panel-icon panel-icon-success">&#10003;</span>
          <h2>Context Feedback</h2>
        </div>
        ${renderActionCard("normal", "No feedback yet", "After AI runs, use kc feedback to record which files were actually used. This trains context selection to improve over time.", null)}
      </section>
    `;
  }

  const recentEntries = fb.recentEntries.slice(0, 5).map((e) => `
    <div class="feedback-entry">
      <span class="feedback-dot ${e.success ? "feedback-dot-success" : "feedback-dot-fail"}"></span>
      <span class="feedback-task">${escapeHtml(e.task)}</span>
      <span class="feedback-meta">${e.filesUsed}/${e.filesSelected} used</span>
    </div>
  `).join("");

  const boostedHtml = fb.topBoostedFiles.length > 0
    ? renderFileScoreList("Boosted", "Files frequently used", fb.topBoostedFiles, "+")
    : "";

  const penalizedHtml = fb.topPenalizedFiles.length > 0
    ? renderFileScoreList("Penalized", "Files frequently wasted", fb.topPenalizedFiles, "-")
    : "";

  return `
    <section class="panel">
      <div class="panel-header">
        <span class="panel-icon panel-icon-success">&#10003;</span>
        <h2>Context Feedback</h2>
      </div>
      <div class="stat-grid">
        ${renderStatCard(String(fb.totalRuns), "Total runs", "")}
        ${renderStatCard(`${fb.successRate}%`, "Success rate", fb.successRate >= 70 ? "stat-value-success" : "stat-value-warn")}
      </div>
      ${recentEntries}
      ${boostedHtml}
      ${penalizedHtml}
    </section>
  `;
}

// ── Panel 6: Execution Panel ──

function renderExecutionPanel(kc: KiwiControlState): string {
  const ex = kc.execution;

  if (ex.totalExecutions === 0) {
    return `
      <section class="panel">
        <div class="panel-header">
          <span class="panel-icon panel-icon-accent">&#9889;</span>
          <h2>Execution History</h2>
        </div>
        ${renderActionCard("normal", "No executions recorded", "Execution tracking records token usage, success rates, and performance trends across AI runs.", null)}
      </section>
    `;
  }

  const trendClass = `trend-${ex.tokenTrend === "insufficient-data" ? "insufficient" : escapeHtml(ex.tokenTrend)}`;

  const recentRows = ex.recentExecutions.slice(0, 5).map((e) => `
    <div class="feedback-entry">
      <span class="feedback-dot ${e.success ? "feedback-dot-success" : "feedback-dot-fail"}"></span>
      <span class="feedback-task">${escapeHtml(e.task)}</span>
      <span class="feedback-meta">${formatTokensShort(e.tokensUsed)}</span>
    </div>
  `).join("");

  return `
    <section class="panel">
      <div class="panel-header">
        <span class="panel-icon panel-icon-accent">&#9889;</span>
        <h2>Execution History</h2>
      </div>
      <div class="stat-grid">
        ${renderStatCard(String(ex.totalExecutions), "Total runs", "")}
        ${renderStatCard(formatTokensShort(ex.averageTokensPerRun), "Avg tokens/run", "")}
        ${renderStatCard(`${ex.successRate}%`, "Success rate", ex.successRate >= 70 ? "stat-value-success" : "stat-value-warn")}
      </div>
      <div style="margin-bottom: 12px;">
        <span class="trend-badge ${trendClass}">${trendIcon(ex.tokenTrend)} Token trend: ${escapeHtml(ex.tokenTrend.replace("-", " "))}</span>
      </div>
      ${recentRows}
    </section>
  `;
}

// ---------------------------------------------------------------------------
// Rendering Helpers
// ---------------------------------------------------------------------------

function renderStatCard(value: string, label: string, colorClass: string): string {
  return `
    <div class="stat-card">
      <div class="stat-value ${colorClass}">${escapeHtml(value)}</div>
      <div class="stat-label">${escapeHtml(label)}</div>
    </div>
  `;
}

function renderPanelRow(label: string, value: string): string {
  return `
    <div class="panel-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${value}</dd>
    </div>
  `;
}

function renderActionCard(priority: string, title: string, reason: string, command: string | null): string {
  return `
    <div class="action-card">
      <div class="action-card-title">
        <span class="priority-badge priority-${escapeHtml(priority)}">${escapeHtml(priority)}</span>
        ${escapeHtml(title)}
      </div>
      <p class="action-card-reason">${escapeHtml(reason)}</p>
      ${command ? `<code class="action-card-cmd">${escapeHtml(command)}</code>` : ""}
    </div>
  `;
}

function renderFileScoreList(label: string, description: string, files: Array<{ file: string; score: number }>, prefix: string): string {
  const items = files.slice(0, 3).map((f) => `
    <li><span class="file-name">${escapeHtml(f.file)}</span><span class="file-tokens">${prefix}${f.score}</span></li>
  `).join("");

  return `
    <dl class="panel-list">
      ${renderPanelRow(label, description)}
    </dl>
    <ul class="file-list">${items}</ul>
  `;
}

function renderTokenBar(label: string, value: number, total: number, color: "accent" | "warn" | "success"): string {
  if (total <= 0) return "";
  const pct = Math.min(100, Math.round((value / total) * 100));
  return `
    <div class="token-bar-container">
      <div class="token-bar-label">
        <span>${escapeHtml(label)}</span>
        <span>${pct}%</span>
      </div>
      <div class="token-bar-track">
        <div class="token-bar-fill token-bar-fill-${color}" style="width: ${pct}%"></div>
      </div>
    </div>
  `;
}

function trendIcon(trend: string): string {
  switch (trend) {
    case "improving": return "\u2193";
    case "worsening": return "\u2191";
    case "stable": return "\u2194";
    default: return "\u2022";
  }
}

function formatTokensShort(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

// ---------------------------------------------------------------------------
// Bridge & State Loading
// ---------------------------------------------------------------------------

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
  if (!state.targetRoot) return "Run kc ui inside a repo to load it automatically.";
  if (state.repoState.mode === "bridge-unavailable") return BRIDGE_UNAVAILABLE_NEXT_STEP;
  if (source === "cli") return `Loaded ${state.targetRoot} from kc ui.`;
  if (source === "manual") return `Loaded ${state.targetRoot}.`;
  return `Repo-local state for ${state.targetRoot} is ready.`;
}

async function consumeInitialLaunchRequest(): Promise<LaunchRequestPayload | null> {
  if (!isTauriBridgeAvailable()) return null;
  try {
    return await invoke<LaunchRequestPayload | null>("consume_initial_launch_request");
  } catch {
    return null;
  }
}

async function loadRepoControlState(targetRoot: string): Promise<RepoControlState> {
  if (!isTauriBridgeAvailable()) return buildBridgeUnavailableState(targetRoot);
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
        : "Run kc ui inside a repo to load it automatically, or use \u201cLoad another repo\u201d to switch.",
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
