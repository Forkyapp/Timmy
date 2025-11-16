/**
 * Pipeline Repository - Stale Task Detection and Recovery Tests
 */

import fs from 'fs';
import path from 'path';
import { PipelineRepository, type StaleTaskInfo } from '../pipeline.repository';
import type { PipelineData } from '../../../types';
import { PIPELINE_STAGES, PIPELINE_STATUS } from '../../../shared/constants';

describe('PipelineRepository - Stale Task Detection and Recovery', () => {
  let repository: PipelineRepository;
  let testFilePath: string;

  beforeEach(() => {
    testFilePath = path.join(__dirname, 'test-pipeline-stale.json');
    repository = new PipelineRepository(testFilePath);
  });

  afterEach(() => {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  describe('findStaleTasks', () => {
    it('should find tasks that have been in_progress for too long', async () => {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();
      const recentTime = new Date(Date.now() - 60000).toISOString();

      await repository.init('task-1', { name: 'Stale Task 1' });
      const pipeline1 = await repository.get('task-1');
      if (pipeline1) {
        pipeline1.updatedAt = twoHoursAgo;
        await repository.save({ 'task-1': pipeline1 });
      }

      await repository.init('task-2', { name: 'Stale Task 2' });
      const pipeline2 = await repository.get('task-2');
      if (pipeline2) {
        pipeline2.updatedAt = oneHourAgo;
        await repository.save({ 'task-1': pipeline1, 'task-2': pipeline2 } as Record<string, PipelineData>);
      }

      await repository.init('task-3', { name: 'Recent Task' });
      const pipeline3 = await repository.get('task-3');
      if (pipeline3) {
        pipeline3.updatedAt = recentTime;
        await repository.save({
          'task-1': pipeline1,
          'task-2': pipeline2,
          'task-3': pipeline3,
        } as Record<string, PipelineData>);
      }

      const staleTimeout = 1800000;
      const staleTasks = await repository.findStaleTasks(staleTimeout);

      expect(staleTasks).toHaveLength(2);
      expect(staleTasks[0].taskId).toBe('task-1');
      expect(staleTasks[1].taskId).toBe('task-2');
      expect(staleTasks[0].staleDurationMs).toBeGreaterThan(staleTimeout);
    });

    it('should not find completed tasks as stale', async () => {
      const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();

      await repository.init('task-completed', { name: 'Completed Task' });
      await repository.complete('task-completed');

      const pipeline = await repository.get('task-completed');
      if (pipeline) {
        pipeline.updatedAt = twoHoursAgo;
        await repository.save({ 'task-completed': pipeline });
      }

      const staleTimeout = 1800000;
      const staleTasks = await repository.findStaleTasks(staleTimeout);

      expect(staleTasks).toHaveLength(0);
    });

    it('should not find failed tasks as stale', async () => {
      const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();

      await repository.init('task-failed', { name: 'Failed Task' });
      await repository.fail('task-failed', new Error('Test failure'));

      const pipeline = await repository.get('task-failed');
      if (pipeline) {
        pipeline.updatedAt = twoHoursAgo;
        await repository.save({ 'task-failed': pipeline });
      }

      const staleTimeout = 1800000;
      const staleTasks = await repository.findStaleTasks(staleTimeout);

      expect(staleTasks).toHaveLength(0);
    });

    it('should return empty array when no stale tasks exist', async () => {
      const recentTime = new Date(Date.now() - 60000).toISOString();

      await repository.init('task-recent', { name: 'Recent Task' });
      const pipeline = await repository.get('task-recent');
      if (pipeline) {
        pipeline.updatedAt = recentTime;
        await repository.save({ 'task-recent': pipeline });
      }

      const staleTimeout = 3600000;
      const staleTasks = await repository.findStaleTasks(staleTimeout);

      expect(staleTasks).toHaveLength(0);
    });
  });

  describe('recoverStaleTask', () => {
    it('should mark task as failed when markAsFailed is true', async () => {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

      await repository.init('task-stale', { name: 'Stale Task' });
      await repository.updateStage('task-stale', PIPELINE_STAGES.IMPLEMENTING);

      const pipeline = await repository.get('task-stale');
      if (pipeline) {
        pipeline.updatedAt = oneHourAgo;
        await repository.save({ 'task-stale': pipeline });
      }

      const recovered = await repository.recoverStaleTask('task-stale', true);

      expect(recovered.status).toBe(PIPELINE_STATUS.FAILED);
      expect(recovered.currentStage).toBe(PIPELINE_STAGES.FAILED);
      expect(recovered.failedAt).toBeDefined();
      expect(recovered.errors).toHaveLength(1);
      expect(recovered.errors[0].error).toContain('stale state');

      const implementingStage = recovered.stages.find((s) => s.stage === PIPELINE_STAGES.IMPLEMENTING);
      expect(implementingStage?.status).toBe(PIPELINE_STATUS.FAILED);
      expect(implementingStage?.error).toBe('Stage did not complete before crash/timeout');
    });

    it('should reset task for resumption when markAsFailed is false', async () => {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

      await repository.init('task-stale', { name: 'Stale Task' });
      await repository.updateStage('task-stale', PIPELINE_STAGES.IMPLEMENTING);

      const pipeline = await repository.get('task-stale');
      if (pipeline) {
        pipeline.updatedAt = oneHourAgo;
        await repository.save({ 'task-stale': pipeline });
      }

      const recovered = await repository.recoverStaleTask('task-stale', false);

      expect(recovered.status).toBe(PIPELINE_STATUS.IN_PROGRESS);
      expect(recovered.currentStage).toBe(PIPELINE_STAGES.IMPLEMENTING);
      expect(recovered.errors).toHaveLength(1);
      expect(recovered.errors[0].error).toContain('recovery initiated');

      const implementingStage = recovered.stages.find((s) => s.stage === PIPELINE_STAGES.IMPLEMENTING);
      expect(implementingStage?.status).toBe(PIPELINE_STATUS.PENDING);
      expect(implementingStage?.startedAt).toBeUndefined();
    });

    it('should throw error when task not found', async () => {
      await expect(repository.recoverStaleTask('non-existent', true)).rejects.toThrow(
        'Pipeline not found'
      );
    });

    it('should update the updatedAt timestamp', async () => {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const beforeRecovery = Date.now();

      await repository.init('task-stale', { name: 'Stale Task' });
      const pipeline = await repository.get('task-stale');
      if (pipeline) {
        pipeline.updatedAt = oneHourAgo;
        await repository.save({ 'task-stale': pipeline });
      }

      const recovered = await repository.recoverStaleTask('task-stale', true);
      const afterRecovery = Date.now();

      const recoveredTime = Date.parse(recovered.updatedAt);
      expect(recoveredTime).toBeGreaterThanOrEqual(beforeRecovery);
      expect(recoveredTime).toBeLessThanOrEqual(afterRecovery);
    });
  });

  describe('Integration: findStaleTasks and recoverStaleTask', () => {
    it('should detect and recover multiple stale tasks', async () => {
      const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();

      await repository.init('task-1', { name: 'Stale Task 1' });
      const pipeline1 = await repository.get('task-1');
      if (pipeline1) {
        pipeline1.updatedAt = twoHoursAgo;
        await repository.save({ 'task-1': pipeline1 });
      }

      await repository.init('task-2', { name: 'Stale Task 2' });
      const pipeline2 = await repository.get('task-2');
      if (pipeline2) {
        pipeline2.updatedAt = twoHoursAgo;
        await repository.save({ 'task-1': pipeline1, 'task-2': pipeline2 } as Record<string, PipelineData>);
      }

      const staleTimeout = 3600000;
      const staleTasks = await repository.findStaleTasks(staleTimeout);

      expect(staleTasks).toHaveLength(2);

      for (const staleTask of staleTasks) {
        await repository.recoverStaleTask(staleTask.taskId, true);
      }

      const afterRecovery = await repository.findStaleTasks(staleTimeout);
      expect(afterRecovery).toHaveLength(0);

      const recovered1 = await repository.get('task-1');
      const recovered2 = await repository.get('task-2');

      expect(recovered1?.status).toBe(PIPELINE_STATUS.FAILED);
      expect(recovered2?.status).toBe(PIPELINE_STATUS.FAILED);
    });
  });
});
