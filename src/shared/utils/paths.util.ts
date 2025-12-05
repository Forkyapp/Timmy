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
