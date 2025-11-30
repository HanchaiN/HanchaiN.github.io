import * as fs from "fs";
import * as path from "path";

import { Logger } from "./logger";
import { FILE_EXTENSIONS } from "./paths";
import { PugMetadata, PugMetadataParser } from "./pug-metadata";

export interface DependencyReport {
  totalPages: number;
  dataUsage: Record<string, number>;
  componentUsage: Record<string, number>;
  dependencies: Record<string, PugMetadata>;
}

export interface DependencyTree {
  pageKey: string;
  data: string[];
  components: string[];
  dependencies: DependencyTree[];
  circular?: boolean;
}

export class DependencyTracker {
  private basedir: string;
  private logger: Logger | null;
  private parser: PugMetadataParser;
  private pageMetadata: Map<string, PugMetadata>;
  private dataUsage: Map<string, Set<string>>;
  private componentUsage: Map<string, Set<string>>;
  private fileDependencies: Map<string, Set<string>>;

  constructor(basedir: string, logger: Logger | null = null) {
    this.basedir = basedir;
    this.logger = logger;
    this.parser = new PugMetadataParser();
    this.pageMetadata = new Map();
    this.dataUsage = new Map();
    this.componentUsage = new Map();
    this.fileDependencies = new Map();
  }

  analyzePage(filePath: string, pageKey: string): PugMetadata {
    const normalizedPageKey = this.normalizePageKey(pageKey);
    const metadata = this.parser.parseFile(filePath);
    this.pageMetadata.set(normalizedPageKey, metadata);

    for (const dataKey of metadata.data) {
      if (!this.dataUsage.has(dataKey)) {
        this.dataUsage.set(dataKey, new Set());
      }
      this.dataUsage.get(dataKey)!.add(normalizedPageKey);
    }

    for (const component of metadata.components) {
      if (!this.componentUsage.has(component)) {
        this.componentUsage.set(component, new Set());
      }
      this.componentUsage.get(component)!.add(normalizedPageKey);
    }

    for (const dep of metadata.depends) {
      const normalizedDep = this.normalizePath(dep);
      if (!this.fileDependencies.has(normalizedDep)) {
        this.fileDependencies.set(normalizedDep, new Set());
      }
      this.fileDependencies.get(normalizedDep)!.add(normalizedPageKey);
    }

    return metadata;
  }

  analyzeComponentIfNeeded(
    componentPath: string,
    pageKey: string,
    basedir: string,
  ): void {
    const normalizedPageKey = this.normalizePageKey(pageKey);
    if (this.pageMetadata.has(normalizedPageKey)) {
      return;
    }

    const fullPath = path.join(basedir, componentPath);

    try {
      if (fs.existsSync(fullPath)) {
        this.analyzePage(fullPath, normalizedPageKey);
      }
    } catch {
      // Component doesn't exist or can't be read, skip it
    }
  }

  getAffectedByData(dataFile: string): Set<string> {
    const dataKey = path.basename(dataFile, FILE_EXTENSIONS.JSON);
    return this.dataUsage.get(dataKey) || new Set();
  }

  getAffectedByComponent(componentFile: string): Set<string> {
    const componentName = path.basename(componentFile, FILE_EXTENSIONS.PUG);
    return this.componentUsage.get(componentName) || new Set();
  }

  getDependents(filePath: string): Set<string> {
    const normalized = this.normalizePath(filePath);
    return this.fileDependencies.get(normalized) || new Set();
  }

  getRequiredDataRecursive(
    pageKey: string,
    basedir: string | null = null,
    visited: Set<string> = new Set(),
  ): Set<string> {
    const normalizedPageKey = this.normalizePageKey(pageKey);
    if (visited.has(normalizedPageKey)) {
      return new Set();
    }

    visited.add(normalizedPageKey);
    const allData = new Set<string>();

    let metadata = this.pageMetadata.get(normalizedPageKey);
    if (!metadata && basedir) {
      const pagePath = normalizedPageKey.replace(/^(page|component):/, "");
      this.analyzeComponentIfNeeded(pagePath, normalizedPageKey, basedir);
      metadata = this.pageMetadata.get(normalizedPageKey);
    }

    if (!metadata) {
      return allData;
    }

    for (const dataKey of metadata.data) {
      allData.add(dataKey);
    }

    for (const dep of metadata.depends) {
      const normalizedDep = this.normalizePath(dep);
      const depData = this.getRequiredDataRecursive(
        "component:" + normalizedDep,
        basedir,
        visited,
      );
      for (const dataKey of depData) {
        allData.add(dataKey);
      }
    }

    for (const dataKey of allData) {
      if (!this.dataUsage.has(dataKey)) {
        this.dataUsage.set(dataKey, new Set());
      }
      this.dataUsage.get(dataKey)!.add(normalizedPageKey);
    }

    return allData;
  }

  getRequiredComponentsRecursive(
    pageKey: string,
    basedir: string | null = null,
    visited: Set<string> = new Set(),
  ): Set<string> {
    const normalizedPageKey = this.normalizePageKey(pageKey);
    if (visited.has(normalizedPageKey)) {
      return new Set();
    }

    visited.add(normalizedPageKey);
    const allComponents = new Set<string>();

    let metadata = this.pageMetadata.get(normalizedPageKey);
    if (!metadata && basedir) {
      const pagePath = normalizedPageKey.replace(/^(page|component):/, "");
      this.analyzeComponentIfNeeded(pagePath, normalizedPageKey, basedir);
      metadata = this.pageMetadata.get(normalizedPageKey);
    }

    if (!metadata) {
      return allComponents;
    }

    for (const componentKey of metadata.components) {
      allComponents.add(componentKey);
    }

    for (const dep of metadata.depends) {
      const normalizedDep = this.normalizePath(dep);
      const depComponents = this.getRequiredComponentsRecursive(
        "component:" + normalizedDep,
        basedir,
        visited,
      );
      for (const componentKey of depComponents) {
        allComponents.add(componentKey);
      }
    }

    for (const componentKey of allComponents) {
      if (!this.componentUsage.has(componentKey)) {
        this.componentUsage.set(componentKey, new Set());
      }
      this.componentUsage.get(componentKey)!.add(normalizedPageKey);
    }

    return allComponents;
  }

  buildDependencyTree(
    pageKey: string,
    visited: Set<string> = new Set(),
  ): DependencyTree | null {
    const normalizedPageKey = this.normalizePageKey(pageKey);
    if (visited.has(normalizedPageKey)) {
      return {
        pageKey: normalizedPageKey,
        data: [],
        components: [],
        dependencies: [],
        circular: true,
      };
    }

    visited.add(normalizedPageKey);
    const metadata = this.pageMetadata.get(normalizedPageKey);

    if (!metadata) {
      return null;
    }

    const tree: DependencyTree = {
      pageKey: normalizedPageKey,
      data: metadata.data,
      components: metadata.components,
      dependencies: [],
    };

    for (const dep of metadata.depends) {
      const normalized = this.normalizePath(dep);
      // Add component: prefix for component dependencies
      const depKey = normalized.startsWith("components/")
        ? "component:" + normalized
        : normalized;
      const subTree = this.buildDependencyTree(depKey, new Set(visited));
      if (subTree) {
        tree.dependencies.push(subTree);
      }
    }

    return tree;
  }

  getBuildOrder(pages: string[]): string[] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const page of pages) {
      graph.set(page, []);
      inDegree.set(page, 0);
    }

    for (const page of pages) {
      const metadata = this.pageMetadata.get(page);
      if (metadata) {
        for (const dep of metadata.depends) {
          const normalized = this.normalizePath(dep);
          if (graph.has(normalized)) {
            graph.get(normalized)!.push(page);
            inDegree.set(page, inDegree.get(page)! + 1);
          }
        }
      }
    }

    const queue: string[] = [];
    const result: string[] = [];

    for (const [page, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(page);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const dependent of graph.get(current) || []) {
        inDegree.set(dependent, inDegree.get(dependent)! - 1);
        if (inDegree.get(dependent) === 0) {
          queue.push(dependent);
        }
      }
    }

    if (result.length !== pages.length) {
      this.logger?.warn(
        "Circular dependency detected, returning partial order",
      );
    }

    return result;
  }

  normalizePath(filePath: string): string {
    const normalized = filePath.replace(/^\//, "").replace(/\\/g, "/");

    if (normalized.startsWith("components/")) {
      return normalized;
    }

    if (!normalized.includes("/")) {
      return normalized;
    }

    return normalized;
  }

  normalizePageKey(pageKey: string): string {
    // Normalize path separators in page keys (e.g., "page:creative_coding\index.pug" -> "page:creative_coding/index.pug")
    return pageKey.replace(/\\/g, "/");
  }

  generateReport(): DependencyReport {
    return {
      totalPages: this.pageMetadata.size,
      dataUsage: Object.fromEntries(
        Array.from(this.dataUsage.entries()).map(([k, v]) => [k, v.size]),
      ),
      componentUsage: Object.fromEntries(
        Array.from(this.componentUsage.entries()).map(([k, v]) => [k, v.size]),
      ),
      dependencies: Object.fromEntries(this.pageMetadata),
    };
  }

  clear(): void {
    this.pageMetadata.clear();
    this.dataUsage.clear();
    this.componentUsage.clear();
    this.fileDependencies.clear();
    this.parser.clearCache();
  }

  invalidatePage(pageKey: string, filePath?: string): void {
    const normalizedPageKey = this.normalizePageKey(pageKey);
    const metadata = this.pageMetadata.get(normalizedPageKey);
    if (metadata) {
      for (const dataKey of metadata.data) {
        this.dataUsage.get(dataKey)?.delete(normalizedPageKey);
      }
      for (const component of metadata.components) {
        this.componentUsage.get(component)?.delete(normalizedPageKey);
      }
      for (const dep of metadata.depends) {
        const normalized = this.normalizePath(dep);
        this.fileDependencies.get(normalized)?.delete(normalizedPageKey);
      }
    }
    this.pageMetadata.delete(normalizedPageKey);

    if (filePath) {
      this.parser.clearCache(filePath);
    }
  }

  invalidateComponent(componentFile: string): Set<string> {
    const componentName = path.basename(componentFile, FILE_EXTENSIONS.PUG);
    const normalizedPath = this.normalizePath(
      "components/" + componentName + FILE_EXTENSIONS.PUG,
    );
    const componentKey = "component:" + normalizedPath;

    // Get pages affected through component includes
    const affectedByInclude = this.getAffectedByComponent(componentFile);

    // Get pages affected through extends/depends
    const affectedByDepends = this.getDependents(
      "/components/" + componentName + FILE_EXTENSIONS.PUG,
    );

    // Combine both sets
    const affectedPages = new Set<string>([
      ...affectedByInclude,
      ...affectedByDepends,
    ]);

    this.invalidatePage(componentKey, componentFile);

    for (const pageKey of affectedPages) {
      this.invalidatePage(pageKey);
    }

    return affectedPages;
  }

  checkNewComponent(componentName: string): Set<string> {
    const affectedPages = new Set<string>();

    for (const [pageKey, metadata] of this.pageMetadata.entries()) {
      if (metadata.components.includes(componentName)) {
        affectedPages.add(pageKey);
      }
    }

    return affectedPages;
  }

  checkNewData(dataKey: string): Set<string> {
    const affectedPages = new Set<string>();

    for (const [pageKey, metadata] of this.pageMetadata.entries()) {
      if (metadata.data.includes(dataKey)) {
        affectedPages.add(pageKey);
      }
    }

    return affectedPages;
  }

  getAffectedByDataRecursive(dataFile: string): Set<string> {
    const dataKey = path.basename(dataFile, FILE_EXTENSIONS.JSON);
    const directlyAffected = this.getAffectedByData(dataFile);
    const allAffected = new Set<string>(directlyAffected);

    // Find components that use this data
    for (const [componentKey, metadata] of this.pageMetadata.entries()) {
      if (
        componentKey.startsWith("component:") &&
        metadata.data.includes(dataKey)
      ) {
        // Get the component name from the key
        const componentPath = componentKey.replace("component:", "");
        const componentName = path.basename(componentPath, FILE_EXTENSIONS.PUG);

        // Find all pages that use this component
        const pagesUsingComponent = this.componentUsage.get(componentName);
        if (pagesUsingComponent) {
          for (const pageKey of pagesUsingComponent) {
            allAffected.add(pageKey);
          }
        }
      }
    }

    return allAffected;
  }
}
