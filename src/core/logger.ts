export class Logger {
  constructor(private readonly verbose = true) {}

  info(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }

  warn(message: string): void {
    console.warn(message);
  }

  error(message: string): void {
    console.error(message);
  }
}

