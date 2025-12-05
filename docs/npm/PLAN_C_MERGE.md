# Plan C: Integration & Packaging

**Agent Task:** Merge path infrastructure and CLI framework, finalize npm package
**Branch:** `feature/npm-package` (merge target)
**Prerequisites:** Plan A (`feature/npm-paths`) and Plan B (`feature/npm-cli`) must be completed
**Estimated Time:** 2-3 hours

---

## Overview

Your job is to merge the work from two other agents and finalize the npm package. This includes:

1. Merging `feature/npm-paths` (XDG path utilities)
2. Merging `feature/npm-cli` (CLI framework)
3. Updating the main entry point to use both
4. Configuring package.json for npm publishing
5. Creating necessary packaging files
6. Testing the complete package

**What was done by other agents:**

- **Plan A** created `src/shared/utils/paths.util.ts` with XDG-compliant path functions
- **Plan A** updated `src/shared/config/index.ts` to use new paths
- **Plan B** created `src/cli/` directory with commander-based CLI
- **Plan B** added `commander` and `inquirer` dependencies

---

## Task 1: Merge Both Feature Branches

```bash
# Start from main branch
git checkout main
git pull origin main

# Create the merge branch
git checkout -b feature/npm-package

# Merge path infrastructure
git merge feature/npm-paths --no-edit

# Merge CLI framework
git merge feature/npm-cli --no-edit

# Resolve any conflicts (unlikely if agents followed plans)
```

---

## Task 2: Update CLI to Use Path Utilities

The CLI commands in Plan B have their own simple path helpers. Replace these with the proper utilities from Plan A.

**Modify file:** `src/cli/commands/init.ts`

Replace the local path functions with imports:

```typescript
// REMOVE these local functions:
// function getConfigDir(): string { ... }
// function ensureDir(dir: string): void { ... }

// ADD this import at the top:
import {
  getConfigDir,
  ensureDirectories,
  getDataDir,
  getConfigPath,
} from '@/shared/utils/paths.util';

// UPDATE the runInitWizard function to use ensureDirectories():
export async function runInitWizard(options: { force?: boolean } = {}): Promise<void> {
  const configDir = getConfigDir();

  console.log(timmy.section('Timmy Setup Wizard'));
  console.log(`\nConfiguration will be saved to: ${colors.cyan}${configDir}${colors.reset}\n`);

  // Use the utility function instead of manual directory creation
  ensureDirectories();

  // ... rest of the function stays the same
}
```

**Modify file:** `src/cli/commands/start.ts`

```typescript
// REMOVE local path functions

// ADD import:
import {
  getConfigDir,
  isFirstRun,
  findEnvFile,
} from '@/shared/utils/paths.util';

// UPDATE isConfigured() to use the utility:
function isConfigured(): boolean {
  return findEnvFile() !== null;
}
```

**Modify file:** `src/cli/commands/status.ts`

```typescript
// REMOVE local path functions

// ADD import:
import {
  getConfigDir,
  getDataDir,
  findEnvFile,
  isDevMode,
} from '@/shared/utils/paths.util';
```

**Modify file:** `src/cli/commands/config.ts`

```typescript
// REMOVE local path functions

// ADD import:
import { getConfigDir, getConfigPath } from '@/shared/utils/paths.util';
```

**Modify file:** `src/cli/commands/projects.ts`

```typescript
// REMOVE local path functions

// ADD import:
import { getConfigDir, getConfigPath } from '@/shared/utils/paths.util';
```

---

## Task 3: Update Main Entry Point

**Modify file:** `timmy.ts`

This is the key integration step. Update the entry point to use the CLI framework while preserving backward compatibility for development.

```typescript
#!/usr/bin/env node

/**
 * Timmy - Autonomous Task Automation
 * Main entry point supporting both CLI and interactive modes
 */

// Register tsconfig paths for runtime (needed for development)
import 'tsconfig-paths/register';

// Initialize directories before anything else
import { ensureDirectories, isFirstRun, isDevMode } from './src/shared/utils/paths.util';
ensureDirectories();

// Check if running with CLI arguments
const hasArgs = process.argv.length > 2;
const isHelpOrVersion = process.argv.some(arg =>
  ['--help', '-h', '--version', '-V', 'init', 'status', 'config', 'projects'].includes(arg)
);

// If CLI arguments provided, use CLI framework
if (hasArgs || isHelpOrVersion) {
  import('./src/cli').then(({ runCLI }) => {
    runCLI().catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
  });
} else {
  // No arguments - check if first run
  if (isFirstRun() && !isDevMode()) {
    console.log('Welcome to Timmy! Running first-time setup...\n');
    import('./src/cli/commands/init').then(({ runInitWizard }) => {
      runInitWizard();
    });
  } else {
    // Start the existing interactive mode
    startLegacyMode();
  }
}

/**
 * Start the original interactive polling mode
 * This preserves backward compatibility with existing workflow
 */
async function startLegacyMode(): Promise<void> {
  // Unset any system environment variables that might override .env file
  delete process.env.CLICKUP_WORKSPACE_ID;
  delete process.env.CLICKUP_API_KEY;
  delete process.env.CLICKUP_SECRET;
  delete process.env.CLICKUP_BOT_USER_ID;
  delete process.env.GITHUB_OWNER;
  delete process.env.GITHUB_REPO;
  delete process.env.GITHUB_BASE_BRANCH;
  delete process.env.GITHUB_REPO_PATH;
  delete process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_DEFAULT_USERNAME;

  // Load environment
  const dotenv = await import('dotenv');
  const { findEnvFile } = await import('./src/shared/utils/paths.util');
  const envPath = findEnvFile();
  if (envPath) {
    dotenv.config({ path: envPath });
  }

  // Import and validate config
  const { default: config, validateRequiredEnvVars } = await import('./src/shared/config');

  try {
    validateRequiredEnvVars();
  } catch (error) {
    const { timmy } = await import('./src/shared/ui');
    console.log(timmy.error((error as Error).message));
    console.log('\nRun `timmy init` to configure.\n');
    process.exit(1);
  }

  // Import remaining modules
  const { timmy, colors } = await import('./src/shared/ui');
  const { logger } = await import('./src/shared/utils/logger.util');
  const { setVerboseMode } = await import('./src/shared/utils/verbose.util');
  const { setupInteractiveMode, type AppState } = await import('./src/shared/interactive-cli');
  const storage = await import('./lib/storage');
  const clickup = await import('./lib/clickup');
  const orchestrator = await import('./src/core/orchestrator/orchestrator.service');
  const { discordService } = await import('./src/core/discord/discord.service');
  const { getProcessManager } = await import('./src/shared/utils/process-manager.util');

  // Initialize state
  const appState: AppState = {
    isRunning: true,
    pollInterval: null,
    isProcessing: false,
    currentTask: null,
    verbose: config.system.verbose
  };

  // Set up verbose mode
  setVerboseMode(appState.verbose);

  // Set up interactive CLI
  setupInteractiveMode(appState);

  // Start the main loop
  // ... (rest of the existing timmy.ts logic)
  // The existing code from line ~60 onwards in timmy.ts should be here
}
```

**Note:** The above is a simplified version. In practice, you'll need to move most of the existing `timmy.ts` code (from line 60 onwards) into the `startLegacyMode()` function or into a separate module like `src/core/main-loop.ts`.

---

## Task 4: Update Package.json

**Modify file:** `package.json`

```json
{
  "name": "timmy-cli",
  "version": "2.0.0",
  "description": "Autonomous task automation: ClickUp to GitHub via AI",
  "main": "dist/timmy.js",
  "bin": {
    "timmy": "dist/timmy.js"
  },
  "files": [
    "dist/",
    "templates/data/",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "init": "ts-node scripts/interactive-setup.ts",
    "settings": "ts-node scripts/settings.ts",
    "setup": "bash scripts/setup.sh",
    "build": "tsc && tsc-alias && cp src/infrastructure/storage/schema.sql dist/src/infrastructure/storage/schema.sql",
    "start": "npm run build && NODE_NO_WARNINGS=1 node dist/timmy.js",
    "dev": "ts-node -r tsconfig-paths/register timmy.ts",
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist",
    "prepublishOnly": "npm run clean && npm run build && npm test"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "cli",
    "automation",
    "clickup",
    "github",
    "ai",
    "claude",
    "task-management",
    "devtools"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Forkyapp/Timmy.git"
  },
  "bugs": {
    "url": "https://github.com/Forkyapp/Timmy/issues"
  },
  "homepage": "https://github.com/Forkyapp/Timmy#readme",
  "author": "Forkyapp",
  "license": "MIT",
  "dependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "axios": "^1.6.0",
    "better-sqlite3": "^12.4.1",
    "commander": "^12.1.0",
    "discord.js": "^14.24.2",
    "dotenv": "^16.3.1",
    "inquirer": "^9.2.23",
    "openai": "^6.9.0",
    "tsconfig-paths": "^4.2.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@types/inquirer": "^9.0.7",
    "@types/jest": "^29.5.14",
    "@types/node": "^24.10.1",
    "@typescript-eslint/eslint-plugin": "^8.46.4",
    "@typescript-eslint/parser": "^8.46.4",
    "eslint": "^9.39.1",
    "jest": "^29.7.0",
    "ts-jest": "^29.4.5",
    "ts-node": "^10.9.2",
    "tsc-alias": "^1.8.16",
    "typescript": "^5.9.3",
    "typescript-eslint": "^8.46.4"
  }
}
```

---

## Task 5: Create .npmignore

**Create file:** `.npmignore`

```gitignore
# Source files (compiled to dist/)
*.ts
!*.d.ts
tsconfig.json
tsconfig.*.json

# Development files
.env
.env.*
*.log
.git/
.github/
.vscode/
.idea/
.context/

# Test files
**/__tests__/
**/*.test.ts
**/*.spec.ts
jest.config.js
jest.setup.ts
coverage/

# Build artifacts
*.tsbuildinfo

# Documentation (keep README)
docs/
CLAUDE.md
PLAN_*.md
NPM_PACKAGE_CONVERSION_PLAN.md
*.md
!README.md
!CHANGELOG.md

# Configuration templates (keep data templates)
templates/context/
templates/*.md
templates/README.md

# Runtime data
data/

# Scripts not needed for users
scripts/interactive-setup.ts
scripts/settings.ts
scripts/switch-project.ts
scripts/list-projects.ts
scripts/current-project.ts
scripts/build-context-index.ts
scripts/migrate-json-to-sqlite.ts

# Legacy code being migrated
lib/

# Other
*.local
.DS_Store
Thumbs.db
node_modules/
```

---

## Task 6: Create LICENSE File

**Create file:** `LICENSE`

```
MIT License

Copyright (c) 2025 Forkyapp

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Task 7: Update README for NPM Users

**Modify file:** `README.md`

Add this section at the top:

```markdown
# Timmy CLI

Autonomous task automation: ClickUp to GitHub via AI

## Quick Start

```bash
# Install globally
npm install -g timmy-cli

# Run setup wizard
timmy init

# Start the automation
timmy start
```

## Commands

| Command | Description |
|---------|-------------|
| `timmy init` | Run the setup wizard |
| `timmy start` | Start the polling loop |
| `timmy start -v` | Start with verbose logging |
| `timmy status` | Show current status |
| `timmy config list` | Show configuration |
| `timmy config set KEY VALUE` | Update configuration |
| `timmy projects list` | List all projects |
| `timmy projects switch NAME` | Switch active project |
| `timmy projects add` | Add new project |
| `timmy --help` | Show all commands |

## Configuration

Configuration is stored in `~/.timmy/`:

```
~/.timmy/
├── .env              # API keys and credentials
├── workspace.json    # Active project
├── projects.json     # Project configurations
└── data/             # Runtime data
```

### Required Credentials

- **ClickUp API Key** - Get from ClickUp Settings → Apps
- **ClickUp Workspace ID** - Found in your ClickUp URL
- **GitHub Token** - Personal access token with repo scope

## Development

```bash
# Clone and install
git clone https://github.com/Forkyapp/Timmy.git
cd Timmy
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build
npm run build
```

---

... (rest of existing README)
```

---

## Task 8: Create CHANGELOG

**Create file:** `CHANGELOG.md`

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-12-XX

### Added
- NPM package support - install globally with `npm install -g timmy-cli`
- CLI commands: `init`, `start`, `status`, `config`, `projects`
- Interactive setup wizard with `timmy init`
- XDG-compliant configuration in `~/.timmy/`
- Support for multiple projects with easy switching
- Verbose mode flag: `timmy start -v`

### Changed
- Configuration now stored in `~/.timmy/` instead of repo root
- Entry point supports both CLI and interactive modes
- Package renamed from `timmy-task-automation` to `timmy-cli`

### Migration
- Existing users: Copy `.env`, `workspace.json`, `projects.json` to `~/.timmy/`
- Data files: Copy `data/` directory to `~/.timmy/data/`

## [1.0.0] - 2025-XX-XX

### Added
- Initial release
- ClickUp task polling
- Claude Code integration
- Gemini analysis
- Codex code review
- GitHub PR creation
- Discord integration
- Multi-project support
```

---

## Task 9: Test the Package

### 9.1 Build and Type Check

```bash
npm run type-check
npm run build
```

### 9.2 Test CLI Commands

```bash
# Test help
node dist/timmy.js --help
node dist/timmy.js init --help
node dist/timmy.js status --help

# Test version
node dist/timmy.js --version
```

### 9.3 Test Local Installation

```bash
# Create a tarball
npm pack

# Install globally from tarball
npm install -g ./timmy-cli-2.0.0.tgz

# Test commands
timmy --help
timmy --version
timmy status

# Clean up
npm uninstall -g timmy-cli
```

### 9.4 Test Init Wizard

```bash
# Remove existing config (backup first!)
mv ~/.timmy ~/.timmy.backup

# Run init
timmy init

# Verify files created
ls -la ~/.timmy/
cat ~/.timmy/.env

# Restore backup
rm -rf ~/.timmy
mv ~/.timmy.backup ~/.timmy
```

---

## Task 10: Verify Package Contents

```bash
# See what will be published
npm pack --dry-run

# Expected files:
# - package.json
# - README.md
# - LICENSE
# - CHANGELOG.md
# - dist/
# - templates/data/
```

---

## Verification Checklist

Before final commit:

- [ ] Both feature branches merged without conflicts
- [ ] CLI commands use path utilities from Plan A
- [ ] `timmy --help` shows all commands
- [ ] `timmy init` creates config in `~/.timmy/`
- [ ] `timmy status` works
- [ ] `timmy start` works (if configured)
- [ ] Package.json has correct `bin`, `files`, `engines`
- [ ] `.npmignore` excludes dev files
- [ ] LICENSE file exists
- [ ] README updated with CLI usage
- [ ] All tests pass: `npm test`
- [ ] TypeScript compiles: `npm run build`
- [ ] Local install test passes

---

## Commit Messages

```bash
# After merging both branches
git commit -m "merge: integrate path utilities and CLI framework"

# After updating CLI to use paths
git commit -m "refactor: CLI commands use shared path utilities"

# After package.json updates
git commit -m "chore: configure package.json for npm publishing"

# After creating packaging files
git commit -m "chore: add .npmignore, LICENSE, CHANGELOG"

# After README update
git commit -m "docs: update README with CLI usage instructions"

# Final commit
git commit -m "feat: complete npm package setup for global installation

- Merge XDG path utilities and CLI framework
- Configure package.json with bin field
- Add setup wizard: timmy init
- Add commands: start, status, config, projects
- Support ~/.timmy/ for user configuration
- Add LICENSE and CHANGELOG

BREAKING CHANGE: Configuration now stored in ~/.timmy/ instead of repo root
```

---

## Publishing (When Ready)

```bash
# Login to npm
npm login

# Publish
npm publish

# Or publish as beta first
npm publish --tag beta
```

---

## Troubleshooting

### Merge Conflicts

If there are conflicts between Plan A and Plan B:

1. Both plans might have modified similar files (unlikely if followed correctly)
2. Resolve by keeping both changes - Plan A's path utilities and Plan B's CLI code
3. The CLI should import from Plan A's utilities

### CLI Not Finding Paths Utility

If CLI commands can't import from `@/shared/utils/paths.util`:

1. Ensure Plan A was merged first
2. Check `tsconfig.json` has the path alias
3. Run `npm run build` to recompile

### Package Too Large

If `npm pack` shows unexpected files:

1. Check `.npmignore` is correct
2. Ensure `files` field in package.json is restrictive
3. Run `npm pack --dry-run` to see what's included
