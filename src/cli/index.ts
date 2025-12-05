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
