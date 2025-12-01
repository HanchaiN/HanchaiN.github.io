import * as fs from "fs";
import * as path from "path";
import * as pug from "pug";

import { DependencyTracker } from "../utils/dependency-tracker";
import { getFiles, writeFile } from "../utils/file-utils";
import { Logger } from "../utils/logger";
import { FILE_EXTENSIONS, getSrcPaths } from "../utils/paths";

interface PugOptions {
  basedir: string;
  pretty?: boolean;
  isDev?: boolean;
  pagesData?: Record<string, unknown>;
}

export class PagesBuilder {
  private basedir: string;
  private inputPath: string;
  private componentsPath: string;
  private dataPath: string;
  private outputPath: string;
  private options: PugOptions;
  private logger: Logger;
  public dependencyTracker: DependencyTracker;
  public dataCache: Map<string, unknown>;

  constructor(
    basedir: string,
    outputPath: string,
    options: PugOptions,
    logger: Logger,
  ) {
    this.basedir = basedir;
    const srcPaths = getSrcPaths(basedir);
    this.inputPath = srcPaths.pages;
    this.componentsPath = srcPaths.components;
    this.dataPath = srcPaths.data;
    this.outputPath = outputPath;
    this.options = options;
    this.logger = logger;
    this.dependencyTracker = new DependencyTracker(basedir, logger);
    this.dataCache = new Map();
  }

  loadDataFile(dataKey: string): unknown {
    if (this.dataCache.has(dataKey)) {
      return this.dataCache.get(dataKey);
    }

    const filename = `${dataKey}${FILE_EXTENSIONS.JSON}`;
    const dataPath = path.join(this.dataPath, filename);

    try {
      const content = fs.readFileSync(dataPath, "utf-8");
      const data = JSON.parse(content);
      this.dataCache.set(dataKey, data);
      return data;
    } catch {
      this.logger.warn(`Could not load ${filename}, using empty data`);
      const emptyData = {};
      this.dataCache.set(dataKey, emptyData);
      return emptyData;
    }
  }

  loadDataFiles(dataKeys: string[]): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const key of dataKeys) {
      data[key] = this.loadDataFile(key);
    }
    return data;
  }

  reloadData(changedFile: string): void {
    const filename = path.basename(changedFile);
    const dataKey = path.basename(filename, FILE_EXTENSIONS.JSON);

    this.dataCache.delete(dataKey);
    this.loadDataFile(dataKey);
  }

  getAffectedPages(dataFile: string): string[] {
    const filename = path.basename(dataFile);
    const affected =
      this.dependencyTracker.getAffectedByDataRecursive(filename);
    return Array.from(affected)
      .filter((f) => f.startsWith("page:"))
      .map((f) => f.slice(5));
  }

  buildFile(relativeFile: string): void {
    if (path.extname(relativeFile) !== FILE_EXTENSIONS.PUG) {
      return;
    }

    const inFile = path.join(this.inputPath, relativeFile);
    const metadata = this.dependencyTracker.analyzePage(
      inFile,
      "page:" + relativeFile,
    );

    const pageData = this.loadDataForPage(metadata, relativeFile);

    const outFile = path.join(
      this.outputPath,
      path.dirname(relativeFile),
      path.basename(relativeFile, FILE_EXTENSIONS.PUG) + FILE_EXTENSIONS.HTML,
    );

    const html = pug.renderFile(inFile, {
      ...this.options,
      pagesData: pageData,
    });
    writeFile(outFile, html);

    const pageKey = "page:" + relativeFile;
    const allRequiredData = this.dependencyTracker.getRequiredDataRecursive(
      pageKey,
      this.basedir,
    );
    const allRequiredComponents =
      this.dependencyTracker.getRequiredComponentsRecursive(
        pageKey,
        this.basedir,
      );

    const dataInfo =
      allRequiredData.size > 0
        ? Array.from(allRequiredData).join(", ")
        : "none";
    const componentsInfo =
      allRequiredComponents.size > 0
        ? Array.from(allRequiredComponents).join(", ")
        : "none";
    this.logger.info(
      `  Rendered ${relativeFile} (data: ${dataInfo}, components: ${componentsInfo})`,
    );
  }

  loadDataForPage(
    metadata: unknown,
    relativeFile: string,
  ): Record<string, unknown> {
    const pageKey = "page:" + relativeFile;
    const requiredData = this.dependencyTracker.getRequiredDataRecursive(
      pageKey,
      this.basedir,
    );

    if (requiredData.size === 0) {
      return {};
    }

    return this.loadDataFiles(Array.from(requiredData));
  }

  getAllDataKeys(): string[] {
    try {
      const files = fs.readdirSync(this.dataPath);
      return files
        .filter((f) => f.endsWith(FILE_EXTENSIONS.JSON))
        .map((f) => path.basename(f, FILE_EXTENSIONS.JSON));
    } catch {
      return [];
    }
  }

  build(files: string[] | null = null): void {
    this.logger.info("Building pages...");
    this.logger.startTimer("pages-build");
    try {
      if (files && files.length > 0) {
        for (const file of files) {
          this.buildFile(file);
        }
      } else {
        const allFiles = getFiles(this.inputPath, {
          filter: (file) => path.extname(file) === FILE_EXTENSIONS.PUG,
        });

        for (const file of allFiles) {
          this.buildFile(file);
        }
      }

      if (this.options.isDev) {
        const report = this.dependencyTracker.generateReport();
        const loadedDataCount = this.dataCache.size;
        const totalDataFiles = this.getAllDataKeys().length;

        this.logger.info(
          `Dependencies analyzed: ${report.totalPages} pages, ${Object.keys(report.dataUsage).length} data sources`,
        );
        this.logger.info(
          `Data files loaded: ${loadedDataCount}/${totalDataFiles} (on-demand loading)`,
        );
      }

      this.logger.logTime("pages-build", "Pages built");
    } catch (e) {
      this.logger.error("Failed to build pages", e as Error);
      throw e;
    }
  }

  getDataStats(): {
    loaded: number;
    total: number;
    keys: string[];
  } {
    return {
      loaded: this.dataCache.size,
      total: this.getAllDataKeys().length,
      keys: Array.from(this.dataCache.keys()),
    };
  }

  clearDataCache(): void {
    this.dataCache.clear();
  }

  getDependencyReport() {
    return this.dependencyTracker.generateReport();
  }
}
