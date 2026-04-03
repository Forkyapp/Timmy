/**
 * Supervisor Entry Point
 * Loads configuration, validates the environment, and reports readiness status.
 * This is the foundation — future phases will add decision-making and pipeline control.
 */

import { createLogger } from '@/shared/utils/logger.util';
import { loadSupervisorConfig } from './config';
import { validateEnvironment } from './validators';
import { SupervisorConfigError, SupervisorValidationError } from './errors';
import type { SupervisorConfig, SupervisorStatus, SupervisorStatusReport } from './types';

const logger = createLogger({ prefix: 'supervisor' });

export class Supervisor {
  private config: SupervisorConfig | null = null;
  private status: SupervisorStatus = 'initializing';

  /**
   * Initialize the supervisor: load config and validate environment.
   * Returns a status report describing readiness.
   */
  async initialize(): Promise<SupervisorStatusReport> {
    this.status = 'initializing';

    try {
      // Step 1: Load configuration
      this.config = loadSupervisorConfig();
      logger.info('Configuration loaded', {
        environment: this.config.environment,
        enabledModels: Object.values(this.config.models)
          .filter(m => m.enabled)
          .map(m => m.id),
      });

      // Step 2: Validate environment
      const validation = validateEnvironment(this.config);

      if (!validation.valid) {
        const failed = validation.checks.filter(c => c.required && !c.passed);
        this.status = 'error';

        throw new SupervisorValidationError(
          `Environment validation failed: ${failed.map(c => c.name).join(', ')}`,
          failed,
        );
      }

      this.status = 'ready';
      logger.info('Supervisor ready', {
        passedChecks: validation.checks.filter(c => c.passed).length,
        totalChecks: validation.checks.length,
      });

      return this.buildReport(validation);
    } catch (error) {
      this.status = 'error';

      if (error instanceof SupervisorConfigError || error instanceof SupervisorValidationError) {
        throw error;
      }

      throw new SupervisorConfigError(
        `Supervisor initialization failed: ${(error as Error).message}`,
        { originalError: (error as Error).message },
      );
    }
  }

  /**
   * Get current supervisor status.
   */
  getStatus(): SupervisorStatus {
    return this.status;
  }

  /**
   * Get loaded configuration (null if not yet initialized).
   */
  getConfig(): SupervisorConfig | null {
    return this.config;
  }

  private buildReport(validation: { valid: boolean; checks: readonly import('./types').ValidationCheck[] }): SupervisorStatusReport {
    return {
      status: this.status,
      environment: this.config!.environment,
      validation,
      timestamp: new Date().toISOString(),
    };
  }
}
