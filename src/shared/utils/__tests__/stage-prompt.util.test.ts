import { STAGE_CONFIGS, isStageCritical } from '../stage-prompt.util';
import type { StageConfig } from '../stage-prompt.util';

describe('stage-prompt.util', () => {
  describe('STAGE_CONFIGS', () => {
    it('should have analysis config', () => {
      const config: StageConfig = STAGE_CONFIGS['analysis'];
      expect(config.name).toBe('Gemini Analysis');
      expect(config.canSkip).toBe(true);
      expect(config.description).toBeDefined();
    });

    it('should have implementation config that cannot be skipped', () => {
      const config = STAGE_CONFIGS['implementation'];
      expect(config.name).toBe('Claude Implementation');
      expect(config.canSkip).toBe(false);
    });

    it('should have review config', () => {
      const config = STAGE_CONFIGS['review'];
      expect(config.name).toBe('Codex Code Review');
      expect(config.canSkip).toBe(true);
    });

    it('should have fixes config', () => {
      const config = STAGE_CONFIGS['fixes'];
      expect(config.name).toBe('Claude Fixes');
      expect(config.canSkip).toBe(true);
    });
  });

  describe('isStageCritical', () => {
    it('should return true for implementation (cannot skip)', () => {
      expect(isStageCritical('implementation')).toBe(true);
    });

    it('should return false for analysis (can skip)', () => {
      expect(isStageCritical('analysis')).toBe(false);
    });

    it('should return false for review (can skip)', () => {
      expect(isStageCritical('review')).toBe(false);
    });

    it('should return false for fixes (can skip)', () => {
      expect(isStageCritical('fixes')).toBe(false);
    });

    it('should return false for unknown stage', () => {
      expect(isStageCritical('nonexistent')).toBe(false);
    });
  });
});
