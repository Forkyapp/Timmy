/**
 * Metrics Collector
 *
 * Collects per-stage and per-pipeline metrics for performance
 * tracking, token accounting, and bottleneck identification.
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/shared/utils/logger.util';
import type {
  StageMetrics,
  StageTimer,
  PipelineMetrics,
} from './types';

const METRICS_DIR = path.join(process.cwd(), 'data', 'metrics');
const METRICS_FILE = path.join(METRICS_DIR, 'pipeline-metrics.json');

export class MetricsCollector {
  private metrics: Map<string, PipelineMetrics> = new Map();

  /**
   * Initialize metrics tracking for a new pipeline run.
   */
  startPipeline(taskId: string): void {
    this.metrics.set(taskId, {
      taskId,
      startedAt: new Date().toISOString(),
      totalDurationMs: 0,
      stages: {},
      totals: { tokensUsed: 0, apiCalls: 0, revisions: 0, qualityDelta: 0 },
      outcome: 'completed',
    });
  }

  /**
   * Start timing a stage. Returns a StageTimer that must be completed.
   */
  startStage(taskId: string, stage: string): StageTimer {
    const startedAt = new Date();

    return {
      complete: (data: Partial<StageMetrics>) => {
        const completedAt = new Date();
        const pipeline = this.metrics.get(taskId);
        if (!pipeline) {
          logger.warn(`No pipeline metrics found for task ${taskId}`);
          return;
        }

        const stageMetrics: StageMetrics = {
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          durationMs: completedAt.getTime() - startedAt.getTime(),
          model: data.model || 'unknown',
          tokensIn: data.tokensIn || 0,
          tokensOut: data.tokensOut || 0,
          apiCalls: data.apiCalls || 0,
          status: data.status || 'success',
          revisionCount: data.revisionCount || 0,
          qualityScore: data.qualityScore,
          issuesFound: data.issuesFound,
          issuesFixed: data.issuesFixed,
          error: data.error,
        };

        pipeline.stages[stage] = stageMetrics;

        // Update totals
        pipeline.totals.tokensUsed += stageMetrics.tokensIn + stageMetrics.tokensOut;
        pipeline.totals.apiCalls += stageMetrics.apiCalls;
        pipeline.totals.revisions += stageMetrics.revisionCount;
      },
    };
  }

  /**
   * Mark a pipeline as complete and calculate totals.
   */
  completePipeline(
    taskId: string,
    outcome: 'completed' | 'failed' | 'escalated'
  ): PipelineMetrics | null {
    const pipeline = this.metrics.get(taskId);
    if (!pipeline) {
      logger.warn(`No pipeline metrics found for task ${taskId}`);
      return null;
    }

    pipeline.completedAt = new Date().toISOString();
    pipeline.totalDurationMs =
      new Date(pipeline.completedAt).getTime() -
      new Date(pipeline.startedAt).getTime();
    pipeline.outcome = outcome;

    return { ...pipeline };
  }

  /**
   * Get metrics for a specific task.
   */
  getMetrics(taskId: string): PipelineMetrics | null {
    return this.metrics.get(taskId) || null;
  }

  /**
   * Get all tracked metrics.
   */
  getAllMetrics(): PipelineMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Persist metrics to disk.
   */
  async save(): Promise<void> {
    try {
      await fs.mkdir(METRICS_DIR, { recursive: true });

      // Load existing metrics
      let existing: Record<string, PipelineMetrics> = {};
      try {
        const content = await fs.readFile(METRICS_FILE, 'utf8');
        existing = JSON.parse(content);
      } catch {
        // File doesn't exist yet
      }

      // Merge new metrics
      for (const [taskId, metrics] of this.metrics) {
        existing[taskId] = metrics;
      }

      await fs.writeFile(METRICS_FILE, JSON.stringify(existing, null, 2));
    } catch (error) {
      logger.error('Failed to save metrics', error as Error);
    }
  }

  /**
   * Load historical metrics from disk.
   */
  async loadHistory(): Promise<PipelineMetrics[]> {
    try {
      const content = await fs.readFile(METRICS_FILE, 'utf8');
      const data = JSON.parse(content) as Record<string, PipelineMetrics>;
      return Object.values(data);
    } catch {
      return [];
    }
  }
}

/** Singleton instance */
let instance: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!instance) {
    instance = new MetricsCollector();
  }
  return instance;
}
