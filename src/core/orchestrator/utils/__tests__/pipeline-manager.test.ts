jest.mock('../../../../../lib/storage', () => ({
  pipeline: {
    init: jest.fn().mockReturnValue({
      taskId: 'task-123',
      taskName: 'Test Task',
      stages: [],
      metadata: {},
    }),
    updateMetadata: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
    get: jest.fn(),
  },
  queue: {
    add: jest.fn().mockResolvedValue(undefined),
  },
}));

import * as pipelineManager from '../pipeline-manager';
import * as storage from '../../../../../lib/storage';

const mockPipeline = storage.pipeline as jest.Mocked<typeof storage.pipeline>;

describe('pipeline-manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initializePipeline', () => {
    it('should initialize pipeline and set metadata', () => {
      const result = pipelineManager.initializePipeline('task-123', 'Test Task', 'my-repo');

      expect(mockPipeline.init).toHaveBeenCalledWith('task-123', { name: 'Test Task' });
      expect(mockPipeline.updateMetadata).toHaveBeenCalledWith('task-123', {
        repository: 'my-repo',
      });
      expect(result).toBeDefined();
    });

    it('should default repository to "default"', () => {
      pipelineManager.initializePipeline('task-123', 'Test Task');

      expect(mockPipeline.updateMetadata).toHaveBeenCalledWith('task-123', {
        repository: 'default',
      });
    });
  });

  describe('completePipeline', () => {
    it('should complete pipeline with branch info', () => {
      pipelineManager.completePipeline('task-123');

      expect(mockPipeline.complete).toHaveBeenCalledWith('task-123', {
        branch: 'task-task-123',
        completedAt: expect.any(String),
      });
    });
  });

  describe('failPipeline', () => {
    it('should fail pipeline and queue task', async () => {
      const task = { id: 'task-123', name: 'Test', url: 'https://example.com' };
      const error = new Error('Something broke');

      await pipelineManager.failPipeline('task-123', task as any, error);

      expect(mockPipeline.fail).toHaveBeenCalledWith('task-123', error);
      expect(storage.queue.add).toHaveBeenCalledWith(task);
    });
  });

  describe('getTaskFromPipeline', () => {
    it('should return task from pipeline state', () => {
      mockPipeline.get.mockReturnValue({
        taskId: 'task-123',
        taskName: 'Test Task',
        stages: [],
        metadata: {},
      } as any);

      const result = pipelineManager.getTaskFromPipeline('task-123');

      expect(result.id).toBe('task-123');
      expect(result.name).toBe('Test Task');
      expect(result.url).toContain('task-123');
    });

    it('should throw if task not found', () => {
      mockPipeline.get.mockReturnValue(null as any);

      expect(() => pipelineManager.getTaskFromPipeline('missing')).toThrow(
        'Task missing not found'
      );
    });
  });

  describe('validateImplementationComplete', () => {
    it('should return branch from completed implementation stage', () => {
      mockPipeline.get.mockReturnValue({
        taskId: 'task-123',
        taskName: 'Test',
        stages: [
          { stage: 'implementing', status: 'completed', branch: 'feature/branch' },
        ],
        metadata: {},
      } as any);

      const branch = pipelineManager.validateImplementationComplete('task-123');
      expect(branch).toBe('feature/branch');
    });

    it('should return default branch if no branch in stage', () => {
      mockPipeline.get.mockReturnValue({
        taskId: 'task-123',
        taskName: 'Test',
        stages: [
          { stage: 'implementing', status: 'completed' },
        ],
        metadata: {},
      } as any);

      const branch = pipelineManager.validateImplementationComplete('task-123');
      expect(branch).toBe('task-task-123');
    });

    it('should throw if pipeline not found', () => {
      mockPipeline.get.mockReturnValue(null as any);

      expect(() => pipelineManager.validateImplementationComplete('missing')).toThrow();
    });

    it('should throw if implementation not completed', () => {
      mockPipeline.get.mockReturnValue({
        taskId: 'task-123',
        taskName: 'Test',
        stages: [
          { stage: 'implementing', status: 'in_progress' },
        ],
        metadata: {},
      } as any);

      expect(() => pipelineManager.validateImplementationComplete('task-123')).toThrow(
        'Claude implementation stage not completed'
      );
    });
  });

  describe('getRepositoryFromPipeline', () => {
    it('should return repository from metadata', () => {
      mockPipeline.get.mockReturnValue({
        taskId: 'task-123',
        metadata: { repository: 'my-repo' },
      } as any);

      expect(pipelineManager.getRepositoryFromPipeline('task-123')).toBe('my-repo');
    });

    it('should return undefined if no pipeline', () => {
      mockPipeline.get.mockReturnValue(null as any);

      expect(pipelineManager.getRepositoryFromPipeline('missing')).toBeUndefined();
    });
  });
});
