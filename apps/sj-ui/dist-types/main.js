import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { renderTopBarView } from "./ui/TopBar.js";
import { renderGraphViewPanel } from "./ui/GraphPanel.js";
import { renderContextTreePanel } from "./ui/ContextTreePanel.js";
import { renderExecutionPlanPanelView } from "./ui/ExecutionPlanPanel.js";
import { renderInspectorPanel } from "./ui/InspectorPanel.js";
import { renderMachinePanelView } from "./ui/MachinePanel.js";
import { buildExplainCommandEntries, buildExplainSelectionEntries, buildTerminalHelpEntries, formatCliCommand } from "./ui/command-help.js";
import { buildDecisionSummary as buildDecisionSummaryModel, buildExecutionPlanPanelContextModel, buildInspectorContextModel } from "./ui/view-models.js";
import { buildActiveTargetHint as buildActiveTargetHintModel, buildBridgeNote as buildBridgeNoteModel, buildFinalReadyDetail as buildFinalReadyDetailModel, buildLoadStatus as buildLoadStatusModel, deriveReadinessSummary as deriveReadinessSummaryModel } from "./ui/readiness.js";
import { buildBlockedActionGuidance, deriveExecutionPlanFailureGuidance, deriveRepoRecoveryGuidance } from "./ui/guidance.js";
import { deriveGraphProjection, materializeGraphModel, resolveProjectedNodePosition } from "./ui/graph-model.js";
const NAV_ITEMS = [
    { id: "overview", label: "Overview", icon: iconSvg("overview") },
    { id: "context", label: "Context", icon: iconSvg("context") },
    { id: "graph", label: "Graph", icon: iconSvg("graph") },
    { id: "tokens", label: "Tokens", icon: iconSvg("tokens") },
    { id: "feedback", label: "Feedback", icon: iconSvg("feedback") },
    { id: "mcps", label: "MCPs", icon: iconSvg("mcps") },
    { id: "specialists", label: "Specialists", icon: iconSvg("specialists") },
    { id: "system", label: "System", icon: iconSvg("system") },
    { id: "validation", label: "Validation", icon: iconSvg("validation") },
    { id: "machine", label: "Machine", icon: iconSvg("system") }
];
const BRIDGE_UNAVAILABLE_NEXT_STEP = "Confirm kiwi-control works in Terminal, then run kc ui again.";
const AUTO_REFRESH_INTERVAL_MS = 45_000;
const AUTO_REFRESH_MIN_AGE_MS = 30_000;
const READY_STATE_PULSE_MS = 4_500;
const GRAPH_INTERACTION_SETTLE_MS = 180;
const MACHINE_LIGHTWEIGHT_SECTIONS = [
    "inventory",
    "configHealth",
    "mcpInventory",
];
const MACHINE_HEAVY_SECTIONS = [
    "guidance",
    "optimizationLayers",
    "setupPhases",
    "usage"
];
const EMPTY_KC = {
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
        basedOnPastRuns: false,
        reusedPattern: null,
        similarTasks: [],
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
    },
    indexing: {
        totalFiles: 0,
        observedFiles: 0,
        selectedFiles: 0,
        candidateFiles: 0,
        excludedFiles: 0,
        discoveredFiles: 0,
        analyzedFiles: 0,
        skippedFiles: 0,
        skippedDirectories: 0,
        visitedDirectories: 0,
        maxDepthExplored: 0,
        fileBudgetReached: false,
        directoryBudgetReached: false,
        partialScan: false,
        ignoreRulesApplied: [],
        skipped: [],
        indexedFiles: 0,
        indexUpdatedFiles: 0,
        indexReusedFiles: 0,
        impactFiles: 0,
        changedSignals: 0,
        keywordSignals: 0,
        importSignals: 0,
        repoContextSignals: 0,
        scopeArea: null,
        coverageNote: "Run kiwi-control prepare to record indexing coverage and selection reasoning.",
        selectionReason: null
    },
    fileAnalysis: {
        totalFiles: 0,
        scannedFiles: 0,
        skippedFiles: 0,
        selectedFiles: 0,
        excludedFiles: 0,
        selected: [],
        excluded: [],
        skipped: []
    },
    contextTrace: {
        initialSignals: {
            changedFiles: [],
            recentFiles: [],
            importNeighbors: [],
            proximityFiles: [],
            keywordMatches: [],
            repoContextFiles: []
        },
        expansionSteps: [],
        honesty: {
            heuristic: true,
            lowConfidence: false,
            partialScan: false
        }
    },
    tokenBreakdown: {
        partialScan: false,
        categories: []
    },
    decisionLogic: {
        summary: "",
        decisionPriority: "low",
        inputSignals: [],
        reasoningChain: [],
        ignoredSignals: []
    },
    runtimeLifecycle: {
        currentTask: null,
        currentStage: "idle",
        validationStatus: null,
        nextSuggestedCommand: null,
        nextRecommendedAction: null,
        recentEvents: []
    },
    measuredUsage: {
        available: false,
        source: "none",
        totalTokens: 0,
        totalRuns: 0,
        runs: [],
        workflows: [],
        files: [],
        note: "No measured token usage is available yet."
    },
    skills: {
        activeSkills: [],
        suggestedSkills: [],
        totalSkills: 0
    },
    workflow: {
        task: null,
        status: "pending",
        currentStepId: null,
        steps: []
    },
    executionTrace: {
        steps: [],
        whyThisHappened: ""
    },
    executionPlan: {
        summary: "",
        state: "idle",
        currentStepIndex: 0,
        confidence: null,
        risk: "low",
        blocked: false,
        steps: [],
        nextCommands: [],
        lastError: null
    }
};
const app = document.querySelector("#app");
const bootOverlay = document.querySelector("#boot-overlay");
if (!app) {
    throw new Error("App root not found");
}
let activeView = "overview";
let activeLogTab = "history";
let activeValidationTab = "all";
let activeHandoffTab = "handoffs";
let isLogDrawerOpen = true;
let isInspectorOpen = true;
let currentState = buildBridgeUnavailableState("");
let activeTheme = loadStoredTheme();
let activeMode = "execution";
const platformMode = detectPlatform();
let shellElement;
let railNavElement;
let bridgeNoteElement;
let topbarElement;
let centerMainElement;
let inspectorElement;
let logDrawerElement;
let workspaceSurfaceElement;
let currentTargetRoot = "";
let isLoadingRepoState = false;
let isRefreshingFreshRepoState = false;
let queuedLaunchRequest = null;
let lastHandledLaunchRequestId = "";
let machineHydrationRound = 0;
let machineHydrationInFlight = false;
let machineHydrationActiveSections = new Set();
let hydratedMachineSections = new Set();
let currentLoadSource = null;
let desktopRuntimeInfo = null;
let lastRepoRefreshAt = 0;
let lastRepoLoadFailure = null;
let renderQueued = false;
let centerRenderQueued = false;
let deferredMachineHydrationTimer = null;
let deferredShellRenderTimer = null;
let pendingShellRenderAfterInteraction = false;
let lastGraphInteractionAt = 0;
let activeInteractiveTargetRoot = "";
let lastReadyStateSignal = null;
let readyStateTimer = null;
let commandState = {
    activeCommand: null,
    loading: false,
    composer: null,
    draftValue: "",
    lastResult: null,
    lastError: null
};
let lastBlockedActionGuidance = null;
let focusedItem = null;
let contextOverrides = new Map();
let contextOverrideHistory = [];
let graphNodePositions = new Map();
let graphPan = { x: 0, y: 0 };
let graphZoom = 1;
let graphDepth = 2;
let graphSelectedPath = null;
let graphInteraction = null;
let localPlanOrder = [];
let localPlanSkipped = new Set();
let localPlanEdits = new Map();
let editingPlanStepId = null;
let editingPlanDraft = "";
let approvalMarkers = new Map();
let contextOverrideVersion = 0;
let derivedTreeCache = null;
let graphProjectionCache = null;
let activeGraphProjection = null;
let graphPatchQueued = false;
let pendingGraphPatchPaths = new Set();
let graphViewportElement = null;
try {
    app.innerHTML = buildShellHtml();
    shellElement = requireElement(".kc-shell");
    railNavElement = requireElement("#rail-nav");
    bridgeNoteElement = requireElement("#bridge-note");
    topbarElement = requireElement("#topbar");
    centerMainElement = requireElement("#center-main");
    inspectorElement = requireElement("#inspector");
    logDrawerElement = requireElement("#log-drawer");
    workspaceSurfaceElement = requireElement("#workspace-surface");
    applyChromePreferences();
    renderState(currentState);
    bridgeNoteElement.textContent = buildBridgeNote(currentState, "shell");
    finalizeInitialRender();
    app.addEventListener("click", (event) => {
        const target = event.target;
        if (!target) {
            return;
        }
        const mouseEvent = event;
        const viewButton = target.closest("[data-view]");
        if (viewButton?.dataset.view) {
            activeView = viewButton.dataset.view;
            scheduleRenderState();
            scheduleMachineHydrationForView(activeView, false);
            return;
        }
        if (target.closest("[data-toggle-logs]")) {
            isLogDrawerOpen = !isLogDrawerOpen;
            scheduleRenderState();
            return;
        }
        if (target.closest("[data-toggle-inspector]")) {
            isInspectorOpen = !isInspectorOpen;
            scheduleRenderState();
            return;
        }
        const logTabButton = target.closest("[data-log-tab]");
        if (logTabButton?.dataset.logTab) {
            activeLogTab = logTabButton.dataset.logTab;
            scheduleRenderState();
            return;
        }
        const validationTabButton = target.closest("[data-validation-tab]");
        if (validationTabButton?.dataset.validationTab) {
            activeValidationTab = validationTabButton.dataset.validationTab;
            scheduleRenderState();
            return;
        }
        if (target.closest("[data-theme-toggle]")) {
            activeTheme = activeTheme === "dark" ? "light" : "dark";
            applyChromePreferences();
            scheduleRenderState();
            return;
        }
        const modeButton = target.closest("[data-ui-mode]");
        if (modeButton?.dataset.uiMode) {
            activeMode = modeButton.dataset.uiMode;
            if (activeMode === "execution") {
                isLogDrawerOpen = false;
                activeLogTab = "history";
            }
            scheduleRenderState();
            return;
        }
        if (handleInteractiveClick(mouseEvent, target)) {
            return;
        }
        if (target.closest("[data-reload-state]")) {
            if (currentTargetRoot) {
                void loadAndRenderTarget(currentTargetRoot, "manual");
            }
        }
    });
    app.addEventListener("input", (event) => {
        const target = event.target;
        if (!target) {
            return;
        }
        if (target.matches("[data-command-draft]")) {
            commandState.draftValue = target.value;
            return;
        }
        if (target.matches("[data-plan-edit-input]")) {
            editingPlanDraft = target.value;
        }
    });
    app.addEventListener("change", (event) => {
        const target = event.target;
        if (!target) {
            return;
        }
        if (target.matches("[data-command-draft]")) {
            commandState.draftValue = target.value;
        }
    });
    app.addEventListener("wheel", (event) => {
        const target = event.target;
        if (!target || !target.closest("[data-graph-surface]")) {
            return;
        }
        event.preventDefault();
        markGraphInteractionActivity();
        const delta = event.deltaY > 0 ? -0.12 : 0.12;
        graphZoom = Math.max(0.65, Math.min(2.4, Number((graphZoom + delta).toFixed(2))));
        if (!updateGraphViewportTransform()) {
            scheduleCenterRender();
        }
    }, { passive: false });
    app.addEventListener("pointerdown", (event) => {
        const target = event.target;
        if (!target) {
            return;
        }
        const node = target.closest("[data-graph-node]");
        if (node?.dataset.path) {
            markGraphInteractionActivity();
            graphInteraction = {
                mode: "drag-node",
                path: node.dataset.path,
                lastClientX: event.clientX,
                lastClientY: event.clientY
            };
            return;
        }
        if (target.closest("[data-graph-surface]")) {
            markGraphInteractionActivity();
            graphInteraction = {
                mode: "pan",
                lastClientX: event.clientX,
                lastClientY: event.clientY
            };
        }
    });
    window.addEventListener("pointermove", (event) => {
        if (!graphInteraction) {
            return;
        }
        const deltaX = event.clientX - graphInteraction.lastClientX;
        const deltaY = event.clientY - graphInteraction.lastClientY;
        markGraphInteractionActivity();
        if (graphInteraction.mode === "pan") {
            graphPan = {
                x: graphPan.x + deltaX,
                y: graphPan.y + deltaY
            };
            graphInteraction.lastClientX = event.clientX;
            graphInteraction.lastClientY = event.clientY;
            if (!updateGraphViewportTransform()) {
                scheduleCenterRender();
            }
            return;
        }
        const existing = graphNodePositions.get(graphInteraction.path) ?? { x: 0, y: 0 };
        graphNodePositions.set(graphInteraction.path, {
            x: existing.x + deltaX / graphZoom,
            y: existing.y + deltaY / graphZoom
        });
        graphInteraction.lastClientX = event.clientX;
        graphInteraction.lastClientY = event.clientY;
        scheduleGraphInteractionPatch(graphInteraction.path);
    });
    window.addEventListener("pointerup", () => {
        if (graphInteraction?.mode === "drag-node") {
            markGraphInteractionActivity();
            scheduleGraphInteractionPatch(graphInteraction.path);
        }
        graphInteraction = null;
        if (pendingShellRenderAfterInteraction) {
            scheduleNonCriticalShellRender();
        }
    });
    window.addEventListener("keydown", (event) => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLInputElement
            || activeElement instanceof HTMLTextAreaElement
            || activeElement instanceof HTMLSelectElement) {
            return;
        }
        if (event.altKey && event.key.toLowerCase() === "g") {
            event.preventDefault();
            void executeKiwiCommand("guide", [], { expectJson: true });
            return;
        }
        if (event.altKey && event.key.toLowerCase() === "n") {
            event.preventDefault();
            void executeKiwiCommand("next", [], { expectJson: true });
            return;
        }
        if (event.altKey && event.key.toLowerCase() === "v") {
            event.preventDefault();
            void executeKiwiCommand("validate", [], { expectJson: true });
            return;
        }
        if (event.altKey && event.key === "Enter") {
            event.preventDefault();
            void executeKiwiCommand("run-auto", [seedComposerDraft("run-auto")], { expectJson: false });
        }
    });
    void boot();
}
catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error);
    console.error(detail);
    window.__KIWI_BOOT_API__?.renderError(`Synchronous renderer boot failure:\n${detail}`);
}
function requireElement(selector) {
    const element = document.querySelector(selector);
    if (!element) {
        throw new Error(`Shell mount point not found: ${selector}`);
    }
    return element;
}
function loadStoredTheme() {
    try {
        const stored = window.localStorage.getItem("kiwi-control-theme");
        if (stored === "dark" || stored === "light") {
            return stored;
        }
    }
    catch {
        // Ignore storage failures and fall back to dark mode.
    }
    return "dark";
}
function finalizeInitialRender() {
    const bootApi = window.__KIWI_BOOT_API__;
    window.requestAnimationFrame(() => {
        const hasVisibleShell = Boolean(topbarElement.textContent?.trim()) ||
            Boolean(centerMainElement.textContent?.trim()) ||
            Boolean(inspectorElement.textContent?.trim());
        if (!hasVisibleShell) {
            bootApi?.renderError("Renderer mounted but produced no visible UI content.");
            return;
        }
        if (bootApi) {
            bootApi.mounted = true;
        }
        bootApi?.hide();
    });
}
function detectPlatform() {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("win")) {
        return "windows";
    }
    if (userAgent.includes("mac")) {
        return "macos";
    }
    return "linux";
}
function applyChromePreferences() {
    shellElement.dataset.theme = activeTheme;
    shellElement.dataset.platform = platformMode;
    document.documentElement.dataset.theme = activeTheme;
    document.documentElement.dataset.platform = platformMode;
    try {
        window.localStorage.setItem("kiwi-control-theme", activeTheme);
    }
    catch {
        // Theme persistence is best-effort only.
    }
}
function buildShellHtml() {
    return `
    <main class="kc-shell">
      <header class="kc-topbar" id="topbar"></header>
      <div class="kc-main-frame">
        <aside class="kc-rail">
          <div class="kc-rail-brand">
            <div class="kc-logo">K</div>
          </div>
          <nav class="kc-rail-nav" id="rail-nav"></nav>
          <div class="kc-rail-footer" id="bridge-note"></div>
        </aside>
        <section class="kc-workspace">
          <div class="kc-workspace-surface" id="workspace-surface">
            <div class="kc-main-stack">
              <div class="kc-view-scroll" id="center-main"></div>
              <section class="kc-log-drawer" id="log-drawer"></section>
            </div>
            <aside class="kc-inspector" id="inspector"></aside>
          </div>
        </section>
      </div>
    </main>
  `;
}
async function boot() {
    await loadDesktopRuntimeInfo();
    await registerLaunchRequestListener();
    const initialLaunchRequest = await consumeInitialLaunchRequest();
    if (initialLaunchRequest) {
        await logUiEvent("ui-initial-launch-request-consumed", initialLaunchRequest.requestId, initialLaunchRequest.targetRoot);
        await handleLaunchRequest(initialLaunchRequest);
    }
    else {
        await logUiEvent("ui-initial-launch-request-missing");
    }
    window.setInterval(() => {
        void pollPendingLaunchRequest();
    }, 250);
    window.setInterval(() => {
        void maybeAutoRefreshState();
    }, AUTO_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", () => {
        void maybeAutoRefreshState();
    });
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            void maybeAutoRefreshState();
        }
    });
}
async function registerLaunchRequestListener() {
    if (!isTauriBridgeAvailable()) {
        return;
    }
    try {
        await listen("desktop-launch-request", (event) => {
            void handleLaunchRequest(event.payload);
        });
    }
    catch {
        // Browser-only contexts do not need live retarget listeners.
    }
}
async function loadDesktopRuntimeInfo() {
    if (!isTauriBridgeAvailable()) {
        return;
    }
    try {
        desktopRuntimeInfo = await invoke("get_desktop_runtime_info");
        scheduleRenderState();
    }
    catch {
        desktopRuntimeInfo = null;
    }
}
async function handleLaunchRequest(request) {
    await logUiEvent("ui-launch-request-received", request.requestId, request.targetRoot);
    lastHandledLaunchRequestId = request.requestId;
    if (isLoadingRepoState) {
        queuedLaunchRequest = request;
        await logUiEvent("ui-launch-request-queued", request.requestId, request.targetRoot);
        return;
    }
    await loadAndRenderTarget(request.targetRoot, "cli", request.requestId);
}
async function pollPendingLaunchRequest() {
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
async function loadAndRenderTarget(targetRoot, source, requestId, options = {}) {
    if (isLoadingRepoState || isRefreshingFreshRepoState) {
        if (requestId) {
            queuedLaunchRequest = { requestId, targetRoot };
        }
        return;
    }
    isLoadingRepoState = true;
    currentLoadSource = source;
    currentTargetRoot = targetRoot;
    lastRepoLoadFailure = null;
    lastReadyStateSignal = null;
    lastBlockedActionGuidance = null;
    bridgeNoteElement.textContent =
        source === "cli"
            ? `Opening ${targetRoot} from ${requestId ? "kc ui" : "the CLI"}...`
            : source === "auto"
                ? `Refreshing repo-local state for ${targetRoot}...`
                : `Loading repo-local state for ${targetRoot}...`;
    renderState(currentState);
    try {
        const state = await loadRepoControlState(targetRoot, options.preferSnapshot ?? (source !== "auto"));
        currentTargetRoot = state.targetRoot || targetRoot;
        currentState = state;
        lastRepoRefreshAt = Date.now();
        renderState(state);
        bridgeNoteElement.textContent = buildBridgeNote(state, source);
        await logUiEvent("ui-repo-state-rendered", requestId, state.targetRoot || targetRoot, `${state.repoState.mode}:${state.loadState.source}`);
        if ((state.loadState.source === "warm-snapshot" || state.loadState.source === "stale-snapshot") && source !== "auto") {
            isLoadingRepoState = false;
            currentLoadSource = null;
            isRefreshingFreshRepoState = true;
            renderState(currentState);
            if (requestId) {
                await acknowledgeLaunchRequest(requestId, currentTargetRoot, "hydrating", state.loadState.source === "stale-snapshot"
                    ? `Loaded an older repo snapshot for ${currentTargetRoot}. Fresh repo-local state is still hydrating.`
                    : `Loaded a warm repo snapshot for ${currentTargetRoot}. Fresh repo-local state is still hydrating.`);
            }
            window.setTimeout(() => {
                void refreshFreshRepoState(currentTargetRoot, requestId);
            }, 32);
            return;
        }
        startMachineHydrationCycle(false);
        noteReadyState(buildFinalReadyDetail(state));
        scheduleRenderState();
        if (requestId) {
            await acknowledgeLaunchRequest(requestId, currentTargetRoot, state.repoState.mode === "bridge-unavailable" ? "error" : "ready");
        }
    }
    catch (error) {
        lastRepoLoadFailure = error instanceof Error ? error.message : String(error);
        const canRetainCurrentState = (source === "auto" || source === "manual")
            && currentState.targetRoot === targetRoot
            && currentState.repoState.mode !== "bridge-unavailable";
        if (canRetainCurrentState) {
            bridgeNoteElement.textContent = `Kiwi kept the last known repo-local state for ${targetRoot}. Refresh failed: ${lastRepoLoadFailure}`;
            renderState(currentState);
            await logUiEvent("ui-repo-state-retained-after-refresh-failure", requestId, targetRoot, lastRepoLoadFailure);
            return;
        }
        const fallbackState = buildBridgeUnavailableState(targetRoot);
        currentState = fallbackState;
        currentTargetRoot = fallbackState.targetRoot || targetRoot;
        bridgeNoteElement.textContent = `Kiwi could not load repo-local state for ${targetRoot}. ${lastRepoLoadFailure}`;
        renderState(fallbackState);
        await logUiEvent("ui-repo-state-failed", requestId, targetRoot, lastRepoLoadFailure);
        if (requestId) {
            await acknowledgeLaunchRequest(requestId, targetRoot, "error", lastRepoLoadFailure);
        }
    }
    finally {
        isLoadingRepoState = false;
        currentLoadSource = null;
        if (!isRefreshingFreshRepoState) {
            await flushQueuedLaunchRequest(requestId);
        }
    }
}
async function maybeAutoRefreshState() {
    const refreshAgeMs = Date.now() - lastRepoRefreshAt;
    const recentFreshState = currentState.loadState.source === "fresh"
        && currentState.repoState.mode !== "initialized-invalid"
        && refreshAgeMs < 5 * 60_000;
    if (!currentTargetRoot
        || isLoadingRepoState
        || isRefreshingFreshRepoState
        || commandState.loading
        || document.hidden
        || refreshAgeMs < AUTO_REFRESH_MIN_AGE_MS
        || recentFreshState) {
        return;
    }
    await loadAndRenderTarget(currentTargetRoot, "auto", undefined, { preferSnapshot: false });
}
async function refreshFreshRepoState(targetRoot, requestId) {
    try {
        const freshState = await loadRepoControlState(targetRoot, false);
        currentTargetRoot = freshState.targetRoot || targetRoot;
        currentState = freshState;
        lastRepoRefreshAt = Date.now();
        lastRepoLoadFailure = null;
        if (shouldDeferShellRenderForGraphInteraction()) {
            scheduleNonCriticalShellRender();
        }
        else {
            renderState(freshState);
        }
        bridgeNoteElement.textContent = buildBridgeNote(freshState, "manual");
        await logUiEvent("ui-repo-state-refreshed", requestId, currentTargetRoot, freshState.repoState.mode);
        startMachineHydrationCycle(false);
        noteReadyState(buildFinalReadyDetail(freshState));
        scheduleNonCriticalShellRender();
        if (requestId) {
            await acknowledgeLaunchRequest(requestId, currentTargetRoot, freshState.repoState.mode === "bridge-unavailable" ? "error" : "ready");
        }
    }
    catch (error) {
        lastRepoLoadFailure = error instanceof Error ? error.message : String(error);
        bridgeNoteElement.textContent = `Showing a warm repo snapshot for ${targetRoot}. Fresh refresh failed: ${lastRepoLoadFailure}`;
        await logUiEvent("ui-repo-state-refresh-failed", requestId, targetRoot, lastRepoLoadFailure);
        scheduleNonCriticalShellRender();
    }
    finally {
        isRefreshingFreshRepoState = false;
        await flushQueuedLaunchRequest(requestId);
    }
}
async function flushQueuedLaunchRequest(currentRequestId) {
    if (queuedLaunchRequest && queuedLaunchRequest.requestId !== currentRequestId) {
        const nextRequest = queuedLaunchRequest;
        queuedLaunchRequest = null;
        await handleLaunchRequest(nextRequest);
        return;
    }
    queuedLaunchRequest = null;
}
async function acknowledgeLaunchRequest(requestId, targetRoot, status, detail) {
    const resolvedDetail = detail ?? (status === "ready"
        ? `Loaded repo-local state for ${targetRoot}.`
        : status === "hydrating"
            ? `Loaded a warm repo snapshot for ${targetRoot}. Fresh repo-local state is still hydrating.`
            : BRIDGE_UNAVAILABLE_NEXT_STEP);
    if (!isTauriBridgeAvailable()) {
        return;
    }
    try {
        await logUiEvent("ui-ack-attempt", requestId, targetRoot, status);
        await invoke("ack_launch_request", { requestId, targetRoot, status, detail: resolvedDetail });
        await logUiEvent("ui-ack-succeeded", requestId, targetRoot, status);
    }
    catch (error) {
        bridgeNoteElement.textContent = "Kiwi Control loaded this repo, but the desktop launch acknowledgement did not complete yet.";
        await logUiEvent("ui-ack-failed", requestId, targetRoot, error instanceof Error ? error.message : String(error));
    }
}
async function logUiEvent(event, requestId, targetRoot, detail) {
    if (!isTauriBridgeAvailable()) {
        return;
    }
    try {
        await invoke("append_ui_launch_log", { event, requestId, targetRoot, detail });
    }
    catch {
        // Logging must never interrupt the product flow.
    }
}
function isSnapshotLoadSource(source) {
    return source === "warm-snapshot" || source === "stale-snapshot";
}
function isMachineHeavyView(view) {
    return view === "machine" || view === "tokens" || view === "mcps" || view === "system";
}
function dedupeMachineSections(sections) {
    return [...new Set(sections)];
}
function machinePrioritySectionsForView(view) {
    switch (view) {
        case "tokens":
            return ["usage", "optimizationLayers"];
        case "mcps":
            return ["mcpInventory", "optimizationLayers"];
        case "system":
            return ["inventory", "configHealth", "setupPhases"];
        case "machine":
            return ["guidance", "inventory", "configHealth"];
        default:
            return MACHINE_LIGHTWEIGHT_SECTIONS;
    }
}
function machineSecondarySectionsForView(view) {
    if (!isMachineHeavyView(view)) {
        return [];
    }
    return dedupeMachineSections([
        ...MACHINE_LIGHTWEIGHT_SECTIONS,
        ...MACHINE_HEAVY_SECTIONS
    ]);
}
function sectionsNeedingHydration(sections, refresh) {
    return sections.filter((section) => {
        if (refresh) {
            return true;
        }
        if (!hydratedMachineSections.has(section)) {
            return true;
        }
        return currentState.machineAdvisory.sections[section]?.status !== "fresh";
    });
}
function scheduleMachineHydrationForView(view, refresh) {
    if (!currentTargetRoot || !isTauriBridgeAvailable()) {
        return;
    }
    const prioritySections = sectionsNeedingHydration(machinePrioritySectionsForView(view), refresh);
    const secondarySections = sectionsNeedingHydration(machineSecondarySectionsForView(view).filter((section) => !prioritySections.includes(section)), refresh);
    const round = ++machineHydrationRound;
    if (deferredMachineHydrationTimer != null) {
        window.clearTimeout(deferredMachineHydrationTimer);
        deferredMachineHydrationTimer = null;
    }
    if (prioritySections.length > 0) {
        void hydrateMachineAdvisory(refresh, prioritySections, round);
    }
    if (secondarySections.length > 0) {
        deferredMachineHydrationTimer = window.setTimeout(() => {
            void hydrateMachineAdvisory(refresh, secondarySections, round);
            deferredMachineHydrationTimer = null;
        }, 900);
    }
}
function startMachineHydrationCycle(refresh) {
    scheduleMachineHydrationForView(activeView, refresh);
}
async function hydrateMachineAdvisory(refresh, sections, round) {
    if (!isTauriBridgeAvailable() || sections.length === 0) {
        return;
    }
    machineHydrationInFlight = true;
    for (const section of sections) {
        machineHydrationActiveSections.add(section);
    }
    scheduleRenderState();
    await Promise.all(sections.map((section) => hydrateMachineSection(section, refresh, round)));
    if (round !== machineHydrationRound) {
        for (const section of sections) {
            machineHydrationActiveSections.delete(section);
        }
        if (machineHydrationActiveSections.size === 0) {
            machineHydrationInFlight = false;
        }
        scheduleRenderState();
        return;
    }
    for (const section of sections) {
        machineHydrationActiveSections.delete(section);
    }
    if (machineHydrationActiveSections.size === 0) {
        machineHydrationInFlight = false;
    }
    scheduleRenderState();
}
async function hydrateAllMachineAdvisory(refresh) {
    const round = ++machineHydrationRound;
    await hydrateMachineAdvisory(refresh, [
        "inventory",
        "mcpInventory",
        "optimizationLayers",
        "setupPhases",
        "configHealth",
        "usage",
        "guidance"
    ], round);
}
async function hydrateMachineSection(section, refresh, round) {
    try {
        const payload = await invoke("load_machine_advisory_section", {
            section,
            refresh
        });
        if (round !== machineHydrationRound) {
            return;
        }
        applyMachineSectionPayload(payload);
        hydratedMachineSections.add(section);
        scheduleNonCriticalShellRender();
    }
    catch (error) {
        if (round !== machineHydrationRound) {
            return;
        }
        currentState.machineAdvisory.sections[section] = {
            status: "partial",
            updatedAt: new Date().toISOString(),
            reason: error instanceof Error ? error.message : String(error)
        };
        scheduleNonCriticalShellRender();
    }
}
function applyMachineSectionPayload(payload) {
    currentState.machineAdvisory.sections[payload.section] = payload.meta;
    switch (payload.section) {
        case "inventory":
            currentState.machineAdvisory.inventory = payload.data;
            break;
        case "mcpInventory":
            currentState.machineAdvisory.mcpInventory = payload.data;
            break;
        case "optimizationLayers":
            currentState.machineAdvisory.optimizationLayers = payload.data;
            break;
        case "setupPhases":
            currentState.machineAdvisory.setupPhases = payload.data;
            break;
        case "configHealth":
            currentState.machineAdvisory.configHealth = payload.data;
            break;
        case "usage":
            currentState.machineAdvisory.usage = payload.data;
            break;
        case "guidance":
            currentState.machineAdvisory.guidance = filterGuidanceForCurrentState(payload.data);
            break;
    }
    currentState.machineAdvisory.updatedAt = payload.meta.updatedAt;
    currentState.machineAdvisory.stale = Object.values(currentState.machineAdvisory.sections).some((entry) => entry.status !== "fresh");
    currentState.machineAdvisory.systemHealth = recomputeMachineSystemHealth(currentState.machineAdvisory);
}
function filterGuidanceForCurrentState(entries) {
    const task = currentState.kiwiControl?.contextView.task?.toLowerCase() ?? "";
    const workflowStep = currentState.kiwiControl?.workflow.currentStepId ?? null;
    const validationFailed = currentState.validation.errors > 0;
    const evalPrecisionLow = (currentState.kiwiControl?.feedback.totalRuns ?? 0) > 0 && (currentState.kiwiControl?.feedback.successRate ?? 100) < 50;
    const executionRetriesTriggered = currentState.kiwiControl?.workflow.steps.some((step) => step.retryCount > 0) ?? false;
    const triggered = validationFailed || evalPrecisionLow || executionRetriesTriggered;
    return entries.filter((entry) => {
        if (!triggered && entry.priority !== "critical") {
            return false;
        }
        if ((/\b(read|inspect|review|summarize)\b/.test(task) || /\bdocs?|document|readme\b/.test(task)) && workflowStep === "prepare" && entry.id === "missing-ccusage") {
            return false;
        }
        return true;
    });
}
function recomputeMachineSystemHealth(machine) {
    const criticalCount = machine.guidance.filter((entry) => entry.priority === "critical").length;
    const warningCount = machine.guidance.filter((entry) => entry.priority === "recommended").length;
    const okCount = machine.inventory.filter((tool) => tool.installed).length +
        machine.configHealth.filter((entry) => entry.healthy).length +
        machine.optimizationLayers.filter((layer) => layer.claude || layer.codex || layer.copilot).length;
    return {
        criticalCount,
        warningCount,
        okCount
    };
}
function syncInteractiveSessionState(state) {
    const targetRoot = state.targetRoot || "";
    if (targetRoot !== activeInteractiveTargetRoot) {
        activeInteractiveTargetRoot = targetRoot;
        commandState = {
            activeCommand: null,
            loading: false,
            composer: null,
            draftValue: "",
            lastResult: null,
            lastError: null
        };
        lastBlockedActionGuidance = null;
        focusedItem = null;
        contextOverrides = new Map();
        contextOverrideHistory = [];
        graphNodePositions = new Map();
        graphPan = { x: 0, y: 0 };
        graphZoom = 1;
        graphDepth = 2;
        graphSelectedPath = null;
        localPlanOrder = [];
        localPlanSkipped = new Set();
        localPlanEdits = new Map();
        editingPlanStepId = null;
        editingPlanDraft = "";
        approvalMarkers = new Map();
        contextOverrideVersion = 0;
        derivedTreeCache = null;
        graphProjectionCache = null;
        activeGraphProjection = null;
        pendingGraphPatchPaths.clear();
        graphPatchQueued = false;
        hydratedMachineSections.clear();
        machineHydrationActiveSections.clear();
        machineHydrationInFlight = false;
        if (deferredMachineHydrationTimer != null) {
            window.clearTimeout(deferredMachineHydrationTimer);
            deferredMachineHydrationTimer = null;
        }
    }
    mergePlanUiState(state);
    ensureFocusedItem(state);
}
function ensureFocusedItem(state) {
    const currentFocus = focusedItem;
    if (currentFocus?.kind === "path" && findContextNodeByPath(state, currentFocus.path)) {
        return;
    }
    if (currentFocus?.kind === "step" && deriveDisplayExecutionPlanSteps(state).some((step) => step.id === currentFocus.id)) {
        return;
    }
    const selectedFiles = deriveInteractiveSelectedFiles(state);
    const firstSelectedFile = selectedFiles[0];
    if (firstSelectedFile) {
        focusedItem = {
            kind: "path",
            id: firstSelectedFile,
            label: basenameForPath(firstSelectedFile),
            path: firstSelectedFile
        };
        return;
    }
    const primaryStep = deriveDisplayExecutionPlanSteps(state)[0];
    if (primaryStep) {
        focusedItem = {
            kind: "step",
            id: primaryStep.id,
            label: primaryStep.displayTitle
        };
    }
}
function mergePlanUiState(state) {
    const stepIds = (state.kiwiControl ?? EMPTY_KC).executionPlan.steps.map((step) => step.id);
    if (stepIds.length === 0) {
        localPlanOrder = [];
        localPlanSkipped.clear();
        localPlanEdits.clear();
        editingPlanStepId = null;
        editingPlanDraft = "";
        return;
    }
    if (localPlanOrder.length === 0) {
        localPlanOrder = [...stepIds];
    }
    else {
        localPlanOrder = [
            ...localPlanOrder.filter((stepId) => stepIds.includes(stepId)),
            ...stepIds.filter((stepId) => !localPlanOrder.includes(stepId))
        ];
    }
    for (const stepId of [...localPlanSkipped]) {
        if (!stepIds.includes(stepId)) {
            localPlanSkipped.delete(stepId);
        }
    }
    for (const stepId of [...localPlanEdits.keys()]) {
        if (!stepIds.includes(stepId)) {
            localPlanEdits.delete(stepId);
        }
    }
}
function deriveInteractiveTree(state) {
    const baseTree = (state.kiwiControl ?? EMPTY_KC).contextView.tree;
    if (derivedTreeCache && derivedTreeCache.baseTree === baseTree && derivedTreeCache.overrideVersion === contextOverrideVersion) {
        return derivedTreeCache.tree;
    }
    const nodes = baseTree.nodes.map((node) => applyOverridesToTreeNode(node));
    const counts = countTreeStatuses(nodes);
    const tree = {
        nodes,
        selectedCount: counts.selected,
        candidateCount: counts.candidate,
        excludedCount: counts.excluded
    };
    derivedTreeCache = {
        baseTree,
        overrideVersion: contextOverrideVersion,
        tree,
        flatNodes: flattenContextNodes(nodes)
    };
    return tree;
}
function applyOverridesToTreeNode(node) {
    const override = contextOverrides.get(node.path);
    const status = override == null
        ? node.status
        : override === "include"
            ? "selected"
            : "excluded";
    return {
        ...node,
        status,
        children: node.children.map((child) => applyOverridesToTreeNode(child))
    };
}
function countTreeStatuses(nodes) {
    return nodes.reduce((accumulator, node) => {
        if (node.status === "selected") {
            accumulator.selected += 1;
        }
        else if (node.status === "candidate") {
            accumulator.candidate += 1;
        }
        else {
            accumulator.excluded += 1;
        }
        const childCounts = countTreeStatuses(node.children);
        accumulator.selected += childCounts.selected;
        accumulator.candidate += childCounts.candidate;
        accumulator.excluded += childCounts.excluded;
        return accumulator;
    }, { selected: 0, candidate: 0, excluded: 0 });
}
function deriveInteractiveSelectedFiles(state) {
    return deriveFlatInteractiveNodes(state)
        .filter((node) => node.kind === "file" && node.status === "selected")
        .map((node) => node.path);
}
function flattenContextNodes(nodes) {
    return nodes.flatMap((node) => [node, ...flattenContextNodes(node.children)]);
}
function deriveFlatInteractiveNodes(state) {
    const baseTree = (state.kiwiControl ?? EMPTY_KC).contextView.tree;
    if (derivedTreeCache && derivedTreeCache.baseTree === baseTree && derivedTreeCache.overrideVersion === contextOverrideVersion) {
        return derivedTreeCache.flatNodes;
    }
    deriveInteractiveTree(state);
    return derivedTreeCache?.flatNodes ?? [];
}
function findContextNodeByPath(state, path) {
    return deriveFlatInteractiveNodes(state).find((node) => node.path === path) ?? null;
}
function pushContextOverrideHistory() {
    contextOverrideHistory.push(new Map(contextOverrides));
    if (contextOverrideHistory.length > 20) {
        contextOverrideHistory.shift();
    }
}
function applyLocalContextOverride(path, mode) {
    pushContextOverrideHistory();
    contextOverrides.set(path, mode);
    contextOverrideVersion += 1;
    derivedTreeCache = null;
    focusedItem = {
        kind: "path",
        id: path,
        label: basenameForPath(path),
        path
    };
    graphSelectedPath = path;
    scheduleRenderState();
}
function resetLocalContextOverrides() {
    if (contextOverrides.size === 0) {
        return;
    }
    pushContextOverrideHistory();
    contextOverrides.clear();
    contextOverrideVersion += 1;
    derivedTreeCache = null;
    scheduleRenderState();
}
function undoLocalContextOverride() {
    const previous = contextOverrideHistory.pop();
    if (!previous) {
        return;
    }
    contextOverrides = new Map(previous);
    contextOverrideVersion += 1;
    derivedTreeCache = null;
    scheduleRenderState();
}
function seedComposerDraft(mode) {
    if (mode === "handoff") {
        return currentState.specialists.handoffTargets[0] ?? currentState.specialists.recommendedSpecialist ?? "";
    }
    if (mode === "checkpoint") {
        return getPanelValue(currentState.repoOverview, "Current phase") !== "none recorded"
            ? getPanelValue(currentState.repoOverview, "Current phase")
            : `${getRepoLabel(currentTargetRoot)} checkpoint`;
    }
    const task = currentState.kiwiControl?.contextView.task?.trim() ?? "";
    if (task && task.toLowerCase() !== "task") {
        return task;
    }
    return currentState.kiwiControl?.nextActions.actions[0]?.action
        ?? "";
}
function isPlaceholderTask(value) {
    const normalized = value?.trim().toLowerCase() ?? "";
    return normalized.length === 0 || normalized === "task";
}
function deriveComposerConstraint(state, mode, draftValue) {
    const plan = state.kiwiControl?.executionPlan;
    const validateStep = plan?.steps.find((step) => step.id === "validate");
    const validateFixCommand = validateStep?.fixCommand
        ?? validateStep?.retryCommand
        ?? plan?.lastError?.fixCommand
        ?? plan?.lastError?.retryCommand
        ?? plan?.nextCommands[0]
        ?? "kiwi-control validate \"task\"";
    if (mode === "run-auto" && isPlaceholderTask(draftValue)) {
        return {
            blocked: true,
            reason: "Enter a real goal instead of the placeholder task.",
            nextCommand: "kiwi-control prepare \"real goal\""
        };
    }
    if (mode === "checkpoint" && (plan?.state === "blocked" || validateStep?.status === "failed" || state.validation.errors > 0)) {
        return {
            blocked: true,
            reason: "Checkpoint is blocked until validation passes.",
            nextCommand: validateFixCommand
        };
    }
    if (mode === "handoff" && (plan?.state === "blocked" || validateStep?.status === "failed" || state.validation.errors > 0)) {
        return {
            blocked: true,
            reason: "Handoff is blocked until validation passes.",
            nextCommand: validateFixCommand
        };
    }
    return {
        blocked: false,
        reason: mode === "run-auto" ? "Run a concrete goal in the loaded repo." : "Ready to run.",
        nextCommand: null
    };
}
function toggleComposer(mode) {
    if (commandState.loading) {
        return;
    }
    lastBlockedActionGuidance = null;
    if (commandState.composer === mode) {
        commandState.composer = null;
        commandState.draftValue = "";
    }
    else {
        commandState.composer = mode;
        commandState.draftValue = seedComposerDraft(mode);
    }
    scheduleRenderState();
}
async function refreshCurrentRepoState() {
    if (!currentTargetRoot) {
        return;
    }
    await loadAndRenderTarget(currentTargetRoot, "manual", undefined, { preferSnapshot: false });
}
async function executeKiwiCommand(command, args, options) {
    if (!currentTargetRoot || commandState.loading || !isTauriBridgeAvailable()) {
        return null;
    }
    commandState.loading = true;
    commandState.activeCommand = command;
    commandState.lastError = null;
    commandState.lastResult = null;
    lastBlockedActionGuidance = null;
    renderState(currentState);
    try {
        const result = await invoke("run_cli_command", {
            command,
            args,
            targetRoot: currentTargetRoot,
            expectJson: options.expectJson
        });
        commandState.lastResult = result;
        commandState.lastError = result.ok ? null : summarizeCliCommandFailure(result);
        if (result.ok) {
            commandState.composer = null;
            commandState.draftValue = "";
            await refreshCurrentRepoState();
        }
        else {
            renderState(currentState);
        }
        return result;
    }
    catch (error) {
        commandState.lastError = error instanceof Error ? error.message : String(error);
        renderState(currentState);
        return null;
    }
    finally {
        commandState.loading = false;
        commandState.activeCommand = null;
        renderState(currentState);
    }
}
async function openRepoPath(path) {
    if (!currentTargetRoot || !isTauriBridgeAvailable()) {
        return;
    }
    try {
        await invoke("open_path", {
            targetRoot: currentTargetRoot,
            path
        });
    }
    catch (error) {
        commandState.lastError = error instanceof Error ? error.message : String(error);
        renderState(currentState);
    }
}
function summarizeCliCommandFailure(result) {
    const payload = result.jsonPayload;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        const record = payload;
        const failureReason = typeof record.failureReason === "string" ? record.failureReason.trim() : "";
        const validation = typeof record.validation === "string" ? record.validation.trim() : "";
        const detail = typeof record.detail === "string" ? record.detail.trim() : "";
        const nextCommand = typeof record.nextCommand === "string"
            ? record.nextCommand.trim()
            : typeof record.nextSuggestedCommand === "string"
                ? record.nextSuggestedCommand.trim()
                : "";
        const summary = failureReason || validation || detail;
        if (summary) {
            return nextCommand ? `${summary} Next: ${formatCliCommand(nextCommand, currentTargetRoot)}` : summary;
        }
    }
    return result.stderr || result.stdout || `${result.commandLabel} failed`;
}
function noteReadyState(detail) {
    lastReadyStateSignal = {
        at: Date.now(),
        detail
    };
    if (readyStateTimer != null) {
        window.clearTimeout(readyStateTimer);
    }
    readyStateTimer = window.setTimeout(() => {
        readyStateTimer = null;
        scheduleNonCriticalShellRender();
    }, READY_STATE_PULSE_MS + 32);
}
function markGraphInteractionActivity() {
    lastGraphInteractionAt = Date.now();
}
function shouldDeferShellRenderForGraphInteraction() {
    return activeView === "graph" && Date.now() - lastGraphInteractionAt < GRAPH_INTERACTION_SETTLE_MS;
}
function scheduleNonCriticalShellRender() {
    if (!shouldDeferShellRenderForGraphInteraction()) {
        pendingShellRenderAfterInteraction = false;
        if (deferredShellRenderTimer != null) {
            window.clearTimeout(deferredShellRenderTimer);
            deferredShellRenderTimer = null;
        }
        scheduleRenderState();
        return;
    }
    pendingShellRenderAfterInteraction = true;
    if (deferredShellRenderTimer != null) {
        return;
    }
    const remainingMs = Math.max(0, GRAPH_INTERACTION_SETTLE_MS - (Date.now() - lastGraphInteractionAt));
    deferredShellRenderTimer = window.setTimeout(() => {
        deferredShellRenderTimer = null;
        if (!pendingShellRenderAfterInteraction) {
            return;
        }
        pendingShellRenderAfterInteraction = false;
        scheduleRenderState();
    }, remainingMs + 16);
}
function resolveGraphViewportElement() {
    if (graphViewportElement?.isConnected) {
        return graphViewportElement;
    }
    graphViewportElement = centerMainElement.querySelector("[data-graph-viewport]");
    return graphViewportElement;
}
function updateGraphViewportTransform() {
    if (activeView !== "graph") {
        return false;
    }
    const viewport = resolveGraphViewportElement();
    if (!viewport) {
        return false;
    }
    viewport.setAttribute("transform", `translate(${graphPan.x} ${graphPan.y}) scale(${graphZoom})`);
    return true;
}
function scheduleGraphInteractionPatch(path) {
    pendingGraphPatchPaths.add(path);
    if (graphPatchQueued || renderQueued || centerRenderQueued) {
        return;
    }
    graphPatchQueued = true;
    window.requestAnimationFrame(() => {
        graphPatchQueued = false;
        const paths = [...pendingGraphPatchPaths];
        pendingGraphPatchPaths.clear();
        if (!patchGraphSurface(paths)) {
            scheduleCenterRender();
        }
    });
}
function patchGraphSurface(paths) {
    if (activeView !== "graph" || paths.length === 0) {
        return false;
    }
    const projection = activeGraphProjection ?? getGraphProjection(currentState);
    if (!projection) {
        return false;
    }
    const graphSurface = centerMainElement.querySelector("[data-graph-canvas-root]");
    if (!graphSurface) {
        return false;
    }
    for (const path of paths) {
        const selector = `[data-graph-node-wrap][data-path="${escapeSelectorValue(path)}"]`;
        const nodeWrap = graphSurface.querySelector(selector);
        const position = resolveProjectedNodePosition(projection, graphNodePositions, path);
        if (nodeWrap && position) {
            nodeWrap.setAttribute("transform", `translate(${position.x}, ${position.y})`);
        }
        const edgeSelector = [
            `[data-graph-edge][data-from-path="${escapeSelectorValue(path)}"]`,
            `[data-graph-edge][data-to-path="${escapeSelectorValue(path)}"]`
        ].join(",");
        for (const edge of graphSurface.querySelectorAll(edgeSelector)) {
            const fromPath = edge.dataset.fromPath;
            const toPath = edge.dataset.toPath;
            if (!fromPath || !toPath) {
                continue;
            }
            const from = resolveProjectedNodePosition(projection, graphNodePositions, fromPath);
            const to = resolveProjectedNodePosition(projection, graphNodePositions, toPath);
            if (!from || !to) {
                continue;
            }
            edge.setAttribute("x1", String(from.x));
            edge.setAttribute("y1", String(from.y));
            edge.setAttribute("x2", String(to.x));
            edge.setAttribute("y2", String(to.y));
        }
    }
    return true;
}
function escapeSelectorValue(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return CSS.escape(value);
    }
    return value.replace(/["\\]/g, "\\$&");
}
function parseKiwiCommand(commandText) {
    const tokens = tokenizeCommand(commandText);
    if (tokens.length < 2) {
        return null;
    }
    const executable = tokens[0] ?? "";
    if (!["kiwi-control", "kc", "shrey-junior", "sj"].includes(executable)) {
        return null;
    }
    const [subcommand = "", ...rest] = tokens.slice(1);
    if (subcommand === "run" && rest[0] === "--auto") {
        const task = rest.find((token, index) => index > 0 && token !== "--target" && token !== currentTargetRoot);
        return task ? { command: "run-auto", args: [task] } : null;
    }
    if (subcommand === "handoff") {
        const toIndex = rest.findIndex((token) => token === "--to");
        const handoffTarget = toIndex >= 0 ? rest[toIndex + 1] : undefined;
        if (handoffTarget) {
            return { command: "handoff", args: [handoffTarget] };
        }
    }
    if (subcommand === "checkpoint") {
        const label = rest.find((token) => !token.startsWith("--"));
        return label ? { command: "checkpoint", args: [label] } : null;
    }
    if (subcommand === "validate") {
        const task = rest.find((token) => !token.startsWith("--") && token !== currentTargetRoot);
        return { command: "validate", args: task ? [task] : [] };
    }
    if (subcommand === "sync") {
        const allowedFlags = rest.filter((token) => token === "--dry-run" || token === "--diff-summary" || token === "--backup");
        return { command: "sync", args: allowedFlags };
    }
    if (["guide", "next", "retry", "resume", "status", "trace"].includes(subcommand)) {
        return { command: subcommand, args: rest.includes("--json") ? ["--json"] : [] };
    }
    return null;
}
function tokenizeCommand(value) {
    const tokens = [...value.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s]+)/g)];
    return tokens.map((match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").filter(Boolean);
}
async function executePlanStepCommand(step) {
    const parsed = parseKiwiCommand(step.command);
    if (parsed) {
        await executeKiwiCommand(parsed.command, parsed.args, { expectJson: parsed.args.includes("--json") });
        return;
    }
    if (step.retryCommand) {
        const retryParsed = parseKiwiCommand(step.retryCommand);
        if (retryParsed) {
            await executeKiwiCommand(retryParsed.command, retryParsed.args, { expectJson: retryParsed.args.includes("--json") });
            return;
        }
    }
    if (step.id === "execute") {
        await executeKiwiCommand("run-auto", [seedComposerDraft("run-auto")], { expectJson: false });
        return;
    }
    if (step.id.includes("validate")) {
        await executeKiwiCommand("validate", [], { expectJson: true });
        return;
    }
    await executeKiwiCommand("next", ["--json"], { expectJson: true });
}
function deriveDisplayExecutionPlanSteps(state) {
    const plan = (state.kiwiControl ?? EMPTY_KC).executionPlan;
    const sourceById = new Map(plan.steps.map((step) => [step.id, step]));
    return localPlanOrder
        .map((stepId) => sourceById.get(stepId))
        .filter((step) => Boolean(step))
        .map((step) => {
        const edit = localPlanEdits.get(step.id);
        return {
            ...step,
            displayTitle: edit?.label?.trim() || step.description,
            displayNote: edit?.note?.trim() || step.result.summary || step.expectedOutput || null,
            skipped: localPlanSkipped.has(step.id)
        };
    });
}
function movePlanStep(stepId, direction) {
    const index = localPlanOrder.indexOf(stepId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= localPlanOrder.length) {
        return;
    }
    const reordered = [...localPlanOrder];
    const currentValue = reordered[index];
    const nextValue = reordered[nextIndex];
    if (!currentValue || !nextValue) {
        return;
    }
    reordered[index] = nextValue;
    reordered[nextIndex] = currentValue;
    localPlanOrder = reordered;
    scheduleRenderState();
}
function toggleSkippedPlanStep(stepId) {
    if (localPlanSkipped.has(stepId)) {
        localPlanSkipped.delete(stepId);
    }
    else {
        localPlanSkipped.add(stepId);
    }
    scheduleRenderState();
}
function startEditingPlanStep(stepId, currentLabel) {
    editingPlanStepId = stepId;
    editingPlanDraft = currentLabel;
    scheduleRenderState();
}
function commitPlanStepEdit(stepId) {
    const existing = localPlanEdits.get(stepId) ?? { label: "", note: "" };
    localPlanEdits.set(stepId, {
        ...existing,
        label: editingPlanDraft.trim() || existing.label
    });
    editingPlanStepId = null;
    editingPlanDraft = "";
    scheduleRenderState();
}
function getGraphProjection(state) {
    const tree = deriveInteractiveTree(state);
    const rootPath = state.targetRoot || "repo";
    const focusPath = graphSelectedPath ?? (focusedItem?.kind === "path" ? focusedItem.path : null);
    const selectedAnalysis = state.kiwiControl?.fileAnalysis.selected ?? [];
    if (graphProjectionCache
        && graphProjectionCache.baseTree === tree
        && graphProjectionCache.overrideVersion === contextOverrideVersion
        && graphProjectionCache.targetRoot === rootPath
        && graphProjectionCache.graphDepth === graphDepth
        && graphProjectionCache.focusPath === focusPath
        && graphProjectionCache.selectedAnalysis === selectedAnalysis) {
        activeGraphProjection = graphProjectionCache.projection;
        return graphProjectionCache.projection;
    }
    const projection = deriveGraphProjection({
        tree,
        rootPath,
        rootLabel: getRepoLabel(rootPath) || "repo",
        graphDepth,
        focusPath,
        selectedAnalysis
    });
    graphProjectionCache = {
        baseTree: tree,
        overrideVersion: contextOverrideVersion,
        targetRoot: rootPath,
        graphDepth,
        focusPath,
        selectedAnalysis,
        projection
    };
    activeGraphProjection = projection;
    return projection;
}
function deriveGraphModel(state) {
    return materializeGraphModel(getGraphProjection(state), graphNodePositions);
}
function basenameForPath(path) {
    const segments = path.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] ?? path;
}
function renderReadinessBanner(loadStatus) {
    const bannerTone = loadStatus.tone === "ready"
        ? "success"
        : loadStatus.tone === "degraded"
            ? "warn"
            : loadStatus.tone === "blocked"
                ? "blocked"
                : "neutral";
    return `
    <div class="kc-view-shell">
      <section class="kc-panel kc-command-banner tone-${bannerTone}">
        <div class="kc-command-banner-head">
          <div>
            <p class="kc-section-micro">${escapeHtml(loadStatus.phase.replaceAll("_", " "))}</p>
            <strong>${escapeHtml(loadStatus.label)}</strong>
          </div>
          <span class="kc-load-badge"><span class="kc-load-dot"></span>${escapeHtml(loadStatus.phase.replaceAll("_", " "))}</span>
        </div>
        <p>${escapeHtml(loadStatus.detail)}</p>
        ${loadStatus.nextCommand ? `<div class="kc-command-banner-actions"><code class="kc-command-chip">${escapeHtml(formatCliCommand(loadStatus.nextCommand, currentTargetRoot))}</code></div>` : ""}
        <div class="kc-load-progress"><span class="kc-load-progress-fill" style="width:${loadStatus.progress}%"></span></div>
      </section>
    </div>
  `;
}
function renderRecoveryGuidanceBanner(guidance, options) {
    const bannerTone = guidance.tone === "blocked" ? "blocked" : "warn";
    return `
    <div class="kc-view-shell">
      <section class="kc-panel kc-command-banner tone-${bannerTone}">
        <div class="kc-command-banner-head">
          <div>
            <p class="kc-section-micro">${escapeHtml(options.kicker)}</p>
            <strong>${escapeHtml(guidance.title)}</strong>
          </div>
          <span class="kc-load-badge"><span class="kc-load-dot"></span>${escapeHtml(guidance.tone)}</span>
        </div>
        <p>${escapeHtml(guidance.detail)}</p>
        <div class="kc-command-banner-actions">
          ${guidance.nextCommand ? `<code class="kc-command-chip">${escapeHtml(formatCliCommand(guidance.nextCommand, currentTargetRoot))}</code>` : ""}
          ${guidance.followUpCommand ? `<code class="kc-command-chip">${escapeHtml(formatCliCommand(guidance.followUpCommand, currentTargetRoot))}</code>` : ""}
          ${options.actionLabel ? `<button class="kc-secondary-button" type="button" data-reload-state>${escapeHtml(options.actionLabel)}</button>` : ""}
        </div>
      </section>
    </div>
  `;
}
function renderCommandBanner() {
    const loadStatus = buildLoadStatus(currentState);
    const repoRecoveryGuidance = buildRepoRecoveryGuidance(currentState);
    if (lastBlockedActionGuidance) {
        return renderRecoveryGuidanceBanner(lastBlockedActionGuidance, {
            kicker: "Action blocked"
        });
    }
    if (commandState.loading || isLoadingRepoState) {
        return renderReadinessBanner(loadStatus);
    }
    if (repoRecoveryGuidance && (repoRecoveryGuidance.tone === "blocked" || repoRecoveryGuidance.tone === "failed" || repoRecoveryGuidance.tone === "degraded")) {
        if (loadStatus.visible
            || repoRecoveryGuidance.tone !== "blocked"
            || currentState.repoState.mode === "repo-not-initialized"
            || currentState.repoState.mode === "initialized-invalid") {
            return renderRecoveryGuidanceBanner(repoRecoveryGuidance, {
                kicker: repoRecoveryGuidance.tone === "blocked"
                    ? "Workflow blocked"
                    : repoRecoveryGuidance.tone === "degraded"
                        ? "Using cached snapshot"
                        : "Load failed",
                actionLabel: repoRecoveryGuidance.actionLabel ?? null
            });
        }
    }
    if (loadStatus.visible) {
        return renderReadinessBanner(loadStatus);
    }
    if (!commandState.lastResult && !commandState.lastError) {
        return "";
    }
    const tone = commandState.lastError ? "warn" : commandState.lastResult?.ok ? "success" : "warn";
    const title = commandState.lastError
        ? "Last command failed"
        : commandState.lastResult?.ok
            ? "Last command completed"
            : "Last command reported an issue";
    const detail = commandState.lastError
        ?? commandState.lastResult?.stderr
        ?? commandState.lastResult?.stdout
        ?? "No command detail was recorded.";
    return `
    <div class="kc-view-shell">
      <section class="kc-panel kc-command-banner tone-${tone}">
        <div class="kc-command-banner-head">
          <div>
            <p class="kc-section-micro">Command Result</p>
            <strong>${escapeHtml(title)}</strong>
          </div>
          ${commandState.lastResult ? `<code class="kc-command-chip">${escapeHtml(commandState.lastResult.commandLabel)}</code>` : ""}
        </div>
        <p>${escapeHtml(detail)}</p>
      </section>
    </div>
  `;
}
function handleInteractiveClick(event, target) {
    const directCommandButton = target.closest("[data-ui-command]");
    if (directCommandButton?.dataset.uiCommand) {
        const command = directCommandButton.dataset.uiCommand;
        if (command === "run-auto" || command === "checkpoint" || command === "handoff") {
            toggleComposer(command);
        }
        else if (command === "retry") {
            const retryText = currentState.kiwiControl?.executionPlan.lastError?.retryCommand ?? "";
            const parsed = retryText ? parseKiwiCommand(retryText) : null;
            if (parsed) {
                void executeKiwiCommand(parsed.command, parsed.args, { expectJson: parsed.args.includes("--json") });
            }
            else {
                void executeKiwiCommand("retry", [], { expectJson: false });
            }
        }
        else {
            void executeKiwiCommand(command, commandRequiresJson(command) ? ["--json"] : [], { expectJson: commandRequiresJson(command) });
        }
        return true;
    }
    const submitComposer = target.closest("[data-composer-submit]");
    if (submitComposer?.dataset.composerSubmit) {
        const mode = submitComposer.dataset.composerSubmit;
        const value = commandState.draftValue.trim();
        const constraint = deriveComposerConstraint(currentState, mode, value);
        if (constraint.blocked) {
            lastBlockedActionGuidance = buildBlockedActionGuidance(mode, constraint.reason, constraint.nextCommand);
            commandState.lastError = null;
            scheduleRenderState();
            return true;
        }
        if (!value) {
            commandState.lastError = `${mode} requires a value before running.`;
            lastBlockedActionGuidance = null;
            scheduleRenderState();
            return true;
        }
        const command = mode === "run-auto" ? "run-auto" : mode === "checkpoint" ? "checkpoint" : "handoff";
        void executeKiwiCommand(command, [value], { expectJson: false });
        return true;
    }
    if (target.closest("[data-composer-cancel]")) {
        commandState.composer = null;
        commandState.draftValue = "";
        lastBlockedActionGuidance = null;
        scheduleRenderState();
        return true;
    }
    const treeAction = target.closest("[data-tree-action]");
    if (treeAction?.dataset.treeAction && treeAction.dataset.path) {
        event.preventDefault();
        event.stopPropagation();
        const path = treeAction.dataset.path;
        const action = treeAction.dataset.treeAction;
        if (action === "open") {
            void openRepoPath(path);
        }
        else if (action === "focus") {
            focusedItem = { kind: "path", id: path, label: basenameForPath(path), path };
            graphSelectedPath = path;
            scheduleRenderState();
        }
        else {
            applyLocalContextOverride(path, action);
        }
        return true;
    }
    const bulkAction = target.closest("[data-tree-bulk]");
    if (bulkAction?.dataset.treeBulk) {
        const interactiveTree = deriveInteractiveTree(currentState);
        const paths = flattenContextNodes(interactiveTree.nodes).map((node) => node.path);
        if (bulkAction.dataset.treeBulk === "reset") {
            resetLocalContextOverrides();
        }
        else if (bulkAction.dataset.treeBulk === "undo") {
            undoLocalContextOverride();
        }
        else {
            pushContextOverrideHistory();
            for (const path of paths) {
                contextOverrides.set(path, bulkAction.dataset.treeBulk);
            }
            contextOverrideVersion += 1;
            derivedTreeCache = null;
            scheduleRenderState();
        }
        return true;
    }
    const graphNode = target.closest("[data-graph-node]");
    if (graphNode?.dataset.path) {
        const path = graphNode.dataset.path;
        focusedItem = { kind: "path", id: path, label: basenameForPath(path), path };
        graphSelectedPath = path;
        if (event.detail > 1 && graphNode.dataset.kind === "file") {
            void openRepoPath(path);
        }
        scheduleRenderState();
        return true;
    }
    const graphAction = target.closest("[data-graph-action]");
    if (graphAction?.dataset.graphAction) {
        const path = graphAction.dataset.path;
        const action = graphAction.dataset.graphAction;
        if (action === "depth-up") {
            graphDepth = Math.min(3, graphDepth + 1);
        }
        else if (action === "depth-down") {
            graphDepth = Math.max(1, graphDepth - 1);
        }
        else if (action === "reset-view") {
            graphPan = { x: 0, y: 0 };
            graphZoom = 1;
            graphNodePositions.clear();
        }
        else if (path) {
            if (action === "open") {
                void openRepoPath(path);
            }
            else if (action === "focus") {
                focusedItem = { kind: "path", id: path, label: basenameForPath(path), path };
                graphSelectedPath = path;
                scheduleRenderState();
                return true;
            }
            else {
                applyLocalContextOverride(path, action);
                return true;
            }
        }
        scheduleRenderState();
        return true;
    }
    const planAction = target.closest("[data-plan-action]");
    if (planAction?.dataset.planAction && planAction.dataset.stepId) {
        const stepId = planAction.dataset.stepId;
        const step = deriveDisplayExecutionPlanSteps(currentState).find((entry) => entry.id === stepId);
        if (!step) {
            return true;
        }
        switch (planAction.dataset.planAction) {
            case "run":
                void executePlanStepCommand(step);
                break;
            case "retry":
                if (step.retryCommand) {
                    const parsed = parseKiwiCommand(step.retryCommand);
                    if (parsed) {
                        void executeKiwiCommand(parsed.command, parsed.args, { expectJson: parsed.args.includes("--json") });
                    }
                    else {
                        void executeKiwiCommand("retry", [], { expectJson: false });
                    }
                }
                else {
                    void executeKiwiCommand("retry", [], { expectJson: false });
                }
                break;
            case "skip":
                toggleSkippedPlanStep(stepId);
                break;
            case "edit":
                startEditingPlanStep(stepId, step.displayTitle);
                break;
            case "edit-save":
                commitPlanStepEdit(stepId);
                break;
            case "edit-cancel":
                editingPlanStepId = null;
                editingPlanDraft = "";
                scheduleRenderState();
                break;
            case "move-up":
                movePlanStep(stepId, -1);
                break;
            case "move-down":
                movePlanStep(stepId, 1);
                break;
            case "focus":
                focusedItem = { kind: "step", id: step.id, label: step.displayTitle };
                scheduleRenderState();
                break;
        }
        return true;
    }
    const inspectorAction = target.closest("[data-inspector-action]");
    if (inspectorAction?.dataset.inspectorAction) {
        const action = inspectorAction.dataset.inspectorAction;
        if (action === "approve" || action === "reject") {
            const markerKey = focusedItem?.id;
            if (markerKey) {
                approvalMarkers.set(markerKey, action === "approve" ? "approved" : "rejected");
            }
            scheduleRenderState();
            return true;
        }
        if (action === "add-to-context" && focusedItem?.kind === "path") {
            applyLocalContextOverride(focusedItem.path, "include");
            return true;
        }
        if (action === "validate") {
            void executeKiwiCommand("validate", [], { expectJson: true });
            return true;
        }
        if (action === "handoff") {
            toggleComposer("handoff");
            return true;
        }
    }
    return false;
}
function commandRequiresJson(command) {
    return ["guide", "next", "validate", "status", "trace"].includes(command);
}
function renderState(state) {
    currentState = state;
    syncInteractiveSessionState(state);
    railNavElement.innerHTML = renderRailNav();
    topbarElement.innerHTML = renderTopBar(state);
    renderCenterSurface(state);
    inspectorElement.innerHTML = renderInspector(state);
    logDrawerElement.innerHTML = renderLogDrawer(state);
    workspaceSurfaceElement.classList.toggle("is-inspector-open", isInspectorOpen);
    workspaceSurfaceElement.classList.toggle("is-log-open", isLogDrawerOpen);
    inspectorElement.classList.toggle("is-hidden", !isInspectorOpen);
    logDrawerElement.classList.toggle("is-hidden", !isLogDrawerOpen);
}
function renderCenterSurface(state) {
    centerMainElement.innerHTML = `${renderCommandBanner()}${renderCenterView(state)}`;
    graphViewportElement = null;
    if (activeView !== "graph") {
        activeGraphProjection = null;
    }
}
function scheduleRenderState() {
    if (renderQueued) {
        return;
    }
    renderQueued = true;
    window.requestAnimationFrame(() => {
        renderQueued = false;
        renderState(currentState);
    });
}
function scheduleCenterRender() {
    if (centerRenderQueued || renderQueued) {
        return;
    }
    centerRenderQueued = true;
    window.requestAnimationFrame(() => {
        centerRenderQueued = false;
        renderCenterSurface(currentState);
    });
}
function renderRailNav() {
    return NAV_ITEMS.map((item) => `
    <button class="kc-rail-button ${item.id === activeView ? "is-active" : ""}" data-view="${item.id}" type="button">
      <span class="kc-rail-icon">${item.icon}</span>
      <span class="kc-rail-label">${escapeHtml(item.label)}</span>
    </button>
  `).join("");
}
function renderTopBar(state) {
    const decision = buildDecisionSummary(state);
    const repoLabel = getRepoLabel(state.targetRoot);
    const phase = getPanelValue(state.repoOverview, "Current phase");
    const validationState = getPanelValue(state.repoOverview, "Validation state");
    const themeLabel = activeTheme === "dark" ? "Light mode" : "Dark mode";
    const currentTask = state.kiwiControl?.contextView.task ?? state.kiwiControl?.nextActions.actions[0]?.action ?? "";
    const retryEnabled = Boolean(state.kiwiControl?.executionPlan.lastError?.retryCommand) || Boolean(currentTargetRoot);
    const composerConstraint = commandState.composer
        ? deriveComposerConstraint(state, commandState.composer, commandState.draftValue)
        : null;
    const runtimeInfo = desktopRuntimeInfo
        ? {
            label: "App",
            detail: `${describeBuildSource(desktopRuntimeInfo.buildSource)} · v${desktopRuntimeInfo.appVersion}`
        }
        : null;
    return renderTopBarView({
        state,
        decision,
        repoLabel,
        phase,
        validationState,
        themeLabel,
        activeTheme,
        activeMode,
        isLogDrawerOpen,
        isInspectorOpen,
        currentTargetRoot,
        commandState,
        currentTask,
        retryEnabled,
        composerConstraint,
        runtimeInfo,
        loadStatus: buildLoadStatus(state),
        helpers: buildUiRenderHelpers()
    });
}
function describeMachineHydration() {
    const sectionCount = machineHydrationActiveSections.size;
    if (sectionCount === 0) {
        return "Refreshing machine-local diagnostics in the background.";
    }
    const labels = [...machineHydrationActiveSections].map((section) => {
        switch (section) {
            case "mcpInventory":
                return "MCP inventory";
            case "optimizationLayers":
                return "optimization layers";
            case "setupPhases":
                return "setup phases";
            case "configHealth":
                return "config health";
            default:
                return section;
        }
    });
    return `Refreshing ${labels.join(", ")}${sectionCount > 1 ? " in the background" : ""}.`;
}
function buildRepoRecoveryGuidance(state) {
    return deriveRepoRecoveryGuidance(state, {
        lastRepoLoadFailure
    });
}
function buildReadinessEnv(state) {
    return {
        commandState: {
            loading: commandState.loading,
            activeCommand: commandState.activeCommand
        },
        currentLoadSource,
        currentTargetRoot,
        isLoadingRepoState,
        isRefreshingFreshRepoState,
        lastRepoLoadFailure,
        lastReadyStateSignal,
        readyStatePulseMs: READY_STATE_PULSE_MS,
        machineHydrationInFlight,
        machineHydrationDetail: describeMachineHydration(),
        activeTargetHint: buildActiveTargetHintModel(state),
        recoveryGuidance: buildRepoRecoveryGuidance(state),
        isMachineHeavyViewActive: isMachineHeavyView(activeView),
        machineAdvisoryStale: state.machineAdvisory.stale
    };
}
function buildLoadStatus(state) {
    return buildLoadStatusModel(state, buildReadinessEnv(state));
}
function buildDecisionSummary(state) {
    return buildDecisionSummaryModel(state, {
        isLoadingRepoState,
        isRefreshingFreshRepoState,
        hasWarmSnapshot: state.loadState.source === "warm-snapshot" || state.loadState.source === "stale-snapshot",
        formatTimestamp
    });
}
function renderHeaderMeta(label, value) {
    return `
    <div class="kc-inline-meta">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}
function buildUiRenderHelpers() {
    return {
        escapeHtml,
        escapeAttribute,
        iconSvg,
        iconLabel,
        formatCliCommand,
        renderHeaderBadge,
        renderHeaderMeta,
        renderPanelHeader,
        renderInlineBadge,
        renderNoteRow,
        renderEmptyState,
        renderStatCard,
        renderInfoRow,
        renderListBadges,
        renderExplainabilityBadge,
        renderGateRow,
        renderBulletRow,
        deriveSignalImpact,
        formatInteger,
        formatPercent,
        formatCurrency,
        formatTimestamp,
        formatTokensShort
    };
}
function renderCenterView(state) {
    switch (activeView) {
        case "context":
            return renderContextView(state);
        case "graph":
            return renderGraphView(state);
        case "tokens":
            return renderTokensView(state);
        case "feedback":
            return renderFeedbackView(state);
        case "mcps":
            return renderMcpView(state);
        case "specialists":
            return renderSpecialistsView(state);
        case "system":
            return renderSystemView(state);
        case "validation":
            return renderValidationView(state);
        case "machine":
            return renderMachineView(state);
        case "overview":
        default:
            return renderOverviewView(state);
    }
}
function deriveReadinessSummary(state) {
    return deriveReadinessSummaryModel(state, buildReadinessEnv(state));
}
function renderOverviewView(state) {
    const kc = state.kiwiControl ?? EMPTY_KC;
    const interactiveTree = deriveInteractiveTree(state);
    const decision = buildDecisionSummary(state);
    const readiness = deriveReadinessSummary(state);
    const repoRecoveryGuidance = buildRepoRecoveryGuidance(state);
    const primaryAction = kc.nextActions.actions[0] ?? null;
    const primaryActionCommand = formatCliCommand(primaryAction?.command, state.targetRoot);
    const recommendedNextCommand = primaryActionCommand || formatCliCommand(kc.executionPlan.nextCommands[0], state.targetRoot) || "No next command is currently recorded.";
    const currentFocus = getPanelValue(state.continuity, "Current focus");
    const activeSpecialist = state.specialists.activeProfile?.name ?? state.specialists.activeSpecialist;
    const selectedTask = kc.contextView.task ?? "No prepared task";
    const compatibleMcpCount = state.mcpPacks.compatibleCapabilities.length;
    const learnedFiles = kc.feedback.topBoostedFiles.slice(0, 3).map((entry) => entry.file);
    const terminalHelpEntries = buildTerminalHelpEntries({
        targetRoot: state.targetRoot,
        repoMode: state.repoState.mode
    });
    const explainSelectionEntries = buildExplainSelectionEntries(kc.fileAnalysis.selected);
    const explainCommandEntries = buildExplainCommandEntries({
        targetRoot: state.targetRoot,
        recoveryGuidance: repoRecoveryGuidance,
        executionPlan: kc.executionPlan
    });
    return `
    <div class="kc-view-shell">
      <section class="kc-panel kc-panel-primary">
        <div class="kc-panel-heading">
          <div class="kc-panel-kicker">
            ${iconLabel(iconSvg("overview"), "Next Action")}
            ${primaryAction ? renderHeaderBadge(primaryAction.priority, primaryAction.priority) : renderHeaderBadge("stable", "neutral")}
          </div>
          <h1>${escapeHtml(primaryAction?.action ?? state.repoState.title)}</h1>
          <p>${escapeHtml(primaryAction?.reason ?? (kc.nextActions.summary || state.repoState.detail))}</p>
        </div>
        <div class="kc-primary-footer">
          ${primaryActionCommand ? `<code class="kc-command-chip">${escapeHtml(primaryActionCommand)}</code>` : ""}
          <span>${escapeHtml(currentFocus)}</span>
        </div>
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Repo Health", state.repoState.title, state.validation.ok ? "passing" : `${state.validation.errors + state.validation.warnings} issues`, state.validation.ok ? "success" : "warn")}
        ${renderStatCard("Task", selectedTask, kc.contextView.confidenceDetail ?? "no prepared scope", "neutral")}
        ${renderStatCard("Selected", String(interactiveTree.selectedCount), "files Kiwi chose", "neutral")}
        ${renderStatCard("Ignored", String(interactiveTree.excludedCount), "files Kiwi filtered out", "warn")}
        ${renderStatCard("Lifecycle", kc.runtimeLifecycle.currentStage, kc.runtimeLifecycle.nextRecommendedAction ?? "runtime stage not recorded yet", "neutral")}
        ${renderStatCard("Skills", String(kc.skills.activeSkills.length), kc.skills.activeSkills.length > 0 ? kc.skills.activeSkills.map((skill) => skill.name).join(", ") : "none active", "neutral")}
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Guided Operation", "What is happening, what is wrong, and what to do next.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${renderNoteRow("Readiness", readiness.label, readiness.detail)}
              ${renderNoteRow("Current state", state.repoState.title, state.repoState.detail)}
              ${renderNoteRow("Blocking issue", decision.blockingIssue, decision.systemHealth === "blocked" ? "Resolve this before trusting execution." : "No hard blocker is currently active.")}
              ${renderNoteRow("Recommended next action", decision.nextAction, recommendedNextCommand)}
              ${repoRecoveryGuidance ? renderNoteRow("Do this now", repoRecoveryGuidance.title, repoRecoveryGuidance.nextCommand ? formatCliCommand(repoRecoveryGuidance.nextCommand, state.targetRoot) : repoRecoveryGuidance.detail) : ""}
            </div>
          </section>
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${renderNoteRow("Execution safety", decision.executionSafety, decision.executionSafety === "ready" ? "Execution is safe to continue." : decision.executionSafety === "guarded" ? "Context or validation signals suggest caution." : "Wait for hydration or clear blockers first.")}
              ${renderNoteRow("Recent change", decision.lastChangedAt, kc.runtimeLifecycle.recentEvents[0]?.summary ?? "No recent lifecycle event is recorded.")}
              ${renderNoteRow("State trust", "repo-local", "Repo state and .agent artifacts remain authoritative. Local UI-only edits do not replace repo truth.")}
            </div>
          </section>
        </div>
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Explain This Selection", "Low-latency parity with kc explain using the already-loaded repo state, file reasons, and dependency chains.")}
          ${explainSelectionEntries.length > 0
        ? `<div class="kc-stack-list">${explainSelectionEntries.map((entry) => renderNoteRow(entry.title, entry.metric, entry.note)).join("")}</div>`
        : renderEmptyState("No selected-file reasoning is available yet. Run kc prepare to build a bounded working set first.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Terminal Recovery", "Exact commands to run next in Terminal, grounded in the current repo state instead of a second explain round-trip.")}
          ${explainCommandEntries.length > 0
        ? `<div class="kc-stack-list">${explainCommandEntries.map((entry) => renderNoteRow(entry.command, entry.label, entry.detail)).join("")}</div>`
        : renderEmptyState("No repo-scoped recovery commands are recorded yet.")}
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Terminal Help", "The same command surface you would reach for from kc help, with repo-scoped commands already pinned to the active repo.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${terminalHelpEntries.slice(0, 3).map((entry) => renderNoteRow(entry.command, entry.label, entry.detail)).join("")}
            </div>
          </section>
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${terminalHelpEntries.slice(3).map((entry) => renderNoteRow(entry.command, entry.label, entry.detail)).join("")}
            </div>
          </section>
        </div>
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Repo State", "Current repo truth, routing, and system fit.")}
          <div class="kc-info-grid">
            ${renderInfoRow("Project type", state.projectType)}
            ${renderInfoRow("Execution mode", state.executionMode)}
            ${renderInfoRow("Active specialist", activeSpecialist)}
            ${renderInfoRow("Suggested pack", state.mcpPacks.suggestedPack.name ?? state.mcpPacks.suggestedPack.id)}
            ${renderInfoRow("Compatible MCPs", String(compatibleMcpCount))}
            ${renderInfoRow("Feedback", `${kc.feedback.adaptationLevel} (${kc.feedback.totalRuns} runs)`)}
            ${renderInfoRow("Measured usage", kc.measuredUsage.available ? `${formatTokensShort(kc.measuredUsage.totalTokens)} over ${kc.measuredUsage.totalRuns} runs` : "unavailable")}
          </div>
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Task Summary", "What Kiwi knows right now about the active working set.")}
          <div class="kc-keyline-value">
            <strong>${escapeHtml(selectedTask)}</strong>
            <span>${escapeHtml((kc.indexing.selectionReason ?? kc.contextView.reason ?? kc.nextActions.summary) || state.repoState.detail)}</span>
          </div>
        </section>
      </div>

      ${renderExecutionPlanPanel(state)}

      <section class="kc-panel">
        <div class="kc-panel-head-row">
          ${renderPanelHeader("Context Tree", "What Kiwi selected, considered, and ignored from the live selector state.")}
          ${renderHeaderBadge(kc.contextView.confidence?.toUpperCase() ?? "UNKNOWN", kc.contextView.confidence === "high" ? "success" : kc.contextView.confidence === "low" ? "warn" : "neutral")}
        </div>
        ${interactiveTree.nodes.length > 0
        ? renderContextTree(interactiveTree)
        : renderEmptyState('Run kc prepare "your task" to build a repo-local context tree.')}
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("What Kiwi Knows", "Immediate operating context exposed as concrete system signals.")}
          <div class="kc-stack-list">
            ${renderNoteRow("Reasoning", kc.contextView.confidence?.toUpperCase() ?? "unknown", kc.contextView.confidenceDetail ?? "No context confidence has been recorded yet.")}
            ${renderNoteRow("Indexing", `${kc.indexing.discoveredFiles} files`, kc.indexing.coverageNote)}
            ${renderNoteRow("Validation", `${state.validation.errors} errors / ${state.validation.warnings} warnings`, state.repoState.detail)}
          </div>
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("What Kiwi Learned", "Adaptive feedback and recent system memory for this task scope.")}
          ${kc.feedback.basedOnPastRuns
        ? `<div class="kc-stack-list">
                ${renderNoteRow("based on past runs", kc.feedback.reusedPattern ?? "similar work", kc.feedback.note)}
                ${kc.feedback.similarTasks.slice(0, 3).map((entry) => renderNoteRow(entry.task, `similarity ${entry.similarity}`, formatTimestamp(entry.timestamp))).join("")}
              </div>`
        : learnedFiles.length > 0
            ? renderListBadges(learnedFiles)
            : renderEmptyState("No learned file preference is strong enough to surface yet.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Active Skills", "Repo-local skills currently shaping the task instructions and workflow trace.")}
          ${kc.skills.activeSkills.length > 0
        ? `<div class="kc-stack-list">${kc.skills.activeSkills.map((skill) => renderNoteRow(skill.name, `score ${skill.score}`, skill.executionTemplate[0] ?? skill.description)).join("")}</div>`
        : renderEmptyState("No repo-local skills matched the active task.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Suggested Skills", "Additional repo-local skills that may become relevant as the task expands.")}
          ${kc.skills.suggestedSkills.length > 0
        ? `<div class="kc-stack-list">${kc.skills.suggestedSkills.map((skill) => renderNoteRow(skill.name, `score ${skill.score}`, skill.description || skill.triggerConditions.join(", "))).join("")}</div>`
        : renderEmptyState("No additional skills are currently suggested.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("HOW IT WORKS", "What Kiwi did, how it did it, and what it intentionally left out.")}
          <div class="kc-stack-list">
            ${renderNoteRow("What was done", `${kc.fileAnalysis.selectedFiles} selected`, "Kiwi built a bounded working set from repo-local signals, then trimmed low-relevance files.")}
            ${renderNoteRow("How it was done", `${kc.contextTrace.expansionSteps.length} trace steps`, kc.contextTrace.expansionSteps[0]?.summary ?? "No context trace has been recorded yet.")}
            ${renderNoteRow("Why it was done", kc.decisionLogic.decisionPriority, kc.decisionLogic.summary || "No decision summary is recorded yet.")}
            ${renderNoteRow("What was ignored", `${kc.fileAnalysis.excludedFiles} excluded / ${kc.fileAnalysis.skippedFiles} skipped`, kc.decisionLogic.ignoredSignals[0] ?? kc.fileAnalysis.excluded[0]?.note ?? "No ignored signals are currently surfaced.")}
          </div>
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("DECISION LOGIC", "The reasoning chain behind the current primary action.")}
          ${kc.decisionLogic.reasoningChain.length > 0
        ? `<div class="kc-stack-list">${kc.decisionLogic.reasoningChain.slice(0, 4).map((item) => renderBulletRow(item)).join("")}</div>`
        : renderEmptyState("No decision reasoning is available yet.")}
        </section>
      </div>
    </div>
  `;
}
function renderContextView(state) {
    const kc = state.kiwiControl ?? EMPTY_KC;
    const ctx = kc.contextView;
    const indexing = kc.indexing;
    const interactiveTree = deriveInteractiveTree(state);
    const selectedFiles = deriveInteractiveSelectedFiles(state);
    const topLevelMap = interactiveTree.nodes.slice(0, 8);
    const indexingMechanics = buildIndexingMechanicsItems(state);
    return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Context Selection</p>
          <h1>${escapeHtml(ctx.task ?? "No prepared task")}</h1>
          <p>${escapeHtml(ctx.confidenceDetail ?? "Kiwi Control only shows files the selector actually considered.")}</p>
        </div>
        <div class="kc-header-metrics">
          ${renderSmallMetric(String(ctx.tree.selectedCount), "selected")}
          ${renderSmallMetric(String(ctx.tree.candidateCount), "candidate")}
          ${renderSmallMetric(String(ctx.tree.excludedCount), "excluded")}
        </div>
      </section>

      <div class="kc-context-grid">
        <section class="kc-panel">
          <div class="kc-panel-head-row">
            ${renderPanelHeader("Repo Tree", "Selected, candidate, and excluded files grounded in live selector state.")}
            <div class="kc-inline-badges">
              <button class="kc-secondary-button" type="button" data-tree-bulk="include">Include visible</button>
              <button class="kc-secondary-button" type="button" data-tree-bulk="exclude">Exclude visible</button>
              <button class="kc-secondary-button" type="button" data-tree-bulk="reset">Reset local edits</button>
              <button class="kc-secondary-button" type="button" data-tree-bulk="undo">Undo</button>
              <button class="kc-secondary-button" type="button" data-reload-state>${iconSvg("refresh")}Refresh</button>
            </div>
          </div>
          ${interactiveTree.nodes.length > 0
        ? renderContextTree(interactiveTree)
        : renderEmptyState('Run kc prepare "your task" to build the repo tree from live selection signals.')}
        </section>

        <section class="kc-panel">
          ${renderPanelHeader("Navigation Map", "Use this as a high-density orientation strip before drilling into the full tree.")}
          ${topLevelMap.length > 0
        ? `<div class="kc-inline-badges">${topLevelMap.map((node) => renderInlineBadge(`${node.name}:${node.status}`)).join("")}</div>`
        : renderEmptyState("No top-level repo map is available yet.")}
          <div class="kc-divider"></div>
          ${renderPanelHeader("Selection State", ctx.reason ?? "No selection reason recorded.")}
          <div class="kc-info-grid">
            ${renderInfoRow("Confidence", ctx.confidence?.toUpperCase() ?? "UNKNOWN")}
            ${renderInfoRow("Scope area", indexing.scopeArea ?? "unknown")}
            ${renderInfoRow("Selected files", String(selectedFiles.length))}
            ${renderInfoRow("Observed files", String(indexing.observedFiles))}
            ${renderInfoRow("Indexed files", String(indexing.indexedFiles))}
            ${renderInfoRow("Impact files", String(indexing.impactFiles))}
            ${renderInfoRow("Keyword matches", String(indexing.keywordSignals))}
            ${renderInfoRow("Import neighbors", String(indexing.importSignals))}
            ${renderInfoRow("Discovery depth", String(indexing.maxDepthExplored))}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-block">
            <p class="kc-stack-label">Coverage</p>
            <p class="kc-support-copy">${escapeHtml(indexing.coverageNote)}</p>
            <div class="kc-inline-badges">
              ${renderInlineBadge(`visited ${indexing.visitedDirectories} dirs`)}
              ${renderInlineBadge(indexing.fileBudgetReached ? "file budget hit" : "file budget clear")}
              ${renderInlineBadge(indexing.directoryBudgetReached ? "dir budget hit" : "dir budget clear")}
            </div>
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-block">
            <p class="kc-stack-label">Selected files</p>
            ${selectedFiles.length > 0 ? renderListBadges(selectedFiles) : renderEmptyState("No active files are selected yet.")}
          </div>
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("How Kiwi Indexed This Repo", "These are the actual scan and signal mechanics behind the current tree, not generic advice.")}
        <div class="kc-stack-list">
          ${indexingMechanics.map((item) => renderNoteRow(item.title, item.metric, item.note)).join("")}
        </div>
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("FILE ANALYSIS PANEL", "Measured scan counts plus why files were selected, excluded, or skipped.")}
          <div class="kc-info-grid">
            ${renderInfoRow("Total files", String(kc.fileAnalysis.totalFiles))}
            ${renderInfoRow("Scanned files", String(kc.fileAnalysis.scannedFiles))}
            ${renderInfoRow("Skipped files", String(kc.fileAnalysis.skippedFiles))}
            ${renderInfoRow("Selected files", String(kc.fileAnalysis.selectedFiles))}
            ${renderInfoRow("Excluded files", String(kc.fileAnalysis.excludedFiles))}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-list">
            ${kc.fileAnalysis.selected.slice(0, 3).map((entry) => renderNoteRow(entry.file, "selected", entry.selectionWhy ?? entry.reasons.join(", "))).join("")}
            ${kc.fileAnalysis.excluded.slice(0, 3).map((entry) => renderNoteRow(entry.file, "excluded", entry.note ?? entry.reasons.join(", "))).join("")}
            ${kc.fileAnalysis.skipped.slice(0, 3).map((entry) => renderNoteRow(entry.path, "skipped", entry.reason)).join("")}
          </div>
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("CONTEXT TRACE", "Initial signals, expansion steps, and final bounded selection.")}
          ${kc.contextTrace.expansionSteps.length > 0
        ? `<div class="kc-fold-grid">${kc.contextTrace.expansionSteps.map((step) => `
                <details class="kc-fold-card" open>
                  <summary>
                    <div>
                      <strong>${escapeHtml(step.step)}</strong>
                      <span>${escapeHtml(step.summary)}</span>
                    </div>
                    ${renderHeaderBadge(`${step.filesAdded.length} files`, "neutral")}
                  </summary>
                  <div class="kc-fold-body">
                    ${step.filesAdded.length > 0 ? renderListBadges(step.filesAdded.slice(0, 8)) : renderEmptyState("No files recorded for this step.")}
                    ${step.filesRemoved && step.filesRemoved.length > 0 ? `<div class="kc-divider"></div>${renderListBadges(step.filesRemoved.slice(0, 8))}` : ""}
                  </div>
                </details>
              `).join("")}</div>`
        : renderEmptyState("Run kc prepare to record a trace of how Kiwi built the working set.")}
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Dependency Chains", "Shortest structural paths that pulled files into the working set.")}
        ${kc.fileAnalysis.selected.some((entry) => Array.isArray(entry.dependencyChain) && entry.dependencyChain.length > 1)
        ? `<div class="kc-stack-list">${kc.fileAnalysis.selected
            .filter((entry) => Array.isArray(entry.dependencyChain) && entry.dependencyChain.length > 1)
            .slice(0, 6)
            .map((entry) => renderNoteRow(entry.file, "chain", (entry.dependencyChain ?? []).join(" -> ")))
            .join("")}</div>`
        : renderEmptyState("No structural dependency chain was needed for the current selection.")}
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("INDEXING", "How the repo scan progressed, where it stopped, and which ignore rules were applied.")}
        <div class="kc-info-grid">
          ${renderInfoRow("Directories visited", String(indexing.visitedDirectories))}
          ${renderInfoRow("Skipped directories", String(indexing.skippedDirectories))}
          ${renderInfoRow("Depth reached", String(indexing.maxDepthExplored))}
          ${renderInfoRow("Files discovered", String(indexing.discoveredFiles))}
          ${renderInfoRow("Files analyzed", String(indexing.analyzedFiles))}
          ${renderInfoRow("Index reused", String(indexing.indexReusedFiles))}
          ${renderInfoRow("Index refreshed", String(indexing.indexUpdatedFiles))}
          ${renderInfoRow("Ignore rules", String(indexing.ignoreRulesApplied.length))}
        </div>
        <div class="kc-divider"></div>
        <div class="kc-inline-badges">
          ${renderExplainabilityBadge("heuristic", kc.contextTrace.honesty.heuristic)}
          ${renderExplainabilityBadge("low confidence", kc.contextTrace.honesty.lowConfidence)}
          ${renderExplainabilityBadge("partial scan", kc.contextTrace.honesty.partialScan || indexing.partialScan)}
        </div>
        <div class="kc-divider"></div>
        <div class="kc-stack-list">
          ${indexing.ignoreRulesApplied.slice(0, 4).map((rule) => renderBulletRow(rule)).join("")}
        </div>
      </section>
    </div>
  `;
}
function renderGraphView(state) {
    const graph = deriveGraphModel(state);
    const focusedNode = graph.nodes.find((node) => node.path === (graphSelectedPath ?? (focusedItem?.kind === "path" ? focusedItem.path : null))) ?? null;
    return renderGraphViewPanel({
        state,
        graph,
        focusedNode,
        graphDepth,
        graphPan,
        graphZoom,
        graphMechanics: buildGraphMechanicsItems(state, graph),
        treeMechanics: buildTreeMechanicsItems(state),
        helpers: buildUiRenderHelpers()
    });
}
function renderValidationView(state) {
    const issues = state.validation.issues ?? [];
    const warnings = issues.filter((issue) => issue.level === "warn");
    const errors = issues.filter((issue) => issue.level === "error");
    return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Validation</p>
          <h1>${escapeHtml(state.repoState.title)}</h1>
          <p>${escapeHtml(state.repoState.detail)}</p>
        </div>
        <button class="kc-secondary-button" type="button" data-reload-state>${iconSvg("refresh")}Reload state</button>
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Passing", state.validation.ok ? "yes" : "no", "repo contract", state.validation.ok ? "success" : "warn")}
        ${renderStatCard("Errors", String(state.validation.errors), "blocking", state.validation.errors > 0 ? "critical" : "neutral")}
        ${renderStatCard("Warnings", String(state.validation.warnings), "non-blocking", state.validation.warnings > 0 ? "warn" : "neutral")}
        ${renderStatCard("Memory", `${state.memoryBank.filter((entry) => entry.present).length}/${state.memoryBank.length}`, "surfaces present", "neutral")}
      </div>

      <section class="kc-panel">
        <div class="kc-tab-row">
          ${renderTabButton("all", activeValidationTab, "All")}
          ${renderTabButton("issues", activeValidationTab, `Issues ${errors.length + warnings.length > 0 ? `(${errors.length + warnings.length})` : ""}`, "data-validation-tab")}
          ${renderTabButton("pending", activeValidationTab, "Pending", "data-validation-tab")}
        </div>
        ${renderValidationTabBody(state)}
      </section>
    </div>
  `;
}
function renderValidationTabBody(state) {
    const issues = state.validation.issues ?? [];
    const flaggedIssues = issues.filter((issue) => issue.level === "error" || issue.level === "warn");
    if (activeValidationTab === "issues") {
        return flaggedIssues.length > 0
            ? `<div class="kc-stack-list">${flaggedIssues.map(renderValidationIssueCard).join("")}</div>`
            : renderEmptyState("No warnings or errors are currently recorded in repo-local validation.");
    }
    if (activeValidationTab === "pending") {
        return renderEmptyState("Kiwi Control does not infer pending checks beyond repo-local validation state.");
    }
    return `
    <div class="kc-two-column">
      <section class="kc-subpanel">
        ${renderPanelHeader("Repo Contract", state.repoState.sourceOfTruthNote)}
        <div class="kc-info-grid">
          ${state.repoOverview.map((item) => renderInfoRow(item.label, item.value, item.tone === "warn" ? "warn" : "default")).join("")}
        </div>
      </section>
      <section class="kc-subpanel">
        ${renderPanelHeader("Continuity", "Latest checkpoint, handoff, reconcile, and open risk state.")}
        <div class="kc-info-grid">
          ${state.continuity.map((item) => renderInfoRow(item.label, item.value, item.tone === "warn" ? "warn" : "default")).join("")}
        </div>
      </section>
    </div>
  `;
}
function renderActivityView(state) {
    const kc = state.kiwiControl ?? EMPTY_KC;
    const items = buildActivityItems(state);
    return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Activity</p>
          <h1>Repo Activity</h1>
          <p>Timeline of real execution, continuity, and validation events.</p>
        </div>
        ${renderHeaderBadge(`${kc.execution.totalExecutions} executions`, "neutral")}
      </section>

      <section class="kc-panel kc-timeline-panel">
        ${items.length > 0
        ? `<div class="kc-timeline">${items.map((item) => `
              <article class="kc-timeline-item">
                <div class="kc-timeline-marker ${item.tone}">
                  ${item.icon}
                </div>
                <div class="kc-timeline-copy">
                  <div class="kc-timeline-head">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${escapeHtml(item.timestamp)}</span>
                  </div>
                  <p>${escapeHtml(item.detail)}</p>
                  ${item.meta ? `<div class="kc-inline-badges">${renderListBadges(item.meta)}</div>` : ""}
                </div>
              </article>
            `).join("")}</div>`
        : renderEmptyState("No activity has been recorded yet.")}
      </section>
    </div>
  `;
}
function renderTokensView(state) {
    const kc = state.kiwiControl ?? EMPTY_KC;
    const tokens = kc.tokenAnalytics;
    return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Token Analytics</p>
          <h1>${escapeHtml(tokens.task ?? "No token estimate yet")}</h1>
          <p>${escapeHtml(tokens.estimateNote ?? 'Run kc prepare "your task" to generate a repo-local rough estimate.')}</p>
        </div>
        ${renderHeaderBadge(tokens.estimationMethod ?? "not generated", "neutral")}
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Selected", `~${formatTokensShort(tokens.selectedTokens)}`, "approximate", "neutral")}
        ${renderStatCard("Full Repo", `~${formatTokensShort(tokens.fullRepoTokens)}`, "approximate", "neutral")}
        ${renderStatCard("Saved", `~${tokens.savingsPercent}%`, "approximate", "success")}
        ${renderStatCard("Measured Files", `${tokens.fileCountSelected}/${tokens.fileCountTotal}`, "direct count", "neutral")}
        ${renderStatCard("Measured Usage", kc.measuredUsage.available ? formatTokensShort(kc.measuredUsage.totalTokens) : "unavailable", kc.measuredUsage.available ? `${kc.measuredUsage.totalRuns} real runs` : "falling back to estimate", kc.measuredUsage.available ? "success" : "warn")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Measured Usage", kc.measuredUsage.note)}
          ${kc.measuredUsage.available
        ? `<div class="kc-stack-list">
                ${renderNoteRow("Source", kc.measuredUsage.source, kc.measuredUsage.note)}
                ${kc.measuredUsage.workflows.slice(0, 4).map((workflow) => renderNoteRow(workflow.workflow, `${formatTokensShort(workflow.tokens)} tokens`, `${workflow.runs} runs`)).join("")}
              </div>`
        : renderEmptyState("No measured repo usage was found in local session or execution logs.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Estimated Usage", tokens.estimationMethod ?? "No estimate method recorded.")}
          <div class="kc-stack-list">
            ${renderNoteRow("Selected working set", `~${formatTokensShort(tokens.selectedTokens)}`, "Heuristic estimate for the current bounded context.")}
            ${renderNoteRow("Full repo", `~${formatTokensShort(tokens.fullRepoTokens)}`, "Heuristic estimate for all scanned repo files.")}
            ${renderNoteRow("Savings", `~${tokens.savingsPercent}%`, "Measured file counts with heuristic token estimation.")}
          </div>
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Top Directories", "Measured directories with the largest share of estimated token usage.")}
          ${tokens.topDirectories.length > 0
        ? `<div class="kc-bar-list">${tokens.topDirectories.slice(0, 6).map((entry) => renderBarRow(entry.directory, entry.tokens, tokens.fullRepoTokens, `${entry.fileCount} files`)).join("")}</div>`
        : renderEmptyState("No directory analytics recorded yet.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Context Breakdown", tokens.estimationMethod ?? "No estimate method recorded.")}
          ${renderMeterRow("Selected vs repo", tokens.selectedTokens, tokens.fullRepoTokens)}
          ${kc.wastedFiles.files.length > 0 ? renderMeterRow("Wasted within selection", kc.wastedFiles.totalWastedTokens, tokens.selectedTokens) : ""}
          <div class="kc-divider"></div>
          ${kc.wastedFiles.files.length > 0
        ? `<div class="kc-stack-list">${kc.wastedFiles.files.slice(0, 4).map((file) => renderNoteRow(file.file, `${formatTokensShort(file.tokens)} tokens`, file.reason)).join("")}</div>`
        : renderEmptyState("No wasted files are recorded in the active selection.")}
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("How To Reduce Tokens", "Concrete actions that affect selection size, measured usage, and model tradeoffs.")}
        <div class="kc-stack-list">
          ${buildTokenGuidanceItems(state).map((entry) => renderNoteRow(entry.title, entry.metric, entry.note)).join("")}
        </div>
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("Why These Token Numbers Look This Way", "Token analytics here are driven by the indexed tree, selected working set, and measured local execution data when available.")}
        <div class="kc-stack-list">
          ${buildTokenMechanicsItems(state).map((entry) => renderNoteRow(entry.title, entry.metric, entry.note)).join("")}
        </div>
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("Heavy Directories", "Directories that dominate repo token volume.")}
        ${kc.heavyDirectories.directories.length > 0
        ? `<div class="kc-stack-list">${kc.heavyDirectories.directories.slice(0, 4).map((directory) => renderNoteRow(directory.directory, `${directory.percentOfRepo}% of repo`, directory.suggestion)).join("")}</div>`
        : renderEmptyState("No heavy-directory warnings are recorded for this repo.")}
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("TOKEN BREAKDOWN", "Where token reduction came from, and whether that reduction is measured or heuristic.")}
        ${kc.tokenBreakdown.categories.length > 0
        ? `<div class="kc-stack-list">${kc.tokenBreakdown.categories.map((category) => renderNoteRow(category.category, `${category.basis} · ~${formatTokensShort(category.estimated_tokens_avoided)}`, category.note)).join("")}</div>`
        : renderEmptyState("No token breakdown has been recorded yet.")}
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("Measured Files", "Per-file measured usage is only shown when repo-local execution entries carry non-zero token totals.")}
        ${kc.measuredUsage.files.length > 0
        ? `<div class="kc-stack-list">${kc.measuredUsage.files.slice(0, 6).map((file) => renderNoteRow(file.file, `${formatTokensShort(file.tokens)} tokens`, `${file.runs} runs · ${file.attribution}`)).join("")}</div>`
        : renderEmptyState("No measured per-file attribution is available yet.")}
      </section>
    </div>
  `;
}
function renderMcpView(state) {
    const capabilities = state.mcpPacks.compatibleCapabilities;
    const highTrustCount = capabilities.filter((entry) => entry.trustLevel === "high").length;
    const writeCapableCount = capabilities.filter((entry) => entry.writeCapable).length;
    const approvalCount = capabilities.filter((entry) => entry.approvalRequired).length;
    return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">MCP Surface</p>
          <h1>${escapeHtml(state.mcpPacks.suggestedPack.name ?? state.mcpPacks.suggestedPack.id)}</h1>
          <p>${escapeHtml(state.mcpPacks.suggestedPack.description)}</p>
        </div>
        ${renderHeaderBadge(state.mcpPacks.capabilityStatus, state.mcpPacks.capabilityStatus === "compatible" ? "success" : "warn")}
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Compatible MCPs", String(capabilities.length), "active specialist + profile", capabilities.length > 0 ? "success" : "warn")}
        ${renderStatCard("High Trust", String(highTrustCount), "preferred first", highTrustCount > 0 ? "success" : "neutral")}
        ${renderStatCard("Write Capable", String(writeCapableCount), "requires judgment", writeCapableCount > 0 ? "warn" : "neutral")}
        ${renderStatCard("Approval Gates", String(approvalCount), "extra caution", approvalCount > 0 ? "warn" : "neutral")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Suggested Pack", state.mcpPacks.note)}
          <div class="kc-stack-list">
            ${(state.mcpPacks.suggestedPack.guidance ?? []).map((item) => renderBulletRow(item)).join("")}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-list">
            ${(state.mcpPacks.suggestedPack.realismNotes ?? []).map((item) => renderNoteRow("Reality check", "advisory", item)).join("")}
          </div>
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Compatible MCP Capabilities", "These are the currently compatible MCP capabilities for the active specialist and repo profile.")}
          ${capabilities.length > 0
        ? `<div class="kc-stack-list">${capabilities.map((capability) => renderCapabilityCard(capability)).join("")}</div>`
        : renderEmptyState("No compatible MCP capabilities are currently exposed for this specialist and profile.")}
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Available Packs", "Pack guidance shapes operator expectations, but does not imply universal runtime parity.")}
        <div class="kc-fold-grid">
          ${state.mcpPacks.available.map((pack) => `
            <details class="kc-fold-card" ${pack.id === state.mcpPacks.suggestedPack.id ? "open" : ""}>
              <summary>
                <div>
                  <strong>${escapeHtml(pack.name ?? pack.id)}</strong>
                  <span>${escapeHtml(pack.description)}</span>
                </div>
                ${renderHeaderBadge(pack.id === state.mcpPacks.suggestedPack.id ? "selected" : "available", pack.id === state.mcpPacks.suggestedPack.id ? "success" : "neutral")}
              </summary>
              <div class="kc-fold-body">
                <div class="kc-stack-list">
                  ${(pack.guidance ?? []).map((item) => renderBulletRow(item)).join("")}
                </div>
              </div>
            </details>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}
function buildTokenGuidanceItems(state) {
    const kc = state.kiwiControl ?? EMPTY_KC;
    const tokens = kc.tokenAnalytics;
    const items = [];
    if (isPlaceholderTask(kc.contextView.task)) {
        items.push({
            title: "Replace the placeholder task",
            metric: "task is too broad",
            note: "The current task label is generic, so Kiwi leans on repo-context and recent-file signals. Preparing with a real goal narrows the selected tree and usually lowers token estimates."
        });
    }
    else if (!tokens.estimationMethod) {
        items.push({
            title: "Generate a bounded estimate",
            metric: "prepare first",
            note: 'Run kc prepare with the actual task goal so Kiwi can record a selected working set before showing reduction guidance.'
        });
    }
    else {
        items.push({
            title: "Narrow the working set",
            metric: `${tokens.fileCountSelected}/${tokens.fileCountTotal} files`,
            note: "Use Include, Exclude, and Ignore in Context or Graph to shrink the selected tree before execution. Those tree changes are what alter the next token estimate."
        });
    }
    items.push({
        title: "Tree drives token estimates",
        metric: `${kc.contextView.tree.selectedCount} selected · ${kc.contextView.tree.excludedCount} excluded`,
        note: "The graph is a projection of the tree. If a file stays selected in the tree, it still counts toward the working-set estimate."
    });
    items.push({
        title: "Index reuse reduces rescanning",
        metric: `${kc.indexing.indexReusedFiles} reused · ${kc.indexing.indexUpdatedFiles} refreshed`,
        note: "Kiwi reuses index entries when it can and only refreshes changed or newly discovered files. The token estimate is still based on the current selected tree, not random guesses."
    });
    if (kc.wastedFiles.files.length > 0) {
        items.push({
            title: "Remove wasted files",
            metric: `~${formatTokensShort(kc.wastedFiles.totalWastedTokens)}`,
            note: `Exclude or ignore ${kc.wastedFiles.files[0]?.file ?? "low-value files"} to reduce token use without changing the task goal.`
        });
    }
    if (kc.heavyDirectories.directories.length > 0) {
        const heavyDirectory = kc.heavyDirectories.directories[0];
        if (heavyDirectory) {
            items.push({
                title: "Scope the heaviest directory",
                metric: `${heavyDirectory.percentOfRepo}%`,
                note: heavyDirectory.suggestion
            });
        }
    }
    items.push({
        title: "Understand the tradeoff",
        metric: tokens.savingsPercent > 0 ? `~${tokens.savingsPercent}% saved` : "no savings yet",
        note: "Smaller context usually lowers tokens and speeds review, but it increases the risk of missing adjacent files or reverse dependents."
    });
    if (!kc.measuredUsage.available) {
        items.push({
            title: "Collect real usage",
            metric: "estimated only",
            note: "Measured token usage appears only after local guide, validate, or execution flows record real runs. Until then, the token view is an indexed working-set estimate."
        });
    }
    return items;
}
function buildIndexingMechanicsItems(state) {
    const kc = state.kiwiControl ?? EMPTY_KC;
    const indexing = kc.indexing;
    const trace = kc.contextTrace.initialSignals;
    return [
        {
            title: "Index coverage",
            metric: `${indexing.indexedFiles} indexed · ${indexing.indexUpdatedFiles} refreshed · ${indexing.indexReusedFiles} reused`,
            note: indexing.coverageNote
        },
        {
            title: "Selection signals",
            metric: `${indexing.changedSignals} changed · ${indexing.importSignals} import · ${indexing.keywordSignals} keyword · ${indexing.repoContextSignals} repo`,
            note: "These are the signal buckets Kiwi used to pull files into the working set."
        },
        {
            title: "Observed tree",
            metric: `${kc.contextView.tree.selectedCount} selected · ${kc.contextView.tree.candidateCount} candidate · ${kc.contextView.tree.excludedCount} excluded`,
            note: "The repo tree is built from the current context-selection artifact. Selected files are in-scope, candidate files were considered, and excluded files were filtered out."
        },
        {
            title: "Initial evidence",
            metric: `${trace.changedFiles.length} changed · ${trace.importNeighbors.length} import neighbors · ${trace.keywordMatches.length} keyword matches`,
            note: "Before Kiwi expands scope, it starts from changed files, import neighbors, keyword matches, recent files, and repo-context files."
        }
    ];
}
function buildGraphMechanicsItems(state, graph) {
    const indexing = state.kiwiControl?.indexing ?? EMPTY_KC.indexing;
    return [
        {
            title: "Source of truth",
            metric: "context tree",
            note: "This graph is drawn from the current selected/candidate/excluded tree. It is not a full semantic code graph or call graph."
        },
        {
            title: "Visible projection",
            metric: `${graph.nodes.length} nodes · ${graph.edges.length} links`,
            note: `Depth ${graphDepth} controls how much of the current tree projection is visible from the repo root.`
        },
        {
            title: "Highlight behavior",
            metric: "dependency chain when available",
            note: "When Kiwi has a structural dependency chain for a file, it highlights that path. Otherwise it falls back to the ancestor path in the tree."
        },
        {
            title: "Indexed evidence behind the map",
            metric: `${indexing.changedSignals} changed · ${indexing.importSignals} import · ${indexing.keywordSignals} keyword`,
            note: "Those index signals decide which files appear in the working set before the graph turns them into a visual map."
        }
    ];
}
function buildTreeMechanicsItems(state) {
    const tree = state.kiwiControl?.contextView.tree ?? EMPTY_KC.contextView.tree;
    return [
        {
            title: "Selected",
            metric: String(tree.selectedCount),
            note: "Selected files are the current bounded working set. They drive validation expectations and token estimates."
        },
        {
            title: "Candidate",
            metric: String(tree.candidateCount),
            note: "Candidate files were considered relevant enough to surface, but are not currently in the selected working set."
        },
        {
            title: "Excluded",
            metric: String(tree.excludedCount),
            note: "Excluded files were filtered by the selector. Local Include/Exclude/Ignore UI edits are session-local until a real CLI command rewrites repo state."
        }
    ];
}
function buildTokenMechanicsItems(state) {
    const kc = state.kiwiControl ?? EMPTY_KC;
    const tokens = kc.tokenAnalytics;
    return [
        {
            title: "Estimate basis",
            metric: tokens.estimationMethod ?? "heuristic only",
            note: tokens.estimateNote ?? "Kiwi is using the indexed working set to estimate token volume."
        },
        {
            title: "Tree to token path",
            metric: `${kc.contextView.tree.selectedCount} selected files`,
            note: "The selected tree is the direct input to the working-set token estimate. Excluding a file from the tree is what reduces the next estimate."
        },
        {
            title: "Measured vs estimated",
            metric: kc.measuredUsage.available ? `${formatTokensShort(kc.measuredUsage.totalTokens)} measured` : "estimate only",
            note: kc.measuredUsage.available
                ? kc.measuredUsage.note
                : "No local execution runs have recorded measured usage yet, so the token numbers are derived from the current indexed tree."
        },
        {
            title: "Index churn",
            metric: `${kc.indexing.indexReusedFiles} reused · ${kc.indexing.indexUpdatedFiles} refreshed`,
            note: "Kiwi does not blindly rescan everything every time. It reuses indexed entries when possible, then recomputes token estimates from the current selected tree."
        }
    ];
}
function renderSpecialistsView(state) {
    const activeProfile = state.specialists.activeProfile;
    const recommendedProfile = state.specialists.recommendedProfile;
    return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Specialists</p>
          <h1>${escapeHtml(activeProfile?.name ?? state.specialists.activeSpecialist)}</h1>
          <p>${escapeHtml(activeProfile?.purpose ?? "Specialist routing is derived from repo-local role hints, task type, and file area.")}</p>
        </div>
        ${renderHeaderBadge(activeProfile?.riskPosture ?? "active", activeProfile?.riskPosture === "conservative" ? "success" : "neutral")}
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Active", activeProfile?.name ?? state.specialists.activeSpecialist, "current role fit", "neutral")}
        ${renderStatCard("Recommended", recommendedProfile?.name ?? state.specialists.recommendedSpecialist, "best next handoff", "success")}
        ${renderStatCard("Targets", String(state.specialists.handoffTargets.length), "handoff candidates", "neutral")}
        ${renderStatCard("Preferred Tools", String(activeProfile?.preferredTools?.length ?? 0), "active specialist", "neutral")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Active Specialist", "The role currently shaping the workspace and compatible capability set.")}
          ${activeProfile ? renderSpecialistCard(activeProfile) : renderEmptyState("No active specialist is currently recorded.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Routing Safety", state.specialists.safeParallelHint)}
          <div class="kc-stack-list">
            ${renderNoteRow("Current role", state.specialists.activeSpecialist, activeProfile?.purpose ?? "No active specialist profile is available.")}
            ${renderNoteRow("Recommended next", state.specialists.recommendedSpecialist, recommendedProfile?.purpose ?? "No recommended specialist profile is available.")}
            ${renderNoteRow("Handoff targets", `${state.specialists.handoffTargets.length}`, state.specialists.safeParallelHint)}
          </div>
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Specialist Catalog", "Available specialists for the current profile, including their role and risk posture.")}
        <div class="kc-fold-grid">
          ${(state.specialists.available ?? []).map((specialist) => `
            <details class="kc-fold-card" ${specialist.specialistId === state.specialists.activeSpecialist ? "open" : ""}>
              <summary>
                <div>
                  <strong>${escapeHtml(specialist.name ?? specialist.specialistId)}</strong>
                  <span>${escapeHtml(specialist.purpose ?? "No purpose recorded.")}</span>
                </div>
                ${renderHeaderBadge(specialist.riskPosture ?? "neutral", specialist.specialistId === state.specialists.activeSpecialist ? "success" : "neutral")}
              </summary>
              <div class="kc-fold-body">
                ${renderSpecialistCard(specialist)}
              </div>
            </details>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}
function renderSystemView(state) {
    const kc = state.kiwiControl ?? EMPTY_KC;
    const failures = Math.max(0, kc.execution.totalExecutions - Math.round((kc.execution.successRate / 100) * kc.execution.totalExecutions));
    const activityItems = buildActivityItems(state);
    const successfulWorkflowSteps = kc.workflow.steps.filter((step) => step.status === "success").length;
    const failedWorkflowStep = kc.workflow.steps.find((step) => step.status === "failed") ?? null;
    return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">System State</p>
          <h1>System visibility</h1>
          <p>Execution health, indexing coverage, adaptive learning, and repo-control operating signals.</p>
        </div>
        ${renderHeaderBadge(kc.execution.tokenTrend, kc.execution.tokenTrend === "improving" ? "success" : kc.execution.tokenTrend === "worsening" ? "warn" : "neutral")}
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Executions", String(kc.execution.totalExecutions), "tracked runs", "neutral")}
        ${renderStatCard("Failures", String(failures), "recorded scope or completion failures", failures > 0 ? "warn" : "success")}
        ${renderStatCard("Success Rate", `${kc.execution.successRate}%`, "real completion history", kc.execution.successRate >= 80 ? "success" : "warn")}
        ${renderStatCard("Feedback Strength", kc.feedback.adaptationLevel, `${kc.feedback.totalRuns} successful runs`, kc.feedback.adaptationLevel === "active" ? "success" : "neutral")}
        ${renderStatCard("Lifecycle", kc.runtimeLifecycle.currentStage, kc.runtimeLifecycle.validationStatus ?? "no validation status", "neutral")}
        ${renderStatCard("Workflow", kc.workflow.status, kc.workflow.currentStepId ?? "no current step", kc.workflow.status === "failed" ? "warn" : "neutral")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Indexing & Structure", kc.indexing.coverageNote)}
          <div class="kc-info-grid">
            ${renderInfoRow("Observed files", String(kc.indexing.observedFiles))}
            ${renderInfoRow("Discovered files", String(kc.indexing.discoveredFiles))}
            ${renderInfoRow("Indexed files", String(kc.indexing.indexedFiles))}
            ${renderInfoRow("Impact files", String(kc.indexing.impactFiles))}
            ${renderInfoRow("Visited directories", String(kc.indexing.visitedDirectories))}
            ${renderInfoRow("Max depth", String(kc.indexing.maxDepthExplored))}
            ${renderInfoRow("Changed signals", String(kc.indexing.changedSignals))}
            ${renderInfoRow("Repo-context signals", String(kc.indexing.repoContextSignals))}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-inline-badges">
            ${renderInlineBadge(kc.indexing.fileBudgetReached ? "file budget limited" : "file budget clear")}
            ${renderInlineBadge(kc.indexing.directoryBudgetReached ? "dir budget limited" : "dir budget clear")}
            ${renderInlineBadge(`scope: ${kc.indexing.scopeArea ?? "unknown"}`)}
          </div>
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Execution Health", "Real runtime accounting from repo-local execution history.")}
          ${activityItems.length > 0
        ? `<div class="kc-timeline">${activityItems.slice(0, 5).map((item) => `
                <article class="kc-timeline-item">
                  <div class="kc-timeline-marker ${item.tone}">
                    ${item.icon}
                  </div>
                  <div class="kc-timeline-copy">
                    <div class="kc-timeline-head">
                      <strong>${escapeHtml(item.title)}</strong>
                      <span>${escapeHtml(item.timestamp)}</span>
                    </div>
                    <p>${escapeHtml(item.detail)}</p>
                  </div>
                </article>
              `).join("")}</div>`
        : renderEmptyState("No execution history has been recorded yet.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Task Lifecycle", "A lightweight runtime trail from prepare to packet generation, checkpoint, and handoff.")}
          <div class="kc-stack-list">
            ${renderNoteRow("Current stage", kc.runtimeLifecycle.currentStage, kc.runtimeLifecycle.nextRecommendedAction ?? "No next runtime action is recorded yet.")}
            ${renderNoteRow("Validation", kc.runtimeLifecycle.validationStatus ?? "unknown", kc.runtimeLifecycle.nextSuggestedCommand ?? "No suggested command is recorded yet.")}
            ${renderNoteRow("Task", kc.runtimeLifecycle.currentTask ?? "none recorded", kc.runtimeLifecycle.recentEvents[0]?.summary ?? "No lifecycle events are recorded yet.")}
          </div>
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Waste & Weight", "Files and directories that inflate scope without helping the task.")}
          ${kc.wastedFiles.files.length > 0
        ? `<div class="kc-stack-list">${kc.wastedFiles.files.slice(0, 4).map((file) => renderNoteRow(file.file, `${formatTokensShort(file.tokens)} tokens`, file.reason)).join("")}</div>`
        : renderEmptyState("No wasted files are recorded in the current selection.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Heavy Directories", "Areas that dominate estimated token volume and deserve tighter scoping.")}
          ${kc.heavyDirectories.directories.length > 0
        ? `<div class="kc-stack-list">${kc.heavyDirectories.directories.slice(0, 4).map((directory) => renderNoteRow(directory.directory, `${directory.percentOfRepo}%`, directory.suggestion)).join("")}</div>`
        : renderEmptyState("No heavy-directory signal is recorded for this repo yet.")}
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Next Commands", "Exact CLI commands from the current execution plan.")}
        ${kc.executionPlan.nextCommands.length > 0
        ? renderListBadges(kc.executionPlan.nextCommands)
        : renderEmptyState("No next commands are currently recorded.")}
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Workflow Steps", "Linear workflow state for the active task.")}
          <div class="kc-inline-badges">
            ${renderInlineBadge(`${successfulWorkflowSteps}/${kc.workflow.steps.length} successful`)}
            ${failedWorkflowStep ? renderInlineBadge(`failed: ${failedWorkflowStep.action}`) : renderInlineBadge("no failed step")}
          </div>
          ${failedWorkflowStep?.failureReason ? `<div class="kc-divider"></div>${renderNoteRow("Failure reason", failedWorkflowStep.action, failedWorkflowStep.failureReason)}` : ""}
          ${kc.workflow.steps.length > 0
        ? `<div class="kc-stack-list">${kc.workflow.steps.map((step) => renderNoteRow(`${step.action}`, `${step.status}${step.retryCount > 0 ? ` · retry ${step.retryCount}` : ""}${step.attemptCount > 0 ? ` · attempt ${step.attemptCount}` : ""}`, step.failureReason
            ?? step.result.summary
            ?? step.validation
            ?? step.expectedOutput
            ?? step.result.suggestedFix
            ?? step.tokenUsage.note)).join("")}</div>`
        : renderEmptyState("No workflow state has been recorded yet.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Execution Trace", "What executed, which files were used, which skills applied, and token usage per step.")}
          ${kc.executionTrace.steps.length > 0
        ? `<div class="kc-stack-list">${kc.executionTrace.steps.map((step) => renderNoteRow(step.action, step.tokenUsage.source === "none"
            ? `${step.status}${step.retryCount > 0 ? ` · retry ${step.retryCount}` : ""}`
            : `${step.status}${step.retryCount > 0 ? ` · retry ${step.retryCount}` : ""} · ${step.tokenUsage.measuredTokens != null ? formatTokensShort(step.tokenUsage.measuredTokens) : `~${formatTokensShort(step.tokenUsage.estimatedTokens ?? 0)}`}`, step.failureReason
            ? `${step.failureReason}${step.files.length > 0 ? ` | files: ${step.files.slice(0, 3).join(", ")}` : ""}`
            : `${step.result.summary ?? (step.files.slice(0, 3).join(", ") || "no files")}${step.skillsApplied.length > 0 ? ` | skills: ${step.skillsApplied.join(", ")}` : ""}${step.result.validation ? ` | validation: ${step.result.validation}` : step.expectedOutput ? ` | expects: ${step.expectedOutput}` : ""}${step.result.retryCommand ? ` | retry: ${step.result.retryCommand}` : ""}`)).join("")}</div>`
        : renderEmptyState("No execution trace is available yet.")}
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("DECISION LOGIC", "Which signals won, and which signals were intentionally ignored.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            ${renderPanelHeader("Reasoning chain", kc.decisionLogic.summary || "No decision summary recorded.")}
            ${kc.decisionLogic.reasoningChain.length > 0
        ? `<div class="kc-stack-list">${kc.decisionLogic.reasoningChain.map((item) => renderBulletRow(item)).join("")}</div>`
        : renderEmptyState("No reasoning chain is available yet.")}
          </section>
          <section class="kc-subpanel">
            ${renderPanelHeader("Ignored signals", "Signals Kiwi saw but did not let dominate the next action.")}
            ${kc.decisionLogic.ignoredSignals.length > 0
        ? `<div class="kc-stack-list">${kc.decisionLogic.ignoredSignals.map((item) => renderBulletRow(item)).join("")}</div>`
        : renderEmptyState("No ignored signals are currently recorded.")}
          </section>
        </div>
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("Runtime Events", "Hook-style events emitted by Kiwi’s lightweight runtime integration.")}
        ${kc.runtimeLifecycle.recentEvents.length > 0
        ? `<div class="kc-stack-list">${kc.runtimeLifecycle.recentEvents.slice(0, 6).map((event) => renderNoteRow(`${event.type} · ${event.stage}`, event.status, event.summary)).join("")}</div>`
        : renderEmptyState("No runtime events are recorded yet.")}
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("Ecosystem Discovery", "Read-only external capability metadata used to inform decisions without executing tools directly.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            ${renderPanelHeader("Known tools", "Selected tools and ecosystems from Awesome Copilot and Awesome Claude Code.")}
            <div class="kc-stack-list">
              ${state.ecosystem.tools.slice(0, 5).map((tool) => renderNoteRow(tool.name, tool.category, tool.description)).join("")}
            </div>
          </section>
          <section class="kc-subpanel">
            ${renderPanelHeader("Known workflows", "Advisory workflow patterns only.")}
            <div class="kc-stack-list">
              ${state.ecosystem.workflows.slice(0, 4).map((workflow) => renderNoteRow(workflow.name, workflow.source, workflow.description)).join("")}
            </div>
          </section>
        </div>
      </section>
    </div>
  `;
}
function renderMachineView(state) {
    return renderMachinePanelView({
        state,
        activeMode,
        helpers: buildUiRenderHelpers()
    });
}
function buildRepoGraph(nodes) {
    const root = { label: "repo", x: 600, y: 360, radius: 34, tone: "tone-root" };
    const topLevel = nodes.slice(0, 8);
    const graphNodes = [root];
    const edges = [];
    const summary = [];
    topLevel.forEach((node, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(topLevel.length, 1);
        const folderNode = {
            label: node.name,
            x: 600 + Math.cos(angle) * 220,
            y: 360 + Math.sin(angle) * 220,
            radius: 24,
            tone: `tone-${node.status}`
        };
        graphNodes.push(folderNode);
        edges.push({ from: root, to: folderNode });
        summary.push({
            label: node.name,
            kind: node.kind,
            meta: node.children.length > 0 ? `${node.children.length} child nodes` : "leaf"
        });
        node.children.slice(0, 4).forEach((child, childIndex) => {
            const childAngle = angle + ((childIndex - 1.5) * 0.35);
            const fileNode = {
                label: child.name,
                x: folderNode.x + Math.cos(childAngle) * 160,
                y: folderNode.y + Math.sin(childAngle) * 160,
                radius: 16,
                tone: `tone-${child.status}`
            };
            graphNodes.push(fileNode);
            edges.push({ from: folderNode, to: fileNode });
        });
    });
    return {
        nodes: graphNodes,
        edges,
        summary
    };
}
function renderHandoffsView(state) {
    const latestCheckpoint = getPanelValue(state.continuity, "Latest checkpoint");
    const latestHandoff = getPanelValue(state.continuity, "Latest handoff");
    const latestReconcile = getPanelValue(state.continuity, "Latest reconcile");
    const recommendedTargets = state.specialists.handoffTargets.slice(0, 6);
    return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Handoffs & Checkpoints</p>
          <h1>Continuity Surfaces</h1>
          <p>Repo-local handoff, checkpoint, and specialist routing state.</p>
        </div>
        ${renderHeaderBadge(state.specialists.recommendedSpecialist, "neutral")}
      </section>

      <section class="kc-panel">
        <div class="kc-tab-row">
          ${renderTabButton("handoffs", activeHandoffTab, "Handoffs", "data-handoff-tab")}
          ${renderTabButton("checkpoints", activeHandoffTab, "Checkpoints", "data-handoff-tab")}
        </div>
        ${activeHandoffTab === "handoffs"
        ? `
            <div class="kc-two-column">
              <section class="kc-subpanel">
                ${renderPanelHeader("Latest Handoff", "Most recent repo-local handoff state")}
                <div class="kc-keyline-value">
                  <strong>${escapeHtml(latestHandoff)}</strong>
                  <span>${escapeHtml(state.specialists.safeParallelHint)}</span>
                </div>
              </section>
              <section class="kc-subpanel">
                ${renderPanelHeader("Suggested Targets", "Specialists that Kiwi Control currently considers safe handoff candidates.")}
                ${recommendedTargets.length > 0 ? renderListBadges(recommendedTargets) : renderEmptyState("No handoff targets are available yet.")}
              </section>
            </div>
          `
        : `
            <div class="kc-two-column">
              <section class="kc-subpanel">
                ${renderPanelHeader("Latest Checkpoint", "Newest saved checkpoint surface")}
                <div class="kc-keyline-value">
                  <strong>${escapeHtml(latestCheckpoint)}</strong>
                  <span>${escapeHtml(state.repoState.title)}</span>
                </div>
              </section>
              <section class="kc-subpanel">
                ${renderPanelHeader("Latest Reconcile", "Most recent dispatch reconcile record")}
                <div class="kc-keyline-value">
                  <strong>${escapeHtml(latestReconcile)}</strong>
                  <span>${escapeHtml(getPanelValue(state.repoOverview, "Current phase"))}</span>
                </div>
              </section>
            </div>
          `}
      </section>
    </div>
  `;
}
function renderFeedbackView(state) {
    const kc = state.kiwiControl ?? EMPTY_KC;
    const feedback = kc.feedback;
    return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Feedback</p>
          <h1>${escapeHtml(feedback.adaptationLevel === "active" ? "Adaptive feedback is active" : "Adaptive feedback is limited")}</h1>
          <p>${escapeHtml(feedback.note)}</p>
        </div>
        ${renderHeaderBadge(`${feedback.totalRuns} runs`, feedback.adaptationLevel === "active" ? "success" : "neutral")}
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Valid Runs", String(feedback.totalRuns), "successful completions", "neutral")}
        ${renderStatCard("Success Rate", `${feedback.successRate}%`, "repo-local", feedback.successRate >= 80 ? "success" : "neutral")}
        ${renderStatCard("Boosted", String(feedback.topBoostedFiles.length), "task-scope files", "success")}
        ${renderStatCard("Penalized", String(feedback.topPenalizedFiles.length), "task-scope files", "warn")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Boosted Files", "Files that improved successful runs in this task scope.")}
          ${feedback.topBoostedFiles.length > 0
        ? `<div class="kc-stack-list">${feedback.topBoostedFiles.map((entry) => renderScoreRow(entry.file, entry.score, "success")).join("")}</div>`
        : renderEmptyState("No boosted files are recorded yet.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Penalized Files", "Files Kiwi Control is learning to avoid for this task scope.")}
          ${feedback.topPenalizedFiles.length > 0
        ? `<div class="kc-stack-list">${feedback.topPenalizedFiles.map((entry) => renderScoreRow(entry.file, entry.score, "warn")).join("")}</div>`
        : renderEmptyState("No penalized files are recorded yet.")}
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Recent Completions", "Only valid successful completions train future selection behavior.")}
        ${feedback.recentEntries.length > 0
        ? `<div class="kc-stack-list">${feedback.recentEntries.map((entry) => `
              <div class="kc-note-row">
                <div>
                  <strong>${escapeHtml(entry.task)}</strong>
                  <span>${escapeHtml(`${entry.filesUsed}/${entry.filesSelected} files used · ${formatTimestamp(entry.timestamp)}`)}</span>
                </div>
                ${renderHeaderBadge(entry.success ? "success" : "fail", entry.success ? "success" : "warn")}
              </div>
            `).join("")}</div>`
        : renderEmptyState("No recent feedback events are available yet.")}
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("Retrieval Reuse", "When Kiwi reuses a successful pattern, it still falls back to fresh selection if similarity is weak.")}
        ${feedback.basedOnPastRuns
        ? `<div class="kc-stack-list">
              ${renderNoteRow("reused pattern", feedback.reusedPattern ?? "similar work", feedback.note)}
              ${feedback.similarTasks.slice(0, 4).map((entry) => renderNoteRow(entry.task, `similarity ${entry.similarity}`, formatTimestamp(entry.timestamp))).join("")}
            </div>`
        : renderEmptyState("Current selection is not based on past runs strongly enough to reuse a prior pattern.")} 
      </section>
    </div>
  `;
}
function renderInspector(state) {
    const kc = state.kiwiControl ?? EMPTY_KC;
    const currentFocus = focusedItem;
    const marker = currentFocus ? approvalMarkers.get(currentFocus.id) ?? "unmarked" : "unmarked";
    return renderInspectorPanel({
        ...buildInspectorContextModel({
            state,
            focusedItem: currentFocus,
            marker,
            activeMode,
            commandState,
            resolveFocusedStep: (focused) => focused?.kind === "step"
                ? deriveDisplayExecutionPlanSteps(state).find((step) => step.id === focused.id) ?? null
                : null,
            resolveFocusedNode: (focused) => focused?.kind === "path" ? findContextNodeByPath(state, focused.path) : null
        }),
        helpers: {
            ...buildUiRenderHelpers(),
            renderGateRow,
            renderBulletRow
        }
    });
}
function renderExecutionPlanPanel(state) {
    const steps = deriveDisplayExecutionPlanSteps(state);
    return renderExecutionPlanPanelView({
        ...buildExecutionPlanPanelContextModel({
            state,
            steps,
            editingPlanStepId,
            editingPlanDraft,
            focusedItem,
            commandState,
            failureGuidance: deriveExecutionPlanFailureGuidance(state.kiwiControl?.executionPlan.lastError ?? null)
        }),
        helpers: {
            escapeHtml,
            escapeAttribute,
            formatCliCommand,
            renderPanelHeader,
            renderInlineBadge,
            renderNoteRow,
            renderEmptyState,
            renderHeaderBadge
        }
    });
}
function renderLogDrawer(state) {
    const lines = buildLogLines(state);
    const executions = (state.kiwiControl ?? EMPTY_KC).execution.recentExecutions;
    return `
    <div class="kc-log-shell">
      <div class="kc-log-header">
        ${activeMode === "inspection"
        ? `<div class="kc-tab-row">
              ${renderTabButton("history", activeLogTab, "Execution History", "data-log-tab")}
              ${renderTabButton("validation", activeLogTab, "Validation Output", "data-log-tab")}
              ${renderTabButton("logs", activeLogTab, "System Logs", "data-log-tab")}
            </div>`
        : `<div class="kc-tab-row">${renderTabButton("history", "history", "Execution History")}</div>`}
        <button class="kc-icon-button" type="button" data-toggle-logs>
          ${iconSvg("close")}
        </button>
      </div>
      <div class="kc-log-body">
        ${activeMode === "execution"
        ? executions.length > 0
            ? executions.slice(0, 6).map((execution) => `
                <div class="kc-log-line ${execution.success ? "" : "is-warn"}">
                  <span>${escapeHtml(execution.success ? "run" : "failed")}</span>
                  <strong>${escapeHtml(`${execution.task} · ${execution.filesTouched} files · ~${formatTokensShort(execution.tokensUsed)} tokens · ${formatTimestamp(execution.timestamp)}`)}</strong>
                </div>
              `).join("")
            : renderEmptyState("No execution history is recorded yet.")
        : activeLogTab === "validation"
            ? renderValidationLogBody(state.validation)
            : activeLogTab === "history"
                ? executions.length > 0
                    ? executions.map((execution) => `
                  <div class="kc-log-line ${execution.success ? "" : "is-warn"}">
                    <span>${escapeHtml(execution.success ? "run" : "failed")}</span>
                    <strong>${escapeHtml(`${execution.task} · ${execution.filesTouched} files · ~${formatTokensShort(execution.tokensUsed)} tokens · ${formatTimestamp(execution.timestamp)}`)}</strong>
                  </div>
                `).join("")
                    : renderEmptyState("No execution history is recorded yet.")
                : lines.length > 0
                    ? lines.map((line) => `
                <div class="kc-log-line">
                  <span>${escapeHtml(line.label)}</span>
                  <strong>${escapeHtml(line.value)}</strong>
                </div>
              `).join("")
                    : renderEmptyState("No repo activity is recorded yet.")}
      </div>
    </div>
  `;
}
function renderValidationLogBody(validation) {
    const issues = validation.issues ?? [];
    if (issues.length === 0) {
        return `<div class="kc-log-line"><span>info</span><strong>Repo validation is currently passing.</strong></div>`;
    }
    return issues.map((issue) => `
    <div class="kc-log-line ${issue.level === "error" ? "is-error" : issue.level === "warn" ? "is-warn" : ""}">
      <span>${escapeHtml(issue.level)}</span>
      <strong>${escapeHtml(`${issue.filePath ? `${issue.filePath}: ` : ""}${issue.message}`)}</strong>
    </div>
  `).join("");
}
function renderStatCard(label, value, meta, tone) {
    return `
    <article class="kc-stat-card tone-${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <em>${escapeHtml(meta)}</em>
    </article>
  `;
}
function renderSmallMetric(value, label) {
    return `
    <div class="kc-small-metric">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}
function renderPanelHeader(title, description) {
    return `
    <header class="kc-panel-header">
      <div>
        <p>${escapeHtml(title)}</p>
        <h3>${escapeHtml(title)}</h3>
      </div>
      <span>${escapeHtml(description)}</span>
    </header>
  `;
}
function renderInfoRow(label, value, tone = "default") {
    return `
    <div class="kc-info-row">
      <span>${escapeHtml(label)}</span>
      <strong class="${tone === "warn" ? "is-warn" : ""}">${escapeHtml(value)}</strong>
    </div>
  `;
}
function deriveSignalImpact(signal) {
    const lowered = signal.toLowerCase();
    if (lowered.includes("low confidence")) {
        return "May miss relevant files or choose the wrong working set.";
    }
    if (lowered.includes("partial scan")) {
        return "Repo understanding may be incomplete until context expands.";
    }
    if (lowered.includes("changed files")) {
        return "Recent edits can dominate the plan and change the safest next step.";
    }
    if (lowered.includes("reverse depend")) {
        return "Downstream breakage can be missed if structural dependents are ignored.";
    }
    if (lowered.includes("keyword")) {
        return "Task matching may drift away from the user’s actual request.";
    }
    if (lowered.includes("repo context")) {
        return "Repo-local authority and critical files may be skipped.";
    }
    return "Ignoring this signal can reduce decision quality or hide relevant files.";
}
function renderHeaderBadge(label, tone) {
    const normalizedTone = tone === "bridge-unavailable"
        ? "warn"
        : tone === "low"
            ? "warn"
            : tone === "medium"
                ? "neutral"
                : tone === "high"
                    ? "success"
                    : tone;
    return `<span class="kc-badge badge-${escapeHtml(normalizedTone)}">${escapeHtml(label)}</span>`;
}
function renderGateRow(label, value, tone) {
    return `
    <div class="kc-info-row kc-gate-row">
      <span>${escapeHtml(label)}</span>
      <strong class="${tone === "warn" ? "is-warn" : tone === "success" ? "is-success" : ""}">${escapeHtml(value)}</strong>
    </div>
  `;
}
function renderTabButton(value, active, label, attributeName = "data-validation-tab") {
    return `<button class="kc-tab-button ${value === active ? "is-active" : ""}" type="button" ${attributeName}="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}
function renderListBadges(values) {
    return `<div class="kc-inline-badges">${values.map((value) => `<span class="kc-inline-badge">${escapeHtml(value)}</span>`).join("")}</div>`;
}
function renderInlineBadge(value) {
    return `<span class="kc-inline-badge">${escapeHtml(value)}</span>`;
}
function renderExplainabilityBadge(label, active) {
    return `<span class="kc-inline-badge ${active ? "is-active" : "is-muted"}">${escapeHtml(label)}</span>`;
}
function renderBulletRow(copy) {
    return `
    <div class="kc-bullet-row">
      <span class="kc-bullet-dot"></span>
      <span>${escapeHtml(copy)}</span>
    </div>
  `;
}
function renderCapabilityCard(capability) {
    return `
    <article class="kc-capability-card">
      <div class="kc-capability-head">
        <div>
          <strong>${escapeHtml(capability.id)}</strong>
          <span>${escapeHtml(capability.category)}</span>
        </div>
        ${renderHeaderBadge(capability.trustLevel, capability.trustLevel === "high" ? "success" : capability.trustLevel === "low" ? "warn" : "neutral")}
      </div>
      <p>${escapeHtml(capability.purpose)}</p>
      <div class="kc-inline-badges">
        ${renderInlineBadge(capability.readOnly ? "read only" : "read write")}
        ${renderInlineBadge(capability.writeCapable ? "write capable" : "no writes")}
        ${renderInlineBadge(capability.approvalRequired ? "approval required" : "self-serve")}
      </div>
      ${capability.usageGuidance.length > 0
        ? `<div class="kc-capability-notes">${capability.usageGuidance.slice(0, 2).map(renderBulletRow).join("")}</div>`
        : ""}
    </article>
  `;
}
function renderSpecialistCard(specialist) {
    return `
    <div class="kc-stack-list">
      <div class="kc-note-row">
        <div>
          <strong>${escapeHtml(specialist.name ?? specialist.specialistId)}</strong>
          <span>${escapeHtml(specialist.purpose ?? "No purpose recorded.")}</span>
        </div>
        <em>${escapeHtml(specialist.riskPosture ?? "unknown")}</em>
      </div>
      <div class="kc-inline-badges">
        ${renderInlineBadge(`id: ${specialist.specialistId}`)}
        ${renderInlineBadge(`tools: ${(specialist.preferredTools ?? []).join(", ") || "none"}`)}
        ${renderInlineBadge(`aliases: ${(specialist.aliases ?? []).join(", ") || "none"}`)}
      </div>
    </div>
  `;
}
function renderMemoryPresenceList(entries) {
    if (entries.length === 0) {
        return renderEmptyState("No repo-local memory entries are available.");
    }
    return `
    <div class="kc-memory-list">
      ${entries.map((entry) => `
        <div class="kc-memory-row ${entry.present ? "is-present" : "is-missing"}">
          <div>
            <strong>${escapeHtml(entry.label)}</strong>
            <span>${escapeHtml(entry.path)}</span>
          </div>
          <em>${entry.present ? "present" : "missing"}</em>
        </div>
      `).join("")}
    </div>
  `;
}
function renderScoreRow(file, score, tone) {
    return `
    <div class="kc-score-row">
      <span>${escapeHtml(file)}</span>
      <strong class="tone-${tone}">${score > 0 ? `+${score}` : `${score}`}</strong>
    </div>
  `;
}
function renderBarRow(label, value, total, meta) {
    const percent = total > 0 ? Math.max(6, Math.round((value / total) * 100)) : 6;
    return `
    <div class="kc-bar-row">
      <div class="kc-bar-copy">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(`${formatTokensShort(value)} · ${meta}`)}</span>
      </div>
      <div class="kc-bar-track"><div class="kc-bar-fill" style="width: ${percent}%"></div></div>
    </div>
  `;
}
function renderNoteRow(title, metric, note) {
    return `
    <div class="kc-note-row">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(note)}</span>
      </div>
      <em>${escapeHtml(metric)}</em>
    </div>
  `;
}
function renderMeterRow(label, value, total) {
    if (total <= 0) {
        return "";
    }
    const percent = Math.max(0, Math.min(100, Math.round((value / total) * 100)));
    return `
    <div class="kc-meter-row">
      <div class="kc-meter-copy">
        <span>${escapeHtml(label)}</span>
        <strong>${percent}%</strong>
      </div>
      <div class="kc-meter-track"><div class="kc-meter-fill" style="width: ${percent}%"></div></div>
    </div>
  `;
}
function renderValidationIssueCard(issue) {
    return `
    <article class="kc-issue-card issue-${escapeHtml(issue.level)}">
      <div>
        <strong>${escapeHtml(issue.filePath ?? "repo contract")}</strong>
        <span>${escapeHtml(issue.message)}</span>
      </div>
      ${renderHeaderBadge(issue.level, issue.level === "error" ? "critical" : "warn")}
    </article>
  `;
}
function renderEmptyState(message) {
    return `<p class="kc-empty-state">${escapeHtml(message)}</p>`;
}
function renderContextTree(tree) {
    return renderContextTreePanel({
        tree,
        focusedItem,
        contextOverrides,
        helpers: {
            escapeHtml,
            escapeAttribute,
            renderEmptyState
        }
    });
}
function buildActivityItems(state) {
    const kc = state.kiwiControl ?? EMPTY_KC;
    const items = [];
    for (const execution of kc.execution.recentExecutions) {
        items.push({
            title: execution.success ? "Execution completed" : "Execution failed",
            detail: `${execution.task} · ${execution.filesTouched} files touched`,
            timestamp: formatTimestamp(execution.timestamp),
            tone: execution.success ? "tone-success" : "tone-warn",
            icon: execution.success ? iconSvg("check") : iconSvg("alert"),
            ...(execution.tokensUsed > 0 ? { meta: [`~${formatTokensShort(execution.tokensUsed)} tokens`] } : {})
        });
    }
    for (const event of kc.runtimeLifecycle.recentEvents.slice(0, 4)) {
        items.push({
            title: `Runtime ${event.type}`,
            detail: event.summary,
            timestamp: formatTimestamp(event.timestamp),
            tone: event.status === "error"
                ? "tone-warn"
                : event.status === "warn"
                    ? "tone-neutral"
                    : "tone-success",
            icon: event.status === "error"
                ? iconSvg("alert")
                : event.status === "warn"
                    ? iconSvg("system")
                    : iconSvg("check"),
            ...(event.files.length > 0 ? { meta: event.files.slice(0, 3) } : {})
        });
    }
    const latestCheckpoint = getPanelValue(state.continuity, "Latest checkpoint");
    if (latestCheckpoint !== "none recorded") {
        items.push({
            title: "Checkpoint updated",
            detail: latestCheckpoint,
            timestamp: "repo-local",
            tone: "tone-neutral",
            icon: iconSvg("checkpoint")
        });
    }
    const latestHandoff = getPanelValue(state.continuity, "Latest handoff");
    if (latestHandoff !== "none recorded") {
        items.push({
            title: "Handoff available",
            detail: latestHandoff,
            timestamp: "repo-local",
            tone: "tone-neutral",
            icon: iconSvg("handoffs")
        });
    }
    const latestReconcile = getPanelValue(state.continuity, "Latest reconcile");
    if (latestReconcile !== "none recorded") {
        items.push({
            title: "Reconcile state updated",
            detail: latestReconcile,
            timestamp: "repo-local",
            tone: "tone-neutral",
            icon: iconSvg("activity")
        });
    }
    return items.slice(0, 8);
}
function buildRecentTouchedFiles(state, latestExecution) {
    const primaryActionFile = (state.kiwiControl ?? EMPTY_KC).nextActions.actions[0]?.file;
    const items = new Set();
    if (primaryActionFile) {
        items.add(primaryActionFile);
    }
    if (latestExecution.filesTouched > 0) {
        items.add(`${latestExecution.filesTouched} touched`);
    }
    if (latestExecution.tokensUsed > 0) {
        items.add(`~${formatTokensShort(latestExecution.tokensUsed)} tokens`);
    }
    return [...items];
}
function buildLogLines(state) {
    const kc = state.kiwiControl ?? EMPTY_KC;
    const lines = kc.execution.recentExecutions.map((execution) => ({
        label: execution.success ? "run" : "run failed",
        value: `${execution.task} · ${execution.filesTouched} files · ${formatTimestamp(execution.timestamp)}`
    }));
    return [
        ...lines,
        ...state.continuity.slice(0, 3).map((item) => ({
            label: item.label,
            value: item.value
        }))
    ].slice(0, 8);
}
function iconLabel(icon, label) {
    return `<span class="kc-icon-label">${icon}<em>${escapeHtml(label)}</em></span>`;
}
function iconSvg(name) {
    const common = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    switch (name) {
        case "overview":
            return `<svg ${common}><rect x="3" y="4" width="7" height="7"/><rect x="14" y="4" width="7" height="7"/><rect x="3" y="13" width="7" height="7"/><rect x="14" y="13" width="7" height="7"/></svg>`;
        case "context":
            return `<svg ${common}><path d="M4 19V5h16v14Z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>`;
        case "graph":
            return `<svg ${common}><circle cx="12" cy="12" r="2"/><circle cx="6" cy="7" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M10.5 10.5 7.5 8.5"/><path d="m13.5 10.5 3-2"/><path d="m10.8 13.4-2.5 3"/><path d="m13.2 13.4 2.5 3"/></svg>`;
        case "validation":
            return `<svg ${common}><path d="M12 3 4 7v6c0 4.5 3.2 6.9 8 8 4.8-1.1 8-3.5 8-8V7Z"/><path d="m9 12 2 2 4-4"/></svg>`;
        case "activity":
            return `<svg ${common}><path d="M3 12h4l2-4 4 8 2-4h6"/></svg>`;
        case "tokens":
            return `<svg ${common}><circle cx="12" cy="12" r="8"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>`;
        case "handoffs":
            return `<svg ${common}><path d="m7 7 5-4 5 4"/><path d="M12 3v14"/><path d="m17 17-5 4-5-4"/></svg>`;
        case "feedback":
            return `<svg ${common}><path d="M12 3v6"/><path d="m15 12 6-3"/><path d="m9 12-6-3"/><path d="m15 15 4 4"/><path d="m9 15-4 4"/><circle cx="12" cy="12" r="3"/></svg>`;
        case "mcps":
            return `<svg ${common}><path d="M4 12h16"/><path d="M12 4v16"/><path d="m6.5 6.5 11 11"/><path d="m17.5 6.5-11 11"/></svg>`;
        case "specialists":
            return `<svg ${common}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`;
        case "system":
            return `<svg ${common}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 4v16"/><path d="M15 4v16"/><path d="M4 9h16"/><path d="M4 15h16"/></svg>`;
        case "logs-open":
            return `<svg ${common}><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/><path d="m19 15-3 3 3 3"/></svg>`;
        case "logs-closed":
            return `<svg ${common}><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h16"/><path d="m15 9 3 3-3 3"/></svg>`;
        case "panel-open":
            return `<svg ${common}><rect x="3" y="4" width="18" height="16"/><path d="M15 4v16"/></svg>`;
        case "panel-closed":
            return `<svg ${common}><rect x="3" y="4" width="18" height="16"/><path d="M9 4v16"/></svg>`;
        case "close":
            return `<svg ${common}><path d="m6 6 12 12"/><path d="m18 6-12 12"/></svg>`;
        case "refresh":
            return `<svg ${common}><path d="M20 11a8 8 0 0 0-14.9-3"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.9 3"/><path d="M20 20v-5h-5"/></svg>`;
        case "check":
            return `<svg ${common}><path d="m5 12 4 4 10-10"/></svg>`;
        case "alert":
            return `<svg ${common}><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>`;
        case "checkpoint":
            return `<svg ${common}><path d="M6 4h12v6H6z"/><path d="M9 10v10"/><path d="M15 10v10"/></svg>`;
        case "sun":
            return `<svg ${common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
        case "moon":
            return `<svg ${common}><path d="M12 3a6 6 0 1 0 9 9A9 9 0 1 1 12 3Z"/></svg>`;
        default:
            return `<svg ${common}><circle cx="12" cy="12" r="8"/></svg>`;
    }
}
function formatTokensShort(count) {
    if (count >= 1_000_000) {
        return `${(count / 1_000_000).toFixed(1)}M`;
    }
    if (count >= 1_000) {
        return `${(count / 1_000).toFixed(1)}K`;
    }
    return String(count);
}
function formatInteger(value) {
    return value.toLocaleString("en-US");
}
function formatPercent(value) {
    return value == null ? "n/a" : `${value.toFixed(1)}%`;
}
function formatCurrency(value) {
    return value == null ? "—" : `$${value.toFixed(2)}`;
}
function formatTimestamp(timestamp) {
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
function getPanelValue(items, label) {
    return items.find((item) => item.label === label)?.value ?? "none recorded";
}
function getRepoLabel(targetRoot) {
    if (!targetRoot) {
        return "No repo loaded";
    }
    const segments = targetRoot.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] ?? targetRoot;
}
function buildActiveTargetHint(state) {
    return buildActiveTargetHintModel(state);
}
function buildFinalReadyDetail(state) {
    return buildFinalReadyDetailModel(state, currentTargetRoot);
}
function describeBuildSource(source) {
    switch (source) {
        case "source-bundle":
            return "local source bundle";
        case "installed-bundle":
            return "installed bundle";
        default:
            return "fallback launcher";
    }
}
function buildBridgeNote(state, source) {
    return buildBridgeNoteModel(state, source, buildReadinessEnv(state));
}
async function consumeInitialLaunchRequest() {
    if (!isTauriBridgeAvailable()) {
        return null;
    }
    try {
        return await invoke("consume_initial_launch_request");
    }
    catch {
        return null;
    }
}
async function loadRepoControlState(targetRoot, preferSnapshot = false) {
    if (!isTauriBridgeAvailable()) {
        return buildBridgeUnavailableState(targetRoot);
    }
    return await invoke("load_repo_control_state", { targetRoot, preferSnapshot });
}
function buildBridgeUnavailableState(targetRoot) {
    const hasTargetRoot = targetRoot.trim().length > 0;
    const resolvedTargetRoot = hasTargetRoot ? targetRoot : "";
    return {
        targetRoot: resolvedTargetRoot,
        loadState: {
            source: "bridge-fallback",
            freshness: "failed",
            generatedAt: new Date().toISOString(),
            snapshotSavedAt: null,
            snapshotAgeMs: null,
            detail: hasTargetRoot
                ? "Repo-local state could not be loaded from the Kiwi bridge."
                : "No repo is loaded yet."
        },
        profileName: "default",
        executionMode: "local",
        projectType: "unknown",
        repoState: {
            mode: "bridge-unavailable",
            title: hasTargetRoot ? "Could not load this repo yet" : "Open a repo",
            detail: hasTargetRoot
                ? "Kiwi Control could not read repo-local state for this folder yet."
                : "Run kc ui inside a repo to load it automatically.",
            sourceOfTruthNote: "Repo-local artifacts under .agent/ and promoted repo instruction files remain the source of truth. The desktop app never replaces that state."
        },
        repoOverview: [
            { label: "Project type", value: hasTargetRoot ? "unknown (awaiting repo bridge)" : "no repo loaded", ...(hasTargetRoot ? { tone: "warn" } : {}) },
            { label: "Active role", value: "none recorded" },
            { label: "Next file", value: hasTargetRoot ? ".agent/project.yaml" : "run kc ui inside a repo" },
            { label: "Next command", value: hasTargetRoot ? "kc ui" : "kc init" },
            { label: "Validation state", value: hasTargetRoot ? "bridge unavailable" : "waiting for repo", ...(hasTargetRoot ? { tone: "warn" } : {}) },
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
            activeSpecialist: "review-specialist",
            recommendedSpecialist: "review-specialist",
            activeProfile: null,
            recommendedProfile: null,
            handoffTargets: [],
            safeParallelHint: "Restore repo-local visibility first."
        },
        mcpPacks: {
            suggestedPack: {
                id: "core-pack",
                description: "Default repo-first pack.",
                guidance: [],
                realismNotes: []
            },
            available: [],
            compatibleCapabilities: [],
            capabilityStatus: "limited",
            note: "No compatible MCP capabilities are available until repo-local state can be loaded."
        },
        validation: { ok: false, errors: hasTargetRoot ? 1 : 0, warnings: hasTargetRoot ? 0 : 1, issues: [] },
        ecosystem: {
            artifactType: "kiwi-control/ecosystem-catalog",
            version: 1,
            timestamp: new Date().toISOString(),
            tools: [],
            workflows: [],
            capabilities: [],
            notes: ["Ecosystem metadata becomes available once repo-local state loads."]
        },
        machineAdvisory: {
            artifactType: "kiwi-control/machine-advisory",
            version: 2,
            generatedBy: "kiwi-control machine-advisory",
            windowDays: 7,
            updatedAt: "",
            stale: true,
            sections: {
                inventory: { status: "partial", updatedAt: "", reason: "Machine-local advisory is unavailable." },
                mcpInventory: { status: "partial", updatedAt: "", reason: "Machine-local advisory is unavailable." },
                optimizationLayers: { status: "partial", updatedAt: "", reason: "Machine-local advisory is unavailable." },
                setupPhases: { status: "partial", updatedAt: "", reason: "Machine-local advisory is unavailable." },
                configHealth: { status: "partial", updatedAt: "", reason: "Machine-local advisory is unavailable." },
                usage: { status: "partial", updatedAt: "", reason: "Machine-local advisory is unavailable." },
                guidance: { status: "partial", updatedAt: "", reason: "Machine-local advisory is unavailable." }
            },
            inventory: [],
            mcpInventory: {
                claudeTotal: 0,
                codexTotal: 0,
                copilotTotal: 0,
                tokenServers: []
            },
            optimizationLayers: [],
            setupPhases: [],
            configHealth: [],
            skillsCount: 0,
            copilotPlugins: [],
            usage: {
                days: 7,
                claude: {
                    available: false,
                    days: [],
                    totals: {
                        inputTokens: 0,
                        outputTokens: 0,
                        cacheCreationTokens: 0,
                        cacheReadTokens: 0,
                        totalTokens: 0,
                        totalCost: null,
                        cacheHitRatio: null
                    },
                    note: "Machine-local advisory is unavailable."
                },
                codex: {
                    available: false,
                    days: [],
                    totals: {
                        inputTokens: 0,
                        outputTokens: 0,
                        cachedInputTokens: 0,
                        reasoningOutputTokens: 0,
                        sessions: 0,
                        totalTokens: 0,
                        cacheHitRatio: null
                    },
                    note: "Machine-local advisory is unavailable."
                },
                copilot: {
                    available: false,
                    note: "Machine-local advisory is unavailable."
                }
            },
            optimizationScore: {
                planning: { label: "planning", score: 0, earnedPoints: 0, maxPoints: 100, activeSignals: [], missingSignals: [] },
                execution: { label: "execution", score: 0, earnedPoints: 0, maxPoints: 100, activeSignals: [], missingSignals: [] },
                assistant: { label: "assistant", score: 0, earnedPoints: 0, maxPoints: 100, activeSignals: [], missingSignals: [] }
            },
            setupSummary: {
                installedTools: { readyCount: 0, totalCount: 0 },
                healthyConfigs: { readyCount: 0, totalCount: 0 },
                activeTokenLayers: [],
                readyRuntimes: {
                    planning: false,
                    execution: false,
                    assistant: false
                }
            },
            systemHealth: {
                criticalCount: 0,
                warningCount: 0,
                okCount: 0
            },
            guidance: [],
            note: "Machine-local advisory is unavailable."
        },
        kiwiControl: EMPTY_KC
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
function escapeAttribute(value) {
    return escapeHtml(value);
}
function isTauriBridgeAvailable() {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
