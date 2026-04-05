import type { GraphPanelRenderContext } from "./contracts.js";

export function renderGraphViewPanel(context: GraphPanelRenderContext): string {
  const { state, graph, focusedNode, graphDepth, graphPan, graphZoom, graphMechanics, treeMechanics, helpers } = context;
  const { escapeHtml, escapeAttribute, renderHeaderBadge, renderPanelHeader, renderNoteRow, renderEmptyState } = helpers;

  return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Repo Graph</p>
          <h1>Mind Map</h1>
          <p>Repo topology visualized from Kiwi’s context tree with local focus, selection, and impact-path controls.</p>
        </div>
        ${renderHeaderBadge(graph.nodes.length > 0 ? `${graph.nodes.length} nodes` : "empty", graph.nodes.length > 0 ? "success" : "warn")}
      </section>

      <section class="kc-panel">
        <div class="kc-panel-head-row">
          ${renderPanelHeader("Graph Overview", "Root-centered map of directories and files Kiwi currently knows about.")}
          <div class="kc-inline-badges">
            <button class="kc-secondary-button" type="button" data-graph-action="depth-down">Depth -</button>
            <span class="kc-inline-badge">depth ${graphDepth}</span>
            <button class="kc-secondary-button" type="button" data-graph-action="depth-up">Depth +</button>
            <button class="kc-secondary-button" type="button" data-graph-action="reset-view">Reset view</button>
          </div>
        </div>
        ${graph.nodes.length > 0
          ? `
            <div class="kc-graph-shell">
              <svg class="kc-graph-canvas" data-graph-surface viewBox="0 0 1200 720" role="img" aria-label="Repo graph">
                <g class="kc-graph-viewport" data-graph-viewport transform="translate(${graphPan.x} ${graphPan.y}) scale(${graphZoom})">
                ${graph.edges.map((edge) => `
                  <line
                    x1="${edge.from.x}"
                    y1="${edge.from.y}"
                    x2="${edge.to.x}"
                    y2="${edge.to.y}"
                    class="kc-graph-edge ${edge.highlighted ? "is-highlighted" : ""}"
                  />
                `).join("")}
                ${graph.nodes.map((node) => `
                  <g
                    transform="translate(${node.x}, ${node.y})"
                    class="kc-graph-node-wrap ${node.highlighted ? "is-highlighted" : ""}"
                    data-graph-node-wrap
                    data-path="${escapeAttribute(node.path)}"
                  >
                    <circle
                      r="${node.radius}"
                      data-graph-node
                      data-path="${escapeAttribute(node.path)}"
                      data-kind="${node.kind}"
                      class="kc-graph-node ${node.tone} importance-${node.importance}"
                    />
                    <text class="kc-graph-label" text-anchor="middle" dy=".35em">${escapeHtml(node.label)}</text>
                  </g>
                `).join("")}
                </g>
              </svg>
            </div>
          `
          : renderEmptyState("No graph data is available yet. Run kiwi-control prepare to build a richer context tree.")}
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Cluster Summary", "Top visible nodes from the current context selection tree.")}
          ${graph.summary.length > 0
            ? `<div class="kc-stack-list">${graph.summary.map((entry) => renderNoteRow(entry.label, entry.kind, entry.meta)).join("")}</div>`
            : renderEmptyState("No cluster summary is available yet.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Node Actions", focusedNode ? `${focusedNode.label} · ${focusedNode.kind}` : "Select a node to act on it.")}
          ${focusedNode
            ? `
              <div class="kc-stack-list">
                ${renderNoteRow("Status", focusedNode.status, `importance: ${focusedNode.importance}`)}
                ${renderNoteRow("Path", focusedNode.kind, focusedNode.path)}
                ${renderNoteRow("Project", state.projectType, state.repoState.detail)}
              </div>
              <div class="kc-divider"></div>
              <div class="kc-inline-badges">
                <button class="kc-secondary-button" type="button" data-graph-action="focus" data-path="${escapeAttribute(focusedNode.path)}">Focus</button>
                <button class="kc-secondary-button" type="button" data-graph-action="include" data-path="${escapeAttribute(focusedNode.path)}">Include</button>
                <button class="kc-secondary-button" type="button" data-graph-action="exclude" data-path="${escapeAttribute(focusedNode.path)}">Exclude</button>
                <button class="kc-secondary-button" type="button" data-graph-action="ignore" data-path="${escapeAttribute(focusedNode.path)}">Ignore</button>
                ${focusedNode.kind === "file" ? `<button class="kc-secondary-button" type="button" data-graph-action="open" data-path="${escapeAttribute(focusedNode.path)}">Open</button>` : ""}
              </div>
            `
            : renderEmptyState("No graph node is currently selected.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("How This Map Is Built", "This graph is projected from Kiwi’s current context tree and index signals, not from a full semantic dependency graph.")}
          ${graphMechanics.length > 0
            ? `<div class="kc-stack-list">${graphMechanics.map((item) => renderNoteRow(item.title, item.metric, item.note)).join("")}</div>`
            : renderEmptyState("No graph mechanics are available yet.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("How Tree Status Works", "Selected, candidate, and excluded statuses come from the current tree plus any local UI overrides.")}
          ${treeMechanics.length > 0
            ? `<div class="kc-stack-list">${treeMechanics.map((item) => renderNoteRow(item.title, item.metric, item.note)).join("")}</div>`
            : renderEmptyState("No tree mechanics are available yet.")}
        </section>
      </div>
    </div>
  `;
}
