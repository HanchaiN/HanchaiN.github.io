#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";

import { DependencyTracker, DependencyTree } from "./utils/dependency-tracker";
import { getFiles } from "./utils/file-utils";
import { Logger } from "./utils/logger";
import { FILE_EXTENSIONS, getProjectPaths } from "./utils/paths";

interface Args {
  format: "json" | "text";
  output?: string;
  verbose: boolean;
  help: boolean;
  tree?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  return {
    format: args.includes("--json") ? "json" : "text",
    output: args.find((arg) => arg.startsWith("--output="))?.split("=")[1],
    verbose: args.includes("--verbose") || args.includes("-v"),
    help: args.includes("--help") || args.includes("-h"),
    tree: args.find((arg) => arg.startsWith("--tree="))?.split("=")[1],
  };
}

function showHelp(): void {
  console.log(`
Pug Dependency Analyzer

Usage: node dependency-report.js [options]

Options:
  --json              Output in JSON format
  --output=<file>     Write output to file
  --verbose, -v       Show verbose output
  --tree=<page>       Show dependency tree for a specific page
  --help, -h          Show this help

Examples:
  # Generate text report
  node dependency-report.js

  # Generate JSON report
  node dependency-report.js --json

  # Save report to file
  node dependency-report.js --output=dependencies.json --json

  # Show verbose output with detailed dependencies
  node dependency-report.js --verbose

  # Show dependency tree for a specific page
  node dependency-report.js --tree=index.pug
  node dependency-report.js --tree=creative_coding/index.pug
`);
}

function generateTextReport(
  tracker: DependencyTracker,
  options: Args,
  basedir: string,
): string {
  const report = tracker.generateReport();
  const output: string[] = [];

  output.push("╔════════════════════════════════════════════════════════════╗");
  output.push("║          󰈙 Pug Dependency Analysis Report                  ║");
  output.push("╚════════════════════════════════════════════════════════════╝");
  output.push("");

  const recursiveStats = {
    dataUsage: {} as Record<string, number>,
    componentUsage: {} as Record<string, number>,
  };

  for (const [pageKey] of Object.entries(report.dependencies)) {
    const requiredData = tracker.getRequiredDataRecursive(pageKey, basedir);
    const requiredComponents = tracker.getRequiredComponentsRecursive(
      pageKey,
      basedir,
    );

    for (const dataKey of requiredData) {
      if (!recursiveStats.dataUsage[dataKey]) {
        recursiveStats.dataUsage[dataKey] = 0;
      }
      recursiveStats.dataUsage[dataKey]++;
    }

    for (const componentKey of requiredComponents) {
      if (!recursiveStats.componentUsage[componentKey]) {
        recursiveStats.componentUsage[componentKey] = 0;
      }
      recursiveStats.componentUsage[componentKey]++;
    }
  }

  output.push(" Summary");
  output.push("─".repeat(60));
  output.push(`Total Pages: ${report.totalPages}`);
  output.push(
    ` Data Sources: ${Object.keys(report.dataUsage).length} (direct), ${Object.keys(recursiveStats.dataUsage).length} (recursive)`,
  );
  output.push(
    ` Components: ${Object.keys(report.componentUsage).length} (direct), ${Object.keys(recursiveStats.componentUsage).length} (recursive)`,
  );
  output.push("");

  output.push(" Data Usage (Direct)");
  output.push("─".repeat(60));
  const dataEntries = Object.entries(report.dataUsage).sort(
    (a, b) => b[1] - a[1],
  );
  if (dataEntries.length > 0) {
    for (const [data, count] of dataEntries) {
      const bar = "█".repeat(Math.min(count, 40));
      output.push(`  ${data.padEnd(18)} ${bar} ${count} pages`);
    }
  } else {
    output.push("  No data usage tracked");
  }
  output.push("");

  output.push(" Data Usage (Recursive - including dependencies)");
  output.push("─".repeat(60));
  const recursiveDataEntries = Object.entries(recursiveStats.dataUsage).sort(
    (a, b) => b[1] - a[1],
  );
  if (recursiveDataEntries.length > 0) {
    for (const [data, count] of recursiveDataEntries) {
      const bar = "█".repeat(Math.min(count, 40));
      const directCount = report.dataUsage[data] || 0;
      output.push(
        `  ${data.padEnd(18)} ${bar} ${count} pages (${directCount} direct)`,
      );
    }
  } else {
    output.push("  No data usage tracked");
  }
  output.push("");

  output.push("󰡰 Component Usage (Direct)");
  output.push("─".repeat(60));
  const componentEntries = Object.entries(report.componentUsage).sort(
    (a, b) => b[1] - a[1],
  );
  if (componentEntries.length > 0) {
    for (const [component, count] of componentEntries) {
      const bar = "█".repeat(Math.min(count, 40));
      output.push(`  ${component.padEnd(18)} ${bar} ${count} pages`);
    }
  } else {
    output.push("  No component usage tracked");
  }
  output.push("");

  output.push("󰡰 Component Usage (Recursive - including dependencies)");
  output.push("─".repeat(60));
  const recursiveComponentEntries = Object.entries(
    recursiveStats.componentUsage,
  ).sort((a, b) => b[1] - a[1]);
  if (recursiveComponentEntries.length > 0) {
    for (const [component, count] of recursiveComponentEntries) {
      const bar = "█".repeat(Math.min(count, 40));
      const directCount = report.componentUsage[component] || 0;
      output.push(
        `  ${component.padEnd(18)} ${bar} ${count} pages (${directCount} direct)`,
      );
    }
  } else {
    output.push("  No component usage tracked");
  }
  output.push("");

  if (options.verbose) {
    output.push(" Page Dependencies");
    output.push("─".repeat(60));
    for (const [pageKey, metadata] of Object.entries(report.dependencies)) {
      output.push(`\n  ${pageKey}:`);

      if (metadata.data.length > 0) {
        output.push(`    Data (direct): ${metadata.data.join(", ")}`);
      }
      if (metadata.components.length > 0) {
        output.push(
          `    Components (direct): ${metadata.components.join(", ")}`,
        );
      }
      if (metadata.depends.length > 0) {
        output.push(`    Depends: ${metadata.depends.join(", ")}`);
      }

      const requiredData = tracker.getRequiredDataRecursive(pageKey, basedir);
      const requiredComponents = tracker.getRequiredComponentsRecursive(
        pageKey,
        basedir,
      );

      if (requiredData.size > 0) {
        const recursiveOnly = Array.from(requiredData).filter(
          (d) => !metadata.data.includes(d),
        );
        if (recursiveOnly.length > 0) {
          output.push(
            `    Data (from dependencies): ${recursiveOnly.join(", ")}`,
          );
        }
      }

      if (requiredComponents.size > 0) {
        const recursiveOnly = Array.from(requiredComponents).filter(
          (c) => !metadata.components.includes(c),
        );
        if (recursiveOnly.length > 0) {
          output.push(
            `    Components (from dependencies): ${recursiveOnly.join(", ")}`,
          );
        }
      }
    }
    output.push("");
  }

  output.push(" Recommendations");
  output.push("─".repeat(60));
  const recommendations: string[] = [];

  const unusedData = Object.entries(report.dataUsage).filter(
    ([, count]) => count === 0,
  );
  if (unusedData.length > 0) {
    recommendations.push(
      `• Remove unused data sources: ${unusedData.map(([d]) => d).join(", ")}`,
    );
  }

  const heavyComponents = Object.entries(report.componentUsage).filter(
    ([, count]) => count > report.totalPages * 0.8,
  );
  if (heavyComponents.length > 0) {
    recommendations.push(
      `• Consider optimizing heavily used components: ${heavyComponents.map(([c]) => c).join(", ")}`,
    );
  }

  const noMetadata = Object.entries(report.dependencies).filter(
    ([, meta]) => meta.data.length === 0,
  );
  if (noMetadata.length > 0) {
    recommendations.push(
      `• Add metadata to ${noMetadata.length} pages without explicit data dependencies`,
    );
  }

  if (recommendations.length > 0) {
    output.push(...recommendations.map((r) => `  ${r}`));
  } else {
    output.push("  ✓ All good! No recommendations at this time.");
  }
  output.push("");

  return output.join("\n");
}

function renderDependencyTree(
  tree: DependencyTree | null,
  prefix = "",
  isLast = true,
): string {
  if (!tree) {
    return "";
  }

  const output: string[] = [];
  const connector = isLast ? "└── " : "├── ";
  const extension = isLast ? "    " : "│   ";

  const pageDisplay = tree.pageKey.replace(/^(page|component):/, "");
  const circular = tree.circular ? " [CIRCULAR]" : "";

  output.push(`${prefix}${connector}${pageDisplay}${circular}`);

  if (tree.data.length > 0) {
    output.push(`${prefix}${extension}  Data: ${tree.data.join(", ")}`);
  }

  if (tree.components.length > 0) {
    output.push(
      `${prefix}${extension}  Components: ${tree.components.join(", ")}`,
    );
  }

  if (tree.dependencies.length > 0) {
    const newPrefix = prefix + extension;
    tree.dependencies.forEach((dep, index) => {
      const isLastDep = index === tree.dependencies.length - 1;
      output.push(renderDependencyTree(dep, newPrefix, isLastDep));
    });
  }

  return output.join("\n");
}

function generateTreeReport(
  tracker: DependencyTracker,
  pageKey: string,
): string {
  const output: string[] = [];

  output.push("╔════════════════════════════════════════════════════════════╗");
  output.push("║             Dependency Tree View                          ║");
  output.push("╚════════════════════════════════════════════════════════════╝");
  output.push("");

  const normalizedKey = pageKey.startsWith("page:")
    ? pageKey
    : "page:" + pageKey;
  const tree = tracker.buildDependencyTree(normalizedKey);

  if (!tree) {
    output.push(`❌ Page not found: ${pageKey}`);
    return output.join("\n");
  }

  output.push(renderDependencyTree(tree, "", true));
  output.push("");

  return output.join("\n");
}

function main(): void {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  const logger = new Logger(true);
  const paths = getProjectPaths();

  logger.info("Analyzing Pug dependencies...");

  const tracker = new DependencyTracker(paths.root, logger);

  // Analyze all components first
  const allComponents = getFiles(paths.components, {
    filter: (file) => path.extname(file) === FILE_EXTENSIONS.PUG,
  });

  for (const component of allComponents) {
    const fullPath = path.join(paths.components, component);
    const componentKey = "component:components/" + component;
    tracker.analyzePage(fullPath, componentKey);
  }

  // Then analyze all pages
  const allPages = getFiles(paths.pages, {
    filter: (file) => path.extname(file) === FILE_EXTENSIONS.PUG,
  });

  for (const page of allPages) {
    const fullPath = path.join(paths.pages, page);
    tracker.analyzePage(fullPath, "page:" + page);
  }

  logger.success(
    `Analyzed ${allComponents.length} components and ${allPages.length} pages`,
  );

  if (options.tree) {
    const treeOutput = generateTreeReport(tracker, options.tree);
    if (options.output) {
      fs.writeFileSync(options.output, treeOutput);
      logger.success(`Tree report written to ${options.output}`);
    } else {
      console.log(treeOutput);
    }
    return;
  }

  let output: string;

  if (options.format === "json") {
    const report = tracker.generateReport();

    const recursiveInfo: Record<
      string,
      {
        dataRecursive: string[];
        componentsRecursive: string[];
      }
    > = {};

    for (const [pageKey] of Object.entries(report.dependencies)) {
      const requiredData = tracker.getRequiredDataRecursive(
        pageKey,
        paths.root,
      );
      const requiredComponents = tracker.getRequiredComponentsRecursive(
        pageKey,
        paths.root,
      );

      recursiveInfo[pageKey] = {
        dataRecursive: Array.from(requiredData),
        componentsRecursive: Array.from(requiredComponents),
      };
    }

    const enhancedReport = {
      ...report,
      recursiveDependencies: recursiveInfo,
    };

    output = JSON.stringify(enhancedReport, null, 2);
  } else {
    output = generateTextReport(tracker, options, paths.root);
  }

  if (options.output) {
    fs.writeFileSync(options.output, output);
    logger.success(`Report written to ${options.output}`);
  } else {
    console.log(output);
  }
}

main();
