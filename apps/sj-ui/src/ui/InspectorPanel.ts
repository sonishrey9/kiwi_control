import type { InspectorRenderContext } from "./contracts.js";

export function renderInspectorPanel(context: InspectorRenderContext): string {
  const {
    state,
    primaryAction,
    activeSpecialist,
    topCapability,
    signalItems,
    focusedItem,
    focusedLabel,
    focusedReason,
    marker,
    activeMode,
    commandState,
    helpers
  } = context;
  const { escapeHtml, renderInlineBadge, renderExplainabilityBadge, renderGateRow, renderBulletRow, renderNoteRow, deriveSignalImpact } = helpers;
  const kc = state.kiwiControl;
  const runtimeLifecycleSnapshot = state.derivedFreshness.find((entry) => entry.outputName === "runtime-lifecycle");
  if (!kc) {
    return `
      <div class="kc-inspector-shell">
        <div class="kc-inspector-header">
          <div>
            <span>Inspector</span>
            <h2>${escapeHtml(focusedLabel)}</h2>
          </div>
          <button class="kc-icon-button" type="button" data-toggle-inspector>×</button>
        </div>
        <section class="kc-inspector-section">
          <p class="kc-section-micro">Reasoning</p>
          <p>${escapeHtml(focusedReason)}</p>
        </section>
      </div>
    `;
  }

  return `
    <div class="kc-inspector-shell">
      <div class="kc-inspector-header">
        <div>
          <span>Inspector</span>
          <h2>${escapeHtml(focusedLabel)}</h2>
        </div>
        <button class="kc-icon-button" type="button" data-toggle-inspector>
          ×
        </button>
      </div>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Controls</p>
        <div class="kc-inline-badges">
          <button class="kc-secondary-button" type="button" data-inspector-action="approve" ${!focusedItem ? "disabled" : ""}>Approve</button>
          <button class="kc-secondary-button" type="button" data-inspector-action="reject" ${!focusedItem ? "disabled" : ""}>Reject</button>
          <button class="kc-secondary-button" type="button" data-inspector-action="add-to-context" ${focusedItem?.kind !== "path" ? "disabled" : ""}>Add to Context</button>
          <button class="kc-secondary-button" type="button" data-inspector-action="validate" ${commandState.loading ? "disabled" : ""}>Trigger Validation</button>
          <button class="kc-secondary-button" type="button" data-inspector-action="handoff" ${commandState.loading ? "disabled" : ""}>Quick Handoff</button>
        </div>
        <div class="kc-divider"></div>
        ${renderNoteRow("Selection", focusedItem?.kind ?? "global", focusedReason)}
        ${renderNoteRow("Decision", marker, focusedItem ? "Local inspector review state for the current focus." : "Select a node or plan step to review it here.")}
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Reasoning</p>
        <p>${escapeHtml(focusedReason)}</p>
        <div class="kc-inline-badges">
          ${renderInlineBadge(kc.contextView.confidence?.toUpperCase() ?? "UNKNOWN")}
          ${renderInlineBadge(kc.contextView.confidenceDetail ?? "No confidence detail")}
          ${renderExplainabilityBadge("heuristic", kc.contextTrace.honesty.heuristic)}
          ${renderExplainabilityBadge("low confidence", kc.contextTrace.honesty.lowConfidence)}
          ${renderExplainabilityBadge("partial scan", kc.contextTrace.honesty.partialScan || kc.tokenBreakdown.partialScan || kc.indexing.partialScan)}
        </div>
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Decision inputs</p>
        ${signalItems.length > 0
          ? `<div class="kc-stack-list">${signalItems.map((item) => renderNoteRow(item, "impact", deriveSignalImpact(item))).join("")}</div>`
          : "<p>No decision inputs are currently surfaced.</p>"}
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Lifecycle</p>
        <div class="kc-gate-list">
          ${renderGateRow("Stage", kc.runtimeLifecycle.currentStage, "default")}
          ${renderGateRow("Validation", kc.runtimeLifecycle.validationStatus ?? "unknown", kc.runtimeLifecycle.validationStatus === "error" ? "warn" : "default")}
        </div>
        <p>${escapeHtml(kc.runtimeLifecycle.nextRecommendedAction ?? "No runtime lifecycle recommendation is recorded yet.")}</p>
        <p>${escapeHtml(`Compatibility/debug snapshot${runtimeLifecycleSnapshot?.sourceRevision != null ? ` · revision ${runtimeLifecycleSnapshot.sourceRevision}` : ""}${runtimeLifecycleSnapshot?.generatedAt ? ` · generated ${runtimeLifecycleSnapshot.generatedAt}` : ""}.`)}</p>
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Token estimate</p>
        <div class="kc-gate-list">
          ${renderGateRow("Measured", kc.measuredUsage.available ? kc.measuredUsage.totalTokens.toLocaleString("en-US") : "none", kc.measuredUsage.available ? "success" : "default")}
          ${renderGateRow("Selected", `~${kc.tokenAnalytics.selectedTokens.toLocaleString("en-US")}`, "default")}
          ${renderGateRow("Full repo", `~${kc.tokenAnalytics.fullRepoTokens.toLocaleString("en-US")}`, "default")}
          ${renderGateRow("Saved", `~${kc.tokenAnalytics.savingsPercent}%`, "success")}
        </div>
        <p>${escapeHtml(kc.measuredUsage.available ? kc.measuredUsage.note : (kc.tokenAnalytics.estimateNote ?? "No repo-local token estimate is available yet."))}</p>
      </section>

      ${activeMode === "inspection"
        ? `
          <section class="kc-inspector-section">
            <p class="kc-section-micro">MCP usage</p>
            <div class="kc-gate-list">
              ${renderGateRow("Pack", state.mcpPacks.suggestedPack.name ?? state.mcpPacks.suggestedPack.id, "default")}
              ${renderGateRow("Compatible", String(state.mcpPacks.compatibleCapabilities.length), state.mcpPacks.compatibleCapabilities.length > 0 ? "success" : "warn")}
              ${renderGateRow("Top capability", topCapability?.id ?? "none", topCapability ? "success" : "warn")}
            </div>
            <p>${escapeHtml(state.mcpPacks.note)}</p>
          </section>

          <section class="kc-inspector-section">
            <p class="kc-section-micro">Specialist usage</p>
            <div class="kc-gate-list">
              ${renderGateRow("Active", activeSpecialist?.name ?? state.specialists.activeSpecialist, "default")}
              ${renderGateRow("Risk", activeSpecialist?.riskPosture ?? "unknown", activeSpecialist?.riskPosture === "conservative" ? "success" : "default")}
              ${renderGateRow("Tool fit", (activeSpecialist?.preferredTools ?? []).join(", ") || "none", "default")}
            </div>
            <p>${escapeHtml(activeSpecialist?.purpose ?? state.specialists.safeParallelHint)}</p>
          </section>

          <section class="kc-inspector-section">
            <p class="kc-section-micro">Skills & trace</p>
            ${kc.skills.activeSkills.length > 0
              ? `<div class="kc-stack-list">${kc.skills.activeSkills.slice(0, 3).map((skill: typeof kc.skills.activeSkills[number]) => renderBulletRow(`${skill.name} — ${skill.executionTemplate[0] ?? skill.description}`)).join("")}</div>`
              : `<p>No active skills are currently matched.</p>`}
          </section>
        `
        : ""}

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Command</p>
        ${commandState.lastResult
          ? `<code class="kc-command-block">${escapeHtml(commandState.lastResult.commandLabel)}</code>`
          : primaryAction?.command
            ? `<code class="kc-command-block">${escapeHtml(primaryAction.command)}</code>`
            : `<p>No command recorded for the current state.</p>`}
      </section>
    </div>
  `;
}
