import { validateEARS, formatValidationSummary } from '../ears-validator';

describe('EARS Validator', () => {
  const validSpec = `
# Feature Specification: User Authentication

## Overview
Implement user login with JWT tokens.

## EARS Requirements

### Functional Requirements
- The system SHALL encrypt all passwords using bcrypt with a cost factor of 12
- WHEN user submits login form, the system SHALL validate credentials against stored hash
- WHEN user provides valid credentials, the system SHALL issue a JWT token
- WHEN user provides invalid credentials, the system SHALL return a 401 error

### Non-Functional Requirements
- WHILE session is active, the system SHALL refresh the JWT token every 15 minutes

### Constraints
- The system SHALL NOT store plain-text passwords
- The system SHALL NOT expose internal error details to the client

## Acceptance Criteria
- GIVEN a registered user with valid credentials
  WHEN they submit the login form
  THEN they receive a JWT token and are redirected to the dashboard
`;

  describe('validateEARS', () => {
    it('should pass for a well-formed EARS spec', () => {
      const result = validateEARS(validSpec);
      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.hasUbiquitous).toBe(true);
      expect(result.hasEventDriven).toBe(true);
      expect(result.hasConstraints).toBe(true);
      expect(result.hasAcceptanceCriteria).toBe(true);
    });

    it('should count requirements correctly', () => {
      const result = validateEARS(validSpec);
      expect(result.counts.ubiquitous).toBe(1);
      expect(result.counts.eventDriven).toBe(3);
      expect(result.counts.constraints).toBe(2);
      expect(result.counts.stateDriven).toBe(1);
      expect(result.counts.acceptanceCriteria).toBe(1);
    });

    it('should report missing ubiquitous requirements', () => {
      const spec = `
WHEN user clicks button, the system SHALL do something
WHEN user logs in, the system SHALL create session
WHEN user logs out, the system SHALL destroy session
GIVEN a user
  WHEN they click
  THEN something happens
`;
      const result = validateEARS(spec);
      expect(result.hasUbiquitous).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('Missing ubiquitous requirements')])
      );
    });

    it('should report insufficient event-driven requirements', () => {
      const spec = `
The system SHALL validate input
WHEN user clicks, the system SHALL respond
The system SHALL NOT crash
GIVEN a user
  WHEN they act
  THEN it works
`;
      const result = validateEARS(spec);
      expect(result.counts.eventDriven).toBe(1);
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('Insufficient event-driven requirements')])
      );
    });

    it('should report missing constraints', () => {
      const spec = `
The system SHALL validate input
WHEN user clicks, the system SHALL respond
WHEN user types, the system SHALL echo
WHEN user leaves, the system SHALL cleanup
GIVEN a user
  WHEN they act
  THEN it works
`;
      const result = validateEARS(spec);
      expect(result.hasConstraints).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('Missing constraints')])
      );
    });

    it('should report missing acceptance criteria', () => {
      const spec = `
The system SHALL validate input
WHEN user clicks, the system SHALL respond
WHEN user types, the system SHALL echo
WHEN user leaves, the system SHALL cleanup
The system SHALL NOT crash
`;
      const result = validateEARS(spec);
      expect(result.hasAcceptanceCriteria).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('Missing acceptance criteria')])
      );
    });

    it('should fail completely for empty spec', () => {
      const result = validateEARS('');
      expect(result.passed).toBe(false);
      expect(result.requirementCount).toBe(0);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.score).toBe(0);
    });

    it('should detect state-driven requirements', () => {
      const result = validateEARS(validSpec);
      expect(result.hasStateDriven).toBe(true);
      expect(result.counts.stateDriven).toBe(1);
    });

    it('should calculate a reasonable score', () => {
      const result = validateEARS(validSpec);
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('should give zero score for empty spec', () => {
      const result = validateEARS('');
      expect(result.score).toBe(0);
    });
  });

  describe('formatValidationSummary', () => {
    it('should format a passing validation', () => {
      const validation = validateEARS(validSpec);
      const summary = formatValidationSummary(validation);
      expect(summary).toContain('EARS Validation Score');
      expect(summary).toContain('PASS');
      expect(summary).not.toContain('**Issues:**');
    });

    it('should include issues for failing validation', () => {
      const validation = validateEARS('No EARS here');
      const summary = formatValidationSummary(validation);
      expect(summary).toContain('FAIL');
      expect(summary).toContain('**Issues:**');
    });

    it('should include a table with requirement counts', () => {
      const validation = validateEARS(validSpec);
      const summary = formatValidationSummary(validation);
      expect(summary).toContain('Ubiquitous');
      expect(summary).toContain('Event-Driven');
      expect(summary).toContain('Constraints');
    });
  });
});
