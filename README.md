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
│   ├── pages-builder.js  # Compiles Pug templates
│   └── scripts-builder.js # Programmatic TypeScript compilation
├── watchers/
│   └── file-watcher.js   # Watch mode implementation
├── server/
│   └── dev-server.js     # Development server
└── utils/
    ├── file-utils.js     # File system utilities
    └── logger.js         # Logging utilities
```

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
