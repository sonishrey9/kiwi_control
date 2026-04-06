import type { TopBarRenderContext } from "./contracts.js";

export function renderTopBarView(context: TopBarRenderContext): string {
  const {
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
    loadStatus,
    helpers
  } = context;
  const {
    escapeHtml,
    escapeAttribute,
    iconSvg,
    renderHeaderBadge,
    renderHeaderMeta
  } = helpers;
  const actionsDisabled = !currentTargetRoot || commandState.loading;

  return `
    <div class="kc-topbar-primary">
      <div class="kc-topbar-left">
        <button class="kc-repo-pill" type="button">
          <span class="kc-repo-name">${escapeHtml(repoLabel)}</span>
          <span class="kc-repo-path">${escapeHtml(state.targetRoot || "No repo loaded yet")}</span>
        </button>
        ${renderHeaderBadge(state.repoState.title, state.repoState.mode)}
        ${renderHeaderBadge(state.projectType, "neutral")}
        ${phase !== "none recorded" ? renderHeaderBadge(phase, "neutral") : ""}
      </div>
      <div class="kc-topbar-center">
        ${renderHeaderMeta("Next", decision.nextAction)}
        ${renderHeaderMeta("Blocking", decision.blockingIssue)}
        ${renderHeaderMeta("Health", decision.systemHealth)}
        ${renderHeaderMeta("Safe", decision.executionSafety)}
        ${renderHeaderMeta("Changed", decision.lastChangedAt)}
        ${renderHeaderMeta("Failures", String(decision.recentFailures))}
        ${renderHeaderMeta("Warnings", String(decision.newWarnings))}
        ${runtimeInfo ? renderHeaderMeta(runtimeInfo.label, runtimeInfo.detail) : ""}
      </div>
      <div class="kc-topbar-right">
        <div class="kc-inline-badges">
          <button class="kc-tab-button ${activeMode === "execution" ? "is-active" : ""}" type="button" data-ui-mode="execution">Execution</button>
          <button class="kc-tab-button ${activeMode === "inspection" ? "is-active" : ""}" type="button" data-ui-mode="inspection">Inspection</button>
        </div>
        <div class="kc-status-chip">
          <strong>${escapeHtml(activeMode)}</strong>
          <span>${escapeHtml(validationState)}</span>
        </div>
        <button class="kc-theme-toggle" type="button" data-theme-toggle>
          ${iconSvg(activeTheme === "dark" ? "sun" : "moon")}
          <span>${escapeHtml(themeLabel)}</span>
        </button>
        <button class="kc-icon-button" type="button" data-toggle-logs>
          ${isLogDrawerOpen ? iconSvg("logs-open") : iconSvg("logs-closed")}
        </button>
        <button class="kc-icon-button" type="button" data-toggle-inspector>
          ${isInspectorOpen ? iconSvg("panel-open") : iconSvg("panel-closed")}
        </button>
      </div>
    </div>
    <div class="kc-topbar-actions">
      <div class="kc-topbar-action-group">
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="guide" ${actionsDisabled ? "disabled" : ""}>Guide</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="next" ${actionsDisabled ? "disabled" : ""}>Next</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="validate" ${actionsDisabled ? "disabled" : ""}>Validate</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="retry" ${!retryEnabled || actionsDisabled ? "disabled" : ""}>Retry</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="run-auto" ${actionsDisabled || !currentTask ? "disabled" : ""}>Run Auto</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="checkpoint" ${actionsDisabled ? "disabled" : ""}>Checkpoint</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="handoff" ${actionsDisabled || state.specialists.handoffTargets.length === 0 ? "disabled" : ""}>Handoff</button>
      </div>
      ${commandState.composer
        ? `
          <div class="kc-action-composer">
            <span class="kc-section-micro">${escapeHtml(commandState.composer)}</span>
            ${commandState.composer === "handoff"
              ? `<select class="kc-action-input" data-command-draft>
                  ${[...new Set([commandState.draftValue, ...state.specialists.handoffTargets].filter(Boolean))].map((value) => `
                    <option value="${escapeAttribute(value)}" ${value === commandState.draftValue ? "selected" : ""}>${escapeHtml(value)}</option>
                  `).join("")}
                </select>`
              : `<input class="kc-action-input" data-command-draft value="${escapeAttribute(commandState.draftValue)}" placeholder="${escapeAttribute(commandState.composer === "checkpoint" ? "checkpoint label" : "run description")}" />`}
            <button class="kc-secondary-button kc-action-button is-primary" type="button" data-composer-submit="${commandState.composer}" ${commandState.loading || composerConstraint?.blocked ? "disabled" : ""}>Run</button>
            <button class="kc-secondary-button kc-action-button" type="button" data-composer-cancel ${commandState.loading ? "disabled" : ""}>Cancel</button>
          </div>
          ${composerConstraint
            ? `<div class="kc-action-hint ${composerConstraint.blocked ? "is-blocked" : ""}">
                <strong>${escapeHtml(composerConstraint.reason)}</strong>
                ${composerConstraint.nextCommand ? `<code class="kc-command-chip">${escapeHtml(composerConstraint.nextCommand)}</code>` : ""}
              </div>`
            : ""}
        `
        : ""}
    </div>
    ${loadStatus.visible
      ? `
        <div class="kc-load-strip tone-${loadStatus.tone}">
          <div class="kc-load-row">
            <span class="kc-load-badge">
              <span class="kc-load-dot"></span>
              ${escapeHtml(loadStatus.label)}
            </span>
            <strong>${escapeHtml(loadStatus.detail)}</strong>
          </div>
          <div class="kc-load-progress">
            <span class="kc-load-progress-fill" style="width:${loadStatus.progress}%"></span>
          </div>
        </div>
      `
      : ""}
  `;
}
