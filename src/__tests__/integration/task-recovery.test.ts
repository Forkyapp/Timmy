/**
 * Task Recovery Integration Tests
 *
 * Tests the full workflow of task recovery when a task becomes stale
 */

import fs from 'fs';
import path from 'path';
import { WatchdogService } from '@/core/watchdog';
import { PipelineRepository } from '@/core/repositories/pipeline.repository';
import { PIPELINE_STATUS } from '@/shared/constants';

// Mock logger and UI
jest.mock('@/shared/utils/logger.util', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/shared/ui', () => ({
  timmy: {
    info: jest.fn((msg: string) => msg),
    warning: jest.fn((msg: string) => msg),
    error: jest.fn((msg: string) => msg),
    success: jest.fn((msg: string) => msg),
  },
  colors: {
    bright: '',
    reset: '',
    dim: '',
  },
}));

describe('Task Recovery Integration', () => {
  let repository: PipelineRepository;
  let watchdog: WatchdogService;
  let testFilePath: string;

  beforeEach(() => {
    jest.useFakeTimers();
    testFilePath = path.join(__dirname, 'test-task-recovery.json');
    repository = new PipelineRepository(testFilePath);

    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }

    watchdog = new WatchdogService(repository, {
      enabled: true,
      checkIntervalMs: 5000, // 5 seconds
      staleThresholdMs: 10000, // 10 seconds
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    watchdog.stop();

    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  describe('Healthy Task Workflow', () => {
    it('should not fail a task that continuously sends heartbeats', async () => {
      // Initialize a task
      await repository.init('healthy-task', { name: 'Healthy Task' });

      // Start watchdog
      watchdog.start();

      // Simulate heartbeats being sent regularly
      const heartbeatInterval = setInterval(async () => {
        await repository.updateHeartbeat('healthy-task');
      }, 3000); // Every 3 seconds

      // Advance time multiple check intervals
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
      }

      clearInterval(heartbeatInterval);

      // Task should still be in progress
      const pipeline = await repository.get('healthy-task');
      expect(pipeline!.status).toBe(PIPELINE_STATUS.IN_PROGRESS);
      expect(pipeline!.errors).toHaveLength(0);
    });
  });

  describe('Stale Task Detection', () => {
    it('should detect and fail a task that stops sending heartbeats', async () => {
      // Initialize a task
      await repository.init('stale-task', { name: 'Stale Task' });

      // Send initial heartbeat
      await repository.updateHeartbeat('stale-task');

      // Manually set old heartbeat (simulating crash)
      const pipelines = await repository.load();
      pipelines['stale-task'].lastHeartbeat = new Date(Date.now() - 15000).toISOString(); // 15 seconds ago
      await repository.save(pipelines);

      // Start watchdog
      watchdog.start();

      // Advance time to trigger watchdog check
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // Task should be marked as failed
      const pipeline = await repository.get('stale-task');
      expect(pipeline!.status).toBe(PIPELINE_STATUS.FAILED);
      expect(pipeline!.errors).toHaveLength(1);
      expect(pipeline!.errors[0].error).toContain('Terminated by watchdog');
      expect(pipeline!.errors[0].error).toContain('became unresponsive');
    });

    it('should not fail a task that just became active', async () => {
      // Initialize a task with recent heartbeat
      await repository.init('new-task', { name: 'New Task' });
      await repository.updateHeartbeat('new-task');

      // Start watchdog
      watchdog.start();

      // Advance time but not past stale threshold
      jest.advanceTimersByTime(8000); // 8 seconds (less than 10 second threshold)
      await Promise.resolve();

      // Task should still be in progress
      const pipeline = await repository.get('new-task');
      expect(pipeline!.status).toBe(PIPELINE_STATUS.IN_PROGRESS);
    });
  });

  describe('Multiple Stale Tasks', () => {
    it('should detect and fail multiple stale tasks', async () => {
      // Create multiple tasks
      await repository.init('task-1', { name: 'Task 1' });
      await repository.init('task-2', { name: 'Task 2' });
      await repository.init('task-3', { name: 'Task 3' });

      // Make task-1 and task-2 stale, keep task-3 healthy
      const pipelines = await repository.load();
      pipelines['task-1'].lastHeartbeat = new Date(Date.now() - 20000).toISOString();
      pipelines['task-2'].lastHeartbeat = new Date(Date.now() - 15000).toISOString();
      await repository.save(pipelines);

      // Start watchdog
      watchdog.start();

      // Trigger watchdog check
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // Check results
      const pipeline1 = await repository.get('task-1');
      const pipeline2 = await repository.get('task-2');
      const pipeline3 = await repository.get('task-3');

      expect(pipeline1!.status).toBe(PIPELINE_STATUS.FAILED);
      expect(pipeline2!.status).toBe(PIPELINE_STATUS.FAILED);
      expect(pipeline3!.status).toBe(PIPELINE_STATUS.IN_PROGRESS);
    });
  });

  describe('Edge Cases', () => {
    it('should handle task completion during watchdog check', async () => {
      // Initialize task
      await repository.init('completing-task', { name: 'Completing Task' });

      // Make it appear stale
      const pipelines = await repository.load();
      pipelines['completing-task'].lastHeartbeat = new Date(Date.now() - 15000).toISOString();
      await repository.save(pipelines);

      // Complete the task just before watchdog check
      await repository.complete('completing-task');

      // Start watchdog
      watchdog.start();

      // Trigger watchdog check
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // Task should remain completed (not failed by watchdog)
      const pipeline = await repository.get('completing-task');
      expect(pipeline!.status).toBe(PIPELINE_STATUS.COMPLETED);
    });

    it('should handle tasks without lastHeartbeat field', async () => {
      // Create task and remove lastHeartbeat (simulating old data)
      await repository.init('legacy-task', { name: 'Legacy Task' });
      const pipelines = await repository.load();
      delete pipelines['legacy-task'].lastHeartbeat;
      await repository.save(pipelines);

      // Start watchdog
      watchdog.start();

      // Trigger watchdog check (should not crash)
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // Task should remain in progress (not failed)
      const pipeline = await repository.get('legacy-task');
      expect(pipeline!.status).toBe(PIPELINE_STATUS.IN_PROGRESS);
    });

    it('should handle watchdog restart after application restart', async () => {
      // Initialize task
      await repository.init('restarted-task', { name: 'Restarted Task' });

      // Make it stale
      const pipelines = await repository.load();
      pipelines['restarted-task'].lastHeartbeat = new Date(Date.now() - 15000).toISOString();
      await repository.save(pipelines);

      // Create new watchdog instance (simulating app restart)
      const newWatchdog = new WatchdogService(repository, {
        enabled: true,
        checkIntervalMs: 5000,
        staleThresholdMs: 10000,
      });

      newWatchdog.start();

      // Trigger check
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // Task should be failed
      const pipeline = await repository.get('restarted-task');
      expect(pipeline!.status).toBe(PIPELINE_STATUS.FAILED);

      newWatchdog.stop();
    });
  });

  describe('Watchdog Lifecycle', () => {
    it('should stop detecting stale tasks after watchdog is stopped', async () => {
      await repository.init('task-after-stop', { name: 'Task After Stop' });

      // Start and then stop watchdog
      watchdog.start();
      watchdog.stop();

      // Make task stale
      const pipelines = await repository.load();
      pipelines['task-after-stop'].lastHeartbeat = new Date(Date.now() - 15000).toISOString();
      await repository.save(pipelines);

      // Advance time
      jest.advanceTimersByTime(10000);
      await Promise.resolve();

      // Task should not be failed (watchdog is stopped)
      const pipeline = await repository.get('task-after-stop');
      expect(pipeline!.status).toBe(PIPELINE_STATUS.IN_PROGRESS);
    });
  });
});
