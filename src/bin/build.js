const path = require("path");
const BuildManager = require("./build-manager");

function parseArgs() {
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

function main() {
  const args = parseArgs();

  const manager = new BuildManager({
    basedir: path.join(__dirname, ".."),
    isDev: args.isDev,
  });

  if (args.isDev) {
    manager.logger.info("Running in development mode");
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
