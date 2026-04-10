import type { ContextTreePanelRenderContext } from "./contracts.js";

export function renderContextTreePanel(context: ContextTreePanelRenderContext): string {
  const { tree, focusedItem, contextOverrides, helpers } = context;
  const { escapeHtml, escapeAttribute } = helpers;

  return `
    <div class="kc-tree-shell">
      <div class="kc-tree-legend">
        <span><strong>✓</strong> selected</span>
        <span><strong>•</strong> candidate</span>
        <span><strong>×</strong> excluded</span>
      </div>
      <div class="kc-tree-root">
        ${tree.nodes.map((node: ContextTreePanelRenderContext["tree"]["nodes"][number]) => renderContextTreeNode(node, focusedItem, contextOverrides, helpers)).join("")}
      </div>
    </div>
  `;
}

function renderContextTreeNode(
  node: ContextTreePanelRenderContext["tree"]["nodes"][number],
  focusedItem: ContextTreePanelRenderContext["focusedItem"],
  contextOverrides: ContextTreePanelRenderContext["contextOverrides"],
  helpers: ContextTreePanelRenderContext["helpers"]
): string {
  const { escapeHtml, escapeAttribute } = helpers;
  const override = contextOverrides.get(node.path);
  const overrideLabel = override ? `override: ${override}` : node.status;
  const focusedClass = focusedItem?.kind === "path" && focusedItem.path === node.path ? "is-focused" : "";

  if (node.kind === "file") {
    return `
      <div class="kc-tree-node tree-${escapeHtml(node.status)} ${focusedClass}">
        <span class="kc-tree-row">
          <span class="kc-tree-status">${contextTreeStatusIcon(node.status)}</span>
          <span class="kc-tree-name">${escapeHtml(node.name)}</span>
          <span class="kc-tree-actions">
            <button class="kc-tree-action" type="button" data-tree-action="focus" data-path="${escapeAttribute(node.path)}">Focus</button>
            <button class="kc-tree-action" type="button" data-tree-action="include" data-path="${escapeAttribute(node.path)}">Include</button>
            <button class="kc-tree-action" type="button" data-tree-action="exclude" data-path="${escapeAttribute(node.path)}">Exclude</button>
            <button class="kc-tree-action" type="button" data-tree-action="ignore" data-path="${escapeAttribute(node.path)}">Ignore</button>
            <button class="kc-tree-action" type="button" data-tree-action="open" data-path="${escapeAttribute(node.path)}">Open</button>
          </span>
        </span>
        <span class="kc-tree-meta">${escapeHtml(overrideLabel)}</span>
      </div>
    `;
  }

  return `
    <details class="kc-tree-node tree-dir tree-${escapeHtml(node.status)} ${focusedClass}" ${node.expanded ? "open" : ""}>
      <summary class="kc-tree-row">
        <span class="kc-tree-caret"></span>
        <span class="kc-tree-status">${contextTreeStatusIcon(node.status)}</span>
        <span class="kc-tree-name">${escapeHtml(node.name)}/</span>
        <span class="kc-tree-actions">
          <button class="kc-tree-action" type="button" data-tree-action="focus" data-path="${escapeAttribute(node.path)}">Focus</button>
          <button class="kc-tree-action" type="button" data-tree-action="include" data-path="${escapeAttribute(node.path)}">Include</button>
          <button class="kc-tree-action" type="button" data-tree-action="exclude" data-path="${escapeAttribute(node.path)}">Exclude</button>
          <button class="kc-tree-action" type="button" data-tree-action="ignore" data-path="${escapeAttribute(node.path)}">Ignore</button>
          <button class="kc-tree-action" type="button" data-tree-action="open" data-path="${escapeAttribute(node.path)}">Open</button>
        </span>
      </summary>
      <div class="kc-tree-meta">${escapeHtml(overrideLabel)}</div>
      <div class="kc-tree-children">
        ${node.children.map((child: ContextTreePanelRenderContext["tree"]["nodes"][number]) => renderContextTreeNode(child, focusedItem, contextOverrides, helpers)).join("")}
      </div>
    </details>
  `;
}

function contextTreeStatusIcon(status: "selected" | "candidate" | "excluded"): string {
  switch (status) {
    case "selected":
      return "✓";
    case "excluded":
      return "×";
    default:
      return "•";
  }
}
