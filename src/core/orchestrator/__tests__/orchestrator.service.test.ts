jest.mock('../../workflow', () => ({
  taskOrchestrator: {
    processTask: jest.fn(),
    getTaskStatus: jest.fn(),
    getActiveTasks: jest.fn(),
    rerunCodexReview: jest.fn(),
    rerunClaudeFixes: jest.fn(),
  },
}));

import { processTask, getTaskStatus, getActiveTasks, rerunCodexReview, rerunClaudeFixes } from '../orchestrator.service';
import { taskOrchestrator } from '../../workflow';

const mockOrchestrator = taskOrchestrator as jest.Mocked<typeof taskOrchestrator>;

describe('orchestrator.service (legacy wrapper)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processTask', () => {
    it('should delegate to taskOrchestrator', async () => {
      const task = { id: '123', name: 'Test', url: 'https://example.com' };
      const expected = { success: true };
      mockOrchestrator.processTask.mockResolvedValue(expected);

      const result = await processTask(task);

      expect(mockOrchestrator.processTask).toHaveBeenCalledWith(task);
      expect(result).toEqual(expected);
    });
  });

  describe('getTaskStatus', () => {
    it('should delegate to taskOrchestrator', () => {
      mockOrchestrator.getTaskStatus.mockReturnValue(null);

      const result = getTaskStatus('123');

      expect(mockOrchestrator.getTaskStatus).toHaveBeenCalledWith('123');
      expect(result).toBeNull();
    });
  });

  describe('getActiveTasks', () => {
    it('should delegate to taskOrchestrator', () => {
      mockOrchestrator.getActiveTasks.mockReturnValue([]);

      const result = getActiveTasks();

      expect(mockOrchestrator.getActiveTasks).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('rerunCodexReview', () => {
    it('should delegate to taskOrchestrator', async () => {
      mockOrchestrator.rerunCodexReview.mockResolvedValue({ success: true });

      const result = await rerunCodexReview('123');

      expect(mockOrchestrator.rerunCodexReview).toHaveBeenCalledWith('123');
      expect(result).toEqual({ success: true });
    });
  });

  describe('rerunClaudeFixes', () => {
    it('should delegate to taskOrchestrator', async () => {
      mockOrchestrator.rerunClaudeFixes.mockResolvedValue({ success: true });

      const result = await rerunClaudeFixes('123');

      expect(mockOrchestrator.rerunClaudeFixes).toHaveBeenCalledWith('123');
      expect(result).toEqual({ success: true });
    });
  });
});
