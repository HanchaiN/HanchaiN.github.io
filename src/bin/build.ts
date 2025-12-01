#!/usr/bin/env node
import { BuildManager } from "./build-manager";
import { getProjectPaths } from "./utils/paths";

interface Args {
  isDev: boolean;
  port: number;
  watch: boolean;
  serve: boolean;
  clean: boolean;
  buildNone: boolean;
  buildPublic: boolean;
  buildPages: boolean;
  buildScripts: boolean;
}

function parseArgs(): Args {
  return {
    isDev:
      process.argv.includes("--dev") || process.env.NODE_ENV !== "production",
    port: process.argv.includes("--port")
      ? parseInt(process.argv[process.argv.indexOf("--port") + 1], 10)
      : process.env.PORT
        ? parseInt(process.env.PORT, 10)
        : 3000,
    watch: process.argv.includes("--watch"),
    serve: process.argv.includes("--serve"),
    clean: process.argv.includes("--clean"),
    buildNone: process.argv.includes("--no-build"),
    buildPublic: process.argv.includes("--public"),
    buildPages: process.argv.includes("--pages"),
    buildScripts: process.argv.includes("--scripts"),
  };
}

function main(): void {
  const args = parseArgs();

  const paths = getProjectPaths();
  const manager = new BuildManager({
    srcPath: paths.src,
    outputPath: paths.distPages,
    isDev: args.isDev,
    port: args.port,
  });

  const logger = manager.getLogger();

  // Graceful shutdown handler
  const shutdown = (signal: string) => {
    logger.info(`\nReceived ${signal}, shutting down gracefully...`);
    manager.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  if (args.isDev) {
    logger.info("Running in development mode");
  }

  if (args.clean) {
    logger.info("Cleaning output directory...");
    manager.clean();
  }

  if (args.buildNone) {
    logger.info("Skipping build step");
  } else {
    let buildAll = true;
    if (args.buildPublic) {
      manager.buildPublicOnly();
      buildAll = false;
    }
    if (args.buildPages) {
      manager.buildPagesOnly();
      buildAll = false;
    }
    if (args.buildScripts) {
      manager.buildScriptsOnly();
      buildAll = false;
    }
    if (buildAll) {
      manager.buildAll();
    }
  }

  if (args.watch) {
    manager.watch();
  }

  if (args.serve) {
    manager.serve();
  }
}

main();
