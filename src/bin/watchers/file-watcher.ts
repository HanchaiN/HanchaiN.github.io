import * as fs from "fs";
import * as path from "path";

import { PagesBuilder } from "../builders/pages-builder";
import { PublicBuilder } from "../builders/public-builder";
import { ScriptsBuilder } from "../builders/scripts-builder";
import { Logger } from "../utils/logger";
import { FILE_EXTENSIONS, SRC_SUBDIRS, getSrcPaths } from "../utils/paths";

interface Builders {
  pagesBuilder: PagesBuilder;
  publicBuilder: PublicBuilder;
  scriptsBuilder: ScriptsBuilder;
}

type WatchHandler = (event: string, filename: string | null) => void;

function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number,
): (...args: T) => void {
  let timeout: NodeJS.Timeout;
  return (...args: T) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

export class FileWatcher {
  private basedir: string;
  private builders: Builders;
  private logger: Logger;
  private watchers: fs.FSWatcher[];
  private changedFiles: Map<string, Set<string>>;

  constructor(basedir: string, builders: Builders, logger: Logger) {
    this.basedir = basedir;
    this.builders = builders;
    this.logger = logger;
    this.watchers = [];
    this.changedFiles = new Map();
  }

  getRelativePath(watchPath: string, filename: string): string {
    const fullPath = path.join(watchPath, filename);
    const normalizedWatch = path.normalize(watchPath);
    const normalizedFull = path.normalize(fullPath);
    return path.relative(normalizedWatch, normalizedFull);
  }

  start(): void {
    const flushChanges = debounce(() => {
      if (this.changedFiles.size === 0) return;

      const changes = new Map(this.changedFiles);
      this.changedFiles.clear();

      for (const [type, files] of changes) {
        try {
          switch (type) {
            case "public":
              this.builders.publicBuilder.build(Array.from(files));
              break;
            case "pages": {
              const srcPaths = getSrcPaths(this.basedir);
              const existingPages = Array.from(files).filter((f) =>
                fs.existsSync(path.join(srcPaths.pages, f)),
              );

              for (const file of files) {
                const pageKey = "page:" + file;
                const filePath = path.join(srcPaths.pages, file);
                this.builders.pagesBuilder.dependencyTracker.invalidatePage(
                  pageKey,
                  filePath,
                );
              }

              if (existingPages.length > 0) {
                this.builders.pagesBuilder.build(existingPages);
              }
              break;
            }
            case "scripts":
              this.builders.scriptsBuilder.build(Array.from(files));
              break;
          }
        } catch (e) {
          this.logger.error(`Failed to rebuild ${type}`, e as Error);
        }
      }

      this.logger.success("Incremental rebuild complete");
    }, 1000);

    const trackChange = (type: string, watchPath: string): WatchHandler => {
      return (event, filename) => {
        if (!filename) return;

        const relativePath = this.getRelativePath(watchPath, filename);
        const fullPath = path.join(watchPath, filename);

        const fileExists = fs.existsSync(fullPath);

        if (event === "rename") {
          if (fileExists) {
            this.logger.info(`File added: ${relativePath}`);
          } else {
            this.logger.info(`File removed: ${relativePath}`);
          }
        } else {
          this.logger.info(`File changed: ${relativePath}`);
        }

        if (!this.changedFiles.has(type)) {
          this.changedFiles.set(type, new Set());
        }
        this.changedFiles.get(type)!.add(relativePath);

        flushChanges();
      };
    };

    const trackComponentChange = (watchPath: string): WatchHandler => {
      return debounce((event: string, filename: string | null) => {
        if (!filename) return;

        const relativePath = this.getRelativePath(watchPath, filename);
        const fullPath = path.join(watchPath, filename);
        const componentName = path.basename(fullPath, FILE_EXTENSIONS.PUG);
        const fileExists = fs.existsSync(fullPath);

        if (event === "rename" && !fileExists) {
          this.logger.info(`Component removed: ${relativePath}`);

          const affectedPages =
            this.builders.pagesBuilder.dependencyTracker.invalidateComponent(
              fullPath,
            );

          if (affectedPages.size > 0) {
            const pagesToBuild = Array.from(affectedPages)
              .filter((p) => p.startsWith("page:"))
              .map((p) => p.slice(5));

            this.builders.pagesBuilder.build(pagesToBuild);
            this.logger.success(
              `Rebuilt ${pagesToBuild.length} page(s) that used ${componentName}`,
            );
          }
          return;
        }

        if (event === "rename" && fileExists) {
          this.logger.info(`Component added: ${relativePath}`);

          const potentialPages =
            this.builders.pagesBuilder.dependencyTracker.checkNewComponent(
              componentName,
            );

          if (potentialPages.size > 0) {
            for (const pageKey of potentialPages) {
              this.builders.pagesBuilder.dependencyTracker.invalidatePage(
                pageKey,
              );
            }

            const pagesToBuild = Array.from(potentialPages)
              .filter((p) => p.startsWith("page:"))
              .map((p) => p.slice(5));

            this.builders.pagesBuilder.build(pagesToBuild);
            this.logger.success(
              `Rebuilt ${pagesToBuild.length} page(s) that may use ${componentName}`,
            );
            return;
          }
        } else {
          this.logger.info(`Component changed: ${relativePath}`);
        }

        const affectedPages =
          this.builders.pagesBuilder.dependencyTracker.invalidateComponent(
            fullPath,
          );

        if (affectedPages.size > 0) {
          const pagesToBuild = Array.from(affectedPages)
            .filter((p) => p.startsWith("page:"))
            .map((p) => p.slice(5));

          this.builders.pagesBuilder.build(pagesToBuild);
          this.logger.success(
            `Rebuilt ${pagesToBuild.length} page(s) affected by ${componentName}`,
          );
        } else {
          this.logger.info(`No pages affected by ${componentName}`);
        }
      }, 1000);
    };

    const trackDataChange = (watchPath: string): WatchHandler => {
      return debounce((event: string, filename: string | null) => {
        if (!filename) return;

        const relativePath = this.getRelativePath(watchPath, filename);
        const fullPath = path.join(watchPath, filename);
        const fileExists = fs.existsSync(fullPath);

        if (event === "rename" && !fileExists) {
          this.logger.info(`Data removed: ${relativePath}`);

          const affectedPages =
            this.builders.pagesBuilder.getAffectedPages(fullPath);

          const dataKey = path.basename(filename, FILE_EXTENSIONS.JSON);
          this.builders.pagesBuilder.dataCache.delete(dataKey);

          const affected =
            this.builders.pagesBuilder.dependencyTracker.getAffectedByData(
              filename,
            );
          for (const pageKey of affected) {
            this.builders.pagesBuilder.dependencyTracker.invalidatePage(
              pageKey,
            );
          }

          if (affectedPages.length > 0) {
            this.builders.pagesBuilder.build(affectedPages);
            this.logger.success(
              `Rebuilt ${affectedPages.length} page(s) that used ${filename}`,
            );
          }
          return;
        }

        if (event === "rename" && fileExists) {
          this.logger.info(`Data added: ${relativePath}`);

          this.builders.pagesBuilder.reloadData(fullPath);

          const dataKey = path.basename(filename, FILE_EXTENSIONS.JSON);
          const potentialPages =
            this.builders.pagesBuilder.dependencyTracker.checkNewData(dataKey);

          if (potentialPages.size > 0) {
            for (const pageKey of potentialPages) {
              this.builders.pagesBuilder.dependencyTracker.invalidatePage(
                pageKey,
              );
            }

            const pagesToBuild = Array.from(potentialPages)
              .filter((p) => p.startsWith("page:"))
              .map((p) => p.slice(5));

            this.builders.pagesBuilder.build(pagesToBuild);
            this.logger.success(
              `Rebuilt ${pagesToBuild.length} page(s) that may use ${filename}`,
            );
            return;
          }
        } else {
          this.logger.info(`Data changed: ${relativePath}`);
        }

        this.builders.pagesBuilder.reloadData(fullPath);

        const affectedPages =
          this.builders.pagesBuilder.getAffectedPages(fullPath);
        if (affectedPages.length > 0) {
          this.builders.pagesBuilder.build(affectedPages);
          this.logger.success(
            `Rebuilt ${affectedPages.length} page(s) affected by ${filename}`,
          );
        } else {
          this.logger.info(`No pages affected by ${filename}`);
        }
      }, 1000);
    };

    const trackImportmapChange = (): WatchHandler => {
      return debounce(() => {
        this.logger.info("Import map changed - rebuilding all pages");
        this.builders.pagesBuilder.build();
        this.logger.success("Pages rebuilt");
      }, 1000);
    };

    const srcPaths = getSrcPaths(this.basedir);

    const watchPaths = [
      {
        path: srcPaths.public,
        handler: trackChange(SRC_SUBDIRS.PUBLIC, srcPaths.public),
      },
      {
        path: srcPaths.pages,
        handler: trackChange(SRC_SUBDIRS.PAGES, srcPaths.pages),
      },
      {
        path: srcPaths.components,
        handler: trackComponentChange(srcPaths.components),
      },
      {
        path: srcPaths.data,
        handler: trackDataChange(srcPaths.data),
      },
      {
        path: srcPaths.importmap,
        handler: trackImportmapChange(),
      },
      {
        path: srcPaths.scripts,
        handler: trackChange(SRC_SUBDIRS.SCRIPTS, srcPaths.scripts),
      },
    ];

    for (const { path: watchPath, handler } of watchPaths) {
      try {
        const watcher = fs.watch(watchPath, { recursive: true }, handler);
        this.watchers.push(watcher);
        this.logger.info(`Watching ${watchPath}`);
      } catch (e) {
        this.logger.error(`Failed to watch ${watchPath}`, e as Error);
      }
    }
  }

  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    this.changedFiles.clear();
  }
}
