import path from "node:path";
import { promises as fs } from "node:fs";
import { pathExists, writeText } from "../utils/fs.js";
import { deriveTaskArea, deriveTaskCategory } from "./task-intent.js";

export interface SkillDefinition {
  skillId: string;
  name: string;
  description: string;
  triggerConditions: string[];
  executionTemplate: string[];
  sourcePath: string;
}

export interface SkillMatch {
  skillId: string;
  name: string;
  score: number;
  description: string;
  triggerConditions: string[];
  executionTemplate: string[];
}

export interface SkillRegistryState {
  artifactType: "kiwi-control/skills-registry";
  version: 1;
  timestamp: string;
  task: string;
  activeSkills: SkillMatch[];
  suggestedSkills: SkillMatch[];
  skills: SkillDefinition[];
}

const MAX_ACTIVE_SKILLS = 2;
const MAX_SUGGESTED_SKILLS = 2;

function registryPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "skills-registry.json");
}

function skillsDirectory(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "skills");
}

export async function loadSkillDefinitions(targetRoot: string): Promise<SkillDefinition[]> {
  const root = skillsDirectory(targetRoot);
  if (!(await pathExists(root))) {
    return [];
  }

  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const skills: SkillDefinition[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const absolutePath = path.join(root, entry.name);
    let contents: string;
    try {
      contents = await fs.readFile(absolutePath, "utf8");
    } catch {
      continue;
    }

    skills.push(parseSkillMarkdown(absolutePath, contents));
  }

  return skills.sort((left, right) => left.name.localeCompare(right.name));
}

export async function matchSkillsForTask(
  targetRoot: string,
  task: string
): Promise<SkillRegistryState> {
  const skills = await loadSkillDefinitions(targetRoot);
  const taskTokens = tokenize(task);
  const taskCategory = deriveTaskCategory(task);
  const taskArea = deriveTaskArea(task);

  const ranked = skills
    .map((skill) => ({
      skill,
      score: scoreSkill(skill, taskTokens, taskCategory, taskArea)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.skill.name.localeCompare(right.skill.name));

  const activeSkills = ranked
    .filter((entry) => entry.score >= 2)
    .slice(0, MAX_ACTIVE_SKILLS)
    .map((entry) => toMatch(entry.skill, entry.score));
  const suggestedSkills = ranked
    .filter((entry) => !activeSkills.some((skill) => skill.skillId === entry.skill.skillId))
    .slice(0, MAX_SUGGESTED_SKILLS)
    .map((entry) => toMatch(entry.skill, entry.score));

  const state: SkillRegistryState = {
    artifactType: "kiwi-control/skills-registry",
    version: 1,
    timestamp: new Date().toISOString(),
    task,
    activeSkills,
    suggestedSkills,
    skills
  };

  await persistSkillRegistry(targetRoot, state);
  return state;
}

export async function persistSkillRegistry(
  targetRoot: string,
  state: SkillRegistryState
): Promise<string> {
  const outputPath = registryPath(targetRoot);
  await writeText(outputPath, `${JSON.stringify(state, null, 2)}\n`);
  return outputPath;
}

function parseSkillMarkdown(absolutePath: string, contents: string): SkillDefinition {
  const lines = contents.split(/\r?\n/);
  const sections = splitSections(lines);
  const basename = path.basename(absolutePath, ".md");
  const name = firstNonEmpty(sections.get("name")) ?? inferTitle(lines) ?? basename;
  const description = (firstNonEmpty(sections.get("description")) ?? "").trim();
  const triggerConditions = collectList(sections.get("trigger conditions") ?? sections.get("triggers"));
  const executionTemplate = collectList(sections.get("execution template") ?? sections.get("template"));

  return {
    skillId: slugify(basename),
    name,
    description,
    triggerConditions,
    executionTemplate,
    sourcePath: absolutePath
  };
}

function splitSections(lines: string[]): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let currentSection = "body";
  sections.set(currentSection, []);

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      const sectionHeading = match[1];
      if (!sectionHeading) {
        continue;
      }
      currentSection = sectionHeading.trim().toLowerCase();
      sections.set(currentSection, []);
      continue;
    }

    sections.get(currentSection)?.push(line);
  }

  return sections;
}

function inferTitle(lines: string[]): string | null {
  const heading = lines.find((line) => /^#\s+/.test(line));
  return heading ? heading.replace(/^#\s+/, "").trim() : null;
}

function collectList(lines: string[] | undefined): string[] {
  if (!lines) {
    return [];
  }

  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function firstNonEmpty(lines: string[] | undefined): string | null {
  if (!lines) {
    return null;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      return trimmed.replace(/^[-*]\s*/, "");
    }
  }

  return null;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, " ")
    .split(/[\s\-_]+/)
    .filter((token) => token.length > 2);
}

function scoreSkill(
  skill: SkillDefinition,
  taskTokens: string[],
  taskCategory: ReturnType<typeof deriveTaskCategory>,
  taskArea: ReturnType<typeof deriveTaskArea>
): number {
  const haystacks = [
    skill.name.toLowerCase(),
    skill.description.toLowerCase(),
    ...skill.triggerConditions.map((entry) => entry.toLowerCase())
  ];

  let score = 0;
  for (const token of taskTokens) {
    if (haystacks.some((haystack) => haystack.includes(token))) {
      score += 1;
    }
  }

  if (skill.triggerConditions.some((condition) => condition.toLowerCase().includes(taskCategory))) {
    score += 1;
  }
  if (skill.triggerConditions.some((condition) => condition.toLowerCase().includes(taskArea))) {
    score += 1;
  }

  return score;
}

function toMatch(skill: SkillDefinition, score: number): SkillMatch {
  return {
    skillId: skill.skillId,
    name: skill.name,
    score,
    description: skill.description,
    triggerConditions: skill.triggerConditions,
    executionTemplate: skill.executionTemplate
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
