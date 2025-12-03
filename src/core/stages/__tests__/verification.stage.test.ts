/**
 * Verification Stage Tests
 */

// Mock dependencies - must be before imports
jest.mock('../../../../lib/storage', () => ({
  pipeline: {
    STAGES: {
      VERIFYING: 'verifying',
      IMPLEMENTING: 'implementing',
    },
    updateStage: jest.fn(),
    completeStage: jest.fn(),
    failStage: jest.fn(),
    get: jest.fn(),
  },
}));
jest.mock('../../../../lib/clickup', () => ({
  addComment: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../../../shared/config', () => ({
  default: {
    github: {
      repoPath: '/path/to/repo',
      owner: 'test-owner',
      repo: 'test-repo',
    },
    files: {
      cacheFile: '/tmp/cache.json',
      pipelineFile: '/tmp/pipeline.json',
    },
  },
}));
jest.mock('../../../shared/ui', () => ({
  timmy: {
    info: jest.fn().mockReturnValue(''),
    success: jest.fn().mockReturnValue(''),
    warning: jest.fn().mockReturnValue(''),
    error: jest.fn().mockReturnValue(''),
    ai: jest.fn().mockReturnValue(''),
  },
  colors: {
    bright: '',
    reset: '',
    dim: '',
  },
}));
jest.mock('../../../shared/utils/process-manager.util', () => ({
  getProcessManager: jest.fn().mockReturnValue({
    spawn: jest.fn().mockReturnValue({
      on: jest.fn((event, callback) => {
        if (event === 'exit') {
          setTimeout(() => callback(0, null), 10);
        }
      }),
    }),
    kill: jest.fn(),
    unregister: jest.fn(),
  }),
}));
jest.mock('../utils/test-pattern-loader', () => ({
  loadTestPatterns: jest.fn().mockResolvedValue({ examples: '', summary: '' }),
  formatTestPatternsForPrompt: jest.fn().mockReturnValue(''),
}));
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));
jest.mock('util', () => ({
  promisify: jest.fn((fn) => fn),
}));
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  openSync: jest.fn().mockReturnValue(1),
  closeSync: jest.fn(),
}));

import { VerificationStage } from '../verification.stage';
import * as storage from '../../../../lib/storage';
import * as clickup from '../../../../lib/clickup';
import { createMockClickUpTask } from '../../../test-setup';
import type { StageContext } from '../types';

// Get the mocked exec
const { exec } = require('child_process');

describe('VerificationStage', () => {
  let stage: VerificationStage;
  let mockContext: StageContext;

  beforeEach(() => {
    stage = new VerificationStage({
      maxFixAttempts: 2,
      commandTimeout: 5000,
    });

    mockContext = {
      task: createMockClickUpTask({
        id: 'task-1',
        name: 'Add login feature',
        description: 'Implement user authentication',
      }),
      taskId: 'task-1',
      taskName: 'Add login feature',
      repoConfig: {
        path: '/path/to/repo',
        owner: 'test-owner',
        repo: 'test-repo',
        baseBranch: 'main',
      },
    };

    // Setup mock returns for storage.pipeline.get
    (storage.pipeline.get as jest.Mock).mockReturnValue({
      taskId: 'task-1',
      stages: [{ stage: 'implementing', status: 'completed' }],
    });

    // Suppress console output
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should pass verification when build and tests succeed', async () => {
      // Mock successful build and test
      exec.mockImplementation((cmd: string, _opts: unknown, callback?: Function) => {
        if (callback) {
          callback(null, { stdout: 'Build successful', stderr: '' });
        }
        return Promise.resolve({
          stdout: 'Tests: 10 passed, 10 total',
          stderr: '',
        });
      });

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.buildPassed).toBe(true);
      expect(result.testsPassed).toBe(true);
    });

    it('should update pipeline stage before execution', async () => {
      exec.mockResolvedValue({
        stdout: 'Tests: 5 passed, 5 total',
        stderr: '',
      });

      await stage.execute(mockContext);

      expect(storage.pipeline.updateStage).toHaveBeenCalledWith(
        'task-1',
        storage.pipeline.STAGES.VERIFYING,
        { name: 'Build & Test Verification' }
      );
    });

    it('should complete pipeline stage on success', async () => {
      exec.mockResolvedValue({
        stdout: 'Tests: 5 passed, 5 total',
        stderr: '',
      });

      await stage.execute(mockContext);

      expect(storage.pipeline.completeStage).toHaveBeenCalledWith(
        'task-1',
        storage.pipeline.STAGES.VERIFYING,
        expect.objectContaining({
          buildPassed: true,
          testsPassed: true,
        })
      );
    });

    it('should fail when build fails after max attempts', async () => {
      // Mock build failure
      exec.mockRejectedValue({
        stdout: '',
        stderr: 'TypeScript error: Type mismatch',
        code: 1,
      });

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.buildPassed).toBe(false);
      expect(result.buildError).toBeDefined();
    });

    it('should fail when tests fail after max attempts', async () => {
      // Mock all commands to fail (simulating test failure consistently)
      exec.mockRejectedValue({
        stdout: 'FAIL src/test.ts\nTests: 1 failed\nTests: 5 total',
        stderr: '',
        code: 1,
      });

      const result = await stage.execute(mockContext);

      // With all commands failing, build will fail
      expect(result.success).toBe(false);
    });

    it('should use worktree path when provided', async () => {
      const contextWithWorktree = {
        ...mockContext,
        worktreePath: '/path/to/worktree',
      };

      exec.mockResolvedValue({
        stdout: 'Tests: 5 passed, 5 total',
        stderr: '',
      });

      await stage.execute(contextWithWorktree);

      expect(exec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cwd: '/path/to/worktree',
        })
      );
    });

    it('should post success comment to ClickUp', async () => {
      exec.mockResolvedValue({
        stdout: 'Tests: 10 passed, 10 total',
        stderr: '',
      });

      await stage.execute(mockContext);

      expect(clickup.addComment).toHaveBeenCalledWith(
        'task-1',
        expect.stringContaining('Verification Passed')
      );
    });
  });

  describe('validateDependencies', () => {
    it('should validate base dependencies', async () => {
      const invalidContext = {
        ...mockContext,
        task: null as unknown as StageContext['task'],
      };

      await expect((stage as unknown as { validateDependencies: Function }).validateDependencies(invalidContext)).rejects.toThrow(
        'Task is required'
      );
    });

    it('should validate repository path is provided', async () => {
      const invalidContext = {
        ...mockContext,
        repoConfig: {
          ...mockContext.repoConfig,
          path: '',
        },
      };

      await expect((stage as unknown as { validateDependencies: Function }).validateDependencies(invalidContext)).rejects.toThrow(
        'Repository path is required for verification'
      );
    });

    it('should validate implementation stage completed', async () => {
      (storage.pipeline.get as jest.Mock).mockReturnValue({
        taskId: 'task-1',
        stages: [{ stage: 'implementing', status: 'pending' }],
      });

      await expect((stage as unknown as { validateDependencies: Function }).validateDependencies(mockContext)).rejects.toThrow(
        'Implementation stage must be completed before verification'
      );
    });

    it('should pass validation when implementation is completed', async () => {
      (storage.pipeline.get as jest.Mock).mockReturnValue({
        taskId: 'task-1',
        stages: [{ stage: 'implementing', status: 'completed' }],
      });

      await expect((stage as unknown as { validateDependencies: Function }).validateDependencies(mockContext)).resolves.not.toThrow();
    });
  });

  describe('parseTestOutput', () => {
    it('should parse Jest test output correctly', () => {
      const parseTestOutput = (stage as unknown as { parseTestOutput: Function }).parseTestOutput.bind(stage);

      // Jest format: Tests: X passed\nTests: Y total
      const output = 'Tests: 5 passed\nTests: 10 total';
      const result = parseTestOutput(output);

      expect(result.passed).toBe(5);
      expect(result.total).toBe(10);
    });

    it('should handle failed tests in output', () => {
      const parseTestOutput = (stage as unknown as { parseTestOutput: Function }).parseTestOutput.bind(stage);

      // Jest format with failures
      const output = 'Tests: 2 failed\nTests: 8 passed\nTests: 10 total';
      const result = parseTestOutput(output);

      expect(result.failed).toBe(2);
      expect(result.passed).toBe(8);
      expect(result.total).toBe(10);
    });
  });

  describe('error handling', () => {
    it('should handle exec timeout gracefully', async () => {
      exec.mockRejectedValue(new Error('Command timed out'));

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
    });

    it('should handle missing npm scripts gracefully', async () => {
      exec.mockRejectedValue({
        stderr: 'Missing script: type-check',
        code: 1,
      });

      // Should try build instead
      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
    });
  });

  describe('fix attempts tracking', () => {
    it('should track fix attempts in result', async () => {
      let callCount = 0;

      exec.mockImplementation(() => {
        callCount++;
        // First few calls fail (build), then succeed
        if (callCount <= 2) {
          return Promise.reject({
            stdout: '',
            stderr: 'Build error',
            code: 1,
          });
        }
        return Promise.resolve({
          stdout: 'Tests: 5 passed, 5 total',
          stderr: '',
        });
      });

      const result = await stage.execute(mockContext);

      // Should have some fix attempts recorded
      expect(result.fixAttempts).toBeDefined();
    });
  });
});
