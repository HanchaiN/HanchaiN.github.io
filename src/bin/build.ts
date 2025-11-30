#!/usr/bin/env node
import { BuildManager } from "./build-manager";
import { getProjectPaths } from "./utils/paths";

interface Args {
  isDev: boolean;
  watch: boolean;
  serve: boolean;
  publicOnly: boolean;
  pagesOnly: boolean;
  scriptsOnly: boolean;
}

function parseArgs(): Args {
  return {
    isDev:
      process.argv.includes("--dev") || process.env.NODE_ENV !== "production",
    watch: process.argv.includes("--watch"),
    serve: process.argv.includes("--serve"),
    publicOnly: process.argv.includes("--public-only"),
    pagesOnly: process.argv.includes("--pages-only"),
    scriptsOnly: process.argv.includes("--scripts-only"),
  };
}

function main(): void {
  const args = parseArgs();

  const paths = getProjectPaths();
  const manager = new BuildManager({
    srcPath: paths.src,
    outputPath: paths.distPages,
    isDev: args.isDev,
  });

  if (args.isDev) {
    console.log("Running in development mode");
  }

  if (args.publicOnly) {
    manager.buildPublicOnly();
  } else if (args.pagesOnly) {
    manager.buildPagesOnly();
  } else if (args.scriptsOnly) {
    manager.buildScriptsOnly();
  } else {
    manager.buildAll();
  }

  if (args.watch) {
    manager.watch();
  }

  if (args.serve) {
    manager.serve();
  }
}

main();
