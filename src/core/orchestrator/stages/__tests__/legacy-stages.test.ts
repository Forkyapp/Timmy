// Mock all external dependencies
jest.mock('../../../../../lib/storage', () => ({
  pipeline: {
    STAGES: {
      ANALYZING: 'analyzing',
      IMPLEMENTING: 'implementing',
      CODEX_REVIEWING: 'codex_reviewing',
      CLAUDE_FIXING: 'claude_fixing',
    },
    updateStage: jest.fn(),
    completeStage: jest.fn(),
    failStage: jest.fn(),
    updateMetadata: jest.fn(),
    storeAgentExecution: jest.fn(),
  },
}));

jest.mock('../../../../../lib/clickup', () => ({
  addComment: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../ai-services/gemini.service', () => ({
  analyzeTask: jest.fn(),
}));

jest.mock('../../../ai-services/claude.service', () => ({
  launchClaude: jest.fn(),
  fixTodoComments: jest.fn(),
}));

jest.mock('../../../monitoring/codex.service', () => ({
  reviewClaudeChanges: jest.fn(),
}));

import { executeAnalysisStage } from '../analysis.stage';
import { executeImplementationStage } from '../implementation.stage';
import { executeReviewStage } from '../review.stage';
import { executeFixesStage } from '../fixes.stage';
import * as gemini from '../../../ai-services/gemini.service';
import * as claude from '../../../ai-services/claude.service';
import * as codex from '../../../monitoring/codex.service';
import * as storage from '../../../../../lib/storage';

const mockGemini = gemini as jest.Mocked<typeof gemini>;
const mockClaude = claude as jest.Mocked<typeof claude>;
const mockCodex = codex as jest.Mocked<typeof codex>;

const baseContext = {
  task: { id: 'task-123', name: 'Test Task', url: 'https://example.com' },
  taskId: 'task-123',
  taskName: 'Test Task',
  repoConfig: {
    owner: 'test',
    repo: 'test-repo',
    path: '/tmp/test-repo',
    baseBranch: 'main',
    token: 'token',
  },
};

describe('Legacy Orchestrator Stages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('executeAnalysisStage', () => {
    it('should execute analysis and return result', async () => {
      const analysisResult = {
        success: true,
        featureSpecFile: '/tmp/spec.md',
        content: 'feature spec',
        featureDir: '/tmp/features',
        logFile: '/tmp/log.txt',
        progressFile: '/tmp/progress.txt',
        fallback: false,
      };
      mockGemini.analyzeTask.mockResolvedValue(analysisResult);

      const result = await executeAnalysisStage(baseContext);

      expect(result).toEqual(analysisResult);
      expect(storage.pipeline.updateStage).toHaveBeenCalled();
      expect(storage.pipeline.completeStage).toHaveBeenCalled();
    });

    it('should handle fallback analysis', async () => {
      mockGemini.analyzeTask.mockResolvedValue({
        success: true,
        featureSpecFile: '/tmp/spec.md',
        featureDir: '/tmp/features',
        content: 'fallback content',
        fallback: true,
        logFile: '/tmp/log.txt',
      });

      const result = await executeAnalysisStage(baseContext);

      expect(result).toBeDefined();
      expect(result?.fallback).toBe(true);
    });

    it('should return null on analysis failure', async () => {
      mockGemini.analyzeTask.mockRejectedValue(new Error('Gemini unavailable'));

      const result = await executeAnalysisStage(baseContext);

      expect(result).toBeNull();
      expect(storage.pipeline.failStage).toHaveBeenCalled();
    });
  });

  describe('executeImplementationStage', () => {
    const analysisContext = {
      ...baseContext,
      analysis: {
        featureSpecFile: '/tmp/spec.md',
        content: 'spec content',
        featureDir: '/tmp/features',
      },
    };

    it('should execute implementation and return result', async () => {
      const implResult = { success: true, branch: 'task-123' };
      mockClaude.launchClaude.mockResolvedValue(implResult);

      const result = await executeImplementationStage(analysisContext);

      expect(result).toEqual(implResult);
      expect(storage.pipeline.completeStage).toHaveBeenCalled();
    });

    it('should throw on implementation failure result', async () => {
      mockClaude.launchClaude.mockResolvedValue({ success: false, error: 'failed' });

      await expect(executeImplementationStage(analysisContext)).rejects.toThrow(
        'failed'
      );
      expect(storage.pipeline.failStage).toHaveBeenCalled();
    });

    it('should throw on implementation exception', async () => {
      mockClaude.launchClaude.mockRejectedValue(new Error('timeout'));

      await expect(executeImplementationStage(analysisContext)).rejects.toThrow('timeout');
    });

    it('should handle null analysis', async () => {
      const contextNoAnalysis = { ...baseContext, analysis: null };
      mockClaude.launchClaude.mockResolvedValue({ success: true, branch: 'task-123' });

      const result = await executeImplementationStage(contextNoAnalysis);
      expect(result.success).toBe(true);
    });
  });

  describe('executeReviewStage', () => {
    it('should execute review and return result', async () => {
      const reviewResult = { success: true, branch: 'task-123' };
      mockCodex.reviewClaudeChanges.mockResolvedValue(reviewResult);

      const result = await executeReviewStage(baseContext);

      expect(result).toEqual(reviewResult);
      expect(storage.pipeline.completeStage).toHaveBeenCalled();
    });

    it('should return null on review failure', async () => {
      mockCodex.reviewClaudeChanges.mockResolvedValue({ success: false, error: 'review failed' });

      const result = await executeReviewStage(baseContext);

      expect(result).toBeNull();
      expect(storage.pipeline.failStage).toHaveBeenCalled();
    });

    it('should return null on review exception', async () => {
      mockCodex.reviewClaudeChanges.mockRejectedValue(new Error('crash'));

      const result = await executeReviewStage(baseContext);

      expect(result).toBeNull();
    });
  });

  describe('executeFixesStage', () => {
    it('should execute fixes and return result', async () => {
      const fixResult = { success: true, branch: 'task-123' };
      mockClaude.fixTodoComments.mockResolvedValue(fixResult);

      const result = await executeFixesStage(baseContext);

      expect(result).toEqual(fixResult);
      expect(storage.pipeline.completeStage).toHaveBeenCalled();
    });

    it('should return null on fixes failure', async () => {
      mockClaude.fixTodoComments.mockResolvedValue({ success: false, error: 'fixes failed' });

      const result = await executeFixesStage(baseContext);

      expect(result).toBeNull();
      expect(storage.pipeline.failStage).toHaveBeenCalled();
    });

    it('should return null on fixes exception', async () => {
      mockClaude.fixTodoComments.mockRejectedValue(new Error('crash'));

      const result = await executeFixesStage(baseContext);

      expect(result).toBeNull();
    });
  });
});
