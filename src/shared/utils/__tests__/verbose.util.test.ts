import { setVerboseMode, isVerbose, logVerbose } from '../verbose.util';

describe('verbose.util', () => {
  afterEach(() => {
    setVerboseMode(false);
  });

  describe('setVerboseMode / isVerbose', () => {
    it('should default to false', () => {
      expect(isVerbose()).toBe(false);
    });

    it('should enable verbose mode', () => {
      setVerboseMode(true);
      expect(isVerbose()).toBe(true);
    });

    it('should disable verbose mode', () => {
      setVerboseMode(true);
      setVerboseMode(false);
      expect(isVerbose()).toBe(false);
    });
  });

  describe('logVerbose', () => {
    it('should not log when verbose is off', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      logVerbose('test message');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should log when verbose is on', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      setVerboseMode(true);
      logVerbose('test message', 'extra');
      expect(spy).toHaveBeenCalledWith('test message', 'extra');
      spy.mockRestore();
    });
  });
});
