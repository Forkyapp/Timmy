/**
 * Init command - First-time setup wizard
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { timmy, colors } from '@/shared/ui';
import {
  getConfigDir,
  ensureDirectories,
  getConfigPath,
} from '@/shared/utils/paths.util';

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

  // Ensure all required directories exist
  ensureDirectories();

  // Check if config already exists
  const envPath = getConfigPath('.env');
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
  const projectsPath = getConfigPath('projects.json');
  const projectsContent = generateProjectsFile(answers);
  fs.writeFileSync(projectsPath, JSON.stringify(projectsContent, null, 2));

  // Generate and save workspace.json
  const workspacePath = getConfigPath('workspace.json');
  const workspaceContent = { active: 'default', comment: 'Active project name' };
  fs.writeFileSync(workspacePath, JSON.stringify(workspaceContent, null, 2));

  // Create empty data files
  createDataFiles(getConfigDir());

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
