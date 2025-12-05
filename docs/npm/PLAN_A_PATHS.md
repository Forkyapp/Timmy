# Plan A: Path Infrastructure

**Agent Task:** Create XDG-compliant path system for user config/data storage
**Branch:** `feature/npm-paths`
**Estimated Time:** 3-4 hours

---

## Overview

Your job is to create a new path utility system that moves all config and data storage from the repository directory to the user's home directory (`~/.timmy/`). This enables the app to work as a globally installed npm package.

**You are NOT modifying:**
- The CLI/entry point (`timmy.ts`)
- Package.json
- Any CLI-related code

**You ARE creating:**
- New path utility module
- Updated config module that uses these paths

---

## Task 1: Create Path Utility Module

**Create file:** `src/shared/utils/paths.util.ts`

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
 * Get all required directories as an array
 */
export function getAllDirectories(): string[] {
  const dataDir = getDataDir();
  return [
    getConfigDir(),
    dataDir,
    path.join(dataDir, 'cache'),
    path.join(dataDir, 'state'),
    path.join(dataDir, 'tracking'),
    path.join(dataDir, 'discord'),
    getLogsDir(),
  ];
}

/**
 * Ensure all required directories exist
 */
export function ensureDirectories(): void {
  const dirs = getAllDirectories();

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
  const envFile = path.join(getConfigDir(), '.env');
  const projectsFile = path.join(getConfigDir(), 'projects.json');

  return !fs.existsSync(envFile) && !fs.existsSync(projectsFile);
}

/**
 * Check if running in development mode (local repo)
 * Returns true if .env exists in current working directory
 */
export function isDevMode(): boolean {
  return fs.existsSync(path.join(process.cwd(), '.env'));
}

/**
 * Get path to a config file (in config directory)
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
 * Find .env file - checks multiple locations
 * Returns the path if found, null otherwise
 */
export function findEnvFile(): string | null {
  const locations = [
    path.join(process.cwd(), '.env'),           // Current directory (dev mode)
    path.join(getConfigDir(), '.env'),          // User config directory
  ];

  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      return loc;
    }
  }

  return null;
}

/**
 * Find projects.json file
 */
export function findProjectsFile(): string | null {
  const locations = [
    path.join(process.cwd(), 'projects.json'),
    path.join(getConfigDir(), 'projects.json'),
  ];

  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      return loc;
    }
  }

  return null;
}

/**
 * Find workspace.json file
 */
export function findWorkspaceFile(): string | null {
  const locations = [
    path.join(process.cwd(), 'workspace.json'),
    path.join(getConfigDir(), 'workspace.json'),
  ];

  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      return loc;
    }
  }

  return null;
}

/**
 * Copy template files to user config directory
 */
export function copyTemplates(templateDir: string): void {
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
  getAllDirectories,
  ensureDirectories,
  isFirstRun,
  isDevMode,
  getConfigPath,
  getDataPath,
  findEnvFile,
  findProjectsFile,
  findWorkspaceFile,
  copyTemplates,
};
```

---

## Task 2: Update Config Module

**Modify file:** `src/shared/config/index.ts`

### Changes Required:

#### 2.1 Add import for paths utility

At the top of the file, add:

```typescript
import fs from 'fs';
import {
  getDataDir,
  findEnvFile,
  ensureDirectories,
  isDevMode,
} from '../utils/paths.util';
```

#### 2.2 Update .env loading logic

Replace the current dotenv.config line:

```typescript
// OLD:
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

// NEW:
const envPath = findEnvFile();
if (envPath) {
  dotenv.config({ path: envPath });
} else if (!isDevMode()) {
  // No .env found and not in dev mode - user needs to run init
  console.warn('Warning: No .env file found. Run `timmy init` to configure.');
}
```

#### 2.3 Update files config section

Replace the hardcoded paths in the `files` section:

```typescript
// OLD:
files: {
  cacheFile: path.join(__dirname, '..', '..', '..', 'data', 'cache', 'processed-tasks.json'),
  queueFile: path.join(__dirname, '..', '..', '..', 'data', 'state', 'task-queue.json'),
  prTrackingFile: path.join(__dirname, '..', '..', '..', 'data', 'tracking', 'pr-tracking.json'),
  pipelineFile: path.join(__dirname, '..', '..', '..', 'data', 'state', 'pipeline-state.json'),
  featuresDir: path.join(__dirname, '..', '..', '..', 'docs', 'features'),
  discordMessagesFile: path.join(__dirname, '..', '..', '..', 'data', 'discord', 'processed-messages.json'),
},

// NEW:
files: {
  cacheFile: path.join(getDataDir(), 'cache', 'processed-tasks.json'),
  queueFile: path.join(getDataDir(), 'state', 'task-queue.json'),
  prTrackingFile: path.join(getDataDir(), 'tracking', 'pr-tracking.json'),
  pipelineFile: path.join(getDataDir(), 'state', 'pipeline-state.json'),
  featuresDir: path.join(getDataDir(), 'features'),
  discordMessagesFile: path.join(getDataDir(), 'discord', 'processed-messages.json'),
},
```

#### 2.4 Export the ensureDirectories function

Add to exports at the bottom:

```typescript
export { ensureDirectories } from '../utils/paths.util';
```

---

## Task 3: Update Workspace Service

**Modify file:** `src/core/workspace/workspace.service.ts`

Update to use the new path utilities for finding `workspace.json` and `projects.json`:

```typescript
import { findWorkspaceFile, findProjectsFile, getConfigPath } from '@/shared/utils/paths.util';

// Update file path resolution to use the new utilities
// Instead of hardcoded paths like:
//   path.join(__dirname, '..', '..', '..', 'workspace.json')
// Use:
//   findWorkspaceFile() || getConfigPath('workspace.json')
```

---

## Task 4: Add Export to Shared Utils Index

**Modify file:** `src/shared/utils/index.ts` (create if doesn't exist)

```typescript
export * from './paths.util';
export * from './logger.util';
export * from './retry.util';
export * from './validation.util';
export * from './verbose.util';
```

---

## Task 5: Create Unit Tests

**Create file:** `src/shared/utils/__tests__/paths.util.test.ts`

```typescript
import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  getConfigDir,
  getDataDir,
  isFirstRun,
  isDevMode,
  findEnvFile,
} from '../paths.util';

describe('paths.util', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getConfigDir', () => {
    it('should return TIMMY_CONFIG_DIR if set', () => {
      process.env.TIMMY_CONFIG_DIR = '/custom/config';
      expect(getConfigDir()).toBe('/custom/config');
    });

    it('should return XDG_CONFIG_HOME/timmy if set', () => {
      delete process.env.TIMMY_CONFIG_DIR;
      process.env.XDG_CONFIG_HOME = '/home/user/.config';
      expect(getConfigDir()).toBe('/home/user/.config/timmy');
    });

    it('should return ~/.timmy by default', () => {
      delete process.env.TIMMY_CONFIG_DIR;
      delete process.env.XDG_CONFIG_HOME;
      expect(getConfigDir()).toBe(path.join(os.homedir(), '.timmy'));
    });
  });

  describe('getDataDir', () => {
    it('should return TIMMY_DATA_DIR if set', () => {
      process.env.TIMMY_DATA_DIR = '/custom/data';
      expect(getDataDir()).toBe('/custom/data');
    });

    it('should return config/data by default', () => {
      delete process.env.TIMMY_DATA_DIR;
      delete process.env.XDG_DATA_HOME;
      const configDir = getConfigDir();
      expect(getDataDir()).toBe(path.join(configDir, 'data'));
    });
  });
});
```

---

## Verification Checklist

Before committing, verify:

- [ ] `src/shared/utils/paths.util.ts` created and exports all functions
- [ ] `src/shared/config/index.ts` uses new path utilities
- [ ] `src/core/workspace/workspace.service.ts` uses new path utilities
- [ ] Unit tests pass: `npm test -- paths.util`
- [ ] TypeScript compiles: `npm run type-check`
- [ ] No hardcoded `__dirname` paths remain for data/config files

---

## Commit Message

```
feat: add XDG-compliant path utilities for npm packaging

- Create paths.util.ts with getConfigDir, getDataDir, etc.
- Support ~/.timmy/ as default config location
- Support environment variable overrides
- Update config to use new path system
- Add unit tests for path utilities
```

---

## Important Notes

1. **DO NOT** modify `timmy.ts` - another agent handles CLI changes
2. **DO NOT** modify `package.json` - handled in merge plan
3. **Keep backward compatibility** - if .env exists in cwd, use it (dev mode)
4. This work enables global npm install but doesn't implement CLI commands
