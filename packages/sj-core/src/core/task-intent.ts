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

export function deriveTaskScope(task: string): string {
  return deriveTaskCategory(task);
}

export function taskNeedsExternalVerification(task: string): boolean {
  const tokens = tokenizeTaskText(task);
  const category = deriveTaskCategory(task);

  return category === "external-contract" || tokens.some((token) =>
    ["api", "sdk", "client", "library", "http", "graphql", "unknown", "behavior"].includes(token)
  );
}
