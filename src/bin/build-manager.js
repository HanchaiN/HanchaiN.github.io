const path = require("path");
const { removeDir, ensureDir, writeFile } = require("./utils/file-utils");
const Logger = require("./utils/logger");
const PublicBuilder = require("./builders/public-builder");
const PagesBuilder = require("./builders/pages-builder");
const ScriptsBuilder = require("./builders/scripts-builder");
const FileWatcher = require("./watchers/file-watcher");
const DevServer = require("./server/dev-server");

class BuildManager {
  constructor(options = {}) {
    this.basedir = options.basedir || path.join(__dirname, "..");
    this.outputPath =
      options.outputPath || path.join(__dirname, "..", "..", "dist");
    this.isDev = options.isDev ?? process.env.NODE_ENV !== "production";
    this.port = options.port || 3000;

    this.logger = new Logger(this.isDev);

    const pugOptions = {
      basedir: this.basedir,
      isDev: this.isDev,
    };

    this.publicBuilder = new PublicBuilder(
      this.basedir,
      this.outputPath,
      this.logger,
    );
    this.pagesBuilder = new PagesBuilder(
      this.basedir,
      this.outputPath,
      pugOptions,
      this.logger,
    );
    this.scriptsBuilder = new ScriptsBuilder(this.logger, this.basedir);
    this.watcher = null;
    this.server = null;
  }

  clean() {
    this.logger.info("Cleaning output directory...");
    removeDir(this.outputPath);
    ensureDir(this.outputPath);
    writeFile(path.join(this.outputPath, ".gitignore"), "*");
    this.logger.success("Output directory cleaned");
  }

  buildPublicOnly() {
    this.publicBuilder.build();
  }

  buildPagesOnly() {
    this.pagesBuilder.build();
  }

  buildScriptsOnly() {
    this.scriptsBuilder.build();
  }

  buildAll() {
    this.clean();
    this.publicBuilder.build();
    this.pagesBuilder.build();
    this.scriptsBuilder.build();
    this.logger.success("Build complete");
  }

  watch() {
    if (!this.watcher) {
      this.watcher = new FileWatcher(
        this.basedir,
        {
          publicBuilder: this.publicBuilder,
          pagesBuilder: this.pagesBuilder,
          scriptsBuilder: this.scriptsBuilder,
          buildAll: () => this.buildAll(),
        },
        this.logger,
      );
      this.watcher.start();
    }
  }

  serve() {
    if (!this.server) {
      this.server = new DevServer(this.outputPath, this.port, this.logger);
      this.server.start();
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.stop();
      this.watcher = null;
    }
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
  }
}

module.exports = BuildManager;
