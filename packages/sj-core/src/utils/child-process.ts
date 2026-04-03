import { execFile } from "node:child_process";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function runCommand(command: string, args: string[], cwd?: string): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(command, args, { cwd }, (error, stdout, stderr) => {
      resolve({
        code: error && typeof error.code === "number" ? error.code : 0,
        stdout,
        stderr
      });
    });
  });
}

