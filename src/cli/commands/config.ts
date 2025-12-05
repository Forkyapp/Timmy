/**
 * Config command - View and modify configuration
 */

import { Command } from 'commander';
import fs from 'fs';
import { timmy, colors } from '@/shared/ui';
import { getConfigPath } from '@/shared/utils/paths.util';

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

  const envPath = getConfigPath('.env');

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
  const envPath = getConfigPath('.env');

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
  const envPath = getConfigPath('.env');

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
  console.log(getConfigPath('.env'));
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
