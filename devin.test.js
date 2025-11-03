// Mock environment variables before any imports
process.env.CLICKUP_API_KEY = 'test-api-key';
process.env.CLICKUP_BOT_USER_ID = '12345';
process.env.CLICKUP_WORKSPACE_ID = '90181842045';
process.env.GITHUB_REPO_PATH = '/test/repo/path';
process.env.GITHUB_OWNER = 'test-owner';
process.env.GITHUB_REPO = 'test-repo';
process.env.GITHUB_TOKEN = 'test-github-token';
process.env.POLL_INTERVAL_MS = '15000';

// Mock all external dependencies
jest.mock('fs');
jest.mock('axios');
jest.mock('child_process', () => ({
  exec: jest.fn(),
  promisify: jest.fn(() => jest.fn())
}));

const fs = require('fs');
const axios = require('axios');

// Don't actually run the startup code
require.main = null;

// Load the module once with mocks in place
const devin = require('./devin.js');

describe('JARVIS Task Automation System', () => {
  beforeEach(() => {
    // Just clear mock call history, don't reload the module
    jest.clearAllMocks();

    // Set up default mock return values
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('[]');
    fs.writeFileSync.mockReturnValue(undefined);
    fs.mkdirSync.mockReturnValue(undefined);
    fs.chmodSync.mockReturnValue(undefined);
    fs.unlinkSync.mockReturnValue(undefined);
    axios.get.mockResolvedValue({ data: { tasks: [] } });
    axios.post.mockResolvedValue({});
    axios.put.mockResolvedValue({});

    // Reset state for tests
    devin.processedTasksData = [];
    devin.processedTaskIds = new Set();
    devin.prTracking = [];
  });

  describe('Cache Management', () => {
    describe('loadProcessedTasks', () => {
      it('should return empty array when cache file does not exist', () => {
        fs.existsSync.mockReturnValue(false);

        const result = devin.loadProcessedTasks();

        expect(result).toEqual([]);
      });

      it('should load tasks from cache file when it exists', () => {
        const mockTasks = [
          { id: '1', title: 'Task 1', description: 'Desc 1', detectedAt: '2024-01-01' },
          { id: '2', title: 'Task 2', description: 'Desc 2', detectedAt: '2024-01-02' }
        ];

        // Temporarily override the mock for this test
        fs.existsSync = jest.fn().mockReturnValue(true);
        fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(mockTasks));

        const result = devin.loadProcessedTasks();

        expect(result).toEqual(mockTasks);
        expect(fs.readFileSync).toHaveBeenCalledWith(devin.CACHE_FILE, 'utf8');
      });

      it('should convert old format (array of IDs) to new format', () => {
        const oldFormat = ['task-1', 'task-2', 'task-3'];

        fs.existsSync = jest.fn().mockReturnValue(true);
        fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(oldFormat));

        const result = devin.loadProcessedTasks();

        expect(result).toHaveLength(3);
        expect(result[0]).toHaveProperty('id', 'task-1');
        expect(result[0]).toHaveProperty('title', 'Unknown');
      });

      it('should handle errors gracefully', () => {
        fs.existsSync = jest.fn().mockReturnValue(true);
        fs.readFileSync = jest.fn().mockImplementation(() => {
          throw new Error('Read error');
        });

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const result = devin.loadProcessedTasks();

        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('saveProcessedTasks', () => {
      it('should write tasks to cache file', () => {
        devin.saveProcessedTasks();

        expect(fs.writeFileSync).toHaveBeenCalledWith(
          devin.CACHE_FILE,
          expect.any(String)
        );
      });

      it('should handle write errors gracefully', () => {
        fs.writeFileSync.mockImplementation(() => {
          throw new Error('Write error');
        });

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        devin.saveProcessedTasks();

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('addToProcessed', () => {
      it('should add task to processed list', () => {
        const task = {
          id: 'task-123',
          name: 'Test Task',
          description: 'Test Description'
        };

        devin.addToProcessed(task);

        const taskData = devin.processedTasksData;
        expect(taskData).toHaveLength(1);
        expect(taskData[0].id).toBe('task-123');
        expect(taskData[0].title).toBe('Test Task');
        expect(devin.processedTaskIds.has('task-123')).toBe(true);
      });

      it('should not add duplicate tasks', () => {
        const task = {
          id: 'task-123',
          name: 'Test Task'
        };

        devin.addToProcessed(task);
        devin.addToProcessed(task); // Try to add again

        expect(devin.processedTasksData).toHaveLength(1);
      });
    });
  });

  describe('ClickUp API', () => {
    describe('getAssignedTasks', () => {
      it('should fetch and filter tasks with bot in progress status', async () => {
        const mockResponse = {
          data: {
            tasks: [
              { id: '1', name: 'Task 1', status: { status: 'bot in progress' } },
              { id: '2', name: 'Task 2', status: { status: 'in progress' } },
              { id: '3', name: 'Task 3', status: { status: 'bot in progress' } }
            ]
          }
        };

        axios.get.mockResolvedValue(mockResponse);

        const result = await devin.getAssignedTasks();

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('1');
        expect(result[1].id).toBe('3');
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringContaining('api.clickup.com'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'test-api-key'
            })
          })
        );
      });

      it('should return empty array on API error', async () => {
        axios.get.mockRejectedValue(new Error('API Error'));

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const result = await devin.getAssignedTasks();

        expect(result).toEqual([]);
        consoleSpy.mockRestore();
      });
    });

    describe('updateTaskStatus', () => {
      it('should update task status via API', async () => {
        axios.put.mockResolvedValue({});

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        await devin.updateTaskStatus('task-123', 'completed');

        expect(axios.put).toHaveBeenCalledWith(
          'https://api.clickup.com/api/v2/task/task-123',
          { status: 'completed' },
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'test-api-key'
            })
          })
        );
        consoleSpy.mockRestore();
      });

      it('should handle API errors gracefully', async () => {
        axios.put.mockRejectedValue(new Error('Update failed'));

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        await devin.updateTaskStatus('task-123', 'completed');

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('addClickUpComment', () => {
      it('should add comment to task', async () => {
        axios.post.mockResolvedValue({});

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        await devin.addClickUpComment('task-123', 'Test comment');

        expect(axios.post).toHaveBeenCalledWith(
          'https://api.clickup.com/api/v2/task/task-123/comment',
          { comment_text: 'Test comment' },
          expect.any(Object)
        );
        consoleSpy.mockRestore();
      });
    });
  });

  describe('Queue Management', () => {
    describe('loadQueue', () => {
      it('should return default queue when file does not exist', () => {
        fs.existsSync.mockReturnValue(false);

        const result = devin.loadQueue();

        expect(result).toEqual({ pending: [], completed: [] });
      });

      it('should load queue from file when it exists', () => {
        const mockQueue = {
          pending: [{ id: '1', title: 'Task 1' }],
          completed: [{ id: '2', title: 'Task 2' }]
        };

        fs.existsSync = jest.fn().mockReturnValue(true);
        fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(mockQueue));

        const result = devin.loadQueue();

        expect(result).toEqual(mockQueue);
      });
    });

    describe('saveQueue', () => {
      it('should save queue to file', () => {
        const mockQueue = { pending: [], completed: [] };

        devin.saveQueue(mockQueue);

        expect(fs.writeFileSync).toHaveBeenCalledWith(
          devin.QUEUE_FILE,
          expect.any(String)
        );
      });
    });

    describe('queueTask', () => {
      it('should add task to pending queue', async () => {
        fs.existsSync = jest.fn().mockReturnValue(false);
        fs.writeFileSync = jest.fn();

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const mockTask = {
          id: 'task-123',
          name: 'Test Task',
          description: 'Test Description',
          url: 'https://app.clickup.com/t/task-123'
        };

        const result = await devin.queueTask(mockTask);

        expect(result).toEqual({ success: true });
        expect(fs.writeFileSync).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('should detect already queued tasks', async () => {
        const existingQueue = {
          pending: [{ id: 'task-123', title: 'Existing' }],
          completed: []
        };

        fs.existsSync = jest.fn().mockReturnValue(true);
        fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(existingQueue));
        fs.writeFileSync = jest.fn();

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const mockTask = {
          id: 'task-123',
          name: 'Test Task'
        };

        const result = await devin.queueTask(mockTask);

        expect(result).toEqual({ alreadyQueued: true });
        consoleSpy.mockRestore();
      });
    });
  });

  describe('PR Tracking System', () => {
    describe('loadPRTracking', () => {
      it('should return empty array when file does not exist', () => {
        fs.existsSync.mockReturnValue(false);

        const result = devin.loadPRTracking();

        expect(result).toEqual([]);
      });

      it('should load tracking data from file', () => {
        const mockTracking = [
          { taskId: '1', branch: 'task-1', startedAt: '2024-01-01' }
        ];

        fs.existsSync = jest.fn().mockReturnValue(true);
        fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(mockTracking));

        const result = devin.loadPRTracking();

        expect(result).toEqual(mockTracking);
      });
    });

    describe('checkForPR', () => {
      it('should find PR when it exists', async () => {
        const mockTracking = {
          owner: 'test-owner',
          repo: 'test-repo',
          branch: 'task-123',
          taskId: 'task-123'
        };

        const mockPR = {
          html_url: 'https://github.com/test-owner/test-repo/pull/1',
          number: 1,
          state: 'open'
        };

        axios.get.mockResolvedValue({ data: [mockPR] });

        const result = await devin.checkForPR(mockTracking);

        expect(result).toEqual({
          found: true,
          url: mockPR.html_url,
          number: mockPR.number,
          state: mockPR.state
        });
      });

      it('should return not found when PR does not exist', async () => {
        const mockTracking = {
          owner: 'test-owner',
          repo: 'test-repo',
          branch: 'task-123'
        };

        axios.get.mockResolvedValue({ data: [] });

        const result = await devin.checkForPR(mockTracking);

        expect(result).toEqual({ found: false });
      });

      it('should handle API errors', async () => {
        const mockTracking = {
          owner: 'test-owner',
          repo: 'test-repo',
          branch: 'task-123',
          taskId: 'task-123'
        };

        axios.get.mockRejectedValue(new Error('GitHub API Error'));

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const result = await devin.checkForPR(mockTracking);

        expect(result).toEqual({ found: false });
        consoleSpy.mockRestore();
      });
    });
  });

  describe('Claude Code Automation', () => {
    describe('ensureClaudeSettings', () => {
      it('should create .claude directory if it does not exist', () => {
        fs.existsSync = jest.fn().mockReturnValue(false);
        fs.mkdirSync = jest.fn();
        fs.writeFileSync = jest.fn();

        devin.ensureClaudeSettings();

        expect(fs.mkdirSync).toHaveBeenCalledWith(
          expect.stringContaining('.claude'),
          { recursive: true }
        );
      });

      it('should write settings.json with full permissions', () => {
        fs.existsSync = jest.fn().mockReturnValue(true);
        fs.writeFileSync = jest.fn();

        devin.ensureClaudeSettings();

        expect(fs.writeFileSync).toHaveBeenCalledWith(
          expect.stringContaining('settings.json'),
          expect.stringContaining('"permissions"')
        );
      });

      it('should not create directory if it already exists', () => {
        fs.existsSync = jest.fn().mockReturnValue(true);
        fs.mkdirSync = jest.fn();
        fs.writeFileSync = jest.fn();

        devin.ensureClaudeSettings();

        expect(fs.mkdirSync).not.toHaveBeenCalled();
      });
    });
  });

  describe('Integration Tests', () => {
    describe('pollAndProcess', () => {
      it('should skip already processed tasks', async () => {
        const mockTasks = [
          { id: 'task-1', name: 'Task 1', status: { status: 'bot in progress' } }
        ];

        axios.get.mockResolvedValue({ data: { tasks: mockTasks } });

        // Simulate task already processed
        devin.processedTaskIds.add('task-1');

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        await devin.pollAndProcess();

        // Should not log "TARGET ACQUIRED" since task is already processed
        const logs = consoleSpy.mock.calls.flat().join(' ');
        expect(logs).not.toContain('TARGET ACQUIRED');

        consoleSpy.mockRestore();
      });

      it('should handle polling errors gracefully', async () => {
        axios.get.mockRejectedValue(new Error('Network error'));

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        await devin.pollAndProcess();

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });
});
