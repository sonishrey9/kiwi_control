export function buildPreCommitChecklist(): string[] {
  return [
    "run local build",
    "run local tests",
    "review generated managed blocks",
    "confirm no global config changed",
    "confirm no secret values were printed"
  ];
}

