const http = require("http");
const handler = require("serve-handler");

class DevServer {
  constructor(outputPath, port, logger) {
    this.outputPath = outputPath;
    this.port = port;
    this.logger = logger;
    this.server = null;
  }

  start() {
    this.server = http.createServer((req, res) =>
      handler(req, res, { public: this.outputPath }),
    );

    this.server.listen(this.port, () => {
      this.logger.success(`Server running at http://localhost:${this.port}`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

module.exports = DevServer;
