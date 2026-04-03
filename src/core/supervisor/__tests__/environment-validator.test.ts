import { validateEnvironment } from '../validators';
import type { SupervisorConfig } from '../types';

// Mock child_process.execSync for CLI checks
jest.mock('child_process', () => ({
  execSync: jest.fn((cmd: string) => {
    // Simulate "which" finding claude and gemini but not codex
    if (cmd.includes('claude') || cmd.includes('gemini')) return Buffer.from('/usr/bin/mock');
    throw new Error('not found');
  }),
}));

// Mock fs.accessSync for path checks
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  accessSync: jest.fn((path: string) => {
    if (path === '/valid/repo') return undefined;
    throw new Error('ENOENT');
  }),
  constants: { R_OK: 4 },
}));

function createTestConfig(overrides: Partial<SupervisorConfig> = {}): SupervisorConfig {
  return {
    environment: 'development',
    models: {
      claude: { id: 'claude', cliPath: 'claude', enabled: true, timeoutMs: 300000, maxRetries: 2 },
      gemini: { id: 'gemini', cliPath: 'gemini', enabled: true, timeoutMs: 300000, maxRetries: 2 },
      codex: { id: 'codex', cliPath: 'codex', enabled: false, timeoutMs: 300000, maxRetries: 2 },
    },
    safety: {
      maxPipelineTimeoutMs: 1800000,
      maxStageRetries: 3,
      maxConcurrentTasks: 1,
      allowedRepoPaths: ['/valid/repo'],
    },
    logging: {
      level: 'info',
      enableFileLogging: false,
      logDir: '/tmp/logs',
    },
    ...overrides,
  };
}

describe('validateEnvironment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CLICKUP_API_KEY: 'test-key',
      GITHUB_TOKEN: 'test-token',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should pass validation with valid config and env', () => {
    const config = createTestConfig();
    const result = validateEnvironment(config);

    expect(result.valid).toBe(true);
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('should fail when CLICKUP_API_KEY is missing', () => {
    delete process.env.CLICKUP_API_KEY;

    const config = createTestConfig();
    const result = validateEnvironment(config);

    expect(result.valid).toBe(false);
    const check = result.checks.find(c => c.name === 'CLICKUP_API_KEY');
    expect(check?.passed).toBe(false);
  });

  it('should fail when GITHUB_TOKEN is missing', () => {
    delete process.env.GITHUB_TOKEN;

    const config = createTestConfig();
    const result = validateEnvironment(config);

    expect(result.valid).toBe(false);
    const check = result.checks.find(c => c.name === 'GITHUB_TOKEN');
    expect(check?.passed).toBe(false);
  });

  it('should skip CLI check for disabled models', () => {
    const config = createTestConfig();
    // codex is disabled in the test config
    const result = validateEnvironment(config);

    const codexCheck = result.checks.find(c => c.name === 'CLI:codex');
    expect(codexCheck?.passed).toBe(true);
    expect(codexCheck?.message).toContain('disabled');
  });

  it('should fail when enabled CLI is not found', () => {
    const config = createTestConfig({
      models: {
        claude: { id: 'claude', cliPath: 'claude', enabled: true, timeoutMs: 300000, maxRetries: 2 },
        gemini: { id: 'gemini', cliPath: 'gemini', enabled: true, timeoutMs: 300000, maxRetries: 2 },
        codex: { id: 'codex', cliPath: 'codex', enabled: true, timeoutMs: 300000, maxRetries: 2 },
      },
    });
    const result = validateEnvironment(config);

    const codexCheck = result.checks.find(c => c.name === 'CLI:codex');
    expect(codexCheck?.passed).toBe(false);
  });

  it('should fail when no allowed paths are configured', () => {
    const config = createTestConfig({
      safety: {
        maxPipelineTimeoutMs: 1800000,
        maxStageRetries: 3,
        maxConcurrentTasks: 1,
        allowedRepoPaths: [],
      },
    });
    const result = validateEnvironment(config);

    expect(result.valid).toBe(false);
    const pathCheck = result.checks.find(c => c.name === 'ALLOWED_PATHS');
    expect(pathCheck?.passed).toBe(false);
  });

  it('should fail when repo path is not accessible', () => {
    const config = createTestConfig({
      safety: {
        maxPipelineTimeoutMs: 1800000,
        maxStageRetries: 3,
        maxConcurrentTasks: 1,
        allowedRepoPaths: ['/nonexistent/path'],
      },
    });
    const result = validateEnvironment(config);

    const pathCheck = result.checks.find(c => c.name === 'PATH:/nonexistent/path');
    expect(pathCheck?.passed).toBe(false);
  });
});
