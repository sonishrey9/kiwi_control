export interface EcosystemTool {
  id: string;
  name: string;
  category: "plugin" | "mcp" | "editor" | "skill-library";
  description: string;
  source: string;
  readOnly: boolean;
}

export interface EcosystemWorkflow {
  id: string;
  name: string;
  description: string;
  source: string;
}

export interface EcosystemCapability {
  id: string;
  name: string;
  surface: "mcp" | "skills" | "workflow";
  description: string;
  source: string;
}

export interface EcosystemCatalog {
  artifactType: "kiwi-control/ecosystem-catalog";
  version: 1;
  timestamp: string;
  tools: EcosystemTool[];
  workflows: EcosystemWorkflow[];
  capabilities: EcosystemCapability[];
  notes: string[];
}

const TOOLS: EcosystemTool[] = [
  {
    id: "github-mcp",
    name: "GitHub MCP",
    category: "mcp",
    description: "Repository, issue, pull request, and workflow access through a structured MCP surface.",
    source: "awesome-claude-code",
    readOnly: true
  },
  {
    id: "notion-mcp",
    name: "Notion MCP",
    category: "mcp",
    description: "Structured access to Notion workspaces and knowledge pages.",
    source: "awesome-claude-code",
    readOnly: true
  },
  {
    id: "supabase-mcp",
    name: "Supabase MCP",
    category: "mcp",
    description: "Project-aware MCP access for Supabase resources and operational context.",
    source: "awesome-claude-code",
    readOnly: true
  },
  {
    id: "awesome-agent-skills",
    name: "Awesome Agent Skills",
    category: "skill-library",
    description: "Curated catalog of reusable `SKILL.md`-style capability packages across platforms.",
    source: "awesome-agent-skills",
    readOnly: true
  },
  {
    id: "awesome-copilot-skills",
    name: "Awesome Copilot Skills",
    category: "skill-library",
    description: "Collection of skills, hooks, plugins, and workflows for Copilot-style agent experiences.",
    source: "awesome-copilot",
    readOnly: true
  }
];

const WORKFLOWS: EcosystemWorkflow[] = [
  {
    id: "copilot-agentic-workflows",
    name: "Agentic Workflows",
    description: "Markdown-defined AI workflows and automations from the Awesome Copilot ecosystem.",
    source: "awesome-copilot"
  },
  {
    id: "claude-plugin-marketplace",
    name: "Plugin Marketplace Flow",
    description: "Marketplace-driven plugin and MCP discovery model from the Claude Code ecosystem.",
    source: "awesome-claude-code"
  },
  {
    id: "skill-progressive-disclosure",
    name: "Progressive Disclosure Skills",
    description: "Skill discovery model that loads lightweight metadata before full instructions.",
    source: "awesome-agent-skills"
  }
];

const CAPABILITIES: EcosystemCapability[] = [
  {
    id: "repos-issues-prs",
    name: "Repos / Issues / PRs",
    surface: "mcp",
    description: "Structured repo and pull request context for decision support.",
    source: "awesome-claude-code"
  },
  {
    id: "jira-confluence",
    name: "Jira / Confluence",
    surface: "mcp",
    description: "Linked planning and documentation surfaces through external MCP integrations.",
    source: "awesome-claude-code"
  },
  {
    id: "skills-triggering",
    name: "Task-triggered skills",
    surface: "skills",
    description: "Intent-based skill discovery with metadata-first loading and optional deeper instructions.",
    source: "awesome-agent-skills"
  },
  {
    id: "copilot-hooks",
    name: "Hook-style lifecycle actions",
    surface: "workflow",
    description: "Event-driven workflow hooks that inform execution and verification without replacing the runtime.",
    source: "awesome-copilot"
  }
];

export function buildEcosystemCatalog(): EcosystemCatalog {
  return {
    artifactType: "kiwi-control/ecosystem-catalog",
    version: 1,
    timestamp: new Date().toISOString(),
    tools: TOOLS,
    workflows: WORKFLOWS,
    capabilities: CAPABILITIES,
    notes: [
      "This catalog is advisory only. Kiwi Control does not execute these tools directly.",
      "The catalog is sourced from permissively licensed, read-only ecosystem lists and is intended to inform decisions, not drive runtime behavior automatically."
    ]
  };
}
