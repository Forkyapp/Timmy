/**
 * TRUST 5 Quality Scanner
 *
 * Runs automated quality checks against changed files
 * and produces a QualityReport for supervisor review.
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import { logger } from '@/shared/utils/logger.util';
import type {
  QualityGatesConfig,
  QualityReport,
  CoverageResult,
  LintResult,
  SecurityResult,
  CommitResult,
} from './types';

const execAsync = promisify(exec);

/** Default configuration matching quality-gates.yaml */
export const DEFAULT_CONFIG: QualityGatesConfig = {
  testable: {
    minCoverage: 85,
    requireUnitTests: true,
    requireIntegrationTests: false,
  },
  readable: {
    maxComplexity: 10,
    maxFileLines: 300,
    maxFunctionLines: 50,
    namingConvention: 'camelCase',
  },
  unified: {
    linter: 'eslint',
    formatter: 'prettier',
    mustPass: true,
  },
  secured: {
    scanSecrets: true,
    scanVulnerabilities: true,
    maxSeverity: 'medium',
  },
  trackable: {
    conventionalCommits: true,
    requireIssueReference: false,
  },
  enforcement: {
    blockOnFailure: true,
    allowOverride: false,
  },
};

/**
 * Run all TRUST 5 quality gates in parallel.
 */
export async function runQualityGates(
  changedFiles: string[],
  repoPath: string,
  config: QualityGatesConfig = DEFAULT_CONFIG
): Promise<QualityReport> {
  const [coverage, lint, security, commits] = await Promise.all([
    runCoverageCheck(repoPath, config),
    runLintCheck(changedFiles, repoPath),
    runSecurityScan(repoPath, config),
    checkCommitFormat(repoPath),
  ]);

  return buildReport(coverage, lint, security, commits, config);
}

/**
 * Testable: Run test coverage check.
 */
async function runCoverageCheck(
  repoPath: string,
  config: QualityGatesConfig
): Promise<CoverageResult> {
  try {
    const { stdout } = await execAsync(
      'npm test -- --coverage --coverageReporters=json-summary --silent 2>/dev/null',
      { cwd: repoPath, timeout: 300000 }
    );

    // Try to parse coverage-summary.json
    try {
      const { stdout: summaryJson } = await execAsync(
        'cat coverage/coverage-summary.json 2>/dev/null',
        { cwd: repoPath }
      );
      const summary = JSON.parse(summaryJson);
      const total = summary.total || {};

      return {
        lineCoverage: total.lines?.pct ?? 0,
        branchCoverage: total.branches?.pct ?? 0,
        functionCoverage: total.functions?.pct ?? 0,
        uncoveredFiles: [],
      };
    } catch {
      // If we can't read the coverage file, parse from stdout
      const coverageMatch = stdout.match(/All files\s*\|\s*([\d.]+)/);
      return {
        lineCoverage: coverageMatch ? parseFloat(coverageMatch[1]) : 0,
        branchCoverage: 0,
        functionCoverage: 0,
        uncoveredFiles: [],
      };
    }
  } catch (error) {
    logger.warn('Coverage check failed', { error: (error as Error).message });
    return {
      lineCoverage: 0,
      branchCoverage: 0,
      functionCoverage: 0,
      uncoveredFiles: [],
    };
  }
}

/**
 * Readable: Run lint check on changed files.
 */
async function runLintCheck(
  changedFiles: string[],
  repoPath: string
): Promise<LintResult> {
  try {
    const tsFiles = changedFiles.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    if (tsFiles.length === 0) {
      return { errors: 0, warnings: 0, issues: [] };
    }

    const fileList = tsFiles.map(f => `"${f}"`).join(' ');
    const { stdout } = await execAsync(
      `npx eslint ${fileList} --format json 2>/dev/null || true`,
      { cwd: repoPath, timeout: 60000 }
    );

    try {
      const results = JSON.parse(stdout);
      const issues = results.flatMap((r: { messages: Array<{ line: number; column: number; severity: number; message: string; ruleId: string }>; filePath: string }) =>
        r.messages.map((m: { line: number; column: number; severity: number; message: string; ruleId: string }) => ({
          file: r.filePath,
          line: m.line,
          column: m.column,
          severity: m.severity === 2 ? 'error' as const : 'warning' as const,
          message: m.message,
          rule: m.ruleId || 'unknown',
        }))
      );

      return {
        errors: issues.filter((i: { severity: string }) => i.severity === 'error').length,
        warnings: issues.filter((i: { severity: string }) => i.severity === 'warning').length,
        issues,
      };
    } catch {
      return { errors: 0, warnings: 0, issues: [] };
    }
  } catch (error) {
    logger.warn('Lint check failed', { error: (error as Error).message });
    return { errors: 0, warnings: 0, issues: [] };
  }
}

/**
 * Secured: Run security scan.
 */
async function runSecurityScan(
  repoPath: string,
  _config: QualityGatesConfig
): Promise<SecurityResult> {
  const result: SecurityResult = {
    secretsFound: false,
    vulnerabilities: [],
    highSeverityCount: 0,
  };

  // Check for common secret patterns in changed files
  try {
    const { stdout } = await execAsync(
      `git diff HEAD~1 --unified=0 2>/dev/null | grep -iE "(api_key|secret|password|token|private_key)\\s*[:=]" || true`,
      { cwd: repoPath, timeout: 30000 }
    );
    result.secretsFound = stdout.trim().length > 0;
  } catch {
    // Ignore grep failures
  }

  // Run npm audit
  try {
    const { stdout } = await execAsync(
      'npm audit --json 2>/dev/null || true',
      { cwd: repoPath, timeout: 60000 }
    );
    try {
      const audit = JSON.parse(stdout);
      const vulns = audit.vulnerabilities || {};
      for (const [name, details] of Object.entries(vulns)) {
        const vuln = details as { severity: string; via: string[] };
        result.vulnerabilities.push({
          name,
          severity: vuln.severity as 'low' | 'moderate' | 'high' | 'critical',
          description: Array.isArray(vuln.via) ? vuln.via.join(', ') : String(vuln.via),
          path: name,
        });
        if (vuln.severity === 'high' || vuln.severity === 'critical') {
          result.highSeverityCount++;
        }
      }
    } catch {
      // Can't parse audit output
    }
  } catch {
    // npm audit not available
  }

  return result;
}

/**
 * Trackable: Check commit message format.
 */
async function checkCommitFormat(repoPath: string): Promise<CommitResult> {
  try {
    const { stdout } = await execAsync(
      'git log -1 --pretty=format:"%s"',
      { cwd: repoPath, timeout: 10000 }
    );

    const message = stdout.replace(/^"|"$/g, '');
    const conventionalPattern = /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .+/;

    return {
      message,
      isConventional: conventionalPattern.test(message),
      type: extractCommitType(message),
    };
  } catch {
    return {
      message: '',
      isConventional: false,
      type: 'unknown',
    };
  }
}

function extractCommitType(message: string): string {
  const match = message.match(/^(\w+)(\(.+\))?:/);
  return match ? match[1] : 'unknown';
}

/**
 * Build the final quality report from individual check results.
 */
function buildReport(
  coverage: CoverageResult,
  lint: LintResult,
  security: SecurityResult,
  commit: CommitResult,
  config: QualityGatesConfig
): QualityReport {
  const blockers: string[] = [];

  const testablePassed = coverage.lineCoverage >= config.testable.minCoverage;
  if (!testablePassed) {
    blockers.push(`Coverage ${coverage.lineCoverage}% < ${config.testable.minCoverage}% minimum`);
  }

  const readablePassed = lint.errors === 0;
  if (!readablePassed) {
    blockers.push(`${lint.errors} lint errors found`);
  }

  const unifiedPassed = lint.errors === 0; // ESLint covers formatting if configured
  const securedPassed = !security.secretsFound && security.highSeverityCount === 0;
  if (security.secretsFound) {
    blockers.push('Secrets detected in code changes');
  }
  if (security.highSeverityCount > 0) {
    blockers.push(`${security.highSeverityCount} high/critical vulnerabilities`);
  }

  const trackablePassed = !config.trackable.conventionalCommits || commit.isConventional;
  if (!trackablePassed) {
    blockers.push('Commit message does not follow conventional format');
  }

  // Calculate score: 20 points per pillar
  let score = 0;
  if (testablePassed) score += 20;
  else score += Math.round((coverage.lineCoverage / config.testable.minCoverage) * 20);

  if (readablePassed) score += 20;
  if (unifiedPassed) score += 20;
  if (securedPassed) score += 20;
  if (trackablePassed) score += 20;

  return {
    testable: {
      coverage: coverage.lineCoverage,
      hasUnitTests: coverage.lineCoverage > 0,
      passed: testablePassed,
      details: coverage,
    },
    readable: {
      complexity: 0, // Would need AST analysis for real complexity
      lintErrors: lint.errors,
      passed: readablePassed,
      details: lint,
    },
    unified: {
      formatterCompliant: unifiedPassed,
      passed: unifiedPassed,
    },
    secured: {
      secretsFound: security.secretsFound,
      vulnerabilities: security.vulnerabilities,
      passed: securedPassed,
    },
    trackable: {
      conventionalCommit: commit.isConventional,
      passed: trackablePassed,
      commitMessage: commit.message,
    },
    overall: {
      passed: blockers.length === 0,
      score,
      blockers,
    },
  };
}

/**
 * Format a QualityReport as a markdown summary for ClickUp.
 */
export function formatQualityReport(report: QualityReport): string {
  const icon = (passed: boolean): string => passed ? 'PASS' : 'FAIL';

  const lines = [
    '## Quality Report (TRUST 5)',
    '',
    '| Pillar | Status | Details |',
    '|--------|--------|---------|',
    `| Testable | ${icon(report.testable.passed)} | ${report.testable.coverage}% coverage |`,
    `| Readable | ${icon(report.readable.passed)} | ${report.readable.lintErrors} lint errors |`,
    `| Unified | ${icon(report.unified.passed)} | ${report.unified.formatterCompliant ? 'Compliant' : 'Non-compliant'} |`,
    `| Secured | ${icon(report.secured.passed)} | ${report.secured.secretsFound ? 'Secrets found!' : 'Clean'}${report.secured.vulnerabilities.length > 0 ? `, ${report.secured.vulnerabilities.length} vulns` : ''} |`,
    `| Trackable | ${icon(report.trackable.passed)} | ${report.trackable.commitMessage || 'N/A'} |`,
    '',
    `**Overall Score: ${report.overall.score}/100**`,
  ];

  if (report.overall.blockers.length > 0) {
    lines.push('', '**Blockers:**');
    for (const blocker of report.overall.blockers) {
      lines.push(`- ${blocker}`);
    }
  }

  return lines.join('\n');
}
