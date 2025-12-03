/**
 * Dashboard Service Tests
 */

jest.mock('../../../../lib/storage', () => ({
  pipeline: {
    load: jest.fn(),
  },
}));

jest.mock('../../../shared/ui', () => ({
  timmy: {
    info: jest.fn((msg: string) => `[INFO] ${msg}`),
  },
  colors: {
    reset: '',
    bright: '',
    dim: '',
    red: '',
    green: '',
    yellow: '',
    cyan: '',
    gray: '',
  },
}));

import { analyzePipelines, renderDashboard, showDashboard, exportReport } from '../dashboard.service';
import type { DashboardData } from '../dashboard.service';
import * as storage from '../../../../lib/storage';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPipelineLoad = storage.pipeline.load as jest.MockedFunction<() => Record<string, any>>;

/**
 * Helper to create a stage entry with required fields
 */
function createStage(stage: string, status: string, duration?: number) {
  return {
    name: stage,
    stage,
    status,
    startedAt: new Date().toISOString(),
    completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    duration,
  };
}

/**
 * Helper to create a pipeline with required fields
 */
function createPipeline(overrides: Record<string, unknown>): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    taskId: 'test-task',
    taskName: 'Test Task',
    currentStage: 'completed',
    status: 'completed',
    createdAt: now,
    updatedAt: now,
    metadata: {},
    errors: [],
    stages: [],
    ...overrides,
  };
}

describe('Dashboard Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzePipelines', () => {
    it('should return empty data when no pipelines exist', () => {
      mockPipelineLoad.mockReturnValue({});

      const result = analyzePipelines(7);

      expect(result.summary.totalPipelines).toBe(0);
      expect(result.summary.successfulPipelines).toBe(0);
      expect(result.summary.failedPipelines).toBe(0);
      expect(result.summary.inProgressPipelines).toBe(0);
      expect(result.summary.overallSuccessRate).toBe(0);
      expect(result.recentRuns).toHaveLength(0);
    });

    it('should analyze completed pipeline correctly', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);

      mockPipelineLoad.mockReturnValue({
        'task-123': createPipeline({
          taskId: 'task-123',
          taskName: 'Test Task',
          status: 'completed',
          currentStage: 'completed',
          stages: [
            createStage('analyzing', 'completed', 60000),
            createStage('implementing', 'completed', 120000),
          ],
          createdAt: oneHourAgo.toISOString(),
          completedAt: now.toISOString(),
        }),
      });

      const result = analyzePipelines(7);

      expect(result.summary.totalPipelines).toBe(1);
      expect(result.summary.successfulPipelines).toBe(1);
      expect(result.summary.overallSuccessRate).toBe(100);
      expect(result.recentRuns).toHaveLength(1);
      expect(result.recentRuns[0].taskId).toBe('task-123');
      expect(result.recentRuns[0].status).toBe('completed');
    });

    it('should analyze failed pipeline correctly', () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 7200000);

      mockPipelineLoad.mockReturnValue({
        'task-456': createPipeline({
          taskId: 'task-456',
          taskName: 'Failed Task',
          status: 'failed',
          currentStage: 'implementing',
          stages: [
            createStage('analyzing', 'completed', 60000),
            createStage('implementing', 'failed'),
          ],
          createdAt: twoHoursAgo.toISOString(),
          failedAt: now.toISOString(),
          errors: [
            { stage: 'implementing', error: 'Build failed with errors', timestamp: now.toISOString() },
          ],
        }),
      });

      const result = analyzePipelines(7);

      expect(result.summary.totalPipelines).toBe(1);
      expect(result.summary.failedPipelines).toBe(1);
      expect(result.summary.successfulPipelines).toBe(0);
      expect(result.summary.overallSuccessRate).toBe(0);
      expect(result.recentRuns[0].failedStage).toBe('implementing');
      expect(result.errorPatterns).toHaveLength(1);
      expect(result.errorPatterns[0].stage).toBe('Implementation');
    });

    it('should track in-progress pipelines', () => {
      const now = new Date();
      const thirtyMinsAgo = new Date(now.getTime() - 1800000);

      mockPipelineLoad.mockReturnValue({
        'task-789': createPipeline({
          taskId: 'task-789',
          taskName: 'In Progress Task',
          status: 'in_progress',
          currentStage: 'codex_reviewing',
          stages: [
            createStage('analyzing', 'completed', 60000),
            createStage('implementing', 'completed', 120000),
            createStage('codex_reviewing', 'in_progress'),
          ],
          createdAt: thirtyMinsAgo.toISOString(),
        }),
      });

      const result = analyzePipelines(7);

      expect(result.summary.inProgressPipelines).toBe(1);
      expect(result.recentRuns[0].status).toBe('in_progress');
      expect(result.recentRuns[0].currentStage).toBe('codex_reviewing');
    });

    it('should filter pipelines by daysBack parameter', () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 86400000);

      mockPipelineLoad.mockReturnValue({
        'recent-task': createPipeline({
          taskId: 'recent-task',
          taskName: 'Recent Task',
          status: 'completed',
          currentStage: 'completed',
          createdAt: twoDaysAgo.toISOString(),
          completedAt: twoDaysAgo.toISOString(),
        }),
        'old-task': createPipeline({
          taskId: 'old-task',
          taskName: 'Old Task',
          status: 'completed',
          currentStage: 'completed',
          createdAt: tenDaysAgo.toISOString(),
          completedAt: tenDaysAgo.toISOString(),
        }),
      });

      const result = analyzePipelines(7);

      expect(result.summary.totalPipelines).toBe(1);
      expect(result.recentRuns[0].taskId).toBe('recent-task');
    });

    it('should calculate stage statistics correctly', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);

      mockPipelineLoad.mockReturnValue({
        'task-1': createPipeline({
          taskId: 'task-1',
          taskName: 'Task 1',
          status: 'completed',
          currentStage: 'completed',
          stages: [
            createStage('analyzing', 'completed', 60000),
            createStage('implementing', 'completed', 120000),
          ],
          createdAt: oneHourAgo.toISOString(),
          completedAt: now.toISOString(),
        }),
        'task-2': createPipeline({
          taskId: 'task-2',
          taskName: 'Task 2',
          status: 'failed',
          currentStage: 'implementing',
          stages: [
            createStage('analyzing', 'completed', 30000),
            createStage('implementing', 'failed'),
          ],
          createdAt: oneHourAgo.toISOString(),
          failedAt: now.toISOString(),
          errors: [{ stage: 'implementing', error: 'Failed', timestamp: now.toISOString() }],
        }),
      });

      const result = analyzePipelines(7);

      const analyzingStats = result.stageStats.find(s => s.name === 'Analysis');
      expect(analyzingStats?.total).toBe(2);
      expect(analyzingStats?.completed).toBe(2);
      expect(analyzingStats?.successRate).toBe(100);

      const implementingStats = result.stageStats.find(s => s.name === 'Implementation');
      expect(implementingStats?.total).toBe(2);
      expect(implementingStats?.completed).toBe(1);
      expect(implementingStats?.failed).toBe(1);
      expect(implementingStats?.successRate).toBe(50);
    });

    it('should aggregate error patterns', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);

      mockPipelineLoad.mockReturnValue({
        'task-1': createPipeline({
          taskId: 'task-1',
          taskName: 'Task 1',
          status: 'failed',
          currentStage: 'implementing',
          stages: [createStage('implementing', 'failed')],
          createdAt: oneHourAgo.toISOString(),
          failedAt: now.toISOString(),
          errors: [{ stage: 'implementing', error: 'Build failed', timestamp: now.toISOString() }],
        }),
        'task-2': createPipeline({
          taskId: 'task-2',
          taskName: 'Task 2',
          status: 'failed',
          currentStage: 'implementing',
          stages: [createStage('implementing', 'failed')],
          createdAt: oneHourAgo.toISOString(),
          failedAt: now.toISOString(),
          errors: [{ stage: 'implementing', error: 'Build failed', timestamp: now.toISOString() }],
        }),
      });

      const result = analyzePipelines(7);

      expect(result.errorPatterns.length).toBeGreaterThan(0);
      expect(result.errorPatterns[0].count).toBe(2);
    });

    it('should sort recent runs by date descending', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const twoHoursAgo = new Date(now.getTime() - 7200000);

      mockPipelineLoad.mockReturnValue({
        'older-task': createPipeline({
          taskId: 'older-task',
          taskName: 'Older Task',
          status: 'completed',
          currentStage: 'completed',
          createdAt: twoHoursAgo.toISOString(),
          completedAt: twoHoursAgo.toISOString(),
        }),
        'newer-task': createPipeline({
          taskId: 'newer-task',
          taskName: 'Newer Task',
          status: 'completed',
          currentStage: 'completed',
          createdAt: oneHourAgo.toISOString(),
          completedAt: oneHourAgo.toISOString(),
        }),
      });

      const result = analyzePipelines(7);

      expect(result.recentRuns[0].taskId).toBe('newer-task');
      expect(result.recentRuns[1].taskId).toBe('older-task');
    });
  });

  describe('renderDashboard', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should render dashboard without errors', () => {
      const mockData: DashboardData = {
        recentRuns: [],
        stageStats: [
          { name: 'Analysis', total: 5, completed: 5, failed: 0, skipped: 0, successRate: 100, avgDuration: 60000, totalDuration: 300000 },
        ],
        errorPatterns: [],
        summary: {
          totalPipelines: 5,
          successfulPipelines: 5,
          failedPipelines: 0,
          inProgressPipelines: 0,
          overallSuccessRate: 100,
          avgPipelineDuration: 600000,
        },
      };

      expect(() => renderDashboard(mockData)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should render pipeline runs with correct status icons', () => {
      const now = new Date();

      const mockData: DashboardData = {
        recentRuns: [
          { taskId: 'task-1', taskName: 'Completed Task', status: 'completed', currentStage: 'completed', duration: 60000, createdAt: now },
          { taskId: 'task-2', taskName: 'Failed Task', status: 'failed', currentStage: 'implementing', duration: 30000, createdAt: now, failedStage: 'implementing' },
          { taskId: 'task-3', taskName: 'In Progress Task', status: 'in_progress', currentStage: 'codex_reviewing', duration: 45000, createdAt: now },
        ],
        stageStats: [],
        errorPatterns: [],
        summary: {
          totalPipelines: 3,
          successfulPipelines: 1,
          failedPipelines: 1,
          inProgressPipelines: 1,
          overallSuccessRate: 33,
          avgPipelineDuration: 45000,
        },
      };

      renderDashboard(mockData);

      const allOutput = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('✓');
      expect(allOutput).toContain('✗');
      expect(allOutput).toContain('⟳');
    });

    it('should render error patterns section when errors exist', () => {
      const mockData: DashboardData = {
        recentRuns: [],
        stageStats: [],
        errorPatterns: [
          { stage: 'Implementation', message: 'Build failed with type errors', count: 3, lastOccurred: new Date() },
        ],
        summary: {
          totalPipelines: 3,
          successfulPipelines: 0,
          failedPipelines: 3,
          inProgressPipelines: 0,
          overallSuccessRate: 0,
          avgPipelineDuration: 0,
        },
      };

      renderDashboard(mockData);

      const allOutput = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(allOutput).toContain('COMMON ERRORS');
      expect(allOutput).toContain('3x');
    });
  });

  describe('showDashboard', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should load and display dashboard', () => {
      mockPipelineLoad.mockReturnValue({});

      expect(() => showDashboard(7)).not.toThrow();
      expect(mockPipelineLoad).toHaveBeenCalled();
    });
  });

  describe('exportReport', () => {
    it('should return dashboard data as JSON-serializable object', () => {
      const now = new Date();
      mockPipelineLoad.mockReturnValue({
        'task-123': createPipeline({
          taskId: 'task-123',
          taskName: 'Test Task',
          status: 'completed',
          currentStage: 'completed',
          createdAt: now.toISOString(),
          completedAt: now.toISOString(),
        }),
      });

      const result = exportReport(7);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('recentRuns');
      expect(result).toHaveProperty('stageStats');
      expect(result).toHaveProperty('errorPatterns');
      expect(() => JSON.stringify(result)).not.toThrow();
    });
  });
});
