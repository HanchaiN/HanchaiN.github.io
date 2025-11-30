const fs = require("fs");
const path = require("path");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function shouldSkipFile(file) {
  return path.basename(file).startsWith(".");
}

function getFiles(dir, options = {}) {
  const { recursive = true, filter = () => true } = options;
  const files = fs.readdirSync(dir, { recursive });
  return files.filter((file) => {
    const fullPath = path.join(dir, file);
    return fs.statSync(fullPath).isFile() && filter(file, fullPath);
  });
}

module.exports = {
  ensureDir,
  removeDir,
  copyFile,
  writeFile,
  shouldSkipFile,
  getFiles,
};
