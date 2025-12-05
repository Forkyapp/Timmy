# Plan B: CLI Framework

**Agent Task:** Create command-line interface with subcommands and setup wizard
**Branch:** `feature/npm-cli`
**Estimated Time:** 4-5 hours

---

## Overview

Your job is to create a proper CLI framework using `commander` and an interactive setup wizard using `inquirer`. This enables users to run commands like `timmy init`, `timmy start`, `timmy status`.

**You are NOT modifying:**
- Path/config utilities (another agent handles this)
- Data storage locations
- Core business logic

**You ARE creating:**
- CLI command structure with commander
- Setup wizard with inquirer
- New CLI entry point

---

## Task 1: Add Dependencies

**Modify file:** `package.json`

Add these dependencies:

```json
{
  "dependencies": {
    "commander": "^12.1.0",
    "inquirer": "^9.2.23"
  },
  "devDependencies": {
    "@types/inquirer": "^9.0.7"
  }
}
```

Then run: `npm install`

---

## Task 2: Create CLI Directory Structure

Create the following directory structure:

```
src/cli/
├── index.ts              # Main CLI entry point
├── commands/
│   ├── init.ts           # Setup wizard
│   ├── start.ts          # Start polling
│   ├── status.ts         # Show status
│   ├── config.ts         # Config management
│   └── projects.ts       # Project management
└── utils/
    └── prompts.ts        # Shared prompt helpers
```

---

## Task 3: Create Main CLI Entry Point

**Create file:** `src/cli/index.ts`

```typescript
/**
 * CLI Entry Point
 * Handles command-line argument parsing and routing
 */

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { startCommand } from './commands/start';
import { statusCommand } from './commands/status';
import { configCommand } from './commands/config';
import { projectsCommand } from './commands/projects';

// Read version from package.json at runtime
const pkg = require('../../package.json');

export function createCLI(): Command {
  const program = new Command();

  program
    .name('timmy')
    .description('Autonomous task automation: ClickUp to GitHub via AI')
    .version(pkg.version);

  // Register commands
  program.addCommand(initCommand());
  program.addCommand(startCommand());
  program.addCommand(statusCommand());
  program.addCommand(configCommand());
  program.addCommand(projectsCommand());

  // Default action (no subcommand) - start interactive mode
  program
    .action(async () => {
      // Import dynamically to avoid circular deps
      const { runDefaultAction } = await import('./commands/start');
      await runDefaultAction();
    });

  return program;
}

export async function runCLI(): Promise<void> {
  const program = createCLI();
  await program.parseAsync(process.argv);
}
```

---

## Task 4: Create Init Command (Setup Wizard)

**Create file:** `src/cli/commands/init.ts`

```typescript
/**
 * Init command - First-time setup wizard
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { timmy, colors } from '@/shared/ui';

// Note: These path functions will be provided by Plan A
// For now, define simple versions that will be replaced during merge
function getConfigDir(): string {
  return process.env.TIMMY_CONFIG_DIR ||
    (process.env.XDG_CONFIG_HOME
      ? path.join(process.env.XDG_CONFIG_HOME, 'timmy')
      : path.join(os.homedir(), '.timmy'));
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

interface SetupAnswers {
  clickupApiKey: string;
  clickupWorkspaceId: string;
  clickupBotUserId: string;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubRepoPath: string;
  githubBaseBranch: string;
  enableDiscord: boolean;
  discordToken?: string;
  discordGuildId?: string;
}

export function initCommand(): Command {
  return new Command('init')
    .description('Run the setup wizard to configure Timmy')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(runInitWizard);
}

export async function runInitWizard(options: { force?: boolean } = {}): Promise<void> {
  const configDir = getConfigDir();

  console.log(timmy.section('Timmy Setup Wizard'));
  console.log(`\nConfiguration will be saved to: ${colors.cyan}${configDir}${colors.reset}\n`);

  // Ensure config directory exists
  ensureDir(configDir);
  ensureDir(path.join(configDir, 'data'));
  ensureDir(path.join(configDir, 'data', 'cache'));
  ensureDir(path.join(configDir, 'data', 'state'));
  ensureDir(path.join(configDir, 'data', 'tracking'));

  // Check if config already exists
  const envPath = path.join(configDir, '.env');
  if (fs.existsSync(envPath) && !options.force) {
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

  console.log('Please provide the following information:\n');

  // Collect configuration
  const answers = await inquirer.prompt<SetupAnswers>([
    // === ClickUp Configuration ===
    {
      type: 'input',
      name: 'clickupApiKey',
      message: 'ClickUp API Key:',
      validate: (input: string) => input.length > 0 || 'API key is required',
    },
    {
      type: 'input',
      name: 'clickupWorkspaceId',
      message: 'ClickUp Workspace ID:',
      validate: (input: string) => input.length > 0 || 'Workspace ID is required',
    },
    {
      type: 'input',
      name: 'clickupBotUserId',
      message: 'ClickUp Bot User ID (your user ID):',
      validate: (input: string) => input.length > 0 || 'User ID is required',
    },

    // === GitHub Configuration ===
    {
      type: 'input',
      name: 'githubToken',
      message: 'GitHub Personal Access Token:',
      validate: (input: string) => input.length > 0 || 'Token is required',
    },
    {
      type: 'input',
      name: 'githubOwner',
      message: 'GitHub Owner (username or org):',
      validate: (input: string) => input.length > 0 || 'Owner is required',
    },
    {
      type: 'input',
      name: 'githubRepo',
      message: 'GitHub Repository name:',
      validate: (input: string) => input.length > 0 || 'Repo name is required',
    },
    {
      type: 'input',
      name: 'githubRepoPath',
      message: 'Local path to repository:',
      validate: (input: string) => {
        if (!input) return 'Path is required';
        const expanded = input.replace(/^~/, os.homedir());
        if (!fs.existsSync(expanded)) {
          return `Path does not exist: ${expanded}`;
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'githubBaseBranch',
      message: 'Base branch:',
      default: 'main',
    },

    // === Discord Configuration (optional) ===
    {
      type: 'confirm',
      name: 'enableDiscord',
      message: 'Enable Discord integration?',
      default: false,
    },
    {
      type: 'input',
      name: 'discordToken',
      message: 'Discord Bot Token:',
      when: (answers: SetupAnswers) => answers.enableDiscord,
    },
    {
      type: 'input',
      name: 'discordGuildId',
      message: 'Discord Guild (Server) ID:',
      when: (answers: SetupAnswers) => answers.enableDiscord,
    },
  ]);

  // Generate and save .env file
  const envContent = generateEnvFile(answers);
  fs.writeFileSync(envPath, envContent);

  // Generate and save projects.json
  const projectsPath = path.join(configDir, 'projects.json');
  const projectsContent = generateProjectsFile(answers);
  fs.writeFileSync(projectsPath, JSON.stringify(projectsContent, null, 2));

  // Generate and save workspace.json
  const workspacePath = path.join(configDir, 'workspace.json');
  const workspaceContent = { active: 'default', comment: 'Active project name' };
  fs.writeFileSync(workspacePath, JSON.stringify(workspaceContent, null, 2));

  // Create empty data files
  createDataFiles(configDir);

  console.log('\n' + timmy.success('Configuration saved successfully!'));
  console.log('\n' + colors.bright + 'Next steps:' + colors.reset);
  console.log(`  ${colors.cyan}timmy start${colors.reset}  - Start the automation bot`);
  console.log(`  ${colors.cyan}timmy status${colors.reset} - Check current status`);
  console.log(`  ${colors.cyan}timmy${colors.reset}        - Interactive mode\n`);
}

function generateEnvFile(answers: SetupAnswers): string {
  const repoPath = answers.githubRepoPath.replace(/^~/, os.homedir());

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
GITHUB_REPO_PATH=${repoPath}
GITHUB_BASE_BRANCH=${answers.githubBaseBranch}

# Discord Configuration
DISCORD_ENABLED=${answers.enableDiscord}
${answers.discordToken ? `DISCORD_BOT_TOKEN=${answers.discordToken}` : '# DISCORD_BOT_TOKEN='}
${answers.discordGuildId ? `DISCORD_GUILD_ID=${answers.discordGuildId}` : '# DISCORD_GUILD_ID='}

# System Configuration
POLL_INTERVAL_MS=60000
VERBOSE=false

# Optional: OpenAI for RAG features
# OPENAI_API_KEY=

# Optional: OpenRouter for additional AI models
# OPENROUTER_API_KEY=
`;
}

function generateProjectsFile(answers: SetupAnswers): object {
  const repoPath = answers.githubRepoPath.replace(/^~/, os.homedir());

  return {
    projects: {
      default: {
        name: answers.githubRepo,
        description: `Default project: ${answers.githubRepo}`,
        clickup: {
          workspaceId: answers.clickupWorkspaceId,
        },
        github: {
          owner: answers.githubOwner,
          repo: answers.githubRepo,
          path: repoPath,
          baseBranch: answers.githubBaseBranch,
        },
      },
    },
  };
}

function createDataFiles(configDir: string): void {
  const dataFiles = [
    { path: 'data/cache/processed-tasks.json', content: '{}' },
    { path: 'data/cache/processed-comments.json', content: '[]' },
    { path: 'data/state/task-queue.json', content: '{"pending":[],"completed":[]}' },
    { path: 'data/state/pipeline-state.json', content: '{}' },
    { path: 'data/tracking/pr-tracking.json', content: '{}' },
    { path: 'data/tracking/review-tracking.json', content: '{}' },
  ];

  for (const file of dataFiles) {
    const filePath = path.join(configDir, file.path);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, file.content);
    }
  }
}
```

---

## Task 5: Create Start Command

**Create file:** `src/cli/commands/start.ts`

```typescript
/**
 * Start command - Begin polling loop
 */

import { Command } from 'commander';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { timmy, colors } from '@/shared/ui';

interface StartOptions {
  verbose?: boolean;
  daemon?: boolean;
}

// Simple config dir check (will be replaced with paths.util during merge)
function getConfigDir(): string {
  return process.env.TIMMY_CONFIG_DIR ||
    (process.env.XDG_CONFIG_HOME
      ? path.join(process.env.XDG_CONFIG_HOME, 'timmy')
      : path.join(os.homedir(), '.timmy'));
}

function isConfigured(): boolean {
  const envPath = path.join(getConfigDir(), '.env');
  const localEnv = path.join(process.cwd(), '.env');
  return fs.existsSync(envPath) || fs.existsSync(localEnv);
}

export function startCommand(): Command {
  return new Command('start')
    .description('Start the Timmy polling loop')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-d, --daemon', 'Run in daemon/background mode')
    .action(runStart);
}

export async function runStart(options: StartOptions = {}): Promise<void> {
  // Check if configured
  if (!isConfigured()) {
    console.log(timmy.error('Timmy is not configured.'));
    console.log(`Run ${colors.cyan}timmy init${colors.reset} to set up.\n`);
    process.exit(1);
  }

  console.log(timmy.section('Starting Timmy'));

  if (options.verbose) {
    console.log('Verbose mode: enabled');
    process.env.VERBOSE = 'true';
  }

  if (options.daemon) {
    console.log('Daemon mode: enabled');
    console.log(timmy.info('Running in background. Logs will be written to ~/.timmy/data/logs/'));
    // TODO: Implement proper daemonization
  }

  console.log('');

  // Import and run the main application
  // This dynamically imports to ensure config is loaded after CLI parsing
  try {
    const { startMainLoop } = await import('../../main-loop');
    await startMainLoop(options);
  } catch (error) {
    // Fallback: run the existing timmy logic
    const mainModule = await import('../../../timmy');
    // The main module auto-starts when imported
  }
}

/**
 * Default action when no subcommand is provided
 * Runs interactive mode
 */
export async function runDefaultAction(): Promise<void> {
  if (!isConfigured()) {
    console.log('Welcome to Timmy! Let\'s get you set up.\n');
    const { runInitWizard } = await import('./init');
    await runInitWizard();
    return;
  }

  // Start in interactive mode (not daemon)
  await runStart({ verbose: false, daemon: false });
}
```

---

## Task 6: Create Status Command

**Create file:** `src/cli/commands/status.ts`

```typescript
/**
 * Status command - Show current system status
 */

import { Command } from 'commander';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { timmy, colors } from '@/shared/ui';

// Simple config dir (will use paths.util after merge)
function getConfigDir(): string {
  return process.env.TIMMY_CONFIG_DIR ||
    (process.env.XDG_CONFIG_HOME
      ? path.join(process.env.XDG_CONFIG_HOME, 'timmy')
      : path.join(os.homedir(), '.timmy'));
}

export function statusCommand(): Command {
  return new Command('status')
    .alias('s')
    .description('Show current Timmy status')
    .action(runStatus);
}

export async function runStatus(): Promise<void> {
  const configDir = getConfigDir();
  const dataDir = path.join(configDir, 'data');

  console.log(timmy.section('Timmy Status'));

  // === Configuration ===
  console.log('\n' + colors.bright + 'Configuration:' + colors.reset);
  console.log(`  Config directory: ${configDir}`);
  console.log(`  Data directory: ${dataDir}`);

  // Check if configured
  const envPath = path.join(configDir, '.env');
  const localEnvPath = path.join(process.cwd(), '.env');
  const isGlobalConfig = fs.existsSync(envPath);
  const isLocalConfig = fs.existsSync(localEnvPath);

  if (isGlobalConfig) {
    console.log(`  Config source: ${colors.green}~/.timmy/.env${colors.reset}`);
  } else if (isLocalConfig) {
    console.log(`  Config source: ${colors.yellow}./env (local dev)${colors.reset}`);
  } else {
    console.log(`  Config source: ${colors.red}Not configured${colors.reset}`);
    console.log(`\n  Run ${colors.cyan}timmy init${colors.reset} to configure.`);
    return;
  }

  // Load config to check connections
  try {
    // Dynamic import to get current config
    const config = (await import('@/shared/config')).default;

    // === Connections ===
    console.log('\n' + colors.bright + 'Connections:' + colors.reset);
    console.log(`  ClickUp: ${config.clickup.apiKey ? colors.green + 'Configured' + colors.reset : colors.red + 'Not configured' + colors.reset}`);
    console.log(`  GitHub: ${config.github.token ? colors.green + 'Configured' + colors.reset : colors.red + 'Not configured' + colors.reset}`);
    console.log(`  Discord: ${config.discord.enabled ? colors.green + 'Enabled' + colors.reset : colors.yellow + 'Disabled' + colors.reset}`);

    // === Active Project ===
    console.log('\n' + colors.bright + 'Active Project:' + colors.reset);
    console.log(`  Repository: ${config.github.owner}/${config.github.repo}`);
    console.log(`  Local path: ${config.github.repoPath}`);
    console.log(`  Base branch: main`);

    // === Pipeline Status ===
    console.log('\n' + colors.bright + 'Pipeline:' + colors.reset);
    const pipelineFile = path.join(dataDir, 'state', 'pipeline-state.json');
    if (fs.existsSync(pipelineFile)) {
      try {
        const pipelines = JSON.parse(fs.readFileSync(pipelineFile, 'utf8'));
        const entries = Object.values(pipelines) as Array<{ status: string }>;
        const active = entries.filter(p => p.status === 'in_progress').length;
        const completed = entries.filter(p => p.status === 'completed').length;
        const failed = entries.filter(p => p.status === 'failed').length;

        console.log(`  Active tasks: ${active}`);
        console.log(`  Completed: ${completed}`);
        console.log(`  Failed: ${failed}`);
      } catch {
        console.log(`  ${colors.yellow}Unable to parse pipeline state${colors.reset}`);
      }
    } else {
      console.log(`  No pipeline data yet`);
    }

    // === Cache Status ===
    console.log('\n' + colors.bright + 'Cache:' + colors.reset);
    const cacheFile = path.join(dataDir, 'cache', 'processed-tasks.json');
    if (fs.existsSync(cacheFile)) {
      try {
        const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        const count = Object.keys(cache).length;
        console.log(`  Processed tasks: ${count}`);
      } catch {
        console.log(`  ${colors.yellow}Unable to read cache${colors.reset}`);
      }
    } else {
      console.log(`  No cached tasks`);
    }

  } catch (error) {
    console.log(`\n  ${colors.red}Error loading configuration${colors.reset}`);
    console.log(`  ${(error as Error).message}`);
  }

  console.log('');
}
```

---

## Task 7: Create Config Command

**Create file:** `src/cli/commands/config.ts`

```typescript
/**
 * Config command - View and modify configuration
 */

import { Command } from 'commander';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { timmy, colors } from '@/shared/ui';

function getConfigDir(): string {
  return process.env.TIMMY_CONFIG_DIR ||
    (process.env.XDG_CONFIG_HOME
      ? path.join(process.env.XDG_CONFIG_HOME, 'timmy')
      : path.join(os.homedir(), '.timmy'));
}

export function configCommand(): Command {
  const cmd = new Command('config')
    .description('View or modify configuration');

  cmd
    .command('list')
    .alias('ls')
    .description('Show all configuration values')
    .action(listConfig);

  cmd
    .command('get <key>')
    .description('Get a configuration value')
    .action(getConfig);

  cmd
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action(setConfig);

  cmd
    .command('path')
    .description('Show configuration file path')
    .action(showPath);

  // Default action for just "timmy config"
  cmd.action(listConfig);

  return cmd;
}

async function listConfig(): Promise<void> {
  console.log(timmy.section('Configuration'));

  const configDir = getConfigDir();
  const envPath = path.join(configDir, '.env');

  if (!fs.existsSync(envPath)) {
    console.log(`\n${colors.yellow}No configuration found.${colors.reset}`);
    console.log(`Run ${colors.cyan}timmy init${colors.reset} to configure.\n`);
    return;
  }

  console.log(`\nConfig file: ${envPath}\n`);

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.startsWith('#')) continue;

    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');

    // Mask sensitive values
    const maskedValue = maskSensitive(key, value);
    console.log(`  ${colors.cyan}${key}${colors.reset}=${maskedValue}`);
  }

  console.log('');
}

async function getConfig(key: string): Promise<void> {
  const configDir = getConfigDir();
  const envPath = path.join(configDir, '.env');

  if (!fs.existsSync(envPath)) {
    console.log(`${colors.red}No configuration found.${colors.reset}`);
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.startsWith(`${key}=`)) {
      const value = line.substring(key.length + 1);
      const masked = maskSensitive(key, value);
      console.log(masked);
      return;
    }
  }

  console.log(`${colors.yellow}Key not found: ${key}${colors.reset}`);
}

async function setConfig(key: string, value: string): Promise<void> {
  const configDir = getConfigDir();
  const envPath = path.join(configDir, '.env');

  if (!fs.existsSync(envPath)) {
    console.log(`${colors.red}No configuration found.${colors.reset}`);
    console.log(`Run ${colors.cyan}timmy init${colors.reset} first.\n`);
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  let found = false;

  const newLines = lines.map(line => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    // Add new key at the end
    newLines.push(`${key}=${value}`);
  }

  fs.writeFileSync(envPath, newLines.join('\n'));
  console.log(`${colors.green}Updated:${colors.reset} ${key}=${maskSensitive(key, value)}`);
}

async function showPath(): Promise<void> {
  const configDir = getConfigDir();
  console.log(path.join(configDir, '.env'));
}

function maskSensitive(key: string, value: string): string {
  const sensitiveKeys = ['API_KEY', 'TOKEN', 'SECRET', 'PASSWORD'];

  if (sensitiveKeys.some(sk => key.toUpperCase().includes(sk))) {
    if (value.length > 8) {
      return value.substring(0, 4) + '****' + value.substring(value.length - 4);
    }
    return '********';
  }

  return value;
}
```

---

## Task 8: Create Projects Command

**Create file:** `src/cli/commands/projects.ts`

```typescript
/**
 * Projects command - Manage multiple projects
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { timmy, colors } from '@/shared/ui';

function getConfigDir(): string {
  return process.env.TIMMY_CONFIG_DIR ||
    (process.env.XDG_CONFIG_HOME
      ? path.join(process.env.XDG_CONFIG_HOME, 'timmy')
      : path.join(os.homedir(), '.timmy'));
}

interface Project {
  name: string;
  description?: string;
  clickup: { workspaceId: string };
  github: {
    owner: string;
    repo: string;
    path: string;
    baseBranch: string;
  };
}

interface ProjectsFile {
  projects: Record<string, Project>;
}

interface WorkspaceFile {
  active: string;
}

export function projectsCommand(): Command {
  const cmd = new Command('projects')
    .description('Manage projects');

  cmd
    .command('list')
    .alias('ls')
    .description('List all projects')
    .action(listProjects);

  cmd
    .command('switch <name>')
    .description('Switch to a different project')
    .action(switchProject);

  cmd
    .command('add')
    .description('Add a new project')
    .action(addProject);

  cmd
    .command('remove <name>')
    .description('Remove a project')
    .action(removeProject);

  cmd
    .command('current')
    .description('Show current project')
    .action(showCurrent);

  // Default action
  cmd.action(listProjects);

  return cmd;
}

function loadProjects(): ProjectsFile {
  const configDir = getConfigDir();
  const projectsPath = path.join(configDir, 'projects.json');

  if (!fs.existsSync(projectsPath)) {
    return { projects: {} };
  }

  return JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
}

function saveProjects(data: ProjectsFile): void {
  const configDir = getConfigDir();
  const projectsPath = path.join(configDir, 'projects.json');
  fs.writeFileSync(projectsPath, JSON.stringify(data, null, 2));
}

function loadWorkspace(): WorkspaceFile {
  const configDir = getConfigDir();
  const workspacePath = path.join(configDir, 'workspace.json');

  if (!fs.existsSync(workspacePath)) {
    return { active: 'default' };
  }

  return JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
}

function saveWorkspace(data: WorkspaceFile): void {
  const configDir = getConfigDir();
  const workspacePath = path.join(configDir, 'workspace.json');
  fs.writeFileSync(workspacePath, JSON.stringify(data, null, 2));
}

async function listProjects(): Promise<void> {
  console.log(timmy.section('Projects'));

  const projectsData = loadProjects();
  const workspace = loadWorkspace();
  const projects = Object.entries(projectsData.projects);

  if (projects.length === 0) {
    console.log(`\n${colors.yellow}No projects configured.${colors.reset}`);
    console.log(`Run ${colors.cyan}timmy projects add${colors.reset} to add one.\n`);
    return;
  }

  console.log('');
  for (const [key, project] of projects) {
    const isActive = key === workspace.active;
    const marker = isActive ? colors.green + ' (active)' + colors.reset : '';

    console.log(`  ${colors.cyan}${key}${colors.reset}${marker}`);
    console.log(`    Repository: ${project.github.owner}/${project.github.repo}`);
    console.log(`    Path: ${project.github.path}`);
    console.log('');
  }
}

async function switchProject(name: string): Promise<void> {
  const projectsData = loadProjects();

  if (!projectsData.projects[name]) {
    console.log(`${colors.red}Project not found: ${name}${colors.reset}`);
    console.log(`\nAvailable projects:`);
    Object.keys(projectsData.projects).forEach(p => console.log(`  - ${p}`));
    return;
  }

  const workspace = loadWorkspace();
  workspace.active = name;
  saveWorkspace(workspace);

  console.log(`${colors.green}Switched to project:${colors.reset} ${name}`);
}

async function addProject(): Promise<void> {
  console.log(timmy.section('Add New Project'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'key',
      message: 'Project key (short identifier):',
      validate: (input: string) => {
        if (!input) return 'Key is required';
        if (!/^[a-z0-9-]+$/.test(input)) return 'Key must be lowercase alphanumeric with hyphens';
        return true;
      },
    },
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      validate: (input: string) => input.length > 0 || 'Name is required',
    },
    {
      type: 'input',
      name: 'workspaceId',
      message: 'ClickUp Workspace ID:',
      validate: (input: string) => input.length > 0 || 'Workspace ID is required',
    },
    {
      type: 'input',
      name: 'githubOwner',
      message: 'GitHub owner:',
      validate: (input: string) => input.length > 0 || 'Owner is required',
    },
    {
      type: 'input',
      name: 'githubRepo',
      message: 'GitHub repo:',
      validate: (input: string) => input.length > 0 || 'Repo is required',
    },
    {
      type: 'input',
      name: 'githubPath',
      message: 'Local path to repo:',
      validate: (input: string) => {
        if (!input) return 'Path is required';
        const expanded = input.replace(/^~/, os.homedir());
        if (!fs.existsSync(expanded)) return 'Path does not exist';
        return true;
      },
    },
    {
      type: 'input',
      name: 'baseBranch',
      message: 'Base branch:',
      default: 'main',
    },
  ]);

  const projectsData = loadProjects();
  projectsData.projects[answers.key] = {
    name: answers.name,
    clickup: { workspaceId: answers.workspaceId },
    github: {
      owner: answers.githubOwner,
      repo: answers.githubRepo,
      path: answers.githubPath.replace(/^~/, os.homedir()),
      baseBranch: answers.baseBranch,
    },
  };

  saveProjects(projectsData);
  console.log(`\n${colors.green}Project added:${colors.reset} ${answers.key}`);

  const { switchNow } = await inquirer.prompt([{
    type: 'confirm',
    name: 'switchNow',
    message: 'Switch to this project now?',
    default: true,
  }]);

  if (switchNow) {
    await switchProject(answers.key);
  }
}

async function removeProject(name: string): Promise<void> {
  const projectsData = loadProjects();

  if (!projectsData.projects[name]) {
    console.log(`${colors.red}Project not found: ${name}${colors.reset}`);
    return;
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Remove project "${name}"?`,
    default: false,
  }]);

  if (!confirm) {
    console.log('Cancelled.');
    return;
  }

  delete projectsData.projects[name];
  saveProjects(projectsData);

  // If active project was removed, switch to first available
  const workspace = loadWorkspace();
  if (workspace.active === name) {
    const remaining = Object.keys(projectsData.projects);
    if (remaining.length > 0) {
      workspace.active = remaining[0];
      saveWorkspace(workspace);
      console.log(`Switched to: ${remaining[0]}`);
    }
  }

  console.log(`${colors.green}Project removed:${colors.reset} ${name}`);
}

async function showCurrent(): Promise<void> {
  const workspace = loadWorkspace();
  const projectsData = loadProjects();
  const project = projectsData.projects[workspace.active];

  if (!project) {
    console.log(`${colors.yellow}No active project${colors.reset}`);
    return;
  }

  console.log(`${colors.cyan}${workspace.active}${colors.reset}`);
  console.log(`  ${project.github.owner}/${project.github.repo}`);
}
```

---

## Task 9: Create CLI Index Export

**Create file:** `src/cli/commands/index.ts`

```typescript
export { initCommand, runInitWizard } from './init';
export { startCommand, runStart, runDefaultAction } from './start';
export { statusCommand, runStatus } from './status';
export { configCommand } from './config';
export { projectsCommand } from './projects';
```

---

## Verification Checklist

Before committing, verify:

- [ ] Dependencies installed: `npm install commander inquirer @types/inquirer`
- [ ] All command files created in `src/cli/commands/`
- [ ] `src/cli/index.ts` exports `createCLI` and `runCLI`
- [ ] TypeScript compiles: `npm run type-check`
- [ ] Commands work:
  - `npx ts-node -r tsconfig-paths/register src/cli/index.ts --help`
  - `npx ts-node -r tsconfig-paths/register src/cli/index.ts init --help`
  - `npx ts-node -r tsconfig-paths/register src/cli/index.ts status`

---

## Commit Message

```
feat: add CLI framework with commander and setup wizard

- Add commander for CLI argument parsing
- Add inquirer for interactive prompts
- Create init command with setup wizard
- Create start, status, config, projects commands
- Support subcommands: timmy init, timmy start, etc.
```

---

## Important Notes

1. **DO NOT** modify path utilities - another agent handles this
2. **DO NOT** modify the main `timmy.ts` entry point yet - handled in merge plan
3. The CLI commands include their own simple path helpers that will be replaced during merge
4. Focus on the CLI structure and user interaction flow
