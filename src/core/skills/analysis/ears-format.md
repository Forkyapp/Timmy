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

## Output Requirements

You MUST use EARS syntax for all requirements:
- At least 3 functional requirements using "WHEN [event], the system SHALL [action]"
- At least 1 ubiquitous requirement using "The system SHALL [action]"
- At least 1 constraint using "The system SHALL NOT [action]"
- Acceptance criteria in Given/When/Then format

### Examples

BAD: "The login should validate the password"
GOOD: "WHEN user submits login form, the system SHALL validate password against stored hash"

BAD: "Don't store passwords in plain text"
GOOD: "The system SHALL NOT store plain-text passwords"
