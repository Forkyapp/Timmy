/**
 * Environment Validator
 * Validates that the runtime environment has everything the supervisor needs:
 * API keys, CLI tools, and allowed project paths.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import type { SupervisorConfig, ValidationResult, ValidationCheck } from '../types';

/**
 * Check if a CLI tool is available on the system PATH.
 */
function isCliAvailable(cliPath: string): boolean {
  try {
    execSync(`which ${cliPath}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists and is accessible.
 */
function isPathAccessible(dirPath: string): boolean {
  try {
    fs.accessSync(dirPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that a string looks like a non-empty API key (basic format check).
 */
function isNonEmptyKey(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate the full supervisor environment against the loaded config.
 * Checks API keys, CLI availability, and path access.
 */
export function validateEnvironment(config: SupervisorConfig): ValidationResult {
  const checks: ValidationCheck[] = [];

  // --- API Key checks (required) ---
  checks.push({
    name: 'CLICKUP_API_KEY',
    passed: isNonEmptyKey(process.env.CLICKUP_API_KEY),
    message: isNonEmptyKey(process.env.CLICKUP_API_KEY)
      ? 'ClickUp API key is set'
      : 'CLICKUP_API_KEY is missing or empty',
    required: true,
  });

  checks.push({
    name: 'GITHUB_TOKEN',
    passed: isNonEmptyKey(process.env.GITHUB_TOKEN),
    message: isNonEmptyKey(process.env.GITHUB_TOKEN)
      ? 'GitHub token is set'
      : 'GITHUB_TOKEN is missing or empty',
    required: true,
  });

  // --- CLI availability checks ---
  for (const [, model] of Object.entries(config.models)) {
    if (!model.enabled) {
      checks.push({
        name: `CLI:${model.id}`,
        passed: true,
        message: `${model.id} is disabled, skipping CLI check`,
        required: false,
      });
      continue;
    }

    const available = isCliAvailable(model.cliPath);
    checks.push({
      name: `CLI:${model.id}`,
      passed: available,
      message: available
        ? `${model.id} CLI found at "${model.cliPath}"`
        : `${model.id} CLI not found at "${model.cliPath}"`,
      required: true,
    });
  }

  // --- Allowed repo path checks ---
  if (config.safety.allowedRepoPaths.length === 0) {
    checks.push({
      name: 'ALLOWED_PATHS',
      passed: false,
      message: 'No allowed repository paths configured (set SUPERVISOR_ALLOWED_PATHS or GITHUB_REPO_PATH)',
      required: true,
    });
  } else {
    for (const repoPath of config.safety.allowedRepoPaths) {
      const accessible = isPathAccessible(repoPath);
      checks.push({
        name: `PATH:${repoPath}`,
        passed: accessible,
        message: accessible
          ? `Repository path accessible: ${repoPath}`
          : `Repository path not accessible: ${repoPath}`,
        required: true,
      });
    }
  }

  // --- Production-specific checks ---
  if (config.environment === 'production') {
    checks.push({
      name: 'PRODUCTION_LOG_DIR',
      passed: config.logging.enableFileLogging,
      message: config.logging.enableFileLogging
        ? 'File logging enabled for production'
        : 'File logging should be enabled in production (set SUPERVISOR_FILE_LOGGING=true)',
      required: false,
    });
  }

  const valid = checks.filter(c => c.required).every(c => c.passed);

  return { valid, checks };
}
