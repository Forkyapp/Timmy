/**
 * PipelineRepository Heartbeat Tests
 * Tests for new heartbeat and stale task detection features
 */

import fs from 'fs';
import path from 'path';
import { PipelineRepository } from '../pipeline.repository';
import type { PipelineData } from '@/types/storage';
import { PIPELINE_STATUS } from '@/shared/constants';

describe('PipelineRepository - Heartbeat Features', () => {
  let repository: PipelineRepository;
  let testFilePath: string;

  beforeEach(() => {
    testFilePath = path.join(__dirname, 'test-pipeline-heartbeat.json');
    repository = new PipelineRepository(testFilePath);

    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  afterEach(() => {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  describe('init', () => {
    it('should initialize pipeline with lastHeartbeat', async () => {
      const pipeline = await repository.init('task-123', { name: 'Test Task' });

      expect(pipeline.lastHeartbeat).toBeDefined();
      expect(typeof pipeline.lastHeartbeat).toBe('string');

      const heartbeatDate = new Date(pipeline.lastHeartbeat!);
      expect(heartbeatDate.getTime()).toBeGreaterThan(Date.now() - 1000); // Within last second
    });
  });

  describe('updateHeartbeat', () => {
    it('should update heartbeat timestamp for existing task', async () => {
      // Create a task
      await repository.init('task-123', { name: 'Test Task' });

      // Wait a bit to ensure timestamp will be different
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update heartbeat
      const updated = await repository.updateHeartbeat('task-123');

      expect(updated).not.toBeNull();
      expect(updated!.lastHeartbeat).toBeDefined();

      // Verify it was updated
      const pipeline = await repository.get('task-123');
      expect(pipeline!.lastHeartbeat).toBe(updated!.lastHeartbeat);
    });

    it('should update updatedAt timestamp when updating heartbeat', async () => {
      await repository.init('task-123', { name: 'Test Task' });
      const initialPipeline = await repository.get('task-123');

      await new Promise(resolve => setTimeout(resolve, 10));

      await repository.updateHeartbeat('task-123');
      const updatedPipeline = await repository.get('task-123');

      expect(updatedPipeline!.updatedAt).not.toBe(initialPipeline!.updatedAt);
    });

    it('should return null for non-existent task', async () => {
      const result = await repository.updateHeartbeat('non-existent');

      expect(result).toBeNull();
    });

    it('should persist heartbeat update to file', async () => {
      await repository.init('task-123', { name: 'Test Task' });
      const updated = await repository.updateHeartbeat('task-123');

      // Create new repository instance to load from file
      const freshRepo = new PipelineRepository(testFilePath);
      const loadedPipeline = await freshRepo.get('task-123');

      expect(loadedPipeline!.lastHeartbeat).toBe(updated!.lastHeartbeat);
    });
  });

  describe('findStaleTasks', () => {
    it('should return empty array when no tasks exist', async () => {
      const staleTasks = await repository.findStaleTasks(60000);

      expect(staleTasks).toEqual([]);
    });

    it('should return empty array when no stale tasks exist', async () => {
      // Create task with recent heartbeat
      await repository.init('task-123', { name: 'Active Task' });
      await repository.updateHeartbeat('task-123');

      const staleTasks = await repository.findStaleTasks(60000); // 1 minute threshold

      expect(staleTasks).toEqual([]);
    });

    it('should find tasks with stale heartbeats', async () => {
      // Create a task
      await repository.init('task-123', { name: 'Stale Task' });

      // Manually set an old heartbeat
      const pipelines = await repository.load();
      pipelines['task-123'].lastHeartbeat = new Date(Date.now() - 120000).toISOString(); // 2 minutes ago
      await repository.save(pipelines);

      const staleTasks = await repository.findStaleTasks(60000); // 1 minute threshold

      expect(staleTasks).toHaveLength(1);
      expect(staleTasks[0].taskId).toBe('task-123');
    });

    it('should only return in_progress tasks', async () => {
      // Create completed task with old heartbeat
      await repository.init('task-completed', { name: 'Completed Task' });
      const pipelines = await repository.load();
      pipelines['task-completed'].status = PIPELINE_STATUS.COMPLETED;
      pipelines['task-completed'].lastHeartbeat = new Date(Date.now() - 120000).toISOString();
      await repository.save(pipelines);

      const staleTasks = await repository.findStaleTasks(60000);

      expect(staleTasks).toEqual([]);
    });

    it('should ignore tasks without lastHeartbeat', async () => {
      // Create task and remove lastHeartbeat
      await repository.init('task-123', { name: 'Task Without Heartbeat' });
      const pipelines = await repository.load();
      delete pipelines['task-123'].lastHeartbeat;
      await repository.save(pipelines);

      const staleTasks = await repository.findStaleTasks(60000);

      expect(staleTasks).toEqual([]);
    });

    it('should find multiple stale tasks', async () => {
      // Create multiple tasks with old heartbeats
      await repository.init('task-1', { name: 'Stale Task 1' });
      await repository.init('task-2', { name: 'Stale Task 2' });
      await repository.init('task-3', { name: 'Active Task' });

      const pipelines = await repository.load();
      pipelines['task-1'].lastHeartbeat = new Date(Date.now() - 120000).toISOString();
      pipelines['task-2'].lastHeartbeat = new Date(Date.now() - 90000).toISOString();
      await repository.save(pipelines);

      const staleTasks = await repository.findStaleTasks(60000);

      expect(staleTasks).toHaveLength(2);
      expect(staleTasks.map(t => t.taskId)).toContain('task-1');
      expect(staleTasks.map(t => t.taskId)).toContain('task-2');
      expect(staleTasks.map(t => t.taskId)).not.toContain('task-3');
    });

    it('should respect different threshold values', async () => {
      await repository.init('task-123', { name: 'Test Task' });

      const pipelines = await repository.load();
      pipelines['task-123'].lastHeartbeat = new Date(Date.now() - 45000).toISOString(); // 45 seconds ago
      await repository.save(pipelines);

      // Should be stale with 30 second threshold
      const staleTasks30s = await repository.findStaleTasks(30000);
      expect(staleTasks30s).toHaveLength(1);

      // Should not be stale with 60 second threshold
      const staleTasks60s = await repository.findStaleTasks(60000);
      expect(staleTasks60s).toHaveLength(0);
    });
  });

  describe('fail', () => {
    it('should accept reason parameter', async () => {
      await repository.init('task-123', { name: 'Test Task' });

      await repository.fail('task-123', 'Task crashed', 'Terminated by watchdog');

      const pipeline = await repository.get('task-123');
      expect(pipeline!.status).toBe(PIPELINE_STATUS.FAILED);
      expect(pipeline!.errors).toHaveLength(1);
      expect(pipeline!.errors[0].error).toContain('Terminated by watchdog');
      expect(pipeline!.errors[0].error).toContain('Task crashed');
    });

    it('should work without reason parameter (backward compatibility)', async () => {
      await repository.init('task-123', { name: 'Test Task' });

      await repository.fail('task-123', 'Task crashed');

      const pipeline = await repository.get('task-123');
      expect(pipeline!.status).toBe(PIPELINE_STATUS.FAILED);
      expect(pipeline!.errors).toHaveLength(1);
      expect(pipeline!.errors[0].error).toBe('Task crashed');
    });
  });
});
