/**
 * Stale Task Recovery Service
 * Detects and recovers tasks that are stuck in in_progress status
 */

import { timmy, colors } from '@/shared/ui';
import { logger } from '@/shared/utils/logger.util';
import config from '@/shared/config';
import * as storage from '../../../lib/storage';
import type { StaleTaskInfo } from '../repositories/pipeline.repository';

export interface RecoveryStats {
  totalStale: number;
  recovered: number;
  failed: number;
  errors: Array<{ taskId: string; error: string }>;
}

/**
 * Check for stale tasks and recover them
 *
 * @returns Recovery statistics
 */
export async function recoverStaleTasks(): Promise<RecoveryStats> {
  const stats: RecoveryStats = {
    totalStale: 0,
    recovered: 0,
    failed: 0,
    errors: [],
  };

  if (!config.pipeline.staleTaskRecoveryEnabled) {
    logger.info('Stale task recovery is disabled');
    return stats;
  }

  try {
    const staleTasks = (storage.pipeline as any).findStaleTasks(config.pipeline.staleTaskTimeoutMs);
    stats.totalStale = staleTasks.length;

    if (staleTasks.length === 0) {
      return stats;
    }

    console.log(timmy.warning(`Found ${staleTasks.length} stale task(s)`));

    for (const staleTask of staleTasks) {
      try {
        await recoverStaleTask(staleTask);
        stats.recovered++;
      } catch (error) {
        const err = error as Error;
        stats.failed++;
        stats.errors.push({
          taskId: staleTask.taskId,
          error: err.message,
        });
        logger.error('Failed to recover stale task', err, { taskId: staleTask.taskId });
      }
    }

    if (stats.recovered > 0) {
      console.log(timmy.success(`Recovered ${stats.recovered} stale task(s)`));
    }

    if (stats.failed > 0) {
      console.log(timmy.error(`Failed to recover ${stats.failed} stale task(s)`));
    }
  } catch (error) {
    const err = error as Error;
    logger.error('Stale task recovery failed', err);
    throw err;
  }

  return stats;
}

/**
 * Recover a single stale task
 *
 * @param staleTask Stale task information
 */
async function recoverStaleTask(staleTask: StaleTaskInfo): Promise<void> {
  const { taskId, taskName, currentStage, staleDurationMs } = staleTask;

  const durationMinutes = Math.round(staleDurationMs / 60000);
  console.log(
    timmy.info(
      `Recovering stale task: ${colors.bright}${taskId}${colors.reset} ` +
      `(${taskName}) - Stage: ${currentStage} - Stale for: ${durationMinutes}m`
    )
  );

  const markAsFailed = config.pipeline.staleTaskAutoFail;

  if (markAsFailed) {
    (storage.pipeline as any).recoverStaleTask(taskId, true);
    console.log(timmy.warning(`  → Marked as failed`));
    logger.info('Stale task marked as failed', { taskId, currentStage, staleDurationMs });
  } else {
    (storage.pipeline as any).recoverStaleTask(taskId, false);
    console.log(timmy.info(`  → Reset for resumption`));
    logger.info('Stale task reset for resumption', { taskId, currentStage, staleDurationMs });
  }
}

/**
 * Get recovery statistics without performing recovery
 *
 * @returns Current stale tasks information
 */
export async function getStaleTasks(): Promise<StaleTaskInfo[]> {
  if (!config.pipeline.staleTaskRecoveryEnabled) {
    return [];
  }

  return (storage.pipeline as any).findStaleTasks(config.pipeline.staleTaskTimeoutMs);
}
