export class Logger {
  private isDev: boolean;
  private timers: Map<string, number>;

  /**
   * Creates a new Logger instance
   * @param isDev - Whether to enable development mode (shows full error stacks)
   */
  constructor(isDev: boolean = false) {
    this.isDev = isDev;
    this.timers = new Map();
  }

  /**
   * Log an informational message
   */
  info(message: string): void {
    console.log(message);
  }

  /**
   * Log a warning message
   */
  warn(message: string): void {
    console.warn(message);
  }

  /**
   * Log an error message with optional error object
   * @param message - Error message to display
   * @param error - Optional Error object (shown in dev mode only)
   */
  error(message: string, error: Error | null = null): void {
    console.error(message);
    if (this.isDev && error) {
      console.error(error);
    }
  }

  /**
   * Log a success message with checkmark
   */
  success(message: string): void {
    console.log(`✓ ${message}`);
  }

  /**
   * Start a performance timer
   * @param label - Unique identifier for this timer
   */
  startTimer(label: string): void {
    this.timers.set(label, performance.now());
  }

  /**
   * End a performance timer and return elapsed time
   * @param label - Timer identifier used in startTimer
   * @returns Elapsed time in milliseconds
   */
  endTimer(label: string): number {
    const start = this.timers.get(label);
    if (!start) {
      this.warn(`Timer "${label}" was not started`);
      return 0;
    }
    const duration = performance.now() - start;
    this.timers.delete(label);
    return duration;
  }

  /**
   * End a timer and log the elapsed time
   * @param label - Timer identifier
   * @param message - Optional custom message (defaults to label)
   */
  logTime(label: string, message?: string): void {
    const duration = this.endTimer(label);
    const durationStr =
      duration >= 1000
        ? `${(duration / 1000).toFixed(2)}s`
        : `${duration.toFixed(0)}ms`;
    this.info(`  ${message || label} completed in ${durationStr}`);
  }
}
