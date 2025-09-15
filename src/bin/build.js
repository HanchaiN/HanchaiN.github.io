const path = require("path");
const fs = require("fs");
const pug = require("pug");
const { execSync } = require("child_process");

const options = {
  basedir: path.join(__dirname, ".."),
  isDev:
    process.argv.includes("--dev") || process.env.NODE_ENV !== "production",
};
if (options.isDev) {
  console.log("Running in development mode");
}

const outputPath = path.join(__dirname, "..", "..", "dist");

function clearOutput() {
  fs.rmSync(outputPath, { recursive: true, force: true });
  fs.mkdirSync(outputPath, { recursive: true });
  fs.writeFileSync(path.join(outputPath, ".gitignore"), "*");
}
function _buildPublic() {
  const inputPath = path.join(options.basedir, "public");
  const files = fs.readdirSync(inputPath, { recursive: true });
  for (const file of files) {
    const inFile = path.join(inputPath, file);
    if (!fs.statSync(inFile).isFile() || path.basename(file).startsWith(".")) {
      continue;
    }
    const outFile = path.join(outputPath, file);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.copyFileSync(inFile, outFile);
    console.log(`Copied ${inFile}`);
  }
}
function buildPublic() {
  console.log("Building public");
  try {
    _buildPublic();
  } catch (e) {
    console.error("Failed to build public");
    if (options.isDev) console.error(e);
  }
}
function _buildPages() {
  const inputPath = path.join(options.basedir, "pages");
  const files = fs.readdirSync(inputPath, { recursive: true });
  for (const file of files) {
    const inFile = path.join(inputPath, file);
    if (!fs.statSync(inFile).isFile() || path.extname(inFile) != ".pug") {
      continue;
    }
    const outFile = path.join(
      outputPath,
      path.dirname(file),
      path.basename(file, ".pug") + ".html",
    );
    const html = pug.renderFile(inFile, { ...options });
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html);
    console.log(`Rendering ${inFile}`);
  }
}
function buildPages() {
  console.log("Building pages");
  try {
    _buildPages();
  } catch (e) {
    console.error("Failed to build pages");
    if (options.isDev) console.error(e);
  }
}
function buildScripts() {
  console.log("Building scripts");
  try {
    execSync("yarn run build:script", { stdio: "inherit" });
  } catch (e) {
    console.error("Failed to build scripts");
    if (options.isDev) console.error(e);
  }
}
function buildAll() {
  clearOutput();
  buildPublic();
  buildPages();
  buildScripts();
}
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

function main() {
  buildAll();
  if (process.argv.includes("--watch")) {
    const _buildAll = debounce((event, filename) => {
      buildAll();
      console.log(`Sync all complete`);
    }, 30000);
    const _buildPublic = debounce((event, filename) => {
      console.log(`Sync: ${filename} ${event}`);
      buildPublic();
      console.log(`Sync complete`);
      _buildAll();
    }, 1000);
    const _buildPages = debounce((event, filename) => {
      console.log(`Sync: ${filename} ${event}`);
      buildPages();
      console.log(`Sync complete`);
      _buildAll();
    }, 1000);
    const _buildScripts = debounce((event, filename) => {
      console.log(`Sync: ${filename} ${event}`);
      buildScripts();
      console.log(`Sync complete`);
      _buildAll();
    }, 1000);
    fs.watch(
      path.join(options.basedir, "public"),
      { recursive: true },
      _buildPublic,
    );
    fs.watch(
      path.join(options.basedir, "pages"),
      { recursive: true },
      _buildPages,
    );
    fs.watch(
      path.join(options.basedir, "components"),
      { recursive: true },
      _buildPages,
    );
    fs.watch(
      path.join(options.basedir, "scripts/importmap.json"),
      { recursive: true },
      _buildPages,
    );
    fs.watch(
      path.join(options.basedir, "scripts"),
      { recursive: true },
      _buildScripts,
    );
  }
  if (process.argv.includes("--serve")) {
    const handler = require("serve-handler");
    const http = require("http");
    const server = http.createServer((req, res) =>
      handler(req, res, { public: outputPath }),
    );
    server.listen(3000, () => {
      console.log("Running at http://localhost:3000");
    });
  }
}

main();
