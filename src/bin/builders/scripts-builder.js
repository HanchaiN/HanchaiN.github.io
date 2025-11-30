const path = require("path");
const ts = require("typescript");

class ScriptsBuilder {
  constructor(logger, basedir) {
    this.logger = logger;
    this.basedir = basedir;
    this.rootDir = path.join(basedir, "..");
  }

  loadTransformers(program, options) {
    const transformers = { before: [], after: [], afterDeclarations: [] };

    if (!options.plugins || options.plugins.length === 0) {
      return transformers;
    }

    for (const plugin of options.plugins) {
      if (plugin.transform === "typescript-transform-paths") {
        try {
          const transformPathsModule = require("typescript-transform-paths");
          const transformer =
            transformPathsModule.default || transformPathsModule;

          if (typeof transformer === "function") {
            transformers.before.push(transformer(program, plugin));
          }
        } catch (e) {
          this.logger.error(
            `Failed to load transformer: ${plugin.transform}`,
            e,
          );
        }
      }
    }

    return transformers;
  }

  readConfigFile() {
    const configPath = path.join(this.rootDir, "tsconfig.json");

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) {
      throw new Error(
        ts.formatDiagnostic(configFile.error, {
          getCanonicalFileName: (f) => f,
          getCurrentDirectory: () => this.rootDir,
          getNewLine: () => ts.sys.newLine,
        }),
      );
    }

    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      this.rootDir,
    );

    if (parsedConfig.errors.length > 0) {
      const errorMessage = ts.formatDiagnosticsWithColorAndContext(
        parsedConfig.errors,
        {
          getCanonicalFileName: (f) => f,
          getCurrentDirectory: () => this.rootDir,
          getNewLine: () => ts.sys.newLine,
        },
      );
      throw new Error(errorMessage);
    }

    return parsedConfig;
  }

  build(files = null) {
    this.logger.info("Building scripts...");
    try {
      const parsedConfig = this.readConfigFile();

      let fileNames = parsedConfig.fileNames;
      if (files && files.length > 0) {
        const absoluteFiles = files.map((f) =>
          path.join(this.rootDir, "src", "scripts", f),
        );
        fileNames = parsedConfig.fileNames.filter((file) =>
          absoluteFiles.some((af) => file.startsWith(af.replace(/\\/g, "/"))),
        );

        if (fileNames.length === 0) {
          this.logger.info("No TypeScript files to rebuild");
          return;
        }
      }

      const program = ts.createProgram({
        rootNames: fileNames,
        options: parsedConfig.options,
        oldProgram: this.program,
      });

      this.program = program;

      const transformers = this.loadTransformers(program, parsedConfig.options);

      const emitResult = program.emit(
        undefined,
        undefined,
        undefined,
        undefined,
        transformers,
      );

      const allDiagnostics = ts
        .getPreEmitDiagnostics(program)
        .concat(emitResult.diagnostics);

      if (allDiagnostics.length > 0) {
        const errorMessage = ts.formatDiagnosticsWithColorAndContext(
          allDiagnostics,
          {
            getCanonicalFileName: (f) => f,
            getCurrentDirectory: () => this.rootDir,
            getNewLine: () => ts.sys.newLine,
          },
        );
        this.logger.error("TypeScript compilation errors:");
        console.error(errorMessage);
      }

      if (emitResult.emitSkipped) {
        throw new Error("TypeScript compilation failed");
      }

      this.logger.success("Scripts built");
    } catch (e) {
      this.logger.error("Failed to build scripts", e);
      throw e;
    }
  }
}

module.exports = ScriptsBuilder;
