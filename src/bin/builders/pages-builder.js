const path = require("path");
const pug = require("pug");
const { getFiles, writeFile } = require("../utils/file-utils");

class PagesBuilder {
  constructor(basedir, outputPath, options, logger) {
    this.inputPath = path.join(basedir, "pages");
    this.componentsPath = path.join(basedir, "components");
    this.outputPath = outputPath;
    this.options = options;
    this.logger = logger;
  }

  buildFile(relativeFile) {
    if (path.extname(relativeFile) !== ".pug") {
      return;
    }

    const inFile = path.join(this.inputPath, relativeFile);
    const outFile = path.join(
      this.outputPath,
      path.dirname(relativeFile),
      path.basename(relativeFile, ".pug") + ".html",
    );

    const html = pug.renderFile(inFile, { ...this.options });
    writeFile(outFile, html);
    this.logger.info(`  Rendered ${relativeFile}`);
  }

  build(files = null) {
    this.logger.info("Building pages...");
    try {
      if (files && files.length > 0) {
        for (const file of files) {
          this.buildFile(file);
        }
      } else {
        const allFiles = getFiles(this.inputPath, {
          filter: (file) => path.extname(file) === ".pug",
        });

        for (const file of allFiles) {
          this.buildFile(file);
        }
      }

      this.logger.success("Pages built");
    } catch (e) {
      this.logger.error("Failed to build pages", e);
      throw e;
    }
  }
}

module.exports = PagesBuilder;
