import * as path from "path";
import * as ts from "typescript";

import { Logger } from "../utils/logger";
import { CONFIG_FILES } from "../utils/paths";

interface PluginConfig {
  transform: string;
  [key: string]: unknown;
}

interface CustomTransformers {
  before?: ts.TransformerFactory<ts.SourceFile>[];
  after?: ts.TransformerFactory<ts.SourceFile>[];
  afterDeclarations?: ts.TransformerFactory<ts.SourceFile>[];
}

export class ScriptsBuilder {
  private logger: Logger;
  private basedir: string;
  private rootDir: string;
  private program?: ts.Program;

  constructor(logger: Logger, basedir: string) {
    this.logger = logger;
    this.basedir = basedir;
    this.rootDir = path.join(basedir, "..");
  }

  loadTransformers(
    program: ts.Program,
    options: ts.CompilerOptions,
  ): CustomTransformers {
    const transformers: CustomTransformers = {
      before: [],
      after: [],
      afterDeclarations: [],
    };

    const plugins = (options as unknown as { plugins?: PluginConfig[] })
      .plugins;
    if (!plugins || plugins.length === 0) {
      return transformers;
    }

    for (const plugin of plugins) {
      if (plugin.transform === "typescript-transform-paths") {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const transformPathsModule = require("typescript-transform-paths");
          const transformer =
            transformPathsModule.default || transformPathsModule;

          if (typeof transformer === "function") {
            transformers.before!.push(transformer(program, plugin));
          }
        } catch (e) {
          this.logger.error(
            `Failed to load transformer: ${plugin.transform}`,
            e as Error,
          );
        }
      }
    }

    return transformers;
  }

  readConfigFile(): ts.ParsedCommandLine {
    const configPath = path.join(this.rootDir, CONFIG_FILES.TSCONFIG);

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

  build(files: string[] | null = null): void {
    this.logger.info("Building scripts...");
    this.logger.startTimer("scripts-build");
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
        transformers as ts.CustomTransformers,
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

      this.logger.logTime("scripts-build", "Scripts built");
    } catch (e) {
      this.logger.error("Failed to build scripts", e as Error);
      throw e;
    }
  }
}
