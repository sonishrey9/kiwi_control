import type { TopBarRenderContext } from "./contracts.js";

export function renderTopBarView(context: TopBarRenderContext): string {
  const {
    state,
    repoLabel,
    phase,
    topMetadata,
    primaryBanner,
    actionCluster,
    runtimeBadge,
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
    helpers
  } = context;
  const {
    escapeHtml,
    escapeAttribute,
    iconSvg,
    formatCliCommand,
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
        ${phase !== "none recorded" ? renderHeaderBadge(phase, "neutral") : ""}
      </div>
      <div class="kc-topbar-center">
        ${topMetadata.centerItems.map((item) => renderHeaderMeta(item.label, item.value)).join("")}
      </div>
      <div class="kc-topbar-right">
        <div class="kc-inline-badges">
          <button class="kc-tab-button ${activeMode === "execution" ? "is-active" : ""}" type="button" data-ui-mode="execution">Execution</button>
          <button class="kc-tab-button ${activeMode === "inspection" ? "is-active" : ""}" type="button" data-ui-mode="inspection">Inspection</button>
        </div>
        <div class="kc-status-chip">
          <strong>${escapeHtml(activeMode)}</strong>
          <span>${escapeHtml(topMetadata.statusDetail)}</span>
        </div>
        ${runtimeBadge ? `<span class="kc-inline-badge is-muted">${escapeHtml(runtimeBadge)}</span>` : ""}
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
        ${actionCluster.primary.directCommand
          ? `<button class="kc-action-button kc-action-button-primary" type="button" data-direct-command="${escapeAttribute(actionCluster.primary.directCommand)}" ${actionsDisabled ? "disabled" : ""}>${escapeHtml(actionCluster.primary.label)}</button>`
          : actionCluster.primary.composerMode
            ? `<button class="kc-action-button kc-action-button-primary" type="button" data-ui-command="${escapeAttribute(actionCluster.primary.composerMode)}" ${actionsDisabled ? "disabled" : ""}>${escapeHtml(actionCluster.primary.label)}</button>`
            : `<button class="kc-action-button kc-action-button-primary" type="button" data-ui-command="${escapeAttribute(actionCluster.primary.command ?? "guide")}" ${actionsDisabled ? "disabled" : ""}>${escapeHtml(actionCluster.primary.label)}</button>`}
        <details class="kc-action-menu">
          <summary class="kc-secondary-button kc-action-button">More</summary>
          <div class="kc-action-menu-panel">
            ${actionCluster.secondary.map((action) =>
              action.directCommand
                ? `<button class="kc-secondary-button kc-action-button" type="button" data-direct-command="${escapeAttribute(action.directCommand)}" ${actionsDisabled ? "disabled" : ""}>${escapeHtml(action.label)}</button>`
                : action.composerMode
                  ? `<button class="kc-secondary-button kc-action-button" type="button" data-ui-command="${escapeAttribute(action.composerMode)}" ${actionsDisabled ? "disabled" : ""}>${escapeHtml(action.label)}</button>`
                  : `<button class="kc-secondary-button kc-action-button" type="button" data-ui-command="${escapeAttribute(action.command ?? "guide")}" ${actionsDisabled ? "disabled" : ""}>${escapeHtml(action.label)}</button>`
            ).join("")}
          </div>
        </details>
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
                ${composerConstraint.nextCommand ? `<code class="kc-command-chip">${escapeHtml(formatCliCommand(composerConstraint.nextCommand, currentTargetRoot))}</code>` : ""}
              </div>`
            : ""}
        `
        : ""}
    </div>
    ${primaryBanner.visible
      ? `
        <div class="kc-load-strip tone-${primaryBanner.tone}">
          <div class="kc-load-row">
            <span class="kc-load-badge">
              <span class="kc-load-dot"></span>
              ${escapeHtml(primaryBanner.label)}
            </span>
            <strong>${escapeHtml(primaryBanner.detail)}</strong>
          </div>
          ${primaryBanner.nextCommand ? `<div class="kc-action-hint is-blocked"><code class="kc-command-chip">${escapeHtml(formatCliCommand(primaryBanner.nextCommand, currentTargetRoot))}</code></div>` : ""}
          <div class="kc-load-progress">
            <span class="kc-load-progress-fill" style="width:${primaryBanner.progress}%"></span>
          </div>
        </div>
      `
      : ""}
  `;
}
