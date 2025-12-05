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
