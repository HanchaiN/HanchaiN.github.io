const path = require("path");
const { getFiles, copyFile, shouldSkipFile } = require("../utils/file-utils");

class PublicBuilder {
  constructor(basedir, outputPath, logger) {
    this.inputPath = path.join(basedir, "public");
    this.outputPath = outputPath;
    this.logger = logger;
  }

  buildFile(relativeFile) {
    if (shouldSkipFile(relativeFile)) {
      return;
    }

    const inFile = path.join(this.inputPath, relativeFile);
    const outFile = path.join(this.outputPath, relativeFile);
    copyFile(inFile, outFile);
    this.logger.info(`  Copied ${relativeFile}`);
  }

  build(files = null) {
    this.logger.info("Building public files...");
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

      this.logger.success("Public files built");
    } catch (e) {
      this.logger.error("Failed to build public files", e);
      throw e;
    }
  }
}

module.exports = PublicBuilder;
