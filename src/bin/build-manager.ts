import * as path from "path";

import { PagesBuilder } from "./builders/pages-builder";
import { PublicBuilder } from "./builders/public-builder";
import { ScriptsBuilder } from "./builders/scripts-builder";
import { DevServer } from "./server/dev-server";
import { ensureDir, removeDir, writeFile } from "./utils/file-utils";
import { Logger } from "./utils/logger";
import { FileWatcher } from "./watchers/file-watcher";

interface BuildManagerOptions {
  srcPath: string;
  outputPath: string;
  isDev?: boolean;
  port?: number;
}

interface PugOptions {
  basedir: string;
  isDev: boolean;
}

/**
 * Main build orchestrator that coordinates all builders, watchers, and dev server
 */
export class BuildManager {
  private srcPath: string;
  private outputPath: string;
  private isDev: boolean;
  private port: number;
  private logger: Logger;
  private publicBuilder: PublicBuilder;
  private pagesBuilder: PagesBuilder;
  private scriptsBuilder: ScriptsBuilder;
  private watcher: FileWatcher | null;
  private server: DevServer | null;
  private lastBuildTime: number;

  constructor(options: BuildManagerOptions) {
    this.srcPath = options.srcPath;
    this.outputPath = options.outputPath;
    this.isDev = options.isDev ?? process.env.NODE_ENV !== "production";
    this.port = options.port || 3000;
    this.lastBuildTime = 0;

    this.logger = new Logger(this.isDev);

    const pugOptions: PugOptions = {
      basedir: this.srcPath,
      isDev: this.isDev,
    };

    this.publicBuilder = new PublicBuilder(
      this.srcPath,
      this.outputPath,
      this.logger,
    );
    this.pagesBuilder = new PagesBuilder(
      this.srcPath,
      this.outputPath,
      pugOptions,
      this.logger,
    );
    this.scriptsBuilder = new ScriptsBuilder(this.logger, this.srcPath);
    this.watcher = null;
    this.server = null;
  }

  clean(): void {
    this.logger.info("Cleaning output directory...");
    removeDir(this.outputPath);
    this.logger.success("Output directory cleaned");
  }

  initialize(): void {
    ensureDir(this.outputPath);
    writeFile(path.join(this.outputPath, ".gitignore"), "*");
    this.logger.success("Output directory initialized");
  }

  buildPublicOnly(): void {
    this.publicBuilder.build();
  }

  buildPagesOnly(): void {
    this.pagesBuilder.build();
  }

  buildScriptsOnly(): void {
    this.scriptsBuilder.build();
  }

  buildAll(): void {
    this.logger.startTimer("build-all");
    this.initialize();
    this.publicBuilder.build();
    this.pagesBuilder.build();
    this.scriptsBuilder.build();
    this.lastBuildTime = Date.now();
    this.logger.logTime("build-all", "Build complete");
  }

  watch(): void {
    if (!this.watcher) {
      this.watcher = new FileWatcher(
        this.srcPath,
        {
          publicBuilder: this.publicBuilder,
          pagesBuilder: this.pagesBuilder,
          scriptsBuilder: this.scriptsBuilder,
        },
        this.logger,
      );
      this.watcher.start();
    }
  }

  serve(): void {
    if (!this.server) {
      this.server = new DevServer(this.outputPath, this.port, this.logger);
      this.server.start();
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.stop();
      this.watcher = null;
    }
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
  }

  getLogger(): Logger {
    return this.logger;
  }

  /**
   * Get timestamp of last successful build
   * @returns Unix timestamp in milliseconds
   */
  getLastBuildTime(): number {
    return this.lastBuildTime;
  }

  /**
   * Check if output is up to date
   * @returns True if build exists and is recent
   */
  isUpToDate(): boolean {
    return this.lastBuildTime > 0;
  }
}
