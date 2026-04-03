jest.mock('../../../../../lib/clickup', () => ({
  addComment: jest.fn().mockResolvedValue(undefined),
}));

import * as notifications from '../notifications';
import * as clickup from '../../../../../lib/clickup';

const mockAddComment = clickup.addComment as jest.MockedFunction<typeof clickup.addComment>;

describe('orchestrator notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('notifyWorkflowComplete', () => {
    it('should post workflow complete comment', async () => {
      await notifications.notifyWorkflowComplete('task-123');
      expect(mockAddComment).toHaveBeenCalledWith(
        'task-123',
        expect.stringContaining('Workflow Complete')
      );
    });
  });

  describe('notifyCodexRerunComplete', () => {
    it('should post codex rerun complete comment', async () => {
      await notifications.notifyCodexRerunComplete('task-123', 'feature/branch');
      expect(mockAddComment).toHaveBeenCalledWith(
        'task-123',
        expect.stringContaining('Codex Review Re-run Complete')
      );
      expect(mockAddComment).toHaveBeenCalledWith(
        'task-123',
        expect.stringContaining('feature/branch')
      );
    });
  });

  describe('notifyCodexRerunFailed', () => {
    it('should post codex rerun failure comment', async () => {
      await notifications.notifyCodexRerunFailed('task-123', 'timeout');
      expect(mockAddComment).toHaveBeenCalledWith(
        'task-123',
        expect.stringContaining('Codex Review Re-run Failed')
      );
      expect(mockAddComment).toHaveBeenCalledWith(
        'task-123',
        expect.stringContaining('timeout')
      );
    });
  });

  describe('notifyFixesRerunComplete', () => {
    it('should post fixes rerun complete comment', async () => {
      await notifications.notifyFixesRerunComplete('task-456');
      expect(mockAddComment).toHaveBeenCalledWith(
        'task-456',
        expect.stringContaining('Claude Fixes Re-run Complete')
      );
    });
  });

  describe('notifyFixesRerunFailed', () => {
    it('should post fixes rerun failure comment', async () => {
      await notifications.notifyFixesRerunFailed('task-456', 'crash');
      expect(mockAddComment).toHaveBeenCalledWith(
        'task-456',
        expect.stringContaining('Claude Fixes Re-run Failed')
      );
      expect(mockAddComment).toHaveBeenCalledWith(
        'task-456',
        expect.stringContaining('crash')
      );
    });
  });
});
