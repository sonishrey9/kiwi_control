export function validateManagedOutput(content: string): boolean {
  const starts = (content.match(/SHREY-JUNIOR:START/g) ?? []).length;
  const ends = (content.match(/SHREY-JUNIOR:END/g) ?? []).length;
  const fileStarts = (content.match(/SHREY-JUNIOR:FILE-START/g) ?? []).length;
  const fileEnds = (content.match(/SHREY-JUNIOR:FILE-END/g) ?? []).length;
  return starts === ends && fileStarts === fileEnds;
}

