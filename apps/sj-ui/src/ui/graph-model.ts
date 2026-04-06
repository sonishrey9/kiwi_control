import type {
  InteractiveGraphEdge,
  InteractiveGraphModel,
  InteractiveGraphNode,
  KiwiControlContextTree,
  KiwiControlContextTreeNode
} from "./contracts.js";

export type GraphProjectionSummaryItem = { label: string; kind: string; meta: string; path: string };

export interface GraphProjection {
  rootPath: string;
  nodes: Array<InteractiveGraphNode & { baseX: number; baseY: number }>;
  edges: Array<{ fromPath: string; toPath: string; highlighted: boolean }>;
  summary: GraphProjectionSummaryItem[];
  nodesByPath: Map<string, InteractiveGraphNode & { baseX: number; baseY: number }>;
}

export interface GraphProjectionInput {
  tree: KiwiControlContextTree;
  rootPath: string;
  rootLabel: string;
  graphDepth: number;
  focusPath: string | null;
  selectedAnalysis: Array<{
    file: string;
    score?: number;
    dependencyChain?: string[];
  }>;
}

export function deriveGraphProjection(input: GraphProjectionInput): GraphProjection {
  const highlightedPaths = new Set(deriveHighlightedGraphPaths(input.focusPath, input.selectedAnalysis));
  const root: InteractiveGraphNode & { baseX: number; baseY: number } = {
    path: input.rootPath,
    label: input.rootLabel || "repo",
    kind: "root",
    status: "selected",
    baseX: 600,
    baseY: 360,
    x: 600,
    y: 360,
    radius: 34,
    tone: "tone-root",
    importance: "high",
    highlighted: highlightedPaths.has(input.rootPath)
  };

  const nodes: Array<InteractiveGraphNode & { baseX: number; baseY: number }> = [root];
  const edges: GraphProjection["edges"] = [];
  const summary: GraphProjectionSummaryItem[] = [];
  const visibleTopLevel = input.tree.nodes.slice(0, 10);

  visibleTopLevel.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(visibleTopLevel.length, 1);
    const baseX = 600 + Math.cos(angle) * 220;
    const baseY = 360 + Math.sin(angle) * 220;
    const importance = deriveNodeImportance(node, input.selectedAnalysis);
    const graphNode: InteractiveGraphNode & { baseX: number; baseY: number } = {
      path: node.path,
      label: node.name,
      kind: node.kind,
      status: node.status,
      baseX,
      baseY,
      x: baseX,
      y: baseY,
      radius: importance === "high" ? 26 : importance === "medium" ? 22 : 18,
      tone: `tone-${node.status}`,
      importance,
      highlighted: highlightedPaths.has(node.path)
    };
    nodes.push(graphNode);
    edges.push({
      fromPath: root.path,
      toPath: graphNode.path,
      highlighted: highlightedPaths.has(root.path) && highlightedPaths.has(graphNode.path)
    });
    summary.push({
      label: node.name,
      kind: node.kind,
      meta: `${node.children.length} child nodes`,
      path: node.path
    });

    if (input.graphDepth < 2) {
      return;
    }

    node.children.slice(0, input.graphDepth > 2 ? 6 : 4).forEach((child, childIndex) => {
      const childAngle = angle + ((childIndex - 1.5) * 0.32);
      const childBaseX = graphNode.baseX + Math.cos(childAngle) * 160;
      const childBaseY = graphNode.baseY + Math.sin(childAngle) * 160;
      const childImportance = deriveNodeImportance(child, input.selectedAnalysis);
      const childNode: InteractiveGraphNode & { baseX: number; baseY: number } = {
        path: child.path,
        label: child.name,
        kind: child.kind,
        status: child.status,
        baseX: childBaseX,
        baseY: childBaseY,
        x: childBaseX,
        y: childBaseY,
        radius: childImportance === "high" ? 18 : childImportance === "medium" ? 16 : 14,
        tone: `tone-${child.status}`,
        importance: childImportance,
        highlighted: highlightedPaths.has(child.path)
      };
      nodes.push(childNode);
      edges.push({
        fromPath: graphNode.path,
        toPath: childNode.path,
        highlighted: highlightedPaths.has(graphNode.path) && highlightedPaths.has(childNode.path)
      });
      summary.push({
        label: child.name,
        kind: child.kind,
        meta: child.status,
        path: child.path
      });
    });
  });

  return {
    rootPath: input.rootPath,
    nodes,
    edges,
    summary,
    nodesByPath: new Map(nodes.map((node) => [node.path, node]))
  };
}

export function materializeGraphModel(
  projection: GraphProjection,
  nodePositions: Map<string, { x: number; y: number }>
): InteractiveGraphModel {
  const nodes: InteractiveGraphNode[] = projection.nodes.map((node) => {
    const offset = nodePositions.get(node.path) ?? { x: 0, y: 0 };
    return {
      path: node.path,
      label: node.label,
      kind: node.kind,
      status: node.status,
      x: node.baseX + offset.x,
      y: node.baseY + offset.y,
      radius: node.radius,
      tone: node.tone,
      importance: node.importance,
      highlighted: node.highlighted
    };
  });

  const nodesByPath = new Map(nodes.map((node) => [node.path, node]));
  const edges: InteractiveGraphEdge[] = projection.edges.map((edge) => {
    const from = nodesByPath.get(edge.fromPath);
    const to = nodesByPath.get(edge.toPath);
    return {
      fromPath: edge.fromPath,
      toPath: edge.toPath,
      from: { x: from?.x ?? 0, y: from?.y ?? 0 },
      to: { x: to?.x ?? 0, y: to?.y ?? 0 },
      highlighted: edge.highlighted
    };
  });

  return {
    nodes,
    edges,
    summary: projection.summary
  };
}

export function resolveProjectedNodePosition(
  projection: GraphProjection,
  nodePositions: Map<string, { x: number; y: number }>,
  path: string
): { x: number; y: number } | null {
  const node = projection.nodesByPath.get(path);
  if (!node) {
    return null;
  }
  const offset = nodePositions.get(path) ?? { x: 0, y: 0 };
  return {
    x: node.baseX + offset.x,
    y: node.baseY + offset.y
  };
}

export function deriveHighlightedGraphPaths(
  focusPath: string | null,
  selectedAnalysis: GraphProjectionInput["selectedAnalysis"]
): string[] {
  if (!focusPath) {
    return [];
  }

  const dependencyChain = selectedAnalysis.find((entry) => entry.file === focusPath)?.dependencyChain;
  if (dependencyChain && dependencyChain.length > 1) {
    return dependencyChain;
  }

  const parts = focusPath.split(/[\\/]/).filter(Boolean);
  const segments: string[] = [];
  let accumulator = focusPath.startsWith("/") ? "/" : "";
  for (const part of parts) {
    accumulator = accumulator ? `${accumulator.replace(/\/$/, "")}/${part}` : part;
    segments.push(accumulator);
  }
  return segments;
}

export function deriveNodeImportance(
  node: KiwiControlContextTreeNode,
  selectedAnalysis: GraphProjectionInput["selectedAnalysis"]
): "low" | "medium" | "high" {
  const analysisEntry = selectedAnalysis.find((entry) => entry.file === node.path);
  if (node.status === "selected" || (analysisEntry?.score ?? 0) >= 2 || (analysisEntry?.dependencyChain?.length ?? 0) > 1) {
    return "high";
  }
  if (node.status === "candidate" || node.children.some((child) => child.status === "selected")) {
    return "medium";
  }
  return "low";
}
