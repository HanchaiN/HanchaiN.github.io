const path = require("path");
const fs = require("fs");

const pug = require("pug");

const options = {
  basedir: path.join(__dirname, ".."),
};

const outputPath = path.join(__dirname, "..", "..", "dist");

fs.rmSync(outputPath, { recursive: true, force: true });
fs.mkdirSync(outputPath, { recursive: true });
fs.writeFileSync(path.join(outputPath, ".gitignore"), "*");

{
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
{
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
