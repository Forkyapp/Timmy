# Phase 02: EARS Requirements Format

## Problem

Gemini produces free-form specifications. Each spec looks different. The supervisor can't programmatically validate if requirements are complete or well-formed.

Example of current output:
```
## Feature Overview
Add login functionality...

## Files to Modify
- src/auth/login.ts
- src/components/LoginForm.tsx
```

No structure. No way to check completeness automatically.

## Solution

Use EARS (Easy Approach to Requirements Syntax) format. Each requirement follows a specific pattern that can be parsed and validated.

## EARS Syntax

| Type | Pattern | Use Case |
|------|---------|----------|
| **Ubiquitous** | The system SHALL [action] | Always true |
| **Event-Driven** | WHEN [trigger], the system SHALL [action] | Response to event |
| **State-Driven** | WHILE [state], the system SHALL [action] | During condition |
| **Unwanted** | The system SHALL NOT [action] | Constraints |
| **Optional** | WHERE [feature], the system SHALL [action] | Conditional |

## Features

### 1. EARS Skill Template

```markdown
# EARS Requirements Format

## Syntax Rules

Write requirements using these patterns:

### Ubiquitous (Always True)
"The system SHALL [action]"
Example: "The system SHALL encrypt all passwords using bcrypt"

### Event-Driven (Response to Trigger)
"WHEN [event], the system SHALL [action]"
Example: "WHEN user clicks login, the system SHALL validate credentials"

### State-Driven (During Condition)
"WHILE [condition], the system SHALL [action]"
Example: "WHILE session is active, the system SHALL refresh token every 15 minutes"

### Unwanted (Constraints)
"The system SHALL NOT [action]"
Example: "The system SHALL NOT store plain-text passwords"

### Optional (Feature-Dependent)
"WHERE [feature flag], the system SHALL [action]"
Example: "WHERE premium tier enabled, the system SHALL allow API access"
```

---

### 2. Updated Feature Spec Template

```markdown
# Feature Specification: [Title]

## Overview
[2-3 sentences describing the feature]

## EARS Requirements

### Functional Requirements
- WHEN user [action], the system SHALL [response]
- The system SHALL [behavior]

### Non-Functional Requirements
- WHILE [condition], the system SHALL [maintain property]
- The system SHALL NOT [constraint]

### Optional Requirements
- WHERE [feature], the system SHALL [behavior]

## Files to Modify
| File | Changes |
|------|---------|
| `path/to/file.ts` | Description of changes |

## Acceptance Criteria
- GIVEN [precondition]
  WHEN [action]
  THEN [expected result]

## Test Scenarios
1. [Scenario name]: [Description]
```

---

### 3. EARS Validator

Programmatically check spec quality:

```typescript
interface EARSValidation {
  hasUbiquitous: boolean;      // At least one SHALL statement
  hasEventDriven: boolean;     // At least one WHEN...SHALL
  hasConstraints: boolean;     // At least one SHALL NOT
  hasAcceptanceCriteria: boolean;
  requirementCount: number;
  issues: string[];
}

function validateEARS(spec: string): EARSValidation {
  const ubiquitousPattern = /The system SHALL (?!NOT)/gi;
  const eventPattern = /WHEN .+, the system SHALL/gi;
  const constraintPattern = /The system SHALL NOT/gi;
  const acceptancePattern = /GIVEN .+\s+WHEN .+\s+THEN/gi;

  return {
    hasUbiquitous: ubiquitousPattern.test(spec),
    hasEventDriven: eventPattern.test(spec),
    hasConstraints: constraintPattern.test(spec),
    hasAcceptanceCriteria: acceptancePattern.test(spec),
    requirementCount: (spec.match(/SHALL/gi) || []).length,
    issues: collectIssues(spec)
  };
}
```

---

### 4. Supervisor Integration

Supervisor uses EARS validation in review:

```typescript
async function reviewAnalysis(spec: string): Promise<Decision> {
  const validation = validateEARS(spec);

  if (!validation.hasUbiquitous) {
    return {
      decision: 'REVISE',
      reason: 'Missing core requirements (no "SHALL" statements)',
      feedback: 'Add at least one "The system SHALL..." requirement'
    };
  }

  if (!validation.hasAcceptanceCriteria) {
    return {
      decision: 'REVISE',
      reason: 'Missing acceptance criteria',
      feedback: 'Add Given/When/Then scenarios for testing'
    };
  }

  // Passed automatic checks, proceed to AI review
  return supervisorAIReview(spec, validation);
}
```

---

### 5. Gemini Prompt Update

Update analysis skill to require EARS:

```markdown
## Output Requirements

You MUST use EARS syntax for all requirements:
- At least 3 functional requirements using "WHEN [event], the system SHALL [action]"
- At least 1 constraint using "The system SHALL NOT [action]"
- Acceptance criteria in Given/When/Then format

❌ BAD: "The login should validate the password"
✅ GOOD: "WHEN user submits login form, the system SHALL validate password against stored hash"
```

---

## Success Criteria

- [ ] EARS skill created in `skills/analysis/ears-format.md`
- [ ] Feature spec template updated
- [ ] EARS validator implemented
- [ ] Gemini produces EARS-formatted output
- [ ] Supervisor validates EARS structure

## Effort Estimate

- EARS skill file: 1 hour
- Template update: 1 hour
- Validator: 2 hours
- Gemini integration: 1 hour
- Testing: 2 hours

**Total: ~1 day**
