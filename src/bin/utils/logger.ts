export class Logger {
  private isDev: boolean;

  constructor(isDev: boolean = false) {
    this.isDev = isDev;
  }

  info(message: string): void {
    console.log(message);
  }

  warn(message: string): void {
    console.warn(message);
  }

  error(message: string, error: Error | null = null): void {
    console.error(message);
    if (this.isDev && error) {
      console.error(error);
    }
  }

  success(message: string): void {
    console.log(`✓ ${message}`);
  }
}
