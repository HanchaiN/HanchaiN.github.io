const fs = require("fs");
const path = require("path");

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

class FileWatcher {
  constructor(basedir, builders, logger) {
    this.basedir = basedir;
    this.builders = builders;
    this.logger = logger;
    this.watchers = [];
    this.changedFiles = new Map();
  }

  getRelativePath(watchPath, filename) {
    const fullPath = path.join(watchPath, filename);
    const normalizedWatch = path.normalize(watchPath);
    const normalizedFull = path.normalize(fullPath);
    return path.relative(normalizedWatch, normalizedFull);
  }

  start() {
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
            case "pages":
              this.builders.pagesBuilder.build(Array.from(files));
              break;
            case "scripts":
              this.builders.scriptsBuilder.build(Array.from(files));
              break;
          }
        } catch (e) {
          this.logger.error(`Failed to rebuild ${type}`, e);
        }
      }

      this.logger.success("Incremental rebuild complete");
    }, 1000);

    const trackChange = (type, watchPath) => {
      return (event, filename) => {
        if (!filename) return;

        const relativePath = this.getRelativePath(watchPath, filename);
        this.logger.info(`Change detected: ${relativePath} (${event})`);

        if (!this.changedFiles.has(type)) {
          this.changedFiles.set(type, new Set());
        }
        this.changedFiles.get(type).add(relativePath);

        flushChanges();
      };
    };

    const trackComponentChange = (watchPath) => {
      return debounce((event, filename) => {
        if (!filename) return;

        const relativePath = this.getRelativePath(watchPath, filename);
        this.logger.info(
          `Component changed: ${relativePath} - rebuilding all pages`,
        );

        this.builders.pagesBuilder.build();
        this.logger.success("Pages rebuilt");
      }, 1000);
    };

    const trackImportmapChange = (watchPath) => {
      return debounce((event, filename) => {
        if (!filename) return;

        this.logger.info("Import map changed - rebuilding all pages");
        this.builders.pagesBuilder.build();
        this.logger.success("Pages rebuilt");
      }, 1000);
    };

    const watchPaths = [
      {
        path: path.join(this.basedir, "public"),
        handler: trackChange("public", path.join(this.basedir, "public")),
      },
      {
        path: path.join(this.basedir, "pages"),
        handler: trackChange("pages", path.join(this.basedir, "pages")),
      },
      {
        path: path.join(this.basedir, "components"),
        handler: trackComponentChange(path.join(this.basedir, "components")),
      },
      {
        path: path.join(this.basedir, "scripts/importmap.json"),
        handler: trackImportmapChange(
          path.join(this.basedir, "scripts/importmap.json"),
        ),
      },
      {
        path: path.join(this.basedir, "scripts"),
        handler: trackChange("scripts", path.join(this.basedir, "scripts")),
      },
    ];

    for (const { path: watchPath, handler } of watchPaths) {
      try {
        const watcher = fs.watch(watchPath, { recursive: true }, handler);
        this.watchers.push(watcher);
        this.logger.info(`Watching ${watchPath}`);
      } catch (e) {
        this.logger.error(`Failed to watch ${watchPath}`, e);
      }
    }
  }

  stop() {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    this.changedFiles.clear();
  }
}

module.exports = FileWatcher;
