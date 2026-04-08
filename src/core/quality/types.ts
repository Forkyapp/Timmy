/**
 * TRUST 5 Quality Gates Types
 *
 * T - Testable: Code has tests with sufficient coverage
 * R - Readable: Code is clear, lint-free, reasonable complexity
 * U - Unified: Consistent style and formatting
 * S - Secured: No secrets or known vulnerabilities
 * T - Trackable: Conventional commits, change documentation
 */

export interface QualityGatesConfig {
  testable: {
    minCoverage: number;
    requireUnitTests: boolean;
    requireIntegrationTests: boolean;
  };
  readable: {
    maxComplexity: number;
    maxFileLines: number;
    maxFunctionLines: number;
    namingConvention: string;
  };
  unified: {
    linter: string;
    formatter: string;
    mustPass: boolean;
  };
  secured: {
    scanSecrets: boolean;
    scanVulnerabilities: boolean;
    maxSeverity: 'low' | 'medium' | 'high' | 'critical';
  };
  trackable: {
    conventionalCommits: boolean;
    requireIssueReference: boolean;
  };
  enforcement: {
    blockOnFailure: boolean;
    allowOverride: boolean;
  };
}

export interface CoverageResult {
  lineCoverage: number;
  branchCoverage: number;
  functionCoverage: number;
  uncoveredFiles: string[];
}

export interface LintResult {
  errors: number;
  warnings: number;
  issues: LintIssue[];
}

export interface LintIssue {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
  rule: string;
}

export interface SecurityResult {
  secretsFound: boolean;
  vulnerabilities: Vulnerability[];
  highSeverityCount: number;
}

export interface Vulnerability {
  name: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  description: string;
  path: string;
}

export interface CommitResult {
  message: string;
  isConventional: boolean;
  type: string;
}

export interface QualityReport {
  testable: {
    coverage: number;
    hasUnitTests: boolean;
    passed: boolean;
    details?: CoverageResult;
  };
  readable: {
    complexity: number;
    lintErrors: number;
    passed: boolean;
    details?: LintResult;
  };
  unified: {
    formatterCompliant: boolean;
    passed: boolean;
  };
  secured: {
    secretsFound: boolean;
    vulnerabilities: Vulnerability[];
    passed: boolean;
  };
  trackable: {
    conventionalCommit: boolean;
    passed: boolean;
    commitMessage?: string;
  };
  overall: {
    passed: boolean;
    score: number;
    blockers: string[];
  };
}
