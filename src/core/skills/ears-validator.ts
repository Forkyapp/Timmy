/**
 * EARS (Easy Approach to Requirements Syntax) Validator
 *
 * Validates feature specifications against EARS patterns
 * to ensure structured, parseable requirements.
 */

export interface EARSValidation {
  /** At least one "The system SHALL" statement (not SHALL NOT) */
  hasUbiquitous: boolean;
  /** At least one "WHEN ..., the system SHALL" statement */
  hasEventDriven: boolean;
  /** At least one "WHILE ..., the system SHALL" statement */
  hasStateDriven: boolean;
  /** At least one "The system SHALL NOT" statement */
  hasConstraints: boolean;
  /** At least one GIVEN/WHEN/THEN acceptance criterion */
  hasAcceptanceCriteria: boolean;
  /** Total number of EARS requirements (SHALL count) */
  requirementCount: number;
  /** Count by type */
  counts: {
    ubiquitous: number;
    eventDriven: number;
    stateDriven: number;
    constraints: number;
    optional: number;
    acceptanceCriteria: number;
  };
  /** Validation issues found */
  issues: string[];
  /** Overall pass/fail */
  passed: boolean;
  /** Quality score 0-100 */
  score: number;
}

// EARS regex patterns
const PATTERNS = {
  // Ubiquitous: starts with "The system SHALL" (not preceded by WHEN/WHILE/WHERE clause)
  ubiquitous: /^[\s\-*]*The system SHALL (?!NOT)/gim,
  eventDriven: /WHEN .+?,\s*the system SHALL/gi,
  stateDriven: /WHILE .+?,\s*the system SHALL/gi,
  constraint: /The system SHALL NOT/gi,
  optional: /WHERE .+?,\s*the system SHALL/gi,
  acceptanceCriteria: /GIVEN .+[\n\r]\s*WHEN .+[\n\r]\s*THEN/gi,
  anyShall: /SHALL/gi,
};

/**
 * Validate a feature specification against EARS format.
 */
export function validateEARS(spec: string): EARSValidation {
  const counts = {
    ubiquitous: countMatches(spec, PATTERNS.ubiquitous),
    eventDriven: countMatches(spec, PATTERNS.eventDriven),
    stateDriven: countMatches(spec, PATTERNS.stateDriven),
    constraints: countMatches(spec, PATTERNS.constraint),
    optional: countMatches(spec, PATTERNS.optional),
    acceptanceCriteria: countMatches(spec, PATTERNS.acceptanceCriteria),
  };

  const requirementCount = countMatches(spec, PATTERNS.anyShall);
  const issues = collectIssues(spec, counts);

  // Calculate score: 20 points per required element (5 elements = 100)
  let score = 0;
  if (counts.ubiquitous > 0) score += 20;
  if (counts.eventDriven >= 3) score += 25;
  else if (counts.eventDriven > 0) score += Math.round(counts.eventDriven / 3 * 25);
  if (counts.constraints > 0) score += 20;
  if (counts.acceptanceCriteria > 0) score += 20;
  if (counts.stateDriven > 0 || counts.optional > 0) score += 15;

  const passed = issues.length === 0;

  return {
    hasUbiquitous: counts.ubiquitous > 0,
    hasEventDriven: counts.eventDriven > 0,
    hasStateDriven: counts.stateDriven > 0,
    hasConstraints: counts.constraints > 0,
    hasAcceptanceCriteria: counts.acceptanceCriteria > 0,
    requirementCount,
    counts,
    issues,
    passed,
    score,
  };
}

/**
 * Generate a human-readable validation summary.
 */
export function formatValidationSummary(validation: EARSValidation): string {
  const { counts, score, issues } = validation;

  const lines = [
    `**EARS Validation Score: ${score}/100**`,
    '',
    `| Requirement Type | Count | Status |`,
    `|-----------------|-------|--------|`,
    `| Ubiquitous (SHALL) | ${counts.ubiquitous} | ${counts.ubiquitous > 0 ? 'PASS' : 'FAIL'} |`,
    `| Event-Driven (WHEN...SHALL) | ${counts.eventDriven} | ${counts.eventDriven >= 3 ? 'PASS' : 'FAIL'} |`,
    `| State-Driven (WHILE...SHALL) | ${counts.stateDriven} | ${counts.stateDriven > 0 ? 'PASS' : 'INFO'} |`,
    `| Constraints (SHALL NOT) | ${counts.constraints} | ${counts.constraints > 0 ? 'PASS' : 'FAIL'} |`,
    `| Optional (WHERE...SHALL) | ${counts.optional} | INFO |`,
    `| Acceptance Criteria (GWT) | ${counts.acceptanceCriteria} | ${counts.acceptanceCriteria > 0 ? 'PASS' : 'FAIL'} |`,
  ];

  if (issues.length > 0) {
    lines.push('', '**Issues:**');
    for (const issue of issues) {
      lines.push(`- ${issue}`);
    }
  }

  return lines.join('\n');
}

function countMatches(text: string, pattern: RegExp): number {
  // Reset lastIndex since we reuse global regex
  pattern.lastIndex = 0;
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function collectIssues(
  _spec: string,
  counts: EARSValidation['counts']
): string[] {
  const issues: string[] = [];

  if (counts.ubiquitous === 0) {
    issues.push('Missing ubiquitous requirements: Add at least one "The system SHALL [action]" statement');
  }

  if (counts.eventDriven < 3) {
    issues.push(
      `Insufficient event-driven requirements: Found ${counts.eventDriven}, need at least 3 "WHEN [event], the system SHALL [action]" statements`
    );
  }

  if (counts.constraints === 0) {
    issues.push('Missing constraints: Add at least one "The system SHALL NOT [action]" statement');
  }

  if (counts.acceptanceCriteria === 0) {
    issues.push('Missing acceptance criteria: Add at least one GIVEN/WHEN/THEN scenario');
  }

  return issues;
}
