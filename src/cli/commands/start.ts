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
    // Try to load main-loop module if it exists (added during merge)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mainLoopPath = '../../main-loop';
    const mainLoop = await import(/* webpackIgnore: true */ mainLoopPath);
    if (mainLoop.startMainLoop) {
      await mainLoop.startMainLoop(options);
      return;
    }
  } catch {
    // main-loop module not yet available, fall through to timmy.ts
  }

  // Fallback: run the existing timmy logic
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const timmyPath = '../../../timmy';
    await import(/* webpackIgnore: true */ timmyPath);
    // The main module auto-starts when imported
  } catch (error) {
    console.log(timmy.error('Failed to start Timmy'));
    console.log(`Error: ${(error as Error).message}`);
    process.exit(1);
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
