import * as path from "path";

export function getProjectRoot(): string {
  return path.join(__dirname, "..", "..", "..");
}

export function getProjectPaths(projectRoot: string = getProjectRoot()) {
  const project_paths = {
    root: projectRoot,
    src: path.join(projectRoot, "src"),
    dist: path.join(projectRoot, "dist"),
  };
  return {
    ...project_paths,
    ...getSrcPaths(project_paths.src),
    ...getDistPaths(project_paths.dist),
  };
}

export function getSrcPaths(srcRoot: string) {
  return {
    pages: path.join(srcRoot, SRC_SUBDIRS.PAGES),
    components: path.join(srcRoot, SRC_SUBDIRS.COMPONENTS),
    data: path.join(srcRoot, SRC_SUBDIRS.DATA),
    scripts: path.join(srcRoot, SRC_SUBDIRS.SCRIPTS),
    public: path.join(srcRoot, SRC_SUBDIRS.PUBLIC),
    importmap: path.join(srcRoot, SRC_SUBDIRS.SCRIPTS, CONFIG_FILES.IMPORTMAP),
  };
}

export function getDistPaths(distRoot: string) {
  return {
    distPages: path.join(distRoot, DIST_SUBDIRS.PAGES),
    distScripts: path.join(distRoot, DIST_SUBDIRS.SCRIPTS),
    distPublic: path.join(distRoot, DIST_SUBDIRS.PUBLIC),
  };
}

export const FILE_EXTENSIONS = {
  PUG: ".pug",
  JSON: ".json",
  HTML: ".html",
  TS: ".ts",
  JS: ".js",
  CSS: ".css",
} as const;

export const CONFIG_FILES = {
  TSCONFIG: "tsconfig.json",
  IMPORTMAP: "importmap.json",
} as const;

export const SRC_SUBDIRS = {
  BIN: "bin",
  PAGES: "pages",
  COMPONENTS: "components",
  DATA: "data",
  SCRIPTS: "scripts",
  PUBLIC: "public",
} as const;

export const DIST_SUBDIRS = {
  BIN: "bin",
  PAGES: "pages",
  SCRIPTS: "pages/static/scripts",
  PUBLIC: "pages/static",
} as const;
