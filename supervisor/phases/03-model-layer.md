# Phase 03: Model Layer

## Problem

Currently, each AI model (Claude, Gemini, Codex) is called differently throughout the codebase. There's no unified way to:

- Call any model with the same interface
- Switch models easily
- Track what each model is doing
- Capture all inputs/outputs for the supervisor to review

The supervisor needs a clean way to dispatch work to any model and monitor the results.

## Solution

Create a unified Model Layer that wraps all AI models behind a consistent interface. The supervisor talks to this layer, not directly to individual models. Every call goes through this layer, making it easy to monitor, log, and control.

## Features

### 1. Unified Model Interface

All models accessible through the same pattern:

```
Supervisor
    │
    ▼
┌─────────────────────────────────────┐
│           MODEL LAYER               │
│                                     │
│  .call(model, prompt) → response   │
│                                     │
│  Supported models:                  │
│  ├── claude-opus                    │
│  ├── claude-sonnet                  │
│  ├── gemini-pro                     │
│  ├── codex                          │
│  └── (extensible for more)          │
└─────────────────────────────────────┘
    │
    ├──► Claude API/CLI
    ├──► Gemini API/CLI
    └──► Codex API/CLI
```

**Why:** Supervisor doesn't need to know HOW to call each model. Just says "use Claude for this" and the layer handles it.

---

### 2. Model Registry

Configuration of available models:

```yaml
models:
  claude-opus:
    type: cli
    command: claude
    role: supervisor, implementation, fixes

  gemini-pro:
    type: cli
    command: gemini
    role: analysis

  codex:
    type: cli
    command: codex
    role: review
```

**Why:** Easy to add new models, change configurations, or swap models for different roles.

---

### 3. Request/Response Capture

Every model interaction is captured:

```
┌─────────────────────────────────────┐
│           MODEL CALL                │
├─────────────────────────────────────┤
│ ID:        call-12345               │
│ Model:     claude-opus              │
│ Timestamp: 2025-12-06T10:30:00Z     │
│ Input:     "Implement login..."     │
│ Output:    "Here's the code..."     │
│ Duration:  45.2s                    │
│ Tokens:    1,234 in / 5,678 out     │
│ Status:    success                  │
└─────────────────────────────────────┘
```

**Why:** Supervisor can review what each model received and produced. Essential for catching mistakes.

---

### 4. Execution Modes

Different ways to run models:

| Mode | Description | Use Case |
|------|-------------|----------|
| **CLI** | Run as shell command | Current Timmy approach |
| **API** | Direct API calls | More control, structured output |
| **Streaming** | Real-time output | Long-running tasks |

**Why:** Flexibility. Some tasks need CLI (file operations), others work better with API.

---

### 5. Timeout & Retry

Built-in handling for:

- Timeouts (model takes too long)
- Retries (transient failures)
- Fallbacks (primary model fails, try backup)

**Why:** Models fail sometimes. Layer handles this gracefully without supervisor needing to worry.

---

### 6. Context Injection

Ability to inject context into any model call:

```
User prompt: "Add login feature"
           +
Injected:   Company coding standards
           +
Injected:   Relevant file contents
           =
Final prompt sent to model
```

**Why:** Supervisor can ensure all models have necessary context without modifying each call site.

---

### 7. Output Parsing

Structured extraction from model responses:

- Code blocks extracted
- Decisions identified (approved/rejected)
- Action items listed

**Why:** Supervisor needs structured data, not raw text, to make decisions.

---

## Depends On

- Phase 01 (Foundation) - Configuration system
- Phase 02 (Docker) - Runs inside container

## Success Criteria

- [ ] Can call any registered model with same interface
- [ ] All calls logged with input/output
- [ ] Timeout and retry working
- [ ] Context injection working
- [ ] Output parsing extracts structured data

## Open Questions

1. **CLI vs API:** Start with CLI (simpler) or API (more control)?
2. **Local models:** Include Ollama/local model support now or later?
3. **Cost tracking:** Track API costs per call?

---

## Notes

This layer is the "nervous system" connecting the supervisor brain to the model workers. It must be reliable and observable. Every interaction flows through here.
