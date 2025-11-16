/**
 * WatchdogService Unit Tests
 */

import { WatchdogService } from '../watchdog.service';
import { PipelineRepository } from '../../repositories/pipeline.repository';
import type { PipelineData } from '@/types/storage';

// Mock the PipelineRepository
jest.mock('../../repositories/pipeline.repository');

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
  },
  colors: {
    bright: '',
    reset: '',
    dim: '',
  },
}));

describe('WatchdogService', () => {
  let watchdogService: WatchdogService;
  let mockPipelineRepository: jest.Mocked<PipelineRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockPipelineRepository = new PipelineRepository('test.json') as jest.Mocked<PipelineRepository>;

    watchdogService = new WatchdogService(mockPipelineRepository, {
      enabled: true,
      checkIntervalMs: 5000, // 5 seconds for testing
      staleThresholdMs: 10000, // 10 seconds for testing
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    watchdogService.stop();
  });

  describe('start', () => {
    it('should start the watchdog service when enabled', () => {
      watchdogService.start();

      expect(watchdogService.isActive()).toBe(true);
    });

    it('should not start when disabled', () => {
      const disabledWatchdog = new WatchdogService(mockPipelineRepository, {
        enabled: false,
        checkIntervalMs: 5000,
        staleThresholdMs: 10000,
      });

      disabledWatchdog.start();

      expect(disabledWatchdog.isActive()).toBe(false);
    });

    it('should not start if already running', () => {
      watchdogService.start();
      const firstStatus = watchdogService.isActive();

      watchdogService.start(); // Try to start again
      const secondStatus = watchdogService.isActive();

      expect(firstStatus).toBe(true);
      expect(secondStatus).toBe(true);
    });
  });

  describe('stop', () => {
    it('should stop the watchdog service', () => {
      watchdogService.start();
      expect(watchdogService.isActive()).toBe(true);

      watchdogService.stop();
      expect(watchdogService.isActive()).toBe(false);
    });

    it('should do nothing if already stopped', () => {
      expect(watchdogService.isActive()).toBe(false);

      watchdogService.stop(); // Should not throw
      expect(watchdogService.isActive()).toBe(false);
    });
  });

  describe('checkStaleTasks', () => {
    it('should not fail tasks when no stale tasks exist', async () => {
      mockPipelineRepository.findStaleTasks = jest.fn().mockResolvedValue([]);
      mockPipelineRepository.fail = jest.fn();

      await watchdogService.checkStaleTasks();

      expect(mockPipelineRepository.findStaleTasks).toHaveBeenCalledWith(10000);
      expect(mockPipelineRepository.fail).not.toHaveBeenCalled();
    });

    it('should fail stale tasks with appropriate error message', async () => {
      const staleTask: PipelineData = {
        taskId: 'task-123',
        taskName: 'Test Task',
        currentStage: 'implementing',
        status: 'in_progress',
        createdAt: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
        updatedAt: new Date(Date.now() - 30000).toISOString(),
        lastHeartbeat: new Date(Date.now() - 20000).toISOString(), // 20 seconds ago (stale)
        stages: [],
        metadata: {},
        errors: [],
      };

      mockPipelineRepository.findStaleTasks = jest.fn().mockResolvedValue([staleTask]);
      mockPipelineRepository.fail = jest.fn();

      await watchdogService.checkStaleTasks();

      expect(mockPipelineRepository.findStaleTasks).toHaveBeenCalledWith(10000);
      expect(mockPipelineRepository.fail).toHaveBeenCalledWith(
        'task-123',
        expect.stringContaining('Task became unresponsive'),
        'Terminated by watchdog'
      );
    });

    it('should fail multiple stale tasks', async () => {
      const staleTasks: PipelineData[] = [
        {
          taskId: 'task-1',
          taskName: 'Task 1',
          currentStage: 'implementing',
          status: 'in_progress',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastHeartbeat: new Date(Date.now() - 20000).toISOString(),
          stages: [],
          metadata: {},
          errors: [],
        },
        {
          taskId: 'task-2',
          taskName: 'Task 2',
          currentStage: 'analyzing',
          status: 'in_progress',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastHeartbeat: new Date(Date.now() - 25000).toISOString(),
          stages: [],
          metadata: {},
          errors: [],
        },
      ];

      mockPipelineRepository.findStaleTasks = jest.fn().mockResolvedValue(staleTasks);
      mockPipelineRepository.fail = jest.fn();

      await watchdogService.checkStaleTasks();

      expect(mockPipelineRepository.fail).toHaveBeenCalledTimes(2);
      expect(mockPipelineRepository.fail).toHaveBeenCalledWith(
        'task-1',
        expect.any(String),
        'Terminated by watchdog'
      );
      expect(mockPipelineRepository.fail).toHaveBeenCalledWith(
        'task-2',
        expect.any(String),
        'Terminated by watchdog'
      );
    });

    it('should handle errors during stale task detection', async () => {
      mockPipelineRepository.findStaleTasks = jest.fn().mockRejectedValue(
        new Error('Database error')
      );

      await expect(watchdogService.checkStaleTasks()).rejects.toThrow('Database error');
    });
  });

  describe('periodic checks', () => {
    it('should periodically check for stale tasks', async () => {
      mockPipelineRepository.findStaleTasks = jest.fn().mockResolvedValue([]);

      watchdogService.start();

      // Fast-forward time by checkIntervalMs
      jest.advanceTimersByTime(5000);

      // Wait for async operations
      await Promise.resolve();

      expect(mockPipelineRepository.findStaleTasks).toHaveBeenCalled();

      // Fast-forward again
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockPipelineRepository.findStaleTasks).toHaveBeenCalledTimes(2);
    });

    it('should stop periodic checks when stopped', async () => {
      mockPipelineRepository.findStaleTasks = jest.fn().mockResolvedValue([]);

      watchdogService.start();
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      const callCountBeforeStop = mockPipelineRepository.findStaleTasks.mock.calls.length;

      watchdogService.stop();

      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // Should not have made additional calls after stopping
      expect(mockPipelineRepository.findStaleTasks).toHaveBeenCalledTimes(callCountBeforeStop);
    });
  });

  describe('getConfig', () => {
    it('should return watchdog configuration', () => {
      const config = watchdogService.getConfig();

      expect(config).toEqual({
        enabled: true,
        checkIntervalMs: 5000,
        staleThresholdMs: 10000,
      });
    });

    it('should return a copy of the config', () => {
      const config1 = watchdogService.getConfig();
      const config2 = watchdogService.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });
  });
});
