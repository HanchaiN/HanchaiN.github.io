import * as http from "http";
import handler from "serve-handler";

import { Logger } from "../utils/logger";

/**
 * Development server for serving built files with hot reload support
 */
export class DevServer {
  private outputPath: string;
  private port: number;
  private logger: Logger;
  private server: http.Server | null;

  /**
   * Creates a new DevServer instance
   * @param outputPath - Path to serve files from
   * @param port - Port number to listen on
   * @param logger - Logger instance for output
   */
  constructor(outputPath: string, port: number, logger: Logger) {
    this.outputPath = outputPath;
    this.port = port;
    this.logger = logger;
    this.server = null;
  }

  /**
   * Start the development server
   */
  start(): void {
    if (this.server) {
      this.logger.warn("Server is already running");
      return;
    }

    try {
      this.server = http.createServer((req, res) => {
        handler(req, res, { public: this.outputPath }).catch((error) => {
          this.logger.error("Error serving request", error);
          res.statusCode = 500;
          res.end("Internal Server Error");
        });
      });

      this.server.on("error", (error) => {
        this.logger.error("Server error", error);
      });

      this.server.listen(this.port, () => {
        this.logger.success(`Server running at http://localhost:${this.port}`);
      });
    } catch (error) {
      this.logger.error(
        "Failed to start server",
        error instanceof Error ? error : null,
      );
      this.server = null;
    }
  }

  /**
   * Stop the development server
   */
  stop(): void {
    if (this.server) {
      this.server.close((err) => {
        if (err) {
          this.logger.error("Error stopping server", err);
        } else {
          this.logger.info("Server stopped");
        }
      });
      this.server = null;
    }
  }

  /**
   * Check if server is currently running
   */
  isRunning(): boolean {
    return this.server !== null;
  }
}
