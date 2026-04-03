/**
 * Supervisor Configuration
 * Loads and validates supervisor-specific configuration from environment variables.
 */

import path from 'path';
import type { SupervisorConfig, SupervisorEnvironment, ModelId, ModelConfig } from '../types';
import { SupervisorConfigError } from '../errors';

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes per model call
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_PIPELINE_TIMEOUT_MS = 1_800_000; // 30 minutes
const DEFAULT_MAX_STAGE_RETRIES = 3;
const DEFAULT_MAX_CONCURRENT_TASKS = 1;

function parseEnvironment(): SupervisorEnvironment {
  const env = process.env.SUPERVISOR_ENV || 'development';
  if (env !== 'development' && env !== 'production') {
    throw new SupervisorConfigError(
      `Invalid SUPERVISOR_ENV: "${env}". Must be "development" or "production".`,
      { value: env }
    );
  }
  return env;
}

function parseModelConfig(id: ModelId, cliEnvVar: string, defaultPath: string): ModelConfig {
  return {
    id,
    cliPath: process.env[cliEnvVar] || defaultPath,
    enabled: process.env[`SUPERVISOR_${id.toUpperCase()}_ENABLED`] !== 'false',
    timeoutMs: parseInt(process.env[`SUPERVISOR_${id.toUpperCase()}_TIMEOUT_MS`] || String(DEFAULT_TIMEOUT_MS)),
    maxRetries: parseInt(process.env[`SUPERVISOR_${id.toUpperCase()}_MAX_RETRIES`] || String(DEFAULT_MAX_RETRIES)),
  };
}

function parseAllowedPaths(): readonly string[] {
  const pathsStr = process.env.SUPERVISOR_ALLOWED_PATHS;
  if (!pathsStr) {
    // Fall back to GITHUB_REPO_PATH if set
    const repoPath = process.env.GITHUB_REPO_PATH;
    return repoPath ? [repoPath] : [];
  }
  return pathsStr.split(',').map(p => p.trim()).filter(Boolean);
}

function parseLogLevel(): 'debug' | 'info' | 'warn' | 'error' {
  const level = process.env.SUPERVISOR_LOG_LEVEL || 'info';
  const valid = ['debug', 'info', 'warn', 'error'] as const;
  if (!valid.includes(level as typeof valid[number])) {
    throw new SupervisorConfigError(
      `Invalid SUPERVISOR_LOG_LEVEL: "${level}". Must be one of: ${valid.join(', ')}`,
      { value: level }
    );
  }
  return level as 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Load supervisor configuration from environment variables.
 * Uses sensible defaults for development; production requires explicit config.
 */
export function loadSupervisorConfig(): SupervisorConfig {
  const environment = parseEnvironment();

  return {
    environment,
    models: {
      claude: parseModelConfig('claude', 'CLAUDE_CLI_PATH', 'claude'),
      gemini: parseModelConfig('gemini', 'GEMINI_CLI_PATH', 'gemini'),
      codex: parseModelConfig('codex', 'CODEX_CLI_PATH', 'codex'),
    },
    safety: {
      maxPipelineTimeoutMs: parseInt(
        process.env.SUPERVISOR_PIPELINE_TIMEOUT_MS || String(DEFAULT_PIPELINE_TIMEOUT_MS)
      ),
      maxStageRetries: parseInt(
        process.env.SUPERVISOR_MAX_STAGE_RETRIES || String(DEFAULT_MAX_STAGE_RETRIES)
      ),
      maxConcurrentTasks: parseInt(
        process.env.SUPERVISOR_MAX_CONCURRENT_TASKS || String(DEFAULT_MAX_CONCURRENT_TASKS)
      ),
      allowedRepoPaths: parseAllowedPaths(),
    },
    logging: {
      level: parseLogLevel(),
      enableFileLogging: process.env.SUPERVISOR_FILE_LOGGING === 'true',
      logDir: process.env.SUPERVISOR_LOG_DIR || path.join(process.cwd(), 'data', 'supervisor', 'logs'),
    },
  };
}
