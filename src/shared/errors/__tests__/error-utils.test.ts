import {
  isOperationalError,
  getErrorMessage,
  getErrorContext,
  AIError,
  ClaudeError,
  GeminiError,
  CodexError,
  AITimeoutError,
  AIExecutionError,
  RepositoryError,
  RepositoryNotFoundError,
  GitOperationError,
  BranchExistsError,
  BranchNotFoundError,
  MergeConflictError,
  ValidationError,
  ConfigurationError,
  MissingConfigError,
  InvalidConfigError,
  StorageError,
  FileReadError,
  FileWriteError,
  FileNotFoundError,
  DataCorruptionError,
  PipelineNotFoundError,
  APIError,
  ClickUpAPIError,
  GitHubAPIError,
  NetworkError,
  RateLimitError,
  TimeoutError,
  NotFoundError,
} from '../index';

describe('Error utility functions', () => {
  describe('isOperationalError', () => {
    it('should return true for operational errors', () => {
      const error = new APIError('test');
      expect(isOperationalError(error)).toBe(true);
    });

    it('should return false for generic errors', () => {
      const error = new Error('generic');
      expect(isOperationalError(error)).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from Error instance', () => {
      expect(getErrorMessage(new Error('hello'))).toBe('hello');
    });

    it('should return string directly', () => {
      expect(getErrorMessage('some error')).toBe('some error');
    });

    it('should return default for unknown types', () => {
      expect(getErrorMessage(42)).toBe('Unknown error occurred');
      expect(getErrorMessage(null)).toBe('Unknown error occurred');
      expect(getErrorMessage(undefined)).toBe('Unknown error occurred');
    });
  });

  describe('getErrorContext', () => {
    it('should extract context from custom errors', () => {
      const error = new APIError('test', 'CODE', 500, { key: 'value' });
      expect(getErrorContext(error)).toEqual({ key: 'value' });
    });

    it('should return undefined for generic errors', () => {
      expect(getErrorContext(new Error('test'))).toBeUndefined();
    });

    it('should return undefined for non-errors', () => {
      expect(getErrorContext('string')).toBeUndefined();
    });
  });
});

describe('AI Error classes', () => {
  describe('AIError', () => {
    it('should create with defaults', () => {
      const err = new AIError('AI failed');
      expect(err.message).toBe('AI failed');
      expect(err.code).toBe('AI_ERROR');
      expect(err.statusCode).toBe(500);
      expect(err.isOperational).toBe(true);
    });

    it('should accept custom code and context', () => {
      const err = new AIError('fail', 'CUSTOM', { model: 'claude' });
      expect(err.code).toBe('CUSTOM');
      expect(err.context).toEqual({ model: 'claude' });
    });
  });

  describe('ClaudeError', () => {
    it('should create with correct code', () => {
      const err = new ClaudeError('timeout');
      expect(err.code).toBe('CLAUDE_ERROR');
      expect(err.message).toBe('timeout');
      expect(err).toBeInstanceOf(AIError);
    });
  });

  describe('GeminiError', () => {
    it('should create with correct code', () => {
      const err = new GeminiError('fail');
      expect(err.code).toBe('GEMINI_ERROR');
      expect(err).toBeInstanceOf(AIError);
    });
  });

  describe('CodexError', () => {
    it('should create with correct code', () => {
      const err = new CodexError('fail');
      expect(err.code).toBe('CODEX_ERROR');
      expect(err).toBeInstanceOf(AIError);
    });
  });

  describe('AITimeoutError', () => {
    it('should include timeout info', () => {
      const err = new AITimeoutError('Claude', 30000);
      expect(err.message).toContain('Claude');
      expect(err.message).toContain('30000');
      expect(err.timeoutMs).toBe(30000);
      expect(err.code).toBe('AI_TIMEOUT_ERROR');
    });
  });

  describe('AIExecutionError', () => {
    it('should include agent and exit code', () => {
      const err = new AIExecutionError('Gemini', 'crashed', 1);
      expect(err.message).toContain('Gemini');
      expect(err.message).toContain('crashed');
      expect(err.exitCode).toBe(1);
      expect(err.code).toBe('AI_EXECUTION_ERROR');
    });

    it('should handle undefined exit code', () => {
      const err = new AIExecutionError('Codex', 'unknown');
      expect(err.exitCode).toBeUndefined();
    });
  });
});

describe('Repository Error classes', () => {
  describe('RepositoryError', () => {
    it('should create with defaults', () => {
      const err = new RepositoryError('repo fail');
      expect(err.code).toBe('REPOSITORY_ERROR');
      expect(err.statusCode).toBe(500);
    });
  });

  describe('RepositoryNotFoundError', () => {
    it('should include repo name', () => {
      const err = new RepositoryNotFoundError('my-repo');
      expect(err.message).toContain('my-repo');
      expect(err.code).toBe('REPOSITORY_NOT_FOUND_ERROR');
    });
  });

  describe('GitOperationError', () => {
    it('should include operation details', () => {
      const err = new GitOperationError('push', 'rejected', 'git push origin main');
      expect(err.message).toContain('push');
      expect(err.message).toContain('rejected');
      expect(err.command).toBe('git push origin main');
    });
  });

  describe('BranchExistsError', () => {
    it('should include branch name', () => {
      const err = new BranchExistsError('feature/test');
      expect(err.message).toContain('feature/test');
      expect(err.code).toBe('BRANCH_EXISTS_ERROR');
    });
  });

  describe('BranchNotFoundError', () => {
    it('should include branch name', () => {
      const err = new BranchNotFoundError('feature/gone');
      expect(err.message).toContain('feature/gone');
      expect(err.code).toBe('BRANCH_NOT_FOUND_ERROR');
    });
  });

  describe('MergeConflictError', () => {
    it('should include conflict info', () => {
      const err = new MergeConflictError(['file1.ts', 'file2.ts']);
      expect(err.message).toContain('2 file(s)');
      expect(err.conflicts).toEqual(['file1.ts', 'file2.ts']);
      expect(err.code).toBe('MERGE_CONFLICT_ERROR');
    });
  });
});

describe('Validation Error classes', () => {
  describe('ValidationError', () => {
    it('should create with issues', () => {
      const issues = [{ field: 'name', message: 'required' }];
      const err = new ValidationError('invalid', issues);
      expect(err.issues).toEqual(issues);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.statusCode).toBe(400);
    });

    it('should create from issues', () => {
      const issues = [
        { field: 'name', message: 'required' },
        { field: 'age', message: 'must be number' },
      ];
      const err = ValidationError.fromIssues(issues);
      expect(err.message).toContain('required');
      expect(err.message).toContain('must be number');
      expect(err.issues).toEqual(issues);
    });
  });

  describe('ConfigurationError', () => {
    it('should create with message', () => {
      const err = new ConfigurationError('bad config');
      expect(err.code).toBe('CONFIGURATION_ERROR');
      expect(err.statusCode).toBe(500);
    });
  });

  describe('MissingConfigError', () => {
    it('should include config key', () => {
      const err = new MissingConfigError('API_KEY');
      expect(err.message).toContain('API_KEY');
    });
  });

  describe('InvalidConfigError', () => {
    it('should include key and reason', () => {
      const err = new InvalidConfigError('PORT', 'must be a number');
      expect(err.message).toContain('PORT');
      expect(err.message).toContain('must be a number');
    });
  });
});

describe('Storage Error classes', () => {
  describe('StorageError', () => {
    it('should create with defaults', () => {
      const err = new StorageError('disk full');
      expect(err.code).toBe('STORAGE_ERROR');
      expect(err.statusCode).toBe(500);
    });
  });

  describe('FileReadError', () => {
    it('should include file path', () => {
      const original = new Error('ENOENT');
      const err = new FileReadError('/tmp/test.json', original);
      expect(err.message).toContain('/tmp/test.json');
      expect(err.code).toBe('FILE_READ_ERROR');
    });
  });

  describe('FileWriteError', () => {
    it('should include file path', () => {
      const err = new FileWriteError('/tmp/out.json');
      expect(err.message).toContain('/tmp/out.json');
      expect(err.code).toBe('FILE_WRITE_ERROR');
    });
  });

  describe('FileNotFoundError', () => {
    it('should include file path', () => {
      const err = new FileNotFoundError('/missing.json');
      expect(err.message).toContain('/missing.json');
      expect(err.code).toBe('FILE_NOT_FOUND_ERROR');
    });
  });

  describe('DataCorruptionError', () => {
    it('should include data type and reason', () => {
      const err = new DataCorruptionError('pipeline', 'invalid JSON');
      expect(err.message).toContain('pipeline');
      expect(err.message).toContain('invalid JSON');
      expect(err.code).toBe('DATA_CORRUPTION_ERROR');
    });
  });

  describe('PipelineNotFoundError', () => {
    it('should include task ID', () => {
      const err = new PipelineNotFoundError('task-123');
      expect(err.message).toContain('task-123');
      expect(err.code).toBe('PIPELINE_NOT_FOUND_ERROR');
    });
  });
});

describe('API Error classes', () => {
  describe('APIError', () => {
    it('should create with defaults', () => {
      const err = new APIError('api fail');
      expect(err.code).toBe('API_ERROR');
      expect(err.statusCode).toBe(500);
      expect(err.isOperational).toBe(true);
    });

    it('should serialize to JSON', () => {
      const err = new APIError('test', 'CODE', 400, { detail: 'bad' });
      const json = err.toJSON();
      expect(json.message).toBe('test');
      expect(json.code).toBe('CODE');
      expect(json.statusCode).toBe(400);
      expect(json.context).toEqual({ detail: 'bad' });
      expect(json.name).toBe('APIError');
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('ClickUpAPIError', () => {
    it('should set correct code', () => {
      const err = new ClickUpAPIError('rate limited', 429);
      expect(err.code).toBe('CLICKUP_API_ERROR');
      expect(err.statusCode).toBe(429);
    });
  });

  describe('GitHubAPIError', () => {
    it('should set correct code', () => {
      const err = new GitHubAPIError('not found', 404);
      expect(err.code).toBe('GITHUB_API_ERROR');
      expect(err.statusCode).toBe(404);
    });
  });

  describe('NetworkError', () => {
    it('should set 503 status', () => {
      const err = new NetworkError('connection refused');
      expect(err.code).toBe('NETWORK_ERROR');
      expect(err.statusCode).toBe(503);
    });
  });

  describe('RateLimitError', () => {
    it('should include retry-after', () => {
      const err = new RateLimitError('too many requests', 60);
      expect(err.retryAfter).toBe(60);
      expect(err.statusCode).toBe(429);
    });

    it('should handle undefined retry-after', () => {
      const err = new RateLimitError('rate limited');
      expect(err.retryAfter).toBeUndefined();
    });
  });

  describe('TimeoutError', () => {
    it('should set 504 status', () => {
      const err = new TimeoutError('timed out');
      expect(err.statusCode).toBe(504);
      expect(err.code).toBe('TIMEOUT_ERROR');
    });
  });

  describe('NotFoundError', () => {
    it('should include resource info', () => {
      const err = new NotFoundError('Task', '123');
      expect(err.message).toContain('Task');
      expect(err.message).toContain('123');
      expect(err.statusCode).toBe(404);
    });
  });
});
