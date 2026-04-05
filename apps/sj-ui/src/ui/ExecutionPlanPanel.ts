import type { ExecutionPlanPanelRenderContext } from "./contracts.js";

export function renderExecutionPlanPanelView(context: ExecutionPlanPanelRenderContext): string {
  const { state, steps, editingPlanStepId, editingPlanDraft, focusedItem, commandState, helpers } = context;
  const { escapeHtml, escapeAttribute, renderPanelHeader, renderInlineBadge, renderNoteRow, renderEmptyState, renderHeaderBadge } = helpers;
  const plan = state.kiwiControl?.executionPlan;
  if (!plan) {
    return `
      <section class="kc-panel">
        ${renderPanelHeader("Execution Plan", "No execution plan is recorded yet.")}
        ${renderEmptyState("No execution plan is available yet.")}
      </section>
    `;
  }

  return `
    <section class="kc-panel">
      ${renderPanelHeader("Execution Plan", plan.summary || "No execution plan is recorded yet.")}
      <div class="kc-inline-badges">
        ${renderInlineBadge(`state: ${plan.state}`)}
        ${renderInlineBadge(`current: ${steps[plan.currentStepIndex]?.id ?? "none"}`)}
        ${renderInlineBadge(`risk: ${plan.risk}`)}
        ${plan.confidence ? renderInlineBadge(`confidence: ${plan.confidence}`) : ""}
      </div>
      ${plan.lastError
        ? `<div class="kc-divider"></div><div class="kc-stack-list">
            ${renderNoteRow("Failure", plan.lastError.errorType, plan.lastError.reason)}
            ${renderNoteRow("Fix command", plan.lastError.fixCommand, "Run this before continuing.")}
            ${renderNoteRow("Retry command", plan.lastError.retryCommand, "Use this to retry the failed step.")}
          </div>`
        : ""}
      ${steps.length > 0
        ? `<div class="kc-plan-list">${steps.map((step, index) => renderStepRow(
            step,
            index,
            editingPlanStepId,
            editingPlanDraft,
            focusedItem,
            commandState.loading,
            { escapeHtml, escapeAttribute, renderHeaderBadge }
          )).join("")}</div>`
        : renderEmptyState("No execution plan is available yet.")}
    </section>
  `;
}

function renderStepRow(
  step: ExecutionPlanPanelRenderContext["steps"][number],
  index: number,
  editingPlanStepId: string | null,
  editingPlanDraft: string,
  focusedItem: ExecutionPlanPanelRenderContext["focusedItem"],
  loading: boolean,
  helpers: Pick<ExecutionPlanPanelRenderContext["helpers"], "escapeHtml" | "escapeAttribute" | "renderHeaderBadge">
): string {
  const { escapeHtml, escapeAttribute, renderHeaderBadge } = helpers;
  const isEditing = editingPlanStepId === step.id;
  const isFocused = focusedItem?.kind === "step" && focusedItem.id === step.id;
  return `
    <article class="kc-plan-step ${step.skipped ? "is-skipped" : ""} ${isFocused ? "is-focused" : ""}" data-step-row="${escapeAttribute(step.id)}">
      <div class="kc-plan-step-head">
        <div>
          <span class="kc-section-micro">step ${index + 1}</span>
          ${isEditing
            ? `<input class="kc-action-input kc-plan-edit-input" data-plan-edit-input value="${escapeAttribute(editingPlanDraft)}" />`
            : `<strong>${escapeHtml(step.displayTitle)}</strong>`}
          <p>${escapeHtml(step.displayNote ?? step.command)}</p>
        </div>
        <div class="kc-inline-badges">
          ${renderHeaderBadge(step.status, step.status === "failed" ? "warn" : step.status === "success" ? "success" : "neutral")}
          ${step.skipped ? `<span class="kc-inline-badge">skipped</span>` : ""}
        </div>
      </div>
      <div class="kc-plan-step-actions">
        <button class="kc-secondary-button" type="button" data-plan-action="focus" data-step-id="${escapeAttribute(step.id)}">Focus</button>
        <button class="kc-secondary-button" type="button" data-plan-action="run" data-step-id="${escapeAttribute(step.id)}" ${loading ? "disabled" : ""}>Run</button>
        <button class="kc-secondary-button" type="button" data-plan-action="retry" data-step-id="${escapeAttribute(step.id)}" ${loading ? "disabled" : ""}>Retry</button>
        <button class="kc-secondary-button" type="button" data-plan-action="skip" data-step-id="${escapeAttribute(step.id)}">${step.skipped ? "Unskip" : "Skip"}</button>
        ${isEditing
          ? `
            <button class="kc-secondary-button" type="button" data-plan-action="edit-save" data-step-id="${escapeAttribute(step.id)}">Save</button>
            <button class="kc-secondary-button" type="button" data-plan-action="edit-cancel" data-step-id="${escapeAttribute(step.id)}">Cancel</button>
          `
          : `<button class="kc-secondary-button" type="button" data-plan-action="edit" data-step-id="${escapeAttribute(step.id)}">Edit</button>`}
        <button class="kc-secondary-button" type="button" data-plan-action="move-up" data-step-id="${escapeAttribute(step.id)}">↑</button>
        <button class="kc-secondary-button" type="button" data-plan-action="move-down" data-step-id="${escapeAttribute(step.id)}">↓</button>
      </div>
      <div class="kc-plan-step-meta">
        <code class="kc-command-chip">${escapeHtml(step.command)}</code>
        <span>${escapeHtml(step.validation)}</span>
        ${step.retryCommand ? `<span>${escapeHtml(step.retryCommand)}</span>` : ""}
      </div>
    </article>
  `;
}
