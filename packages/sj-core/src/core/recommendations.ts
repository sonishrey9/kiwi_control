import type { FileArea, ProjectType, TaskType } from "./config.js";

export const MCP_PACK_IDS = ["core-pack", "research-pack", "web-qa-pack", "aws-pack", "ios-pack", "android-pack"] as const;
export type McpPackId = (typeof MCP_PACK_IDS)[number];

export interface McpPackDefinition {
  id: McpPackId;
  name: string;
  description: string;
  guidance: string[];
  realismNotes: string[];
  suggestedProjectTypes: string[];
}

const MCP_PACKS: Record<McpPackId, McpPackDefinition> = {
  "core-pack": {
    id: "core-pack",
    name: "Core Pack",
    description: "Default repo-first pack for filesystem, git-aware reasoning, and contract inspection.",
    guidance: [
      "Use for any repo that only needs baseline repo-state reading, routing, and contract maintenance.",
      "Prefer this pack when the repo is generic and should stay quiet by default."
    ],
    realismNotes: [
      "This pack is guidance only. Availability still depends on the active runtime and installed tools.",
      "Do not assume write-capable MCP parity across Codex, Claude, Copilot, Cursor, or hosted runtimes."
    ],
    suggestedProjectTypes: ["generic", "node", "python", "docs", "data-platform"]
  },
  "research-pack": {
    id: "research-pack",
    name: "Research Pack",
    description: "Planning and documentation pack for discovery, migration research, and architecture work.",
    guidance: [
      "Use for planning, docs, migration prep, and cross-repo research tasks.",
      "Prefer read-heavy tools and keep repo-local outputs compact and inspectable."
    ],
    realismNotes: [
      "Search and browser tooling are stronger in some runtimes than others.",
      "The pack improves guidance, not guaranteed live browsing capability."
    ],
    suggestedProjectTypes: ["docs", "generic", "data-platform"]
  },
  "web-qa-pack": {
    id: "web-qa-pack",
    name: "Web QA Pack",
    description: "Browser and verification guidance for web apps, UI review, and smoke testing.",
    guidance: [
      "Use when Playwright or browser automation helps validate UI, routing, and regressions.",
      "Keep browser verification additive. Never imply that UI automation is universally available."
    ],
    realismNotes: [
      "Playwright MCP is strongest where browser automation is explicitly installed and exposed.",
      "Copilot is suggestion-oriented and should not be described as a strict orchestration runtime."
    ],
    suggestedProjectTypes: ["node", "generic"]
  },
  "aws-pack": {
    id: "aws-pack",
    name: "AWS Pack",
    description: "AWS-specific routing and safety guidance for repos that genuinely target AWS.",
    guidance: [
      "Only recommend this pack for AWS repos or tasks that clearly require AWS services.",
      "Prefer repo-local guidance and existing SSO/account conventions over ad hoc credential handling."
    ],
    realismNotes: [
      "AWS MCP support is workload-specific and runtime-specific.",
      "Never imply AWS tooling is symmetric across local and hosted agent runtimes."
    ],
    suggestedProjectTypes: ["infra", "node", "python"]
  },
  "ios-pack": {
    id: "ios-pack",
    name: "iOS Pack",
    description: "Apple-platform guidance for Xcode-aware workflows, simulator checks, and UI validation.",
    guidance: [
      "Recommend for iOS and macOS repos when Xcode or simulator tooling is available.",
      "Keep repo-local runbooks authoritative and treat bridge tooling as optional acceleration."
    ],
    realismNotes: [
      "Xcode bridge availability is not universal across local shells, CI, and hosted runtimes.",
      "Always describe simulator and bridge capabilities as contingent on the active environment."
    ],
    suggestedProjectTypes: ["ios", "macos"]
  },
  "android-pack": {
    id: "android-pack",
    name: "Android Pack",
    description: "Android-focused guidance that leans on repo-local docs, Gradle, and emulator workflows.",
    guidance: [
      "Recommend for Android repos, especially when Gradle, Kotlin, and emulator checks are relevant.",
      "Default to repo-local guidance and normal build/test tooling before claiming special bridge support."
    ],
    realismNotes: [
      "Android support relies mainly on repo-local guidance plus standard build and test tooling.",
      "Do not imply parity with iOS bridge workflows or universal MCP support."
    ],
    suggestedProjectTypes: ["android"]
  }
};

export interface RecommendationInputs {
  projectType: ProjectType | string;
  taskType?: TaskType;
  fileArea?: FileArea;
  starterMcpHints?: string[];
  authorityFiles?: string[];
}

export function recommendMcpPack(inputs: RecommendationInputs): McpPackId {
  const hints = [...(inputs.starterMcpHints ?? []), ...(inputs.authorityFiles ?? [])].join(" ").toLowerCase();

  if (/(xcode|swift|ios|macos|xcworkspace|xcodeproj)/.test(hints)) {
    return "ios-pack";
  }
  if (/(android|gradle|kotlin|androidmanifest)/.test(hints)) {
    return "android-pack";
  }
  if (/(aws|route53|cloudformation|cdk|kiwi-prod|iam identity center)/.test(hints)) {
    return "aws-pack";
  }
  if (
    inputs.projectType === "docs" ||
    inputs.taskType === "planning" ||
    inputs.taskType === "docs" ||
    inputs.taskType === "migration"
  ) {
    return "research-pack";
  }
  if (
    inputs.taskType === "testing" ||
    ((inputs.taskType === "implementation" || inputs.taskType === "review") &&
      (inputs.projectType === "node" || inputs.fileArea === "application"))
  ) {
    return "web-qa-pack";
  }
  return "core-pack";
}

export function normalizeMcpPack(value: string | undefined): McpPackId {
  if (value && MCP_PACK_IDS.includes(value as McpPackId)) {
    return value as McpPackId;
  }
  return "core-pack";
}

export function getMcpPackDefinition(packId: string | undefined): McpPackDefinition {
  return MCP_PACKS[normalizeMcpPack(packId)];
}

export function listMcpPacks(): McpPackDefinition[] {
  return MCP_PACK_IDS.map((packId) => MCP_PACKS[packId]);
}
