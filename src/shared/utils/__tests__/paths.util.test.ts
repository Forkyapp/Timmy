import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  getConfigDir,
  getDataDir,
  getLogsDir,
  getAllDirectories,
  isFirstRun,
  isDevMode,
  findEnvFile,
  getConfigPath,
  getDataPath,
} from '../paths.util';

describe('paths.util', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getConfigDir', () => {
    it('should return TIMMY_CONFIG_DIR if set', () => {
      process.env.TIMMY_CONFIG_DIR = '/custom/config';
      expect(getConfigDir()).toBe('/custom/config');
    });

    it('should return XDG_CONFIG_HOME/timmy if set', () => {
      delete process.env.TIMMY_CONFIG_DIR;
      process.env.XDG_CONFIG_HOME = '/home/user/.config';
      expect(getConfigDir()).toBe('/home/user/.config/timmy');
    });

    it('should return ~/.timmy by default', () => {
      delete process.env.TIMMY_CONFIG_DIR;
      delete process.env.XDG_CONFIG_HOME;
      expect(getConfigDir()).toBe(path.join(os.homedir(), '.timmy'));
    });
  });

  describe('getDataDir', () => {
    it('should return TIMMY_DATA_DIR if set', () => {
      process.env.TIMMY_DATA_DIR = '/custom/data';
      expect(getDataDir()).toBe('/custom/data');
    });

    it('should return XDG_DATA_HOME/timmy if set', () => {
      delete process.env.TIMMY_DATA_DIR;
      process.env.XDG_DATA_HOME = '/home/user/.local/share';
      expect(getDataDir()).toBe('/home/user/.local/share/timmy');
    });

    it('should return config/data by default', () => {
      delete process.env.TIMMY_DATA_DIR;
      delete process.env.XDG_DATA_HOME;
      delete process.env.TIMMY_CONFIG_DIR;
      delete process.env.XDG_CONFIG_HOME;
      const configDir = getConfigDir();
      expect(getDataDir()).toBe(path.join(configDir, 'data'));
    });
  });

  describe('getLogsDir', () => {
    it('should return data/logs', () => {
      process.env.TIMMY_DATA_DIR = '/custom/data';
      expect(getLogsDir()).toBe('/custom/data/logs');
    });
  });

  describe('getAllDirectories', () => {
    it('should return all required directories', () => {
      process.env.TIMMY_CONFIG_DIR = '/test/config';
      process.env.TIMMY_DATA_DIR = '/test/data';

      const dirs = getAllDirectories();

      expect(dirs).toContain('/test/config');
      expect(dirs).toContain('/test/data');
      expect(dirs).toContain('/test/data/cache');
      expect(dirs).toContain('/test/data/state');
      expect(dirs).toContain('/test/data/tracking');
      expect(dirs).toContain('/test/data/discord');
      expect(dirs).toContain('/test/data/logs');
    });
  });

  describe('getConfigPath', () => {
    it('should return path to config file', () => {
      process.env.TIMMY_CONFIG_DIR = '/test/config';
      expect(getConfigPath('projects.json')).toBe('/test/config/projects.json');
    });
  });

  describe('getDataPath', () => {
    it('should return path to data file with multiple segments', () => {
      process.env.TIMMY_DATA_DIR = '/test/data';
      expect(getDataPath('cache', 'processed-tasks.json')).toBe('/test/data/cache/processed-tasks.json');
    });
  });

  describe('isFirstRun', () => {
    beforeEach(() => {
      jest.spyOn(fs, 'existsSync');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return true if no .env and no projects.json exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(isFirstRun()).toBe(true);
    });

    it('should return false if .env exists', () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.endsWith('.env');
      });
      expect(isFirstRun()).toBe(false);
    });
  });

  describe('isDevMode', () => {
    beforeEach(() => {
      jest.spyOn(fs, 'existsSync');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return true if .env exists in cwd', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      expect(isDevMode()).toBe(true);
    });

    it('should return false if no .env in cwd', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(isDevMode()).toBe(false);
    });
  });

  describe('findEnvFile', () => {
    beforeEach(() => {
      jest.spyOn(fs, 'existsSync');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return cwd .env path if it exists', () => {
      const cwdEnv = path.join(process.cwd(), '.env');
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath === cwdEnv;
      });
      expect(findEnvFile()).toBe(cwdEnv);
    });

    it('should return null if no .env exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(findEnvFile()).toBe(null);
    });
  });
});
