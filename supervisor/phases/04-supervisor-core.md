# Phase 04: Supervisor Core

## Problem

Currently, Timmy's pipeline runs sequentially without oversight. Each stage (Gemini analysis → Claude implementation → Codex review → Claude fixes) executes blindly, trusting the previous stage's output.

If Gemini produces a bad spec, Claude implements the wrong thing. If Claude makes a mistake, it propagates through. There's no "manager" watching and catching errors.

## Solution

Build the Supervisor Core - an AI agent that oversees the entire pipeline. It reviews each stage's output before allowing the next stage to proceed. It can request corrections, halt the pipeline, or approve continuation.

## Features

### 1. Supervisor Agent

A dedicated AI instance that:

```
┌─────────────────────────────────────────────────────────┐
│                   SUPERVISOR AGENT                      │
│                                                         │
│  Role: Technical Lead / Manager                         │
│                                                         │
│  Responsibilities:                                      │
│  • Review each stage output                            │
│  • Compare output against original task                │
│  • Check for business rule violations                  │
│  • Decide: APPROVE / REVISE / REJECT                   │
│  • Maintain context across all stages                  │
└─────────────────────────────────────────────────────────┘
```

**Why:** Someone needs to see the big picture. Workers focus on their task; supervisor ensures alignment.

---

### 2. Review Checkpoints

Supervisor reviews at defined points:

```
Task Received
     │
     ▼
┌─────────────┐     ┌────────────────────┐
│   Gemini    │────►│ CHECKPOINT 1       │
│  Analysis   │     │ "Is spec correct?" │
└─────────────┘     └────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
               [APPROVE]            [REVISE]
                    │                   │
                    ▼                   ▼
              Continue            Ask Gemini
              to Claude           to fix spec
```

Same pattern after each stage.

**Why:** Catch problems early. Don't let mistakes cascade through the pipeline.

---

### 3. Context Awareness

Supervisor maintains full context:

```
┌─────────────────────────────────────────────────────────┐
│              SUPERVISOR CONTEXT                         │
├─────────────────────────────────────────────────────────┤
│ Original Task:     "Add OAuth login with Google"       │
│ Company Rules:     "Must use Auth0, not direct OAuth"  │
│ Stage History:                                          │
│   ├── Analysis: [Gemini output...]                     │
│   ├── Implementation: [Claude output...]               │
│   └── Review: [Codex output...]                        │
│ Decisions Made:                                         │
│   ├── Approved spec after 1 revision                   │
│   └── Approved implementation first try                │
└─────────────────────────────────────────────────────────┘
```

**Why:** Each worker sees only their piece. Supervisor sees everything and can spot inconsistencies.

---

### 4. Decision Making

Supervisor decisions are structured:

| Decision | Meaning | Action |
|----------|---------|--------|
| **APPROVE** | Output is acceptable | Proceed to next stage |
| **REVISE** | Minor issues | Ask worker to fix specific things |
| **REJECT** | Fundamentally wrong | Restart stage with new approach |
| **ESCALATE** | Needs human | Pause pipeline, notify human |

**Why:** Clear outcomes. No ambiguity about what happens next.

---

### 5. Correction Loop

When supervisor requests revision:

```
                    ┌──────────────┐
                    │  SUPERVISOR  │
                    │   Reviews    │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
         [APPROVE]                  [REVISE]
              │                         │
              ▼                         ▼
         Continue              ┌──────────────┐
                              │    Worker     │
                              │  Gets feedback│
                              │  Tries again  │
                              └──────┬───────┘
                                     │
                                     ▼
                              Back to Review
                              (max N attempts)
```

**Why:** Automated correction without human intervention. Human only needed for complex issues.

---

### 6. Business Rules Integration

Supervisor enforces company-specific rules:

```yaml
# Loaded into supervisor context
rules:
  - "All API endpoints must be versioned (/api/v1/...)"
  - "Database operations must use transactions"
  - "Authentication must use Auth0"
  - "No console.log in production code"
```

**Why:** Encode your company's standards. Supervisor checks every output against them.

---

### 7. Reasoning Trail

Supervisor explains its decisions:

```
┌─────────────────────────────────────────────────────────┐
│ DECISION: REVISE                                        │
│                                                         │
│ REASONING:                                              │
│ 1. Checked spec against original task ✓                │
│ 2. Checked for business rule compliance                │
│    ✗ VIOLATION: Spec mentions "local JWT auth"         │
│      but company rule requires "Auth0"                 │
│ 3. Implementation would be wrong if we proceed         │
│                                                         │
│ FEEDBACK TO GEMINI:                                     │
│ "Revise spec to use Auth0 instead of local JWT.        │
│  See company auth guidelines at /docs/auth.md"         │
└─────────────────────────────────────────────────────────┘
```

**Why:** Transparency. Know WHY decisions were made. Debug issues. Improve rules.

---

## Depends On

- Phase 01 (Foundation) - Configuration and structure
- Phase 02 (Docker) - Safe execution environment
- Phase 03 (Model Layer) - Unified model access

## Success Criteria

- [ ] Supervisor agent can be instantiated with context
- [ ] Reviews output and produces structured decisions
- [ ] Correction loop works (revise → retry → review)
- [ ] Business rules are checked
- [ ] All decisions logged with reasoning

## Open Questions

1. **Supervisor model:** Which model? Claude Opus (smartest) or Sonnet (cheaper)?
2. **Max retries:** How many revision attempts before escalating?
3. **Rule format:** YAML, JSON, or natural language?
4. **Memory:** How much context to keep? Full history or summarized?

---

## Notes

This is the "brain" of the system. The supervisor must be reliable and consistent. It's better to be too strict (catch false positives) than too lenient (miss real issues). Can tune later.
