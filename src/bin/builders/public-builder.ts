import * as path from "path";

import { copyFile, getFiles, shouldSkipFile } from "../utils/file-utils";
import { Logger } from "../utils/logger";
import { getSrcPaths } from "../utils/paths";

export class PublicBuilder {
  private inputPath: string;
  private outputPath: string;
  private logger: Logger;

  constructor(basedir: string, outputPath: string, logger: Logger) {
    this.inputPath = getSrcPaths(basedir).public;
    this.outputPath = outputPath;
    this.logger = logger;
  }

  buildFile(relativeFile: string): void {
    if (shouldSkipFile(relativeFile)) {
      return;
    }

    const inFile = path.join(this.inputPath, relativeFile);
    const outFile = path.join(this.outputPath, relativeFile);
    copyFile(inFile, outFile);
    this.logger.info(`  Copied ${relativeFile}`);
  }

  build(files: string[] | null = null): void {
    this.logger.info("Building public files...");
    this.logger.startTimer("public-build");
    try {
      if (files && files.length > 0) {
        for (const file of files) {
          this.buildFile(file);
        }
      } else {
        const allFiles = getFiles(this.inputPath, {
          filter: (file) => !shouldSkipFile(file),
        });

        for (const file of allFiles) {
          this.buildFile(file);
        }
      }

      this.logger.logTime("public-build", "Public files built");
    } catch (e) {
      this.logger.error("Failed to build public files", e as Error);
      throw e;
    }
  }
}
