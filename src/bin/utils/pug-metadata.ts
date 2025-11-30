import * as fs from "fs";
import * as path from "path";

import { FILE_EXTENSIONS } from "./paths";

export interface PugMetadata {
  data: string[];
  components: string[];
  depends: string[];
  raw: Record<string, string>;
  error?: string;
}

interface AutoDetectedDependencies {
  components: string[];
  depends: string[];
}

export class PugMetadataParser {
  private metadataCache: Map<string, PugMetadata>;

  constructor() {
    this.metadataCache = new Map();
  }

  parseContent(content: string): PugMetadata {
    const metadata: PugMetadata = {
      data: [],
      components: [],
      depends: [],
      raw: {},
    };

    const lines = content.split("\n");
    let inMetaBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === "//-@meta" || trimmed === "//- @meta") {
        inMetaBlock = true;
        continue;
      }

      if (inMetaBlock && !trimmed.startsWith("//-")) {
        break;
      }

      if (inMetaBlock) {
        const metaLine = trimmed.replace(/^\/\/-?\s*/, "");
        const match = metaLine.match(/^@([a-zA-Z_-]+):\s*(.+)$/);

        if (match) {
          const [, key, value] = match;
          const normalizedKey = key.toLowerCase();

          switch (normalizedKey) {
            case "data":
              metadata.data = value.split(",").map((s) => s.trim());
              break;
            case "components":
              metadata.components = value.split(",").map((s) => s.trim());
              break;
            case "depends":
            case "dependencies":
              metadata.depends = value.split(",").map((s) => s.trim());
              break;
            default:
              metadata.raw[normalizedKey] = value.trim();
          }
        }
      }
    }

    const autoDetected = this.autoDetectDependencies(content);
    metadata.components = [
      ...new Set([...metadata.components, ...autoDetected.components]),
    ];
    metadata.depends = [
      ...new Set([...metadata.depends, ...autoDetected.depends]),
    ];

    return metadata;
  }

  autoDetectDependencies(content: string): AutoDetectedDependencies {
    const detected: AutoDetectedDependencies = {
      components: [],
      depends: [],
    };

    const extendsRegex = /^\s*extends\s+([^\s]+)/gm;
    const includeRegex = /^\s*include\s+([^\s]+)/gm;

    let match: RegExpExecArray | null;

    while ((match = extendsRegex.exec(content)) !== null) {
      const dep = match[1].trim();
      if (dep.startsWith("/components/")) {
        const component = path.basename(dep, FILE_EXTENSIONS.PUG);
        detected.components.push(component);
      }
      detected.depends.push(dep);
    }

    while ((match = includeRegex.exec(content)) !== null) {
      const dep = match[1].trim();
      if (dep.startsWith("/components/")) {
        const component = path.basename(dep, FILE_EXTENSIONS.PUG);
        detected.components.push(component);
      }
      detected.depends.push(dep);
    }

    return detected;
  }

  parseFile(filePath: string): PugMetadata {
    if (this.metadataCache.has(filePath)) {
      return this.metadataCache.get(filePath)!;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const metadata = this.parseContent(content);
      this.metadataCache.set(filePath, metadata);
      return metadata;
    } catch (error) {
      return {
        data: [],
        components: [],
        depends: [],
        raw: {},
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  clearCache(filePath: string | null = null): void {
    if (filePath) {
      this.metadataCache.delete(filePath);
    } else {
      this.metadataCache.clear();
    }
  }

  getAllMetadata(): Map<string, PugMetadata> {
    return this.metadataCache;
  }
}
