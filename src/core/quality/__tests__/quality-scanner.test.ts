import { formatQualityReport, DEFAULT_CONFIG } from '../quality-scanner';
import type { QualityReport } from '../types';

describe('Quality Scanner', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have all TRUST 5 pillars configured', () => {
      expect(DEFAULT_CONFIG.testable).toBeDefined();
      expect(DEFAULT_CONFIG.readable).toBeDefined();
      expect(DEFAULT_CONFIG.unified).toBeDefined();
      expect(DEFAULT_CONFIG.secured).toBeDefined();
      expect(DEFAULT_CONFIG.trackable).toBeDefined();
      expect(DEFAULT_CONFIG.enforcement).toBeDefined();
    });

    it('should have reasonable default thresholds', () => {
      expect(DEFAULT_CONFIG.testable.minCoverage).toBe(85);
      expect(DEFAULT_CONFIG.readable.maxComplexity).toBe(10);
      expect(DEFAULT_CONFIG.readable.maxFileLines).toBe(300);
      expect(DEFAULT_CONFIG.readable.maxFunctionLines).toBe(50);
      expect(DEFAULT_CONFIG.secured.maxSeverity).toBe('medium');
      expect(DEFAULT_CONFIG.trackable.conventionalCommits).toBe(true);
    });

    it('should enforce gates by default', () => {
      expect(DEFAULT_CONFIG.enforcement.blockOnFailure).toBe(true);
      expect(DEFAULT_CONFIG.enforcement.allowOverride).toBe(false);
    });
  });

  describe('formatQualityReport', () => {
    const passingReport: QualityReport = {
      testable: { coverage: 90, hasUnitTests: true, passed: true },
      readable: { complexity: 5, lintErrors: 0, passed: true },
      unified: { formatterCompliant: true, passed: true },
      secured: { secretsFound: false, vulnerabilities: [], passed: true },
      trackable: { conventionalCommit: true, passed: true, commitMessage: 'feat: add login' },
      overall: { passed: true, score: 100, blockers: [] },
    };

    const failingReport: QualityReport = {
      testable: { coverage: 50, hasUnitTests: true, passed: false },
      readable: { complexity: 15, lintErrors: 3, passed: false },
      unified: { formatterCompliant: false, passed: false },
      secured: {
        secretsFound: true,
        vulnerabilities: [{
          name: 'test-vuln',
          severity: 'high',
          description: 'test',
          path: 'test',
        }],
        passed: false,
      },
      trackable: { conventionalCommit: false, passed: false, commitMessage: 'bad commit' },
      overall: {
        passed: false,
        score: 20,
        blockers: [
          'Coverage 50% < 85% minimum',
          '3 lint errors found',
          'Secrets detected in code changes',
        ],
      },
    };

    it('should format a passing report', () => {
      const summary = formatQualityReport(passingReport);
      expect(summary).toContain('Quality Report (TRUST 5)');
      expect(summary).toContain('PASS');
      expect(summary).toContain('90%');
      expect(summary).toContain('Score: 100/100');
      expect(summary).not.toContain('Blockers');
    });

    it('should format a failing report with blockers', () => {
      const summary = formatQualityReport(failingReport);
      expect(summary).toContain('FAIL');
      expect(summary).toContain('50%');
      expect(summary).toContain('Blockers');
      expect(summary).toContain('Coverage 50%');
      expect(summary).toContain('Secrets found!');
      expect(summary).toContain('Score: 20/100');
    });

    it('should include a markdown table', () => {
      const summary = formatQualityReport(passingReport);
      expect(summary).toContain('| Pillar | Status | Details |');
      expect(summary).toContain('Testable');
      expect(summary).toContain('Readable');
      expect(summary).toContain('Unified');
      expect(summary).toContain('Secured');
      expect(summary).toContain('Trackable');
    });

    it('should show commit message in trackable', () => {
      const summary = formatQualityReport(passingReport);
      expect(summary).toContain('feat: add login');
    });

    it('should show vulnerability count', () => {
      const summary = formatQualityReport(failingReport);
      expect(summary).toContain('1 vulns');
    });
  });
});
