# Timmy NPM Package Conversion Plan

**Document Version:** 1.0.0
**Created:** 2025-12-05
**Target Package Name:** `timmy-cli` or `timmy-task-automation`
**Estimated Effort:** 12-16 hours

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Target State](#3-target-state)
4. [Implementation Phases](#4-implementation-phases)
5. [Detailed File Changes](#5-detailed-file-changes)
6. [New Files to Create](#6-new-files-to-create)
7. [Configuration Architecture](#7-configuration-architecture)
8. [CLI Command Structure](#8-cli-command-structure)
9. [Testing Strategy](#9-testing-strategy)
10. [Publishing Checklist](#10-publishing-checklist)
11. [Migration Guide for Existing Users](#11-migration-guide-for-existing-users)

---

## 1. Executive Summary

### Goal
Convert Timmy from a clone-and-run repository to a globally installable npm package:

```bash
# Target user experience
npm install -g timmy-cli
timmy init                    # First-time setup wizard
timmy start                   # Start the automation bot
timmy status                  # Check current status
```

### Key Challenges
1. **Hardcoded paths** - All data/config paths use `__dirname` relative to repo
2. **No CLI argument parsing** - Only interactive mode exists
3. **No `bin` field** - Package not executable after install
4. **Config in repo root** - `.env`, `workspace.json`, `projects.json` expected locally

### Solution Overview
1. Move all user data to `~/.timmy/` (XDG-compliant)
2. Add CLI argument parsing with `commander`
3. Create `timmy init` setup wizard
4. Support both global install and local development

---

## 2. Current State Analysis

### Package.json (Current)
```json
{
  "name": "timmy-task-automation",
  "version": "1.0.0",
  "main": "dist/timmy.js",
  "scripts": {
    "start": "npm run build && node dist/timmy.js",
    "dev": "ts-node timmy.ts"
  }
  // NO "bin" field - cannot run globally
}
```

### Directory Structure (Current)
```
timmy/
├── .env                      # Credentials (gitignored)
├── workspace.json            # Active project (gitignored)
├── projects.json             # Project configs (gitignored)
├── data/                     # Runtime state (gitignored)
│   ├── cache/
│   ├── state/
│   └── tracking/
├── templates/                # Setup templates
└── src/
    └── shared/config/index.ts  # Hardcoded paths here
```

### Path Resolution (Current - Problem)
```typescript
// src/shared/config/index.ts - Lines 165-170
files: {
  cacheFile: path.join(__dirname, '..', '..', '..', 'data', 'cache', 'processed-tasks.json'),
  queueFile: path.join(__dirname, '..', '..', '..', 'data', 'state', 'task-queue.json'),
  // etc...
}
```

**Problem:** When installed in `node_modules/`, `__dirname` points to wrong location.

---

## 3. Target State

### Package.json (Target)
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
    "templates/",
    "README.md"
  ],
  "scripts": {
    "build": "tsc && tsc-alias",
    "prepublishOnly": "npm run build && npm test"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": ["cli", "automation", "clickup", "github", "ai", "claude"]
}
```

### User Directory Structure (Target)
```
~/.timmy/                     # XDG_CONFIG_HOME fallback
├── config.json               # Merged configuration
├── .env                      # Credentials
├── workspace.json            # Active project
├── projects.json             # Project configurations
├── data/
│   ├── cache/
│   │   ├── processed-tasks.json
│   │   └── processed-comments.json
│   ├── state/
│   │   ├── task-queue.json
│   │   └── pipeline-state.json
│   └── tracking/
│       ├── pr-tracking.json
│       └── review-tracking.json
└── logs/                     # Optional: persistent logs
    └── timmy.log
```

### CLI Commands (Target)
```bash
timmy                         # Start interactive mode (default)
timmy start                   # Start polling in background
timmy stop                    # Stop polling
timmy status                  # Show current status
timmy init                    # First-time setup wizard
timmy config                  # Show current config
timmy config set KEY VALUE    # Set config value
timmy projects                # List projects
timmy projects add            # Add new project
timmy projects switch <name>  # Switch active project
timmy logs [taskId]           # View logs
timmy cache clear             # Clear processed cache
timmy --version               # Show version
timmy --help                  # Show help
```

---

## 4. Implementation Phases

### Phase 1: Core Infrastructure (4-5 hours)
**Goal:** Make the package installable and runnable globally

| Task | File(s) | Priority |
|------|---------|----------|
| 1.1 Add `bin` field to package.json | `package.json` | Critical |
| 1.2 Create `.npmignore` | `.npmignore` | Critical |
| 1.3 Create XDG config utility | `src/shared/utils/paths.util.ts` | Critical |
| 1.4 Refactor config to use user home | `src/shared/config/index.ts` | Critical |
| 1.5 Create directory initialization | `src/shared/utils/init-dirs.util.ts` | Critical |

### Phase 2: CLI Framework (3-4 hours)
**Goal:** Add proper command-line interface

| Task | File(s) | Priority |
|------|---------|----------|
| 2.1 Add commander.js dependency | `package.json` | High |
| 2.2 Create CLI entry point | `src/cli/index.ts` | High |
| 2.3 Implement `init` command | `src/cli/commands/init.ts` | High |
| 2.4 Implement `start` command | `src/cli/commands/start.ts` | High |
| 2.5 Implement `config` command | `src/cli/commands/config.ts` | High |
| 2.6 Implement `projects` command | `src/cli/commands/projects.ts` | Medium |
| 2.7 Update main entry point | `timmy.ts` | High |

### Phase 3: Setup Wizard (2-3 hours)
**Goal:** Smooth first-time user experience

| Task | File(s) | Priority |
|------|---------|----------|
| 3.1 Create interactive prompts | `src/cli/wizard/prompts.ts` | High |
| 3.2 Implement credential setup | `src/cli/wizard/credentials.ts` | High |
| 3.3 Implement project setup | `src/cli/wizard/project.ts` | High |
| 3.4 Add validation helpers | `src/cli/wizard/validators.ts` | Medium |
| 3.5 Create postinstall hook | `scripts/postinstall.ts` | Medium |

### Phase 4: Polish & Publish (2-3 hours)
**Goal:** Production-ready package

| Task | File(s) | Priority |
|------|---------|----------|
| 4.1 Update README for npm users | `README.md` | High |
| 4.2 Add CHANGELOG.md | `CHANGELOG.md` | Medium |
| 4.3 Add LICENSE | `LICENSE` | High |
| 4.4 Test global installation | - | Critical |
| 4.5 Publish to npm | - | Critical |

---

## 5. Detailed File Changes

### 5.1 `package.json`

```diff
{
-  "name": "timmy-task-automation",
-  "version": "1.0.0",
+  "name": "timmy-cli",
+  "version": "2.0.0",
   "description": "Autonomous task automation: ClickUp to GitHub via AI",
   "main": "dist/timmy.js",
+  "bin": {
+    "timmy": "dist/timmy.js"
+  },
+  "files": [
+    "dist/",
+    "templates/data/",
+    "README.md",
+    "LICENSE"
+  ],
   "scripts": {
     "build": "tsc && tsc-alias && cp src/infrastructure/storage/schema.sql dist/src/infrastructure/storage/schema.sql",
     "start": "npm run build && node dist/timmy.js",
-    "dev": "ts-node timmy.ts"
+    "dev": "ts-node timmy.ts",
+    "postinstall": "node dist/scripts/postinstall.js || true",
+    "prepublishOnly": "npm run build && npm test"
   },
+  "engines": {
+    "node": ">=18.0.0"
+  },
   "dependencies": {
     "axios": "^1.6.0",
+    "commander": "^12.0.0",
+    "inquirer": "^9.2.0",
     "dotenv": "^16.3.1",
     ...
   },
+  "keywords": [
+    "cli",
+    "automation",
+    "clickup",
+    "github",
+    "ai",
+    "claude",
+    "task-management"
+  ],
+  "repository": {
+    "type": "git",
+    "url": "https://github.com/user/timmy.git"
+  },
+  "author": "Your Name",
+  "license": "MIT"
}
```

### 5.2 `src/shared/config/index.ts`

```diff
import path from 'path';
import dotenv from 'dotenv';
+import { getConfigDir, getDataDir, ensureDirectories } from '../utils/paths.util';

-// Load .env file for global credentials
-dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });
+// Load .env from user config directory OR current working directory
+const envPaths = [
+  path.join(getConfigDir(), '.env'),           // ~/.timmy/.env
+  path.join(process.cwd(), '.env'),            // ./env (local dev)
+];
+
+for (const envPath of envPaths) {
+  if (fs.existsSync(envPath)) {
+    dotenv.config({ path: envPath });
+    break;
+  }
+}

// ... existing validation code ...

+const dataDir = getDataDir();

const config: Config = {
   // ... existing config ...
   files: {
-    cacheFile: path.join(__dirname, '..', '..', '..', 'data', 'cache', 'processed-tasks.json'),
-    queueFile: path.join(__dirname, '..', '..', '..', 'data', 'state', 'task-queue.json'),
-    prTrackingFile: path.join(__dirname, '..', '..', '..', 'data', 'tracking', 'pr-tracking.json'),
-    pipelineFile: path.join(__dirname, '..', '..', '..', 'data', 'state', 'pipeline-state.json'),
-    featuresDir: path.join(__dirname, '..', '..', '..', 'docs', 'features'),
-    discordMessagesFile: path.join(__dirname, '..', '..', '..', 'data', 'discord', 'processed-messages.json'),
+    cacheFile: path.join(dataDir, 'cache', 'processed-tasks.json'),
+    queueFile: path.join(dataDir, 'state', 'task-queue.json'),
+    prTrackingFile: path.join(dataDir, 'tracking', 'pr-tracking.json'),
+    pipelineFile: path.join(dataDir, 'state', 'pipeline-state.json'),
+    featuresDir: path.join(dataDir, 'features'),
+    discordMessagesFile: path.join(dataDir, 'discord', 'processed-messages.json'),
   },
   // ... rest of config ...
};
```

### 5.3 `timmy.ts` (Entry Point)

```diff
#!/usr/bin/env node

-// Register tsconfig paths for runtime
-import 'tsconfig-paths/register';
+import { program } from 'commander';
+import { ensureDirectories, isFirstRun } from './src/shared/utils/paths.util';
+import { runInitWizard } from './src/cli/commands/init';
+import { startPolling } from './src/cli/commands/start';
+import { showStatus } from './src/cli/commands/status';

-// Unset any system environment variables...
-delete process.env.CLICKUP_WORKSPACE_ID;
-// ... etc

+// Ensure user directories exist
+ensureDirectories();

+// Check for first run
+if (isFirstRun() && process.argv.length <= 2) {
+  console.log('Welcome to Timmy! Running first-time setup...\n');
+  runInitWizard();
+  process.exit(0);
+}

+program
+  .name('timmy')
+  .description('Autonomous task automation: ClickUp to GitHub via AI')
+  .version('2.0.0');

+program
+  .command('init')
+  .description('Run the setup wizard')
+  .action(runInitWizard);

+program
+  .command('start')
+  .description('Start the polling loop')
+  .option('-v, --verbose', 'Enable verbose logging')
+  .option('-d, --daemon', 'Run in background')
+  .action(startPolling);

+program
+  .command('status')
+  .description('Show current status')
+  .action(showStatus);

+program
+  .command('config [action] [key] [value]')
+  .description('View or modify configuration')
+  .action(handleConfig);

+program
+  .command('projects [action] [name]')
+  .description('Manage projects')
+  .action(handleProjects);

+// Default: interactive mode
+program
+  .action(() => {
+    startInteractiveMode();
+  });

+program.parse();

-// ... existing interactive mode code moved to src/cli/commands/start.ts ...
```

---

## 6. New Files to Create

### 6.1 `.npmignore`

```gitignore
# Development files
.env
.env.*
*.log
.git/
.github/
.vscode/
.idea/

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
*.md
!README.md
!CHANGELOG.md
!LICENSE

# Configuration templates (keep data templates)
templates/context/
templates/*.md

# Runtime data
data/

# Source TypeScript (dist is compiled)
# Uncomment if you want to exclude source:
# src/
# timmy.ts
# tsconfig.json

# Scripts not needed in production
scripts/interactive-setup.ts
scripts/settings.ts
scripts/switch-project.ts
scripts/list-projects.ts
scripts/current-project.ts
scripts/build-context-index.ts
scripts/migrate-json-to-sqlite.ts

# Other
*.local
.DS_Store
Thumbs.db
```

### 6.2 `src/shared/utils/paths.util.ts`

```typescript
/**
 * XDG Base Directory Specification compliant path utilities
 * Handles user config and data directories for global npm installation
 */

import path from 'path';
import os from 'os';
import fs from 'fs';

const APP_NAME = 'timmy';

/**
 * Get the configuration directory
 * Priority: $TIMMY_CONFIG_DIR > $XDG_CONFIG_HOME/timmy > ~/.timmy
 */
export function getConfigDir(): string {
  if (process.env.TIMMY_CONFIG_DIR) {
    return process.env.TIMMY_CONFIG_DIR;
  }

  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, APP_NAME);
  }

  return path.join(os.homedir(), `.${APP_NAME}`);
}

/**
 * Get the data directory
 * Priority: $TIMMY_DATA_DIR > $XDG_DATA_HOME/timmy > ~/.timmy/data
 */
export function getDataDir(): string {
  if (process.env.TIMMY_DATA_DIR) {
    return process.env.TIMMY_DATA_DIR;
  }

  if (process.env.XDG_DATA_HOME) {
    return path.join(process.env.XDG_DATA_HOME, APP_NAME);
  }

  return path.join(getConfigDir(), 'data');
}

/**
 * Get the logs directory
 */
export function getLogsDir(): string {
  return path.join(getDataDir(), 'logs');
}

/**
 * Ensure all required directories exist
 */
export function ensureDirectories(): void {
  const dirs = [
    getConfigDir(),
    getDataDir(),
    path.join(getDataDir(), 'cache'),
    path.join(getDataDir(), 'state'),
    path.join(getDataDir(), 'tracking'),
    path.join(getDataDir(), 'discord'),
    getLogsDir(),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Check if this is first run (no config exists)
 */
export function isFirstRun(): boolean {
  const configFile = path.join(getConfigDir(), '.env');
  const projectsFile = path.join(getConfigDir(), 'projects.json');

  return !fs.existsSync(configFile) && !fs.existsSync(projectsFile);
}

/**
 * Get path to a config file
 */
export function getConfigPath(filename: string): string {
  return path.join(getConfigDir(), filename);
}

/**
 * Get path to a data file
 */
export function getDataPath(...segments: string[]): string {
  return path.join(getDataDir(), ...segments);
}

/**
 * Copy template files to user config directory
 */
export function copyTemplates(templateDir: string): void {
  const configDir = getConfigDir();
  const dataDir = getDataDir();

  // Copy data templates
  const dataTemplateDir = path.join(templateDir, 'data');
  if (fs.existsSync(dataTemplateDir)) {
    copyDirRecursive(dataTemplateDir, dataDir);
  }
}

function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      // Only copy if destination doesn't exist (don't overwrite user data)
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export default {
  getConfigDir,
  getDataDir,
  getLogsDir,
  ensureDirectories,
  isFirstRun,
  getConfigPath,
  getDataPath,
  copyTemplates,
};
```

### 6.3 `src/cli/commands/init.ts`

```typescript
/**
 * Init command - First-time setup wizard
 */

import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { getConfigDir, getConfigPath, ensureDirectories } from '../../shared/utils/paths.util';
import { timmy, colors } from '../../shared/ui';

interface SetupAnswers {
  clickupApiKey: string;
  clickupWorkspaceId: string;
  clickupBotUserId: string;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubRepoPath: string;
  githubBaseBranch: string;
  discordEnabled: boolean;
  discordToken?: string;
}

export async function runInitWizard(): Promise<void> {
  console.log(timmy.section('Timmy Setup Wizard'));
  console.log('\nThis wizard will help you configure Timmy.\n');
  console.log(`Configuration will be saved to: ${colors.cyan}${getConfigDir()}${colors.reset}\n`);

  // Ensure directories exist
  ensureDirectories();

  // Check if config already exists
  const envPath = getConfigPath('.env');
  if (fs.existsSync(envPath)) {
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: 'Configuration already exists. Overwrite?',
      default: false,
    }]);

    if (!overwrite) {
      console.log('\nSetup cancelled. Existing configuration preserved.');
      return;
    }
  }

  // Collect configuration
  const answers = await inquirer.prompt<SetupAnswers>([
    // ClickUp Configuration
    {
      type: 'input',
      name: 'clickupApiKey',
      message: 'ClickUp API Key:',
      validate: (input) => input.length > 0 || 'API key is required',
    },
    {
      type: 'input',
      name: 'clickupWorkspaceId',
      message: 'ClickUp Workspace ID:',
      validate: (input) => input.length > 0 || 'Workspace ID is required',
    },
    {
      type: 'input',
      name: 'clickupBotUserId',
      message: 'ClickUp Bot User ID (your user ID):',
      validate: (input) => input.length > 0 || 'User ID is required',
    },

    // GitHub Configuration
    {
      type: 'input',
      name: 'githubToken',
      message: 'GitHub Personal Access Token:',
      validate: (input) => input.length > 0 || 'Token is required',
    },
    {
      type: 'input',
      name: 'githubOwner',
      message: 'GitHub Owner (username or org):',
      validate: (input) => input.length > 0 || 'Owner is required',
    },
    {
      type: 'input',
      name: 'githubRepo',
      message: 'GitHub Repository name:',
      validate: (input) => input.length > 0 || 'Repo name is required',
    },
    {
      type: 'input',
      name: 'githubRepoPath',
      message: 'Local path to repository:',
      validate: (input) => {
        if (!input) return 'Path is required';
        const expanded = input.replace(/^~/, process.env.HOME || '');
        if (!fs.existsSync(expanded)) return 'Path does not exist';
        return true;
      },
    },
    {
      type: 'input',
      name: 'githubBaseBranch',
      message: 'Base branch:',
      default: 'main',
    },

    // Discord (optional)
    {
      type: 'confirm',
      name: 'discordEnabled',
      message: 'Enable Discord integration?',
      default: false,
    },
    {
      type: 'input',
      name: 'discordToken',
      message: 'Discord Bot Token:',
      when: (answers) => answers.discordEnabled,
    },
  ]);

  // Generate .env file
  const envContent = generateEnvFile(answers);
  fs.writeFileSync(envPath, envContent);

  // Generate projects.json
  const projectsPath = getConfigPath('projects.json');
  const projectsContent = generateProjectsFile(answers);
  fs.writeFileSync(projectsPath, JSON.stringify(projectsContent, null, 2));

  // Generate workspace.json
  const workspacePath = getConfigPath('workspace.json');
  const workspaceContent = { active: 'default' };
  fs.writeFileSync(workspacePath, JSON.stringify(workspaceContent, null, 2));

  console.log('\n' + timmy.success('Configuration saved successfully!'));
  console.log('\nYou can now run:');
  console.log(`  ${colors.cyan}timmy start${colors.reset}  - Start the automation bot`);
  console.log(`  ${colors.cyan}timmy status${colors.reset} - Check current status`);
  console.log(`  ${colors.cyan}timmy${colors.reset}        - Interactive mode`);
}

function generateEnvFile(answers: SetupAnswers): string {
  return `# Timmy Configuration
# Generated by: timmy init
# Date: ${new Date().toISOString()}

# ClickUp Configuration
CLICKUP_API_KEY=${answers.clickupApiKey}
CLICKUP_WORKSPACE_ID=${answers.clickupWorkspaceId}
CLICKUP_BOT_USER_ID=${answers.clickupBotUserId}

# GitHub Configuration
GITHUB_TOKEN=${answers.githubToken}
GITHUB_OWNER=${answers.githubOwner}
GITHUB_REPO=${answers.githubRepo}
GITHUB_REPO_PATH=${answers.githubRepoPath.replace(/^~/, process.env.HOME || '')}
GITHUB_BASE_BRANCH=${answers.githubBaseBranch}

# Discord Configuration
DISCORD_ENABLED=${answers.discordEnabled}
${answers.discordToken ? `DISCORD_BOT_TOKEN=${answers.discordToken}` : '# DISCORD_BOT_TOKEN='}

# System Configuration
POLL_INTERVAL_MS=60000
VERBOSE=false
`;
}

function generateProjectsFile(answers: SetupAnswers): object {
  return {
    projects: {
      default: {
        name: answers.githubRepo,
        description: 'Default project',
        clickup: {
          workspaceId: answers.clickupWorkspaceId,
        },
        github: {
          owner: answers.githubOwner,
          repo: answers.githubRepo,
          path: answers.githubRepoPath.replace(/^~/, process.env.HOME || ''),
          baseBranch: answers.githubBaseBranch,
        },
      },
    },
  };
}
```

### 6.4 `src/cli/commands/start.ts`

```typescript
/**
 * Start command - Begin polling loop
 */

import config from '../../shared/config';
import { timmy, colors } from '../../shared/ui';
import { setVerboseMode } from '../../shared/utils/verbose.util';
import { setupInteractiveMode, type AppState } from '../../shared/interactive-cli';
import { ensureDirectories, isFirstRun } from '../../shared/utils/paths.util';

interface StartOptions {
  verbose?: boolean;
  daemon?: boolean;
}

export async function startPolling(options: StartOptions = {}): Promise<void> {
  // Check if configured
  if (isFirstRun()) {
    console.log(timmy.error('Timmy is not configured. Run `timmy init` first.'));
    process.exit(1);
  }

  // Ensure directories
  ensureDirectories();

  // Set verbose mode
  if (options.verbose) {
    setVerboseMode(true);
  }

  console.log(timmy.section('Starting Timmy'));
  console.log(`Polling interval: ${config.system.pollIntervalMs / 1000}s`);
  console.log(`Verbose mode: ${options.verbose ? 'on' : 'off'}`);
  console.log('');

  // Import and start the main polling loop
  // This is the existing logic from timmy.ts
  const { startMainLoop } = await import('../../core/main-loop');

  if (options.daemon) {
    console.log(timmy.info('Running in daemon mode. Use `timmy stop` to halt.'));
    await startMainLoop({ daemon: true });
  } else {
    // Interactive mode with readline
    await startInteractiveMode();
  }
}

async function startInteractiveMode(): Promise<void> {
  const { setupInteractiveMode } = await import('../../shared/interactive-cli');

  const appState: AppState = {
    isRunning: true,
    pollInterval: null,
    isProcessing: false,
    currentTask: null,
    verbose: config.system.verbose,
  };

  setupInteractiveMode(appState);

  // Start polling...
  // (existing polling logic)
}
```

### 6.5 `src/cli/commands/status.ts`

```typescript
/**
 * Status command - Show current system status
 */

import config from '../../shared/config';
import { timmy, colors } from '../../shared/ui';
import { getConfigDir, getDataDir } from '../../shared/utils/paths.util';
import * as pipelineRepo from '../../core/repositories/pipeline.repository';
import * as cacheRepo from '../../core/repositories/cache.repository';

export async function showStatus(): Promise<void> {
  console.log(timmy.section('Timmy Status'));

  // Configuration
  console.log('\n' + colors.bright + 'Configuration:' + colors.reset);
  console.log(`  Config directory: ${getConfigDir()}`);
  console.log(`  Data directory: ${getDataDir()}`);
  console.log(`  Active project: ${config.github.repo || 'Not configured'}`);

  // Connection status
  console.log('\n' + colors.bright + 'Connections:' + colors.reset);
  console.log(`  ClickUp: ${config.clickup.apiKey ? colors.green + 'Configured' : colors.red + 'Not configured'}${colors.reset}`);
  console.log(`  GitHub: ${config.github.token ? colors.green + 'Configured' : colors.red + 'Not configured'}${colors.reset}`);
  console.log(`  Discord: ${config.discord.enabled ? colors.green + 'Enabled' : colors.yellow + 'Disabled'}${colors.reset}`);

  // Pipeline status
  console.log('\n' + colors.bright + 'Pipeline:' + colors.reset);
  try {
    const pipelines = await pipelineRepo.getAll();
    const active = pipelines.filter(p => p.status === 'in_progress');
    const completed = pipelines.filter(p => p.status === 'completed');
    const failed = pipelines.filter(p => p.status === 'failed');

    console.log(`  Active tasks: ${active.length}`);
    console.log(`  Completed: ${completed.length}`);
    console.log(`  Failed: ${failed.length}`);
  } catch {
    console.log(`  ${colors.yellow}Unable to read pipeline state${colors.reset}`);
  }

  // Cache status
  console.log('\n' + colors.bright + 'Cache:' + colors.reset);
  try {
    const cacheSize = await cacheRepo.size();
    console.log(`  Processed tasks: ${cacheSize}`);
  } catch {
    console.log(`  ${colors.yellow}Unable to read cache${colors.reset}`);
  }

  console.log('');
}
```

### 6.6 `src/cli/index.ts`

```typescript
/**
 * CLI Entry Point
 * Handles command-line argument parsing and routing
 */

import { program } from 'commander';
import { ensureDirectories, isFirstRun, getConfigDir } from '../shared/utils/paths.util';
import { runInitWizard } from './commands/init';
import { startPolling } from './commands/start';
import { showStatus } from './commands/status';
import { handleConfig } from './commands/config';
import { handleProjects } from './commands/projects';

// Package version from package.json
const VERSION = '2.0.0';

export function run(): void {
  // Ensure directories exist
  ensureDirectories();

  program
    .name('timmy')
    .description('Autonomous task automation: ClickUp to GitHub via AI')
    .version(VERSION);

  // Init command
  program
    .command('init')
    .description('Run the setup wizard')
    .action(runInitWizard);

  // Start command
  program
    .command('start')
    .description('Start the polling loop')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-d, --daemon', 'Run in background mode')
    .action(startPolling);

  // Status command
  program
    .command('status')
    .alias('s')
    .description('Show current status')
    .action(showStatus);

  // Config command
  program
    .command('config [action] [key] [value]')
    .description('View or modify configuration (get, set, list)')
    .action(handleConfig);

  // Projects command
  program
    .command('projects [action] [name]')
    .description('Manage projects (list, add, switch, remove)')
    .action(handleProjects);

  // Logs command
  program
    .command('logs [taskId]')
    .description('View task logs')
    .option('-f, --follow', 'Follow log output')
    .action(handleLogs);

  // Cache command
  program
    .command('cache <action>')
    .description('Manage cache (clear, stats)')
    .action(handleCache);

  // Default action (no command = interactive mode)
  program
    .action(() => {
      if (isFirstRun()) {
        console.log('Welcome to Timmy! Running first-time setup...\n');
        runInitWizard();
      } else {
        startPolling({ verbose: false });
      }
    });

  program.parse();
}

// Placeholder implementations
async function handleLogs(taskId?: string, options?: { follow?: boolean }): Promise<void> {
  console.log('Logs command - TODO');
}

async function handleCache(action: string): Promise<void> {
  console.log(`Cache ${action} - TODO`);
}
```

### 6.7 `scripts/postinstall.ts`

```typescript
#!/usr/bin/env node
/**
 * Postinstall script
 * Runs after npm install to set up user directories
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

const APP_NAME = 'timmy';
const configDir = process.env.XDG_CONFIG_HOME
  ? path.join(process.env.XDG_CONFIG_HOME, APP_NAME)
  : path.join(os.homedir(), `.${APP_NAME}`);

const dataDir = path.join(configDir, 'data');

const directories = [
  configDir,
  dataDir,
  path.join(dataDir, 'cache'),
  path.join(dataDir, 'state'),
  path.join(dataDir, 'tracking'),
  path.join(dataDir, 'discord'),
  path.join(dataDir, 'logs'),
];

try {
  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Copy template data files if they don't exist
  const templateDir = path.join(__dirname, '..', 'templates', 'data');
  if (fs.existsSync(templateDir)) {
    copyTemplates(templateDir, dataDir);
  }

  console.log(`✓ Timmy directories created at ${configDir}`);
  console.log('  Run `timmy init` to configure.');
} catch (error) {
  // Silent fail - user can run `timmy init` manually
}

function copyTemplates(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyTemplates(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
```

---

## 7. Configuration Architecture

### Configuration Discovery Order

```
1. Environment variables (highest priority)
   ↓
2. ~/.timmy/.env
   ↓
3. ./env (current working directory)
   ↓
4. Default values (lowest priority)
```

### Project Configuration Discovery

```
1. ~/.timmy/workspace.json → active project name
   ↓
2. ~/.timmy/projects.json → project details
   ↓
3. Fallback to .env values
```

### Directory Structure Explained

```
~/.timmy/                       # XDG_CONFIG_HOME/timmy or ~/.timmy
├── .env                        # API keys and credentials
├── workspace.json              # { "active": "project-name" }
├── projects.json               # Project configurations
├── config.json                 # (optional) Additional settings
└── data/                       # XDG_DATA_HOME/timmy or ~/.timmy/data
    ├── cache/
    │   ├── processed-tasks.json
    │   └── processed-comments.json
    ├── state/
    │   ├── task-queue.json
    │   └── pipeline-state.json
    ├── tracking/
    │   ├── pr-tracking.json
    │   └── review-tracking.json
    ├── discord/
    │   └── processed-messages.json
    └── logs/
        └── timmy.log
```

### Environment Variable Overrides

```bash
# Override config directory
export TIMMY_CONFIG_DIR=/custom/path

# Override data directory
export TIMMY_DATA_DIR=/custom/data/path

# Override individual settings
export TIMMY_VERBOSE=true
export TIMMY_POLL_INTERVAL=30000
```

---

## 8. CLI Command Structure

### Command Hierarchy

```
timmy
├── init                        # Setup wizard
├── start                       # Start polling
│   ├── --verbose, -v           # Enable verbose logging
│   └── --daemon, -d            # Run in background
├── stop                        # Stop polling (if daemon)
├── status, s                   # Show status
├── config                      # Configuration management
│   ├── list                    # Show all config
│   ├── get <key>               # Get config value
│   └── set <key> <value>       # Set config value
├── projects                    # Project management
│   ├── list                    # List all projects
│   ├── add                     # Add new project (wizard)
│   ├── switch <name>           # Switch active project
│   └── remove <name>           # Remove project
├── logs [taskId]               # View logs
│   └── --follow, -f            # Follow log output
├── cache                       # Cache management
│   ├── clear                   # Clear all cache
│   └── stats                   # Show cache statistics
├── --version, -V               # Show version
└── --help, -h                  # Show help
```

### Usage Examples

```bash
# First-time setup
npm install -g timmy-cli
timmy init

# Daily usage
timmy start                     # Start interactive mode
timmy start -v                  # Start with verbose logging
timmy start -d                  # Start as daemon

# Status checks
timmy status                    # Show current status
timmy logs                      # View recent logs
timmy logs abc123               # View logs for specific task

# Configuration
timmy config list               # Show all config
timmy config get POLL_INTERVAL  # Get specific value
timmy config set VERBOSE true   # Set value

# Project management
timmy projects list             # List all projects
timmy projects switch my-app    # Switch to my-app
timmy projects add              # Add new project (wizard)

# Maintenance
timmy cache clear               # Clear processed tasks cache
timmy cache stats               # Show cache statistics
```

---

## 9. Testing Strategy

### Test Categories

#### 9.1 Unit Tests (Existing)
- Continue using existing Jest tests
- Add tests for new CLI commands
- Mock file system operations

#### 9.2 Integration Tests (New)
```typescript
// tests/integration/cli.test.ts
describe('CLI Integration', () => {
  it('should show help', async () => {
    const { stdout } = await exec('node dist/timmy.js --help');
    expect(stdout).toContain('Autonomous task automation');
  });

  it('should show version', async () => {
    const { stdout } = await exec('node dist/timmy.js --version');
    expect(stdout).toMatch(/\d+\.\d+\.\d+/);
  });
});
```

#### 9.3 Installation Tests
```bash
# Test global installation
npm pack
npm install -g ./timmy-cli-2.0.0.tgz
timmy --version
timmy --help

# Test in clean environment
docker run -it node:18 bash
npm install -g timmy-cli
timmy init
```

### Test Checklist

- [ ] `timmy --version` works
- [ ] `timmy --help` works
- [ ] `timmy init` creates config in `~/.timmy/`
- [ ] `timmy start` works after init
- [ ] `timmy status` shows correct info
- [ ] `timmy config list` shows config
- [ ] `timmy projects list` shows projects
- [ ] Global install works
- [ ] Local development still works
- [ ] Existing tests pass

---

## 10. Publishing Checklist

### Pre-Publish

- [ ] Update version in `package.json`
- [ ] Update CHANGELOG.md
- [ ] Run full test suite: `npm test`
- [ ] Build: `npm run build`
- [ ] Test local install: `npm pack && npm install -g ./timmy-cli-*.tgz`
- [ ] Verify all commands work
- [ ] Check `.npmignore` excludes correct files
- [ ] Verify `files` field in package.json
- [ ] Check package size: `npm pack --dry-run`

### Publishing

```bash
# Login to npm
npm login

# Publish (first time)
npm publish

# Publish update
npm version patch  # or minor, major
npm publish

# Publish with tag (beta, etc)
npm publish --tag beta
```

### Post-Publish

- [ ] Verify installation: `npm install -g timmy-cli`
- [ ] Test on fresh machine
- [ ] Update documentation
- [ ] Create GitHub release
- [ ] Announce release

### Package Verification

```bash
# Check what will be published
npm pack --dry-run

# Expected output:
# package.json
# README.md
# LICENSE
# dist/
# templates/data/
```

---

## 11. Migration Guide for Existing Users

### For Users with Cloned Repository

```bash
# 1. Backup existing configuration
cp .env ~/.timmy/.env
cp workspace.json ~/.timmy/workspace.json
cp projects.json ~/.timmy/projects.json

# 2. Backup data (optional)
cp -r data ~/.timmy/data

# 3. Install global package
npm install -g timmy-cli

# 4. Verify configuration
timmy status

# 5. (Optional) Remove old clone
# rm -rf ~/path/to/timmy
```

### Configuration Migration

**Old location** → **New location**
```
./env            → ~/.timmy/.env
./workspace.json  → ~/.timmy/workspace.json
./projects.json   → ~/.timmy/projects.json
./data/           → ~/.timmy/data/
```

### Breaking Changes

1. **Config location changed**: Config now in `~/.timmy/` instead of repo root
2. **CLI arguments**: New command structure with subcommands
3. **Environment variables**: Some may be renamed (document changes)

### Compatibility Mode (Optional)

For users who want to keep using local config:

```bash
# Set environment variable to use local config
export TIMMY_CONFIG_DIR=./

# Or in .bashrc/.zshrc
alias timmy-local='TIMMY_CONFIG_DIR=./ timmy'
```

---

## Appendix A: Dependencies to Add

```json
{
  "dependencies": {
    "commander": "^12.0.0",
    "inquirer": "^9.2.0"
  }
}
```

**Why these packages:**
- `commander` - Industry standard CLI framework (30M+ weekly downloads)
- `inquirer` - Interactive prompts (30M+ weekly downloads)

---

## Appendix B: File Changes Summary

| Action | File | Description |
|--------|------|-------------|
| Modify | `package.json` | Add bin, files, engines, postinstall |
| Modify | `src/shared/config/index.ts` | Use XDG paths |
| Modify | `timmy.ts` | Add CLI routing |
| Create | `.npmignore` | Exclude dev files |
| Create | `src/shared/utils/paths.util.ts` | XDG path utilities |
| Create | `src/cli/index.ts` | CLI entry point |
| Create | `src/cli/commands/init.ts` | Init wizard |
| Create | `src/cli/commands/start.ts` | Start command |
| Create | `src/cli/commands/status.ts` | Status command |
| Create | `src/cli/commands/config.ts` | Config command |
| Create | `src/cli/commands/projects.ts` | Projects command |
| Create | `scripts/postinstall.ts` | Post-install hook |
| Create | `CHANGELOG.md` | Version history |
| Create | `LICENSE` | MIT license |
| Update | `README.md` | Installation instructions |

---

## Appendix C: Estimated Timeline

| Phase | Tasks | Estimated Hours |
|-------|-------|-----------------|
| Phase 1 | Core Infrastructure | 4-5 hours |
| Phase 2 | CLI Framework | 3-4 hours |
| Phase 3 | Setup Wizard | 2-3 hours |
| Phase 4 | Polish & Publish | 2-3 hours |
| **Total** | | **11-15 hours** |

---

**Document maintained by:** Timmy Development Team
**Last updated:** 2025-12-05
