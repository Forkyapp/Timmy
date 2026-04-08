import { loadSkill, loadSkillWithDeps, loadAndApplySkill, loadTemplate, applyVariables, invalidateCache, listSkills } from '../loader';

describe('Skills Loader', () => {
  beforeEach(() => {
    invalidateCache();
  });

  describe('loadSkill', () => {
    it('should load analysis SKILL.md', async () => {
      const content = await loadSkill('analysis/SKILL.md');
      expect(content).toContain('# Skill: Analysis');
      expect(content).toContain('## Role');
      expect(content).toContain('## Instructions');
    });

    it('should load review SKILL.md', async () => {
      const content = await loadSkill('review/SKILL.md');
      expect(content).toContain('# Skill: Code Review');
    });

    it('should load fixes SKILL.md', async () => {
      const content = await loadSkill('fixes/SKILL.md');
      expect(content).toContain('# Skill: Fix TODO/FIXME Comments');
    });

    it('should load implementation SKILL.md', async () => {
      const content = await loadSkill('implementation/SKILL.md');
      expect(content).toContain('# Skill: Implementation');
    });

    it('should throw for non-existent skill', async () => {
      await expect(loadSkill('nonexistent/SKILL.md')).rejects.toThrow('Skill not found');
    });

    it('should cache loaded skills', async () => {
      const first = await loadSkill('analysis/SKILL.md');
      const second = await loadSkill('analysis/SKILL.md');
      expect(first).toBe(second);
    });
  });

  describe('loadSkillWithDeps', () => {
    it('should resolve @include directives in analysis skill', async () => {
      const content = await loadSkillWithDeps('analysis');
      // Analysis SKILL.md includes ears-format.md and ears-feature-spec.md
      expect(content).toContain('# Skill: Analysis');
      expect(content).toContain('EARS Requirements Format');
      expect(content).toContain('Feature Specification');
    });

    it('should load skills without dependencies', async () => {
      const content = await loadSkillWithDeps('review');
      expect(content).toContain('# Skill: Code Review');
    });
  });

  describe('applyVariables', () => {
    it('should replace template variables', () => {
      const template = 'Hello {{name}}, your task is {{taskId}}';
      const result = applyVariables(template, { name: 'Claude', taskId: '123' });
      expect(result).toBe('Hello Claude, your task is 123');
    });

    it('should replace multiple occurrences of same variable', () => {
      const template = '{{id}} and {{id}} again';
      const result = applyVariables(template, { id: '42' });
      expect(result).toBe('42 and 42 again');
    });

    it('should leave unmatched variables as-is', () => {
      const template = 'Hello {{name}}, {{unknown}} here';
      const result = applyVariables(template, { name: 'Claude' });
      expect(result).toBe('Hello Claude, {{unknown}} here');
    });
  });

  describe('loadAndApplySkill', () => {
    it('should load skill and apply variables', async () => {
      const content = await loadAndApplySkill('fixes', {
        taskId: '123',
        taskTitle: 'Test Task',
        branch: 'task-123',
        checkoutInstructions: 'cd /repo && git checkout task-123',
      });
      expect(content).toContain('123');
      expect(content).toContain('task-123');
      expect(content).not.toContain('{{taskId}}');
      expect(content).not.toContain('{{branch}}');
    });
  });

  describe('loadTemplate', () => {
    it('should load a template file with variables', async () => {
      const content = await loadTemplate('analysis/fallback.md', {
        taskTitle: 'My Feature',
        taskDescription: 'Implement something cool',
      });
      expect(content).toContain('Implement something cool');
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate specific cache entry', async () => {
      await loadSkill('analysis/SKILL.md');
      invalidateCache('analysis/SKILL.md');
      // Should not throw - just reloads from disk
      const content = await loadSkill('analysis/SKILL.md');
      expect(content).toContain('# Skill: Analysis');
    });

    it('should invalidate all cache entries', async () => {
      await loadSkill('analysis/SKILL.md');
      await loadSkill('review/SKILL.md');
      invalidateCache();
      // Both should reload
      const analysis = await loadSkill('analysis/SKILL.md');
      const review = await loadSkill('review/SKILL.md');
      expect(analysis).toContain('Analysis');
      expect(review).toContain('Review');
    });
  });

  describe('listSkills', () => {
    it('should list available skills', async () => {
      const skills = await listSkills();
      expect(skills).toContain('analysis');
      expect(skills).toContain('implementation');
      expect(skills).toContain('review');
      expect(skills).toContain('fixes');
    });
  });
});
