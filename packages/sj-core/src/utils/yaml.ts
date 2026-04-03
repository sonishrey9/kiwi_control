import { promises as fs } from "node:fs";
import YAML from "yaml";

export async function readYamlFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return YAML.parse(raw) as T;
}

export function parseYaml<T>(raw: string): T {
  return YAML.parse(raw) as T;
}

export function stringifyYaml(value: unknown): string {
  return YAML.stringify(value);
}

