# GitHub-pages

Personal GitHub Pages website with build system for static site generation.

## Build System

The project uses a modular build system with programmatic TypeScript compilation:

```text
src/bin/
├── build.js              # Main entry point
├── build-manager.js      # Orchestrates build process
├── builders/
│   ├── public-builder.js # Copies static assets
│   ├── pages-builder.js  # Compiles Pug templates with dependency tracking
│   └── scripts-builder.js # Programmatic TypeScript compilation
├── watchers/
│   └── file-watcher.js   # Watch mode implementation
├── server/
│   └── dev-server.js     # Development server
└── utils/
    ├── file-utils.js     # File system utilities
    ├── logger.js         # Logging utilities
    ├── pug-metadata.js   # Pug metadata parser for frontmatter
    └── dependency-tracker.js # Dependency tracking and analysis
```

### Dependency Tracking & Metadata System

The build system includes a sophisticated metadata/frontmatter system for Pug templates:

- **Metadata comments** at the top of Pug files declare dependencies
- **Minimal data passing** - only required data is passed to each template
- **Smart rebuilds** - only affected pages rebuild when data/components change
- **Auto-detection** - automatically detects components, scripts, and dependencies
- **Dependency reports** - analyze and visualize page dependencies

**Example:**

```pug
//-@meta
//- @data: navbar, home
//- @components: layout, mixins
//- @cache: true

extends /components/layout.pug
```

See [DEPENDENCY_TRACKING.md](./DEPENDENCY_TRACKING.md) for complete documentation.

### TypeScript Compilation

The `scripts-builder.js` uses the TypeScript Compiler API directly:

- **Programmatic compilation** using `ts.createProgram()` and `program.emit()`
- **Transform plugins** loaded and applied during compilation (typescript-transform-paths)
- **Proper diagnostics** with colored output and error reporting
- **No external process spawning** - runs entirely in-process
- **Faster builds** compared to CLI-based compilation
- **Incremental builds** - reuses previous program for faster rebuilds

### Watch Mode & Incremental Builds

The file watcher implements intelligent incremental rebuilds:

- **Tracks changed files** per build type (public, pages, scripts)
- **Batches changes** with debouncing to avoid redundant builds
- **Rebuilds only changed files** instead of full rebuilds
- **Component changes** trigger full page rebuild (due to dependencies)
- **TypeScript incremental compilation** reuses previous program state
- **Fast feedback loop** for development

## Scripts

- `yarn build` - Full production build
- `yarn dev` - Development mode with watch and serve
- `yarn serve` - Serve the built site
- `yarn watch` - Watch mode with auto-rebuild
- `yarn clean` - Clean build output
- `yarn build:public` - Build only public assets
- `yarn build:pages` - Build only Pug pages
- `yarn build:scripts` - Build only TypeScript scripts
- `yarn deps` - Generate dependency report
- `yarn deps:json` - Generate JSON dependency report
- `yarn typecheck` - Run TypeScript type checking
- `yarn lint` - Run ESLint
- `yarn lint:fix` - Auto-fix ESLint issues
- `yarn format` - Format code with Prettier
- `yarn format:check` - Check code formatting
- `yarn validate` - Run type check, lint, and format check

## Technology Stack

- **Build**: Custom Node.js build system
- **Templates**: Pug
- **Scripts**: TypeScript with path transformation
- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier with import sorting
- **Package Manager**: Yarn 4
