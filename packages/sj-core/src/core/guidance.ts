import { renderDisplayPath } from "../utils/fs.js";

export interface PortableContractLike {
  instructionSurfaces: string[];
  agentSurfaces: string[];
  roleSurfaces: string[];
  activeRole: string;
  supportingRoles: string[];
}

export interface SearchGuidance {
  inspectCodebaseFirst: boolean;
  repoDocsFirst: boolean;
  useExternalLookupWhen: string[];
  avoidExternalLookupWhen: string[];
}

export function buildBootstrapNextFileToRead(): string {
  return ".agent/context/architecture.md";
}

export function buildBootstrapNextSuggestedCommand(targetRoot?: string): string {
  const repoArg = targetRoot ? `"${targetRoot}"` : "<repo>";
  return `shrey-junior checkpoint "context seeded" --target ${repoArg}`;
}

export function chooseNextFileToRead(options: {
  latestTaskPacket?: string | null;
  latestHandoff?: string | null;
  latestReconcile?: string | null;
  latestDispatchManifest?: string | null;
  latestCheckpoint?: string | null;
  fallback?: string;
}): string {
  return (
    options.latestTaskPacket ??
    options.latestHandoff ??
    options.latestReconcile ??
    options.latestDispatchManifest ??
    options.latestCheckpoint ??
    options.fallback ??
    buildBootstrapNextFileToRead()
  );
}

export function buildFirstReadContract(options: {
  targetRoot: string;
  authorityOrder?: string[];
  promotedAuthorityDocs?: string[];
  contract: PortableContractLike;
}): string[] {
  const authority = uniqueStrings(
    [
      ...(options.authorityOrder ?? []),
      ...(options.promotedAuthorityDocs ?? [])
    ].map((item) => renderDisplayPath(options.targetRoot, item))
  ).filter((item) => !item.startsWith(".agent/context/"));

  return uniqueStrings([
    ...authority,
    ".agent/state/active-role-hints.json",
    ...buildCanonicalReadNext(options)
  ]);
}

export function buildCanonicalReadNext(options: {
  targetRoot: string;
  authorityOrder?: string[];
  promotedAuthorityDocs?: string[];
  contract: PortableContractLike;
}): string[] {
  const authority = uniqueStrings(
    [
      ...(options.authorityOrder ?? []),
      ...(options.promotedAuthorityDocs ?? [])
    ].map((item) => renderDisplayPath(options.targetRoot, item))
  ).filter((item) => !item.startsWith(".agent/context/"));

  return uniqueStrings([
    ...authority,
    ".agent/state/current-phase.json",
    ".agent/memory/current-focus.json",
    ".agent/state/checkpoints/latest.json",
    ".agent/state/latest-task-packets.json",
    ".agent/state/handoff/latest.json",
    ".agent/state/reconcile/latest.json",
    ".agent/state/dispatch/latest-manifest.json",
    ".agent/context/commands.md",
    ".agent/context/specialists.md",
    ".agent/context/tool-capabilities.md",
    ".agent/context/mcp-capabilities.md",
    ".agent/context/architecture.md",
    ".agent/memory/repo-facts.json",
    ".agent/memory/open-risks.json",
    ...options.contract.instructionSurfaces,
    ".github/agents/shrey-junior.md",
    ...options.contract.agentSurfaces.filter((item) => item !== ".github/agents/shrey-junior.md"),
    ...options.contract.roleSurfaces,
    ".agent/checks.yaml",
    ".agent/scripts/verify-contract.sh",
    ".agent/project.yaml",
    ".agent/context/conventions.md",
    ".agent/context/runbooks.md"
  ]);
}

export function buildWriteTargets(contract: PortableContractLike, extraTargets: string[] = []): string[] {
  return uniqueStrings([
    ...extraTargets,
    ".agent/tasks/*",
    ".agent/state/current-phase.json",
    ".agent/state/checkpoints/*",
    ".agent/state/handoff/*",
    ".agent/state/dispatch/*",
    ".agent/state/reconcile/*",
    ".agent/memory/current-focus.json",
    ".agent/memory/open-risks.json",
    ...contract.roleSurfaces
  ]);
}

export function buildChecksToRun(validationSteps: string[] = []): string[] {
  return uniqueStrings([
    ".agent/checks.yaml",
    "bash .agent/scripts/verify-contract.sh",
    ...validationSteps,
    "shrey-junior push-check --target <repo> when the CLI is available"
  ]);
}

export function buildStopConditions(options?: {
  riskLevel?: "low" | "medium" | "high";
  taskType?: string;
}): string[] {
  const conditions = [
    "stop when explicit repo authority or promoted canonical docs conflict with the requested action",
    "stop when active phase, handoff, dispatch, or reconcile state is blocked or stale",
    "stop when the change expands beyond the stated task packet scope or latest next step",
    "stop when a stable contract, auth flow, data boundary, or release surface must change without updated checks",
    "stop when required packets, role outputs, or continuity artifacts are missing"
  ];
  if (options?.riskLevel === "medium" || options?.riskLevel === "high") {
    conditions.push("stop when reviewer or tester separation becomes necessary and is not yet captured");
  }
  if (options?.taskType === "release-readiness" || options?.taskType === "migration") {
    conditions.push("stop when release or migration impact is unclear and no explicit validation evidence exists");
  }
  return uniqueStrings(conditions);
}

export function buildSearchGuidance(options?: {
  projectType?: string;
  taskType?: string;
  fileArea?: string;
}): SearchGuidance {
  const useExternalLookupWhen = [
    "repo authority or promoted docs explicitly point to external docs, APIs, or live systems",
    "the task depends on current tool behavior, version-sensitive docs, cloud service behavior, or browser/runtime behavior",
    "repo-local artifacts are insufficient to resolve an ambiguity after inspecting the codebase first"
  ];
  const avoidExternalLookupWhen = [
    "the repo-local contract, packets, or codebase already answers the question",
    "the task is a local mechanical edit, refactor, formatting fix, or narrow docs update",
    "external search would replace reading the active packet, latest handoff, or latest reconcile first"
  ];
  if (options?.projectType === "docs") {
    avoidExternalLookupWhen.push("the repo already contains the canonical docs being updated");
  }
  if (options?.fileArea === "infra" || options?.taskType === "migration") {
    useExternalLookupWhen.push("live provider or platform documentation is needed to confirm current behavior");
  }
  return {
    inspectCodebaseFirst: true,
    repoDocsFirst: true,
    useExternalLookupWhen: uniqueStrings(useExternalLookupWhen),
    avoidExternalLookupWhen: uniqueStrings(avoidExternalLookupWhen)
  };
}

export function buildBootstrapNextAction(): string {
  return "Fill in .agent/context/architecture.md, then record a checkpoint before non-trivial implementation or handoff.";
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter((item) => Boolean(item.trim())))];
}
