/**
 * Pipeline Repository
 * Manages pipeline state and progress tracking
 */

import fs from 'fs';
import {
  PipelineData,
  PipelineStage,
  StageEntry,
  PipelineSummary,
  ClickUpTaskData,
} from '../../types';
import { FileReadError, FileWriteError, PipelineNotFoundError } from '../../shared/errors';
import { PIPELINE_STAGES, PIPELINE_STATUS } from '../../shared/constants';

export interface StaleTaskInfo {
  taskId: string;
  taskName: string;
  currentStage: string;
  status: string;
  updatedAt: string;
  staleDurationMs: number;
}

export interface IPipelineRepository {
  load(): Promise<Record<string, PipelineData>>;
  save(pipelines: Record<string, PipelineData>): Promise<void>;
  get(taskId: string): Promise<PipelineData | null>;
  init(taskId: string, taskData: Partial<ClickUpTaskData>): Promise<PipelineData>;
  updateStage(taskId: string, stage: PipelineStage, stageData?: Partial<StageEntry>): Promise<PipelineData>;
  completeStage(taskId: string, stage: PipelineStage, result?: Record<string, unknown>): Promise<PipelineData>;
  failStage(taskId: string, stage: PipelineStage, error: Error | string): Promise<PipelineData>;
  updateMetadata(taskId: string, metadata: Record<string, unknown>): Promise<PipelineData>;
  complete(taskId: string, result?: Record<string, unknown>): Promise<PipelineData>;
  fail(taskId: string, error: Error | string): Promise<PipelineData>;
  getActive(): Promise<PipelineData[]>;
  getSummary(taskId: string): Promise<PipelineSummary | null>;
  findStaleTasks(staleTimeoutMs: number): Promise<StaleTaskInfo[]>;
  recoverStaleTask(taskId: string, markAsFailed: boolean): Promise<PipelineData>;
}

export class PipelineRepository implements IPipelineRepository {
  constructor(private readonly filePath: string) {}

  /**
   * Load all pipelines from file
   */
  async load(): Promise<Record<string, PipelineData>> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return {};
      }

      const data = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new FileReadError(this.filePath, error as Error);
    }
  }

  /**
   * Save all pipelines to file
   */
  async save(pipelines: Record<string, PipelineData>): Promise<void> {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(pipelines, null, 2));
    } catch (error) {
      throw new FileWriteError(this.filePath, error as Error);
    }
  }

  /**
   * Get pipeline for specific task
   */
  async get(taskId: string): Promise<PipelineData | null> {
    const pipelines = await this.load();
    return pipelines[taskId] || null;
  }

  /**
   * Initialize new pipeline
   */
  async init(taskId: string, taskData: Partial<ClickUpTaskData> = {}): Promise<PipelineData> {
    const pipelines = await this.load();

    const pipeline: PipelineData = {
      taskId,
      taskName: taskData.name || taskData.title || '',
      currentStage: PIPELINE_STAGES.DETECTED,
      status: PIPELINE_STATUS.IN_PROGRESS,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stages: [
        {
          name: 'detection',
          stage: PIPELINE_STAGES.DETECTED,
          status: PIPELINE_STATUS.COMPLETED,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      ],
      metadata: {
        geminiAnalysis: null,
        aiInstances: [],
        branches: [],
        prNumber: null,
        reviewIterations: 0,
        maxReviewIterations: 3,
        agentExecution: {
          gemini: null,
          claude: null,
          codex: null,
        },
      },
      errors: [],
    };

    pipelines[taskId] = pipeline;
    await this.save(pipelines);

    return pipeline;
  }

  /**
   * Update stage in pipeline
   */
  async updateStage(
    taskId: string,
    stage: PipelineStage,
    stageData: Partial<StageEntry> = {}
  ): Promise<PipelineData> {
    const pipelines = await this.load();
    const pipeline = pipelines[taskId];

    if (!pipeline) {
      throw new PipelineNotFoundError(taskId);
    }

    let stageEntry = pipeline.stages.find((s) => s.stage === stage);

    if (!stageEntry) {
      stageEntry = {
        name: stageData.name || stage,
        stage,
        status: PIPELINE_STATUS.IN_PROGRESS,
        startedAt: new Date().toISOString(),
      };
      pipeline.stages.push(stageEntry);
    } else {
      Object.assign(stageEntry, {
        ...stageData,
        status: PIPELINE_STATUS.IN_PROGRESS,
        startedAt: new Date().toISOString(),
      });
    }

    pipeline.currentStage = stage;
    pipeline.updatedAt = new Date().toISOString();

    await this.save(pipelines);
    return pipeline;
  }

  /**
   * Mark stage as completed
   */
  async completeStage(
    taskId: string,
    stage: PipelineStage,
    result: Record<string, unknown> = {}
  ): Promise<PipelineData> {
    const pipelines = await this.load();
    const pipeline = pipelines[taskId];

    if (!pipeline) {
      throw new PipelineNotFoundError(taskId);
    }

    const stageEntry = pipeline.stages.find((s) => s.stage === stage);

    if (stageEntry) {
      const completedAt = new Date().toISOString();
      Object.assign(stageEntry, {
        ...result,
        status: PIPELINE_STATUS.COMPLETED,
        completedAt,
        duration: Date.parse(completedAt) - Date.parse(stageEntry.startedAt),
      });
    }

    pipeline.updatedAt = new Date().toISOString();
    await this.save(pipelines);

    return pipeline;
  }

  /**
   * Mark stage as failed
   */
  async failStage(
    taskId: string,
    stage: PipelineStage,
    error: Error | string
  ): Promise<PipelineData> {
    const pipelines = await this.load();
    const pipeline = pipelines[taskId];

    if (!pipeline) {
      throw new PipelineNotFoundError(taskId);
    }

    const stageEntry = pipeline.stages.find((s) => s.stage === stage);

    if (stageEntry) {
      stageEntry.status = PIPELINE_STATUS.FAILED;
      stageEntry.completedAt = new Date().toISOString();
      stageEntry.error = error instanceof Error ? error.message : String(error);
    }

    pipeline.errors.push({
      stage,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });

    pipeline.updatedAt = new Date().toISOString();
    await this.save(pipelines);

    return pipeline;
  }

  /**
   * Update pipeline metadata
   */
  async updateMetadata(taskId: string, metadata: Record<string, unknown>): Promise<PipelineData> {
    const pipelines = await this.load();
    const pipeline = pipelines[taskId];

    if (!pipeline) {
      throw new PipelineNotFoundError(taskId);
    }

    pipeline.metadata = {
      ...pipeline.metadata,
      ...metadata,
    };

    pipeline.updatedAt = new Date().toISOString();
    await this.save(pipelines);

    return pipeline;
  }

  /**
   * Mark pipeline as completed
   */
  async complete(taskId: string, result: Record<string, unknown> = {}): Promise<PipelineData> {
    const pipelines = await this.load();
    const pipeline = pipelines[taskId];

    if (!pipeline) {
      throw new PipelineNotFoundError(taskId);
    }

    const completedAt = new Date().toISOString();

    pipeline.status = PIPELINE_STATUS.COMPLETED;
    pipeline.currentStage = PIPELINE_STAGES.COMPLETED;
    pipeline.completedAt = completedAt;
    pipeline.totalDuration = Date.parse(completedAt) - Date.parse(pipeline.createdAt);

    Object.assign(pipeline.metadata, result);

    await this.save(pipelines);
    return pipeline;
  }

  /**
   * Mark pipeline as failed
   */
  async fail(taskId: string, error: Error | string): Promise<PipelineData> {
    const pipelines = await this.load();
    const pipeline = pipelines[taskId];

    if (!pipeline) {
      throw new PipelineNotFoundError(taskId);
    }

    pipeline.status = PIPELINE_STATUS.FAILED;
    pipeline.currentStage = PIPELINE_STAGES.FAILED;
    pipeline.failedAt = new Date().toISOString();
    pipeline.errors.push({
      stage: pipeline.currentStage,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });

    await this.save(pipelines);
    return pipeline;
  }

  /**
   * Get all active pipelines
   */
  async getActive(): Promise<PipelineData[]> {
    const pipelines = await this.load();
    return Object.values(pipelines).filter((p) => p.status === PIPELINE_STATUS.IN_PROGRESS);
  }

  /**
   * Get pipeline summary
   */
  async getSummary(taskId: string): Promise<PipelineSummary | null> {
    const pipeline = await this.get(taskId);

    if (!pipeline) {
      return null;
    }

    const completedStages = pipeline.stages.filter((s) => s.status === PIPELINE_STATUS.COMPLETED).length;
    const totalStages = 10;
    const progress = Math.round((completedStages / totalStages) * 100);

    const endTime = pipeline.completedAt || pipeline.failedAt || new Date().toISOString();
    const duration = Date.parse(endTime) - Date.parse(pipeline.createdAt);

    return {
      taskId: pipeline.taskId,
      taskName: pipeline.taskName,
      currentStage: pipeline.currentStage,
      status: pipeline.status,
      progress,
      duration,
      reviewIterations: pipeline.metadata.reviewIterations || 0,
      hasErrors: pipeline.errors.length > 0,
    };
  }

  /**
   * Find stale tasks that have been in progress for too long
   * A task is considered stale if:
   * 1. Status is 'in_progress'
   * 2. updatedAt timestamp is older than staleTimeoutMs
   *
   * @param staleTimeoutMs Timeout in milliseconds (e.g., 3600000 for 1 hour)
   * @returns Array of stale task information
   */
  async findStaleTasks(staleTimeoutMs: number): Promise<StaleTaskInfo[]> {
    const pipelines = await this.load();
    const now = Date.now();
    const staleTasks: StaleTaskInfo[] = [];

    for (const [taskId, pipeline] of Object.entries(pipelines)) {
      if (pipeline.status !== PIPELINE_STATUS.IN_PROGRESS) {
        continue;
      }

      const updatedAt = Date.parse(pipeline.updatedAt);
      const staleDuration = now - updatedAt;

      if (staleDuration > staleTimeoutMs) {
        staleTasks.push({
          taskId: pipeline.taskId,
          taskName: pipeline.taskName,
          currentStage: pipeline.currentStage,
          status: pipeline.status,
          updatedAt: pipeline.updatedAt,
          staleDurationMs: staleDuration,
        });
      }
    }

    return staleTasks;
  }

  /**
   * Recover a stale task by either resuming or marking as failed
   *
   * @param taskId The task ID to recover
   * @param markAsFailed If true, marks the task as failed. If false, resets to allow resumption
   * @returns Updated pipeline data
   */
  async recoverStaleTask(taskId: string, markAsFailed: boolean): Promise<PipelineData> {
    const pipelines = await this.load();
    const pipeline = pipelines[taskId];

    if (!pipeline) {
      throw new PipelineNotFoundError(taskId);
    }

    if (markAsFailed) {
      const errorMessage = `Task marked as failed due to stale state. Last updated: ${pipeline.updatedAt}. Stage: ${pipeline.currentStage}`;

      pipeline.status = PIPELINE_STATUS.FAILED;
      pipeline.currentStage = PIPELINE_STAGES.FAILED;
      pipeline.failedAt = new Date().toISOString();
      pipeline.errors.push({
        stage: pipeline.currentStage,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      const currentStageEntry = pipeline.stages.find((s) => s.stage === pipeline.currentStage);
      if (currentStageEntry && currentStageEntry.status === PIPELINE_STATUS.IN_PROGRESS) {
        currentStageEntry.status = PIPELINE_STATUS.FAILED;
        currentStageEntry.completedAt = new Date().toISOString();
        currentStageEntry.error = 'Stage did not complete before crash/timeout';
      }
    } else {
      const currentStageEntry = pipeline.stages.find((s) => s.stage === pipeline.currentStage);
      if (currentStageEntry && currentStageEntry.status === PIPELINE_STATUS.IN_PROGRESS) {
        currentStageEntry.status = PIPELINE_STATUS.PENDING;
        currentStageEntry.startedAt = '';
      }

      pipeline.errors.push({
        stage: pipeline.currentStage,
        error: `Task recovery initiated. Stage reset from stale state. Last updated: ${pipeline.updatedAt}`,
        timestamp: new Date().toISOString(),
      });
    }

    pipeline.updatedAt = new Date().toISOString();
    await this.save(pipelines);

    return pipeline;
  }
}
