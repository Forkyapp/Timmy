import { Supervisor } from '../supervisor';
import { SupervisorValidationError } from '../errors';

// Mock config loader
jest.mock('../config', () => ({
  loadSupervisorConfig: jest.fn(() => ({
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
  })),
}));

// Mock validator
jest.mock('../validators', () => ({
  validateEnvironment: jest.fn(() => ({
    valid: true,
    checks: [
      { name: 'CLICKUP_API_KEY', passed: true, message: 'Set', required: true },
      { name: 'GITHUB_TOKEN', passed: true, message: 'Set', required: true },
      { name: 'CLI:claude', passed: true, message: 'Found', required: true },
    ],
  })),
}));

describe('Supervisor', () => {
  let supervisor: Supervisor;

  beforeEach(() => {
    supervisor = new Supervisor();
  });

  it('should start with initializing status', () => {
    expect(supervisor.getStatus()).toBe('initializing');
  });

  it('should have null config before initialization', () => {
    expect(supervisor.getConfig()).toBeNull();
  });

  it('should initialize successfully with valid environment', async () => {
    const report = await supervisor.initialize();

    expect(report.status).toBe('ready');
    expect(report.environment).toBe('development');
    expect(report.validation.valid).toBe(true);
    expect(report.timestamp).toBeDefined();
    expect(supervisor.getStatus()).toBe('ready');
    expect(supervisor.getConfig()).not.toBeNull();
  });

  it('should throw SupervisorValidationError on failed validation', async () => {
    const { validateEnvironment } = jest.requireMock('../validators') as { validateEnvironment: jest.Mock };
    validateEnvironment.mockReturnValueOnce({
      valid: false,
      checks: [
        { name: 'GITHUB_TOKEN', passed: false, message: 'Missing', required: true },
      ],
    });

    await expect(supervisor.initialize()).rejects.toThrow(SupervisorValidationError);
    expect(supervisor.getStatus()).toBe('error');
  });
});
