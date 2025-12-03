/**
 * Test Generation Stage Tests
 */

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  unlinkSync: jest.fn(),
  openSync: jest.fn(() => 123),
  closeSync: jest.fn(),
}));

jest.mock('child_process', () => ({
  exec: jest.fn(),
  spawn: jest.fn(),
}));

jest.mock('util', () => ({
  promisify: jest.fn((fn) => fn),
}));

jest.mock('../../../../lib/storage', () => ({
  pipeline: {
    STAGES: {
      GENERATING_TESTS: 'generating_tests',
      TESTS_GENERATED: 'tests_generated',
    },
    updateStage: jest.fn(),
    completeStage: jest.fn(),
    failStage: jest.fn(),
  },
}));

jest.mock('../../../shared/ui', () => ({
  timmy: {
    info: jest.fn((msg: string) => `[INFO] ${msg}`),
    success: jest.fn((msg: string) => `[SUCCESS] ${msg}`),
    warning: jest.fn((msg: string) => `[WARNING] ${msg}`),
    error: jest.fn((msg: string) => `[ERROR] ${msg}`),
    ai: jest.fn((msg: string) => `[AI] ${msg}`),
  },
  colors: {
    reset: '',
    bright: '',
    dim: '',
  },
}));

jest.mock('../../../shared/utils/process-manager.util', () => {
  interface MockChild {
    on: jest.Mock;
  }

  const createMockChild = (): MockChild => {
    const child: MockChild = {
      on: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
        if (event === 'exit') {
          // Simulate successful exit
          setTimeout(() => callback(0, null), 10);
        }
        return child;
      }),
    };
    return child;
  };

  return {
    getProcessManager: jest.fn(() => ({
      spawn: jest.fn(() => createMockChild()),
      kill: jest.fn(),
      unregister: jest.fn(),
    })),
  };
});

jest.mock('../../../shared/utils/logger.util', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../shared/utils/verbose.util', () => ({
  isVerbose: jest.fn(() => false),
}));

import { TestGenerationStage } from '../test-generation.stage';
import * as storage from '../../../../lib/storage';
import fs from 'fs';
import { exec } from 'child_process';
import type { StageContext } from '../types';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExec = exec as jest.MockedFunction<typeof exec>;

describe('TestGenerationStage', () => {
  let stage: TestGenerationStage;
  let mockContext: StageContext;

  beforeEach(() => {
    jest.clearAllMocks();

    stage = new TestGenerationStage();

    mockContext = {
      task: {
        id: 'task-123',
        name: 'Add user authentication',
        description: 'Implement login/logout functionality',
      },
      taskId: 'task-123',
      taskName: 'Add user authentication',
      repoConfig: {
        path: '/path/to/repo',
        owner: 'testowner',
        repo: 'testrepo',
        baseBranch: 'main',
      },
      worktreePath: '/path/to/worktree',
    } as StageContext;

    // Mock fs functions
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([]);
    mockFs.readFileSync.mockReturnValue('test file content');
    mockFs.statSync.mockReturnValue({
      mtime: new Date(),
      isDirectory: () => false,
      isFile: () => true,
    } as fs.Stats);

    // Mock exec for git commands
    mockExec.mockImplementation((_cmd, _opts, callback) => {
      if (typeof callback === 'function') {
        callback(null, '', '');
      }
      return { stdout: '', stderr: '' } as unknown as ReturnType<typeof exec>;
    });
  });

  describe('execute', () => {
    it('should update pipeline stage on start', async () => {
      // Mock empty changed files to skip test generation
      mockExec.mockImplementation((_cmd, _opts, _callback) => {
        return { stdout: '', stderr: '' } as unknown as ReturnType<typeof exec>;
      });

      await stage.run(mockContext);

      expect(storage.pipeline.updateStage).toHaveBeenCalledWith(
        'task-123',
        'generating_tests',
        { name: 'Test Generation' }
      );
    });

    it('should skip test generation when no changed files', async () => {
      // Mock git diff to return empty
      mockExec.mockImplementation((_cmd, _opts, _callback) => {
        return { stdout: '', stderr: '' } as unknown as ReturnType<typeof exec>;
      });

      const result = await stage.run(mockContext);

      expect(result.success).toBe(true);
      expect(result.testsCreated).toBe(0);
      expect(result.testFiles).toEqual([]);
    });

    it('should use worktreePath when provided', async () => {
      const result = await stage.run(mockContext);

      // The stage should succeed even if no changed files
      expect(result.success).toBe(true);
      // Verify storage was updated with correct task ID
      expect(storage.pipeline.updateStage).toHaveBeenCalledWith(
        'task-123',
        'generating_tests',
        expect.any(Object)
      );
    });

    it('should fall back to repoConfig.path when no worktreePath', async () => {
      const contextWithoutWorktree = {
        ...mockContext,
        worktreePath: undefined,
      };

      await stage.run(contextWithoutWorktree);

      // Should still work without worktree
      expect(storage.pipeline.updateStage).toHaveBeenCalled();
    });
  });

  describe('validateDependencies', () => {
    it('should throw error when repoConfig.path is missing', async () => {
      const contextWithoutPath = {
        ...mockContext,
        repoConfig: {
          ...mockContext.repoConfig,
          path: '',
        },
      };

      const result = await stage.run(contextWithoutPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Repository path is required');
    });

    it('should throw error when task is missing', async () => {
      const contextWithoutTask = {
        ...mockContext,
        task: undefined,
      } as unknown as StageContext;

      const result = await stage.run(contextWithoutTask);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task is required');
    });
  });

  describe('loadTestPatterns', () => {
    it('should attempt to load test files from the repository', async () => {
      // Just verify the stage runs without error
      const result = await stage.run(mockContext);
      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle git diff errors gracefully', async () => {
      mockExec.mockImplementation(() => {
        throw new Error('git command failed');
      });

      const result = await stage.run(mockContext);

      // Should still succeed but with 0 tests since changed files couldn't be determined
      expect(result.success).toBe(true);
      expect(result.testsCreated).toBe(0);
    });

    it('should complete stage on success', async () => {
      await stage.run(mockContext);

      expect(storage.pipeline.completeStage).toHaveBeenCalledWith(
        'task-123',
        'generating_tests',
        expect.objectContaining({ testsCreated: 0 })
      );
    });
  });

  describe('integration with pipeline storage', () => {
    it('should call completeStage with test count', async () => {
      await stage.run(mockContext);

      expect(storage.pipeline.completeStage).toHaveBeenCalledWith(
        'task-123',
        'generating_tests',
        expect.objectContaining({
          testsCreated: expect.any(Number),
        })
      );
    });
  });
});
