import * as http from "http";
import handler from "serve-handler";

import { Logger } from "../utils/logger";

export class DevServer {
  private outputPath: string;
  private port: number;
  private logger: Logger;
  private server: http.Server | null;

  constructor(outputPath: string, port: number, logger: Logger) {
    this.outputPath = outputPath;
    this.port = port;
    this.logger = logger;
    this.server = null;
  }

  start(): void {
    this.server = http.createServer((req, res) =>
      handler(req, res, { public: this.outputPath }),
    );

    this.server.listen(this.port, () => {
      this.logger.success(`Server running at http://localhost:${this.port}`);
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
