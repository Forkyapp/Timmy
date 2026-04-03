jest.mock('../clickup-notifier');

import { NotificationManager } from '../notification-manager';
import { ClickUpNotifier } from '../clickup-notifier';

const MockClickUpNotifier = ClickUpNotifier as jest.MockedClass<typeof ClickUpNotifier>;

describe('NotificationManager', () => {
  let manager: NotificationManager;
  let mockNotifier: jest.Mocked<ClickUpNotifier>;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new NotificationManager();
    mockNotifier = MockClickUpNotifier.mock.instances[0] as jest.Mocked<ClickUpNotifier>;
  });

  describe('notifyWorkflowComplete', () => {
    it('should delegate to clickup notifier', async () => {
      mockNotifier.notifyWorkflowComplete.mockResolvedValue();
      const data = { taskId: '123', status: 'completed' as const, branch: 'task-123' };

      await manager.notifyWorkflowComplete(data);

      expect(mockNotifier.notifyWorkflowComplete).toHaveBeenCalledWith(data);
    });

    it('should handle errors gracefully', async () => {
      mockNotifier.notifyWorkflowComplete.mockRejectedValue(new Error('network error'));
      const data = { taskId: '123', status: 'completed' as const };

      await expect(manager.notifyWorkflowComplete(data)).resolves.not.toThrow();
    });
  });

  describe('notifyWorkflowFailed', () => {
    it('should delegate to clickup notifier', async () => {
      mockNotifier.notifyWorkflowFailed.mockResolvedValue();
      const data = { taskId: '123', status: 'failed' as const, error: 'timeout' };

      await manager.notifyWorkflowFailed(data);

      expect(mockNotifier.notifyWorkflowFailed).toHaveBeenCalledWith(data);
    });

    it('should handle errors gracefully', async () => {
      mockNotifier.notifyWorkflowFailed.mockRejectedValue(new Error('fail'));

      await expect(
        manager.notifyWorkflowFailed({ taskId: '123', status: 'failed' as const })
      ).resolves.not.toThrow();
    });
  });

  describe('notifyStageStart', () => {
    it('should delegate to clickup notifier', async () => {
      mockNotifier.notifyStageStart.mockResolvedValue();
      const data = { taskId: '123', stage: 'analyzing', status: 'started' as const };

      await manager.notifyStageStart(data);

      expect(mockNotifier.notifyStageStart).toHaveBeenCalledWith(data);
    });

    it('should handle errors gracefully', async () => {
      mockNotifier.notifyStageStart.mockRejectedValue(new Error('fail'));

      await expect(
        manager.notifyStageStart({ taskId: '123', stage: 'analyzing', status: 'started' as const })
      ).resolves.not.toThrow();
    });
  });

  describe('notifyStageComplete', () => {
    it('should delegate to clickup notifier', async () => {
      mockNotifier.notifyStageComplete.mockResolvedValue();
      const data = { taskId: '123', stage: 'analyzing', status: 'completed' as const };

      await manager.notifyStageComplete(data);

      expect(mockNotifier.notifyStageComplete).toHaveBeenCalledWith(data);
    });

    it('should handle errors gracefully', async () => {
      mockNotifier.notifyStageComplete.mockRejectedValue(new Error('fail'));

      await expect(
        manager.notifyStageComplete({ taskId: '123', stage: 'analyzing', status: 'completed' as const })
      ).resolves.not.toThrow();
    });
  });

  describe('notifyRerunComplete', () => {
    it('should delegate to clickup notifier', async () => {
      mockNotifier.notifyRerunComplete.mockResolvedValue();
      const data = { taskId: '123', stage: 'codex_review' as const, status: 'completed' as const };

      await manager.notifyRerunComplete(data);

      expect(mockNotifier.notifyRerunComplete).toHaveBeenCalledWith(data);
    });

    it('should handle errors gracefully', async () => {
      mockNotifier.notifyRerunComplete.mockRejectedValue(new Error('fail'));

      await expect(
        manager.notifyRerunComplete({ taskId: '123', stage: 'codex_review' as const, status: 'completed' as const })
      ).resolves.not.toThrow();
    });
  });

  describe('notifyRerunFailed', () => {
    it('should delegate to clickup notifier', async () => {
      mockNotifier.notifyRerunFailed.mockResolvedValue();
      const data = { taskId: '123', stage: 'claude_fixes' as const, status: 'failed' as const, error: 'crash' };

      await manager.notifyRerunFailed(data);

      expect(mockNotifier.notifyRerunFailed).toHaveBeenCalledWith(data);
    });

    it('should handle errors gracefully', async () => {
      mockNotifier.notifyRerunFailed.mockRejectedValue(new Error('fail'));

      await expect(
        manager.notifyRerunFailed({ taskId: '123', stage: 'claude_fixes' as const, status: 'failed' as const })
      ).resolves.not.toThrow();
    });
  });
});
