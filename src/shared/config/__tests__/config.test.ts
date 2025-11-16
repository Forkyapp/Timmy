/**
 * Config Validation Tests
 */

import { validateRequiredEnvVars } from '../index';
import { ValidationError } from '../../errors';

describe('validateRequiredEnvVars', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('when all required environment variables are present', () => {
    it('should not throw an error', () => {
      process.env.CLICKUP_API_KEY = 'test-clickup-key';
      process.env.GITHUB_TOKEN = 'test-github-token';
      process.env.GITHUB_REPO_PATH = '/test/repo/path';

      expect(() => validateRequiredEnvVars()).not.toThrow();
    });
  });

  describe('when CLICKUP_API_KEY is missing', () => {
    it('should throw ValidationError listing the missing variable', () => {
      delete process.env.CLICKUP_API_KEY;
      process.env.GITHUB_TOKEN = 'test-github-token';
      process.env.GITHUB_REPO_PATH = '/test/repo/path';

      expect(() => validateRequiredEnvVars()).toThrow(ValidationError);
      expect(() => validateRequiredEnvVars()).toThrow('CLICKUP_API_KEY');
    });
  });

  describe('when GITHUB_TOKEN is missing', () => {
    it('should throw ValidationError listing the missing variable', () => {
      process.env.CLICKUP_API_KEY = 'test-clickup-key';
      delete process.env.GITHUB_TOKEN;
      process.env.GITHUB_REPO_PATH = '/test/repo/path';

      expect(() => validateRequiredEnvVars()).toThrow(ValidationError);
      expect(() => validateRequiredEnvVars()).toThrow('GITHUB_TOKEN');
    });
  });

  describe('when GITHUB_REPO_PATH is missing', () => {
    it('should throw ValidationError listing the missing variable', () => {
      process.env.CLICKUP_API_KEY = 'test-clickup-key';
      process.env.GITHUB_TOKEN = 'test-github-token';
      delete process.env.GITHUB_REPO_PATH;

      expect(() => validateRequiredEnvVars()).toThrow(ValidationError);
      expect(() => validateRequiredEnvVars()).toThrow('GITHUB_REPO_PATH');
    });
  });

  describe('when a variable is set to an empty string', () => {
    it('should treat empty string as missing for CLICKUP_API_KEY', () => {
      process.env.CLICKUP_API_KEY = '';
      process.env.GITHUB_TOKEN = 'test-github-token';
      process.env.GITHUB_REPO_PATH = '/test/repo/path';

      expect(() => validateRequiredEnvVars()).toThrow(ValidationError);
      expect(() => validateRequiredEnvVars()).toThrow('CLICKUP_API_KEY');
    });

    it('should treat empty string as missing for GITHUB_TOKEN', () => {
      process.env.CLICKUP_API_KEY = 'test-clickup-key';
      process.env.GITHUB_TOKEN = '';
      process.env.GITHUB_REPO_PATH = '/test/repo/path';

      expect(() => validateRequiredEnvVars()).toThrow(ValidationError);
      expect(() => validateRequiredEnvVars()).toThrow('GITHUB_TOKEN');
    });

    it('should treat empty string as missing for GITHUB_REPO_PATH', () => {
      process.env.CLICKUP_API_KEY = 'test-clickup-key';
      process.env.GITHUB_TOKEN = 'test-github-token';
      process.env.GITHUB_REPO_PATH = '';

      expect(() => validateRequiredEnvVars()).toThrow(ValidationError);
      expect(() => validateRequiredEnvVars()).toThrow('GITHUB_REPO_PATH');
    });
  });

  describe('when multiple variables are missing', () => {
    it('should list all missing variables in the error message', () => {
      delete process.env.CLICKUP_API_KEY;
      delete process.env.GITHUB_TOKEN;
      process.env.GITHUB_REPO_PATH = '/test/repo/path';

      try {
        validateRequiredEnvVars();
        fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('CLICKUP_API_KEY');
        expect(errorMessage).toContain('GITHUB_TOKEN');
      }
    });

    it('should list all three variables when all are missing', () => {
      delete process.env.CLICKUP_API_KEY;
      delete process.env.GITHUB_TOKEN;
      delete process.env.GITHUB_REPO_PATH;

      try {
        validateRequiredEnvVars();
        fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('CLICKUP_API_KEY');
        expect(errorMessage).toContain('GITHUB_TOKEN');
        expect(errorMessage).toContain('GITHUB_REPO_PATH');
      }
    });
  });

  describe('when variables are set to whitespace', () => {
    it('should treat whitespace as missing', () => {
      process.env.CLICKUP_API_KEY = '   ';
      process.env.GITHUB_TOKEN = 'test-github-token';
      process.env.GITHUB_REPO_PATH = '/test/repo/path';

      expect(() => validateRequiredEnvVars()).toThrow(ValidationError);
      expect(() => validateRequiredEnvVars()).toThrow('CLICKUP_API_KEY');
    });
  });
});
