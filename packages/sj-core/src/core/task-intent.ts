import path from "node:path";
import type { FileArea } from "./config.js";

export type TaskCategory =
  | "implementation"
  | "testing"
  | "docs"
  | "config"
  | "external-contract"
  | "release"
  | "ui"
  | "general";

const TASK_STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "need", "must",
  "it", "its", "this", "that", "these", "those", "my", "your", "our",
  "their", "what", "which", "who", "whom", "how", "when", "where", "why",
  "all", "each", "every", "both", "few", "more", "some", "any", "no",
  "not", "only", "same", "so", "than", "too", "very", "just", "about",
  "above", "after", "before", "between", "into", "through", "during",
  "up", "down", "out", "off", "over", "under", "again", "further",
  "then", "once", "here", "there", "also", "fix", "update", "add",
  "remove", "delete", "change", "modify", "implement", "create", "make",
  "refactor", "improve", "ensure"
]);

const CATEGORY_KEYWORDS: Record<TaskCategory, string[]> = {
  implementation: ["feature", "bug", "behavior", "logic", "flow"],
  testing: ["test", "tests", "spec", "coverage", "regression", "assert"],
  docs: ["doc", "docs", "readme", "guide", "documentation", "onboarding"],
  config: ["config", "tooling", "build", "lint", "typecheck", "tsconfig", "webpack", "vite"],
  "external-contract": ["api", "sdk", "http", "graphql", "client", "library", "unknown", "contract"],
  release: ["release", "deploy", "package", "publish", "signing", "notarization", "installer"],
  ui: ["ui", "ux", "component", "screen", "layout", "styles", "visual"],
  general: []
};

export function tokenizeTaskText(task: string): string[] {
  return task
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, " ")
    .split(/[\s\-_]+/)
    .filter((token) => token.length >= 2 && !TASK_STOP_WORDS.has(token));
}

export function deriveTaskCategory(task: string): TaskCategory {
  const tokens = tokenizeTaskText(task);
  const joined = tokens.join(" ");

  const orderedCategories: TaskCategory[] = [
    "external-contract",
    "testing",
    "docs",
    "config",
    "release",
    "ui",
    "implementation"
  ];

  for (const category of orderedCategories) {
    if (CATEGORY_KEYWORDS[category].some((keyword) => joined.includes(keyword))) {
      return category;
    }
  }

  return tokens.length > 0 ? "implementation" : "general";
}

export function buildTaskScopeKey(category: TaskCategory, fileArea: FileArea): string {
  return `${category}::${fileArea}`;
}

export function deriveTaskArea(task: string): FileArea {
  const tokens = tokenizeTaskText(task);
  const joined = tokens.join(" ");
  const category = deriveTaskCategory(task);

  if (category === "docs") return "docs";
  if (category === "testing") return "tests";
  if (category === "config") return "config";

  if (joined.includes("deploy") || joined.includes("infra") || joined.includes("terraform") || joined.includes("kubernetes")) {
    return "infra";
  }

  if (joined.includes("migration") || joined.includes("schema") || joined.includes("database") || joined.includes("sql")) {
    return "data";
  }

  if (joined.includes("prompt") || joined.includes("instruction") || joined.includes("context")) {
    return "context";
  }

  if (category === "release") {
    return "infra";
  }

  if (category === "general") {
    return "unknown";
  }

  return "application";
}

export function inferFileAreaFromPaths(filePaths: string[]): FileArea {
  if (filePaths.length === 0) {
    return "unknown";
  }

  const counts = new Map<FileArea, number>();
  for (const filePath of filePaths) {
    const area = classifyFileArea(filePath);
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }

  let bestArea: FileArea = "unknown";
  let bestCount = -1;
  for (const [area, count] of counts) {
    if (count > bestCount) {
      bestArea = area;
      bestCount = count;
    }
  }

  return bestArea;
}

export function deriveTaskScope(task: string, fileArea?: FileArea): string {
  return buildTaskScopeKey(deriveTaskCategory(task), fileArea ?? deriveTaskArea(task));
}

export function taskNeedsExternalVerification(task: string): boolean {
  const tokens = tokenizeTaskText(task);
  const category = deriveTaskCategory(task);

  return category === "external-contract" || tokens.some((token) =>
    ["api", "sdk", "client", "library", "http", "graphql", "unknown", "behavior"].includes(token)
  );
}

export function classifyFileArea(filePath: string): FileArea {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const base = path.basename(normalized);

  if (
    normalized.startsWith(".agent/")
    || normalized.startsWith(".github/instructions/")
    || normalized.startsWith("prompts/")
    || normalized.startsWith("templates/")
    || normalized.includes("/context/")
  ) {
    return "context";
  }

  if (
    normalized.startsWith("docs/")
    || base === "readme.md"
    || base === "readme.mdx"
    || base === "changelog.md"
    || normalized.endsWith(".md")
    || normalized.endsWith(".mdx")
  ) {
    return "docs";
  }

  if (
    normalized.includes("/__tests__/")
    || normalized.includes("/tests/")
    || normalized.includes("/test/")
    || normalized.endsWith(".test.ts")
    || normalized.endsWith(".test.tsx")
    || normalized.endsWith(".test.js")
    || normalized.endsWith(".spec.ts")
    || normalized.endsWith(".spec.tsx")
    || normalized.endsWith(".spec.js")
  ) {
    return "tests";
  }

  if (
    normalized.startsWith("infra/")
    || normalized.startsWith("deploy/")
    || normalized.startsWith("deployment/")
    || normalized.includes("/terraform/")
    || normalized.includes("/k8s/")
    || normalized.includes("/helm/")
    || normalized.endsWith(".tf")
    || normalized.endsWith(".hcl")
  ) {
    return "infra";
  }

  if (
    normalized.includes("/migrations/")
    || normalized.includes("/prisma/")
    || normalized.includes("/schema/")
    || normalized.endsWith(".sql")
  ) {
    return "data";
  }

  if (
    base === "package.json"
    || base === "package-lock.json"
    || base === "pnpm-lock.yaml"
    || base === "yarn.lock"
    || base === "tsconfig.json"
    || base === "vite.config.ts"
    || base === "vite.config.js"
    || base === "eslint.config.js"
    || base === "eslint.config.mjs"
    || base === "prettier.config.js"
    || base === "dockerfile"
    || normalized.startsWith(".github/workflows/")
    || normalized.includes("/config/")
    || normalized.endsWith(".yaml")
    || normalized.endsWith(".yml")
    || normalized.endsWith(".toml")
  ) {
    return "config";
  }

  return "application";
}
