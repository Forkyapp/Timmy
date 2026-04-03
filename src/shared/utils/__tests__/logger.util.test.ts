import { setVerboseMode } from '../verbose.util';
import { logger, createLogger, LogLevel } from '../logger.util';

describe('Logger', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    setVerboseMode(false);
  });

  describe('default logger', () => {
    it('should not log info when verbose is off', () => {
      setVerboseMode(false);
      logger.info('test info');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log info when verbose is on', () => {
      setVerboseMode(true);
      logger.info('test info');
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy.mock.calls[0][0]).toContain('[INFO]');
      expect(logSpy.mock.calls[0][0]).toContain('test info');
    });

    it('should log warn to console.log', () => {
      logger.warn('test warning');
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy.mock.calls[0][0]).toContain('[WARN]');
    });

    it('should log error to console.error', () => {
      logger.error('test error', new Error('boom'));
      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy.mock.calls[0][0]).toContain('[ERROR]');
      expect(errorSpy.mock.calls[0][0]).toContain('test error');
    });

    it('should log error without Error object', () => {
      logger.error('simple error');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should include context in output', () => {
      setVerboseMode(true);
      logger.info('with context', { taskId: '123' });
      expect(logSpy.mock.calls[0][0]).toContain('taskId');
      expect(logSpy.mock.calls[0][0]).toContain('123');
    });

    it('should not log debug at INFO level', () => {
      setVerboseMode(true);
      logger.debug('debug message');
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('setLevel', () => {
    it('should change minimum log level', () => {
      setVerboseMode(true);
      logger.setLevel(LogLevel.WARN);
      logger.info('should not appear');
      expect(logSpy).not.toHaveBeenCalled();

      logger.warn('should appear');
      expect(logSpy).toHaveBeenCalled();

      // Reset
      logger.setLevel(LogLevel.INFO);
    });
  });

  describe('createLogger', () => {
    it('should create logger with custom options', () => {
      setVerboseMode(true);
      const custom = createLogger({
        level: LogLevel.DEBUG,
        enableColors: false,
        enableTimestamp: false,
        prefix: 'TEST',
      });

      custom.debug('debug msg');
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy.mock.calls[0][0]).toContain('[TEST]');
      expect(logSpy.mock.calls[0][0]).toContain('[DEBUG]');
    });

    it('should create logger without colors', () => {
      setVerboseMode(true);
      const custom = createLogger({ enableColors: false });
      custom.info('no colors');
      expect(logSpy).toHaveBeenCalled();
    });

    it('should create logger without timestamps', () => {
      setVerboseMode(true);
      const custom = createLogger({ enableTimestamp: false });
      custom.info('no timestamp');
      // Should not contain ISO date pattern
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('child', () => {
    it('should create a child logger with prefix', () => {
      setVerboseMode(true);
      const parent = createLogger({ prefix: 'PARENT', level: LogLevel.DEBUG });
      const child = parent.child('CHILD');

      child.info('child message');
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy.mock.calls[0][0]).toContain('PARENT:CHILD');
    });

    it('should create child from logger without prefix', () => {
      setVerboseMode(true);
      const custom = createLogger({ level: LogLevel.DEBUG });
      const child = custom.child('CHILD');

      child.info('child message');
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy.mock.calls[0][0]).toContain('[CHILD]');
    });
  });

  describe('log levels', () => {
    it('should format all level names', () => {
      setVerboseMode(true);
      const custom = createLogger({ level: LogLevel.DEBUG });

      custom.debug('d');
      expect(logSpy.mock.calls[0][0]).toContain('[DEBUG]');

      custom.info('i');
      expect(logSpy.mock.calls[1][0]).toContain('[INFO]');

      custom.warn('w');
      expect(logSpy.mock.calls[2][0]).toContain('[WARN]');

      custom.error('e');
      expect(errorSpy.mock.calls[0][0]).toContain('[ERROR]');
    });
  });
});
