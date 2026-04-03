jest.mock('../../../../lib/clickup', () => ({
  addComment: jest.fn().mockResolvedValue(undefined),
}));

import { ClickUpNotifier } from '../clickup-notifier';
import * as clickup from '../../../../lib/clickup';

const mockAddComment = clickup.addComment as jest.MockedFunction<typeof clickup.addComment>;

describe('ClickUpNotifier', () => {
  let notifier: ClickUpNotifier;

  beforeEach(() => {
    jest.clearAllMocks();
    notifier = new ClickUpNotifier();
  });

  describe('notifyWorkflowComplete', () => {
    it('should post completion comment', async () => {
      await notifier.notifyWorkflowComplete({
        taskId: '123',
        status: 'completed',
        branch: 'task-123',
      });

      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('Workflow Complete'));
      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('task-123'));
    });

    it('should use fallback branch name when none provided', async () => {
      await notifier.notifyWorkflowComplete({
        taskId: '456',
        status: 'completed',
      });

      expect(mockAddComment).toHaveBeenCalledWith('456', expect.stringContaining('task-456'));
    });

    it('should handle addComment failure gracefully', async () => {
      mockAddComment.mockRejectedValueOnce(new Error('API error'));

      await expect(
        notifier.notifyWorkflowComplete({ taskId: '123', status: 'completed' })
      ).resolves.not.toThrow();
    });
  });

  describe('notifyWorkflowFailed', () => {
    it('should post failure comment with error', async () => {
      await notifier.notifyWorkflowFailed({
        taskId: '123',
        status: 'failed',
        stage: 'implementing',
        error: 'timeout occurred',
      });

      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('Workflow Failed'));
      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('implementing'));
      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('timeout occurred'));
    });

    it('should use default error message when none provided', async () => {
      await notifier.notifyWorkflowFailed({ taskId: '123', status: 'failed' });

      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('Unknown error'));
    });

    it('should handle addComment failure gracefully', async () => {
      mockAddComment.mockRejectedValueOnce(new Error('API error'));

      await expect(
        notifier.notifyWorkflowFailed({ taskId: '123', status: 'failed' })
      ).resolves.not.toThrow();
    });
  });

  describe('notifyStageStart', () => {
    it('should post stage start comment with emoji', async () => {
      await notifier.notifyStageStart({
        taskId: '123',
        stage: 'analyzing',
        status: 'started',
      });

      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('Gemini Analysis'));
      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('Started'));
      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('🧠'));
    });

    it('should handle implementing stage', async () => {
      await notifier.notifyStageStart({
        taskId: '123',
        stage: 'implementing',
        status: 'started',
      });

      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('Claude Implementation'));
      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('💻'));
    });

    it('should handle unknown stage', async () => {
      await notifier.notifyStageStart({
        taskId: '123',
        stage: 'unknown_stage',
        status: 'started',
      });

      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('📝'));
    });

    it('should handle addComment failure gracefully', async () => {
      mockAddComment.mockRejectedValueOnce(new Error('fail'));

      await expect(
        notifier.notifyStageStart({ taskId: '123', stage: 'analyzing', status: 'started' })
      ).resolves.not.toThrow();
    });
  });

  describe('notifyStageComplete', () => {
    it('should post stage complete comment', async () => {
      await notifier.notifyStageComplete({
        taskId: '123',
        stage: 'codex_reviewing',
        status: 'completed',
        details: { issuesFound: 3 },
      });

      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('Codex Review'));
      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('Complete'));
    });

    it('should handle empty details', async () => {
      await notifier.notifyStageComplete({
        taskId: '123',
        stage: 'claude_fixing',
        status: 'completed',
      });

      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('Claude Fixes'));
    });
  });

  describe('notifyRerunComplete', () => {
    it('should post rerun complete for codex_review', async () => {
      await notifier.notifyRerunComplete({
        taskId: '123',
        stage: 'codex_review',
        status: 'completed',
        branch: 'task-123',
      });

      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('Codex Review'));
      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('Re-run Complete'));
    });

    it('should post rerun complete for claude_fixes', async () => {
      await notifier.notifyRerunComplete({
        taskId: '123',
        stage: 'claude_fixes',
        status: 'completed',
      });

      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('Claude Fixes'));
    });
  });

  describe('notifyRerunFailed', () => {
    it('should post rerun failure comment', async () => {
      await notifier.notifyRerunFailed({
        taskId: '123',
        stage: 'codex_review',
        status: 'failed',
        error: 'process crashed',
      });

      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('Re-run Failed'));
      expect(mockAddComment).toHaveBeenCalledWith('123', expect.stringContaining('process crashed'));
    });

    it('should handle addComment failure gracefully', async () => {
      mockAddComment.mockRejectedValueOnce(new Error('fail'));

      await expect(
        notifier.notifyRerunFailed({ taskId: '123', stage: 'codex_review', status: 'failed' })
      ).resolves.not.toThrow();
    });
  });
});
