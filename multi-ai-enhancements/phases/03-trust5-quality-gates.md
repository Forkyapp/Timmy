# Phase 03: TRUST 5 Quality Gates

## Problem

Code review is subjective. Codex might say "looks good" while missing:
- Low test coverage
- Security vulnerabilities
- Style violations
- Missing documentation

No concrete thresholds. No automatic enforcement.

## Solution

Implement TRUST 5 framework - five quality pillars with measurable gates. Automatic checks run before supervisor review. Failures block progression.

## TRUST 5 Framework

| Pillar | Meaning | Gate |
|--------|---------|------|
| **T**estable | Code has tests | ≥85% coverage |
| **R**eadable | Code is clear | Lint passes, naming conventions |
| **U**nified | Consistent style | Formatter compliance |
| **S**ecured | No vulnerabilities | Security scan passes |
| **T**rackable | Changes documented | Conventional commits |

## Features

### 1. Quality Gates Configuration

```yaml
# src/core/skills/supervisor/quality-gates.yaml
trust5:
  testable:
    min_coverage: 85
    require_unit_tests: true
    require_integration_tests: false

  readable:
    max_complexity: 10
    max_file_lines: 300
    max_function_lines: 50
    naming_convention: camelCase

  unified:
    linter: eslint
    formatter: prettier
    must_pass: true

  secured:
    scan_secrets: true
    scan_vulnerabilities: true
    max_severity: medium  # Block on high/critical

  trackable:
    conventional_commits: true
    require_issue_reference: false

enforcement:
  block_on_failure: true
  allow_override: false  # Supervisor can't skip gates
```

---

### 2. Quality Scanner

Run automated checks:

```typescript
interface QualityReport {
  testable: {
    coverage: number;
    hasUnitTests: boolean;
    passed: boolean;
  };
  readable: {
    complexity: number;
    lintErrors: number;
    passed: boolean;
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
  };
  overall: {
    passed: boolean;
    score: number;  // 0-100
    blockers: string[];
  };
}

async function runQualityGates(
  changedFiles: string[],
  config: QualityGatesConfig
): Promise<QualityReport> {
  const [coverage, lint, security, commits] = await Promise.all([
    runCoverageCheck(changedFiles),
    runLintCheck(changedFiles),
    runSecurityScan(changedFiles),
    checkCommitFormat()
  ]);

  return buildReport(coverage, lint, security, commits, config);
}
```

---

### 3. Individual Checks

**Testable - Coverage Check:**
```typescript
async function runCoverageCheck(files: string[]): Promise<CoverageResult> {
  const result = await exec('npm run test:coverage -- --json');
  const report = JSON.parse(result.stdout);

  return {
    lineCoverage: report.total.lines.pct,
    branchCoverage: report.total.branches.pct,
    functionCoverage: report.total.functions.pct,
    uncoveredFiles: findUncoveredFiles(report, files)
  };
}
```

**Readable - Lint Check:**
```typescript
async function runLintCheck(files: string[]): Promise<LintResult> {
  const result = await exec(`npx eslint ${files.join(' ')} --format json`);
  const report = JSON.parse(result.stdout);

  return {
    errors: report.filter(r => r.severity === 2).length,
    warnings: report.filter(r => r.severity === 1).length,
    issues: report.flatMap(r => r.messages)
  };
}
```

**Secured - Security Scan:**
```typescript
async function runSecurityScan(files: string[]): Promise<SecurityResult> {
  // Check for secrets
  const secretsResult = await exec(`npx secretlint ${files.join(' ')}`);

  // Check for vulnerabilities (if applicable)
  const auditResult = await exec('npm audit --json');

  return {
    secretsFound: secretsResult.exitCode !== 0,
    vulnerabilities: parseAuditReport(auditResult.stdout),
    highSeverityCount: countHighSeverity(auditResult)
  };
}
```

**Trackable - Commit Check:**
```typescript
async function checkCommitFormat(): Promise<CommitResult> {
  const result = await exec('git log -1 --pretty=format:"%s"');
  const message = result.stdout;

  // Conventional commit pattern: type(scope): description
  const pattern = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/;

  return {
    message,
    isConventional: pattern.test(message),
    type: extractCommitType(message)
  };
}
```

---

### 4. Supervisor Integration

Quality gates run before supervisor AI review:

```typescript
async function reviewImplementation(context: ReviewContext): Promise<Decision> {
  // Step 1: Run automated quality gates
  const quality = await runQualityGates(context.changedFiles, config);

  // Step 2: Block on failures
  if (!quality.overall.passed) {
    return {
      decision: 'REVISE',
      reason: `Quality gates failed: ${quality.overall.blockers.join(', ')}`,
      feedback: generateFixInstructions(quality),
      automated: true  // No AI needed for this decision
    };
  }

  // Step 3: Passed gates, now AI reviews semantics
  return supervisorAIReview(context, quality);
}
```

---

### 5. Quality Report in ClickUp

Post quality summary to ClickUp:

```markdown
## Quality Report

| Pillar | Status | Details |
|--------|--------|---------|
| Testable | ✅ Pass | 87% coverage |
| Readable | ✅ Pass | 0 lint errors |
| Unified | ✅ Pass | Prettier compliant |
| Secured | ⚠️ Warn | 1 low-severity issue |
| Trackable | ✅ Pass | feat: add login |

**Overall Score: 92/100**
```

---

## Success Criteria

- [ ] Quality gates config created
- [ ] Coverage check implemented
- [ ] Lint check implemented
- [ ] Security scan implemented
- [ ] Commit format check implemented
- [ ] Gates integrated into supervisor flow
- [ ] Report posted to ClickUp

## Effort Estimate

- Config file: 1 hour
- Individual checks: 4 hours
- Integration: 2 hours
- ClickUp reporting: 1 hour
- Testing: 2 hours

**Total: ~1.5 days**
