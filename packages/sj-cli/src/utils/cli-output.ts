import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

type SpinnerLike = {
  succeed(text?: string): void;
  fail(text?: string): void;
  stop(): void;
  text: string;
};

const ANSI = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  bold: "\u001b[1m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m"
};
const optionalImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;

function colorize(text: string, color: keyof typeof ANSI): string {
  return `${ANSI[color]}${text}${ANSI.reset}`;
}

export function info(text: string): string {
  return colorize(text, "cyan");
}

export function success(text: string): string {
  return colorize(text, "green");
}

export function warn(text: string): string {
  return colorize(text, "yellow");
}

export function error(text: string): string {
  return colorize(text, "red");
}

export function dim(text: string): string {
  return colorize(text, "dim");
}

export async function createSpinner(text: string): Promise<SpinnerLike> {
  try {
    const oraModule = await optionalImport("ora") as { default: unknown };
    const spinnerFactory = oraModule.default as (options: { text: string; isEnabled: boolean }) => { start(): SpinnerLike };
    const spinner = spinnerFactory({
      text,
      isEnabled: process.stdout.isTTY
    }).start();
    return spinner;
  } catch {
    return {
      text,
      succeed(message?: string) {
        if (message) {
          process.stdout.write(`${success("✔")} ${message}\n`);
        }
      },
      fail(message?: string) {
        if (message) {
          process.stdout.write(`${error("✖")} ${message}\n`);
        }
      },
      stop() {
        // noop fallback
      }
    };
  }
}

export async function renderTable(headers: string[], rows: string[][]): Promise<string> {
  try {
    const tableModule = await optionalImport("cli-table3") as { default: new (options: Record<string, unknown>) => { push: (...rows: string[][]) => void; toString: () => string } };
    const Table = tableModule.default;
    const table = new Table({
      head: headers.map((header) => colorize(header, "bold")),
      wordWrap: true,
      style: {
        head: [],
        border: []
      }
    });
    rows.forEach((row) => table.push(row));
    return table.toString();
  } catch {
    const widths = headers.map((header, index) =>
      Math.max(
        stripAnsi(header).length,
        ...rows.map((row) => stripAnsi(row[index] ?? "").length)
      )
    );
    const renderRow = (values: string[]) =>
      values
        .map((value, index) => pad(value, widths[index] ?? value.length))
        .join("  ");
    return [
      renderRow(headers),
      renderRow(widths.map((width) => "-".repeat(width))),
      ...rows.map((row) => renderRow(row))
    ].join("\n");
  }
}

export async function printTable(logger: Logger, headers: string[], rows: string[][]): Promise<void> {
  logger.info(await renderTable(headers, rows));
}

export function printSection(logger: Logger, title: string): void {
  logger.info(colorize(title, "bold"));
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function pad(value: string, width: number): string {
  const visible = stripAnsi(value).length;
  const padding = Math.max(0, width - visible);
  return `${value}${" ".repeat(padding)}`;
}
