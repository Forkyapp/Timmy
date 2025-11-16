/**
 * Watchdog Service
 *
 * Monitors active tasks for stale heartbeats and automatically fails tasks
 * that appear to be stuck due to crashes or hangs.
 *
 * This service runs in the background and periodically checks for tasks that:
 * - Are in "in_progress" status
 * - Have a lastHeartbeat older than the configured threshold
 *
 * When a stale task is detected, it is automatically marked as failed with
 * a clear message indicating it was terminated by the watchdog.
 */

import config from '@/shared/config';
import { timmy, colors } from '@/shared/ui';
import { logger } from '@/shared/utils/logger.util';
import { PipelineRepository } from '../repositories/pipeline.repository';

export interface WatchdogConfig {
  enabled: boolean;
  checkIntervalMs: number;
  staleThresholdMs: number;
}

export class WatchdogService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly pipelineRepository: PipelineRepository;
  private readonly watchdogConfig: WatchdogConfig;

  constructor(
    pipelineRepository: PipelineRepository,
    watchdogConfig?: WatchdogConfig
  ) {
    this.pipelineRepository = pipelineRepository;
    this.watchdogConfig = watchdogConfig || {
      enabled: config.watchdog.enabled,
      checkIntervalMs: config.watchdog.checkIntervalMs,
      staleThresholdMs: config.watchdog.staleThresholdMs,
    };
  }

  /**
   * Start the watchdog service
   * Begins periodic checks for stale tasks
   */
  start(): void {
    if (!this.watchdogConfig.enabled) {
      logger.info('Watchdog service is disabled');
      return;
    }

    if (this.isRunning) {
      logger.warn('Watchdog service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting watchdog service', {
      checkIntervalMs: this.watchdogConfig.checkIntervalMs,
      staleThresholdMs: this.watchdogConfig.staleThresholdMs,
    });

    console.log(
      timmy.info(
        `🔍 Watchdog started (checking every ${this.watchdogConfig.checkIntervalMs / 1000}s, stale threshold: ${this.watchdogConfig.staleThresholdMs / 60000}min)`
      )
    );

    this.intervalId = setInterval(() => {
      this.checkStaleTasks().catch((error) => {
        logger.error('Watchdog check failed', error instanceof Error ? error : new Error(String(error)));
      });
    }, this.watchdogConfig.checkIntervalMs);
  }

  /**
   * Stop the watchdog service
   * Cancels periodic checks
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Watchdog service stopped');
    console.log(timmy.info('🔍 Watchdog stopped'));
  }

  /**
   * Check for stale tasks and fail them
   * This is the core watchdog logic
   */
  async checkStaleTasks(): Promise<void> {
    try {
      const staleTasks = await this.pipelineRepository.findStaleTasks(
        this.watchdogConfig.staleThresholdMs
      );

      if (staleTasks.length === 0) {
        return;
      }

      logger.warn(`Found ${staleTasks.length} stale task(s)`, {
        taskIds: staleTasks.map((t) => t.taskId),
      });

      console.log(
        timmy.warning(
          `⚠️  Found ${colors.bright}${staleTasks.length}${colors.reset} stale task(s)`
        )
      );

      for (const task of staleTasks) {
        await this.failStaleTask(task.taskId, task.lastHeartbeat || 'unknown');
      }
    } catch (error) {
      logger.error('Error checking for stale tasks', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Fail a stale task with appropriate error message
   */
  private async failStaleTask(taskId: string, lastHeartbeat: string): Promise<void> {
    const now = new Date();
    const lastHeartbeatDate = new Date(lastHeartbeat);
    const staleMinutes = Math.floor(
      (now.getTime() - lastHeartbeatDate.getTime()) / 60000
    );

    const error = `Task became unresponsive (no heartbeat for ${staleMinutes} minutes)`;
    const reason = 'Terminated by watchdog';

    logger.warn(`Failing stale task: ${taskId}`, {
      lastHeartbeat,
      staleMinutes,
    });

    console.log(
      timmy.error(
        `✗ Failing stale task ${colors.bright}${taskId}${colors.reset} (stale for ${staleMinutes}min)`
      )
    );

    try {
      await this.pipelineRepository.fail(taskId, error, reason);

      logger.info(`Successfully failed stale task: ${taskId}`);
    } catch (error) {
      logger.error(`Failed to mark task ${taskId} as failed`, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Check if watchdog is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get watchdog configuration
   */
  getConfig(): WatchdogConfig {
    return { ...this.watchdogConfig };
  }
}

export default WatchdogService;
