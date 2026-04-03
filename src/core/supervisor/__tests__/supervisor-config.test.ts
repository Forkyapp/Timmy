import { loadSupervisorConfig } from '../config';
import { SupervisorConfigError } from '../errors';

describe('loadSupervisorConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear supervisor-specific env vars
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('SUPERVISOR_')) delete process.env[key];
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load default development config', () => {
    const config = loadSupervisorConfig();

    expect(config.environment).toBe('development');
    expect(config.models.claude.id).toBe('claude');
    expect(config.models.gemini.id).toBe('gemini');
    expect(config.models.codex.id).toBe('codex');
    expect(config.models.claude.enabled).toBe(true);
    expect(config.safety.maxConcurrentTasks).toBe(1);
    expect(config.logging.level).toBe('info');
  });

  it('should respect SUPERVISOR_ENV', () => {
    process.env.SUPERVISOR_ENV = 'production';

    const config = loadSupervisorConfig();

    expect(config.environment).toBe('production');
  });

  it('should throw on invalid SUPERVISOR_ENV', () => {
    process.env.SUPERVISOR_ENV = 'staging';

    expect(() => loadSupervisorConfig()).toThrow(SupervisorConfigError);
  });

  it('should allow disabling individual models', () => {
    process.env.SUPERVISOR_CODEX_ENABLED = 'false';

    const config = loadSupervisorConfig();

    expect(config.models.codex.enabled).toBe(false);
    expect(config.models.claude.enabled).toBe(true);
  });

  it('should use custom CLI paths', () => {
    process.env.CLAUDE_CLI_PATH = '/usr/local/bin/claude';

    const config = loadSupervisorConfig();

    expect(config.models.claude.cliPath).toBe('/usr/local/bin/claude');
  });

  it('should parse allowed paths from SUPERVISOR_ALLOWED_PATHS', () => {
    process.env.SUPERVISOR_ALLOWED_PATHS = '/repo/a, /repo/b';

    const config = loadSupervisorConfig();

    expect(config.safety.allowedRepoPaths).toEqual(['/repo/a', '/repo/b']);
  });

  it('should fall back to GITHUB_REPO_PATH for allowed paths', () => {
    process.env.GITHUB_REPO_PATH = '/my/repo';
    delete process.env.SUPERVISOR_ALLOWED_PATHS;

    const config = loadSupervisorConfig();

    expect(config.safety.allowedRepoPaths).toEqual(['/my/repo']);
  });

  it('should parse safety limits from env vars', () => {
    process.env.SUPERVISOR_PIPELINE_TIMEOUT_MS = '600000';
    process.env.SUPERVISOR_MAX_STAGE_RETRIES = '5';
    process.env.SUPERVISOR_MAX_CONCURRENT_TASKS = '2';

    const config = loadSupervisorConfig();

    expect(config.safety.maxPipelineTimeoutMs).toBe(600000);
    expect(config.safety.maxStageRetries).toBe(5);
    expect(config.safety.maxConcurrentTasks).toBe(2);
  });

  it('should throw on invalid log level', () => {
    process.env.SUPERVISOR_LOG_LEVEL = 'verbose';

    expect(() => loadSupervisorConfig()).toThrow(SupervisorConfigError);
  });

  it('should enable file logging when configured', () => {
    process.env.SUPERVISOR_FILE_LOGGING = 'true';
    process.env.SUPERVISOR_LOG_DIR = '/tmp/supervisor-logs';

    const config = loadSupervisorConfig();

    expect(config.logging.enableFileLogging).toBe(true);
    expect(config.logging.logDir).toBe('/tmp/supervisor-logs');
  });
});
