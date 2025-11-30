import * as fs from "fs";
import * as path from "path";

export interface GetFilesOptions {
  recursive?: boolean;
  filter?: (file: string, fullPath: string) => boolean;
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function removeDir(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

export function copyFile(src: string, dest: string): void {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

export function writeFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

export function shouldSkipFile(file: string): boolean {
  return path.basename(file).startsWith(".");
}

export function getFiles(dir: string, options: GetFilesOptions = {}): string[] {
  const { recursive = true, filter = () => true } = options;
  const files = fs.readdirSync(dir, { recursive }) as string[];
  return files.filter((file) => {
    const fullPath = path.join(dir, file);
    return fs.statSync(fullPath).isFile() && filter(file, fullPath);
  });
}
