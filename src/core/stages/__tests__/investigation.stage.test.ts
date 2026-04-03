jest.mock('../../../../lib/storage', () => ({
  pipeline: {
    STAGES: { INVESTIGATING: 'investigating' },
    updateStage: jest.fn(),
    completeStage: jest.fn(),
    failStage: jest.fn(),
    updateMetadata: jest.fn(),
  },
}));

jest.mock('../../ai-services/claude-investigator.service', () => ({
  investigateIssue: jest.fn(),
}));

jest.mock('../../../../lib/clickup', () => ({
  addComment: jest.fn().mockResolvedValue(undefined),
  updateTaskDescription: jest.fn().mockResolvedValue(undefined),
}));

import { InvestigationStage } from '../investigation.stage';
import * as investigator from '../../ai-services/claude-investigator.service';
import * as clickup from '../../../../lib/clickup';
import * as storage from '../../../../lib/storage';

const mockInvestigator = investigator as jest.Mocked<typeof investigator>;
const mockClickup = clickup as jest.Mocked<typeof clickup>;

describe('InvestigationStage', () => {
  let stage: InvestigationStage;

  const baseContext = {
    task: { id: 'task-123', name: 'Fix bug', description: 'Original desc' },
    taskId: 'task-123',
    taskName: 'Fix bug',
    repoConfig: {
      owner: 'test',
      repo: 'test-repo',
      path: '/tmp/test-repo',
      baseBranch: 'main',
      token: 'token',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    stage = new InvestigationStage();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should run investigation successfully', async () => {
    mockInvestigator.investigateIssue.mockResolvedValue({
      success: true,
      detailedDescription: 'Enhanced description',
      filesIdentified: ['src/file1.ts', 'src/file2.ts'],
      technicalContext: 'Context details',
      investigationFile: '/tmp/investigation.md',
    });

    const result = await stage.run(baseContext);

    expect(result.success).toBe(true);
    expect(result.filesIdentified).toHaveLength(2);
    expect(mockClickup.updateTaskDescription).toHaveBeenCalledWith('task-123', 'Enhanced description');
    expect(storage.pipeline.completeStage).toHaveBeenCalled();
  });

  it('should handle investigation failure gracefully', async () => {
    mockInvestigator.investigateIssue.mockRejectedValue(new Error('Claude unavailable'));

    const result = await stage.run(baseContext);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Claude unavailable');
    expect(result.filesIdentified).toEqual([]);
    expect(storage.pipeline.failStage).toHaveBeenCalled();
  });

  it('should handle partial success with fallback', async () => {
    mockInvestigator.investigateIssue.mockResolvedValue({
      success: false,
      detailedDescription: 'Fallback description',
      filesIdentified: [],
      technicalContext: '',
    });

    const result = await stage.run(baseContext);

    expect(result.success).toBe(true); // Still considered success
  });

  it('should handle many files in notification', async () => {
    mockInvestigator.investigateIssue.mockResolvedValue({
      success: true,
      detailedDescription: 'Enhanced',
      filesIdentified: ['f1.ts', 'f2.ts', 'f3.ts', 'f4.ts', 'f5.ts', 'f6.ts', 'f7.ts'],
      technicalContext: 'Context',
      investigationFile: '/tmp/inv.md',
    });

    const result = await stage.run(baseContext);

    expect(result.success).toBe(true);
    // Completion notification should mention "and X more files"
    const commentCall = mockClickup.addComment.mock.calls.find(
      c => (c[1] as string).includes('Investigation Complete')
    );
    expect(commentCall).toBeDefined();
    expect(commentCall![1]).toContain('more files');
  });

  it('should handle notification failures silently', async () => {
    mockClickup.addComment.mockRejectedValue(new Error('API error'));
    mockInvestigator.investigateIssue.mockResolvedValue({
      success: true,
      detailedDescription: 'Enhanced',
      filesIdentified: ['f1.ts'],
      technicalContext: 'Context',
    });

    // Should not throw despite notification failures
    const result = await stage.run(baseContext);
    expect(result.success).toBe(true);
  });
});
