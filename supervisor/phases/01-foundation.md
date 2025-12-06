# Phase 01: Foundation

## Problem

Timmy currently runs directly on the host machine with no isolation. Processes can escape, touch any file, and continue running even after shutdown. There's no structured way to add a supervisor layer.

We need a clean foundation before building the supervisor system.

## Solution

Create a separate, self-contained project structure for the supervisor system. This becomes the "control center" that will eventually run inside Docker and manage all AI agents.

## Features

### 1. Project Structure

A dedicated `supervisor/` directory with clear separation:

```
supervisor/
├── src/           # Supervisor source code
├── config/        # Configuration files
├── data/          # Runtime data (logs, state)
├── scripts/       # Utility scripts
└── tests/         # Test files
```

**Why:** Clean separation from Timmy's existing code. Can be developed and tested independently.

---

### 2. Configuration System

Centralized configuration for:

- API keys (Claude, Gemini, Codex, GitHub, ClickUp)
- Model preferences (which model for supervisor, which for workers)
- Safety limits (timeouts, max retries, resource caps)
- Project paths (which repos can be accessed)

**Why:** All settings in one place. Easy to modify behavior without code changes.

---

### 3. Environment Management

Clear separation between:

- Development (local testing, verbose logging)
- Production (Docker, minimal logging)

**Why:** Safe testing without affecting real projects.

---

### 4. Dependency Isolation

Supervisor has its own dependencies, separate from Timmy:

- No conflicts with Timmy's packages
- Can use Python for ML/AI parts if needed
- Clear interface between Timmy and Supervisor

**Why:** Timmy is Node.js/TypeScript. Supervisor might need Python for training. Keep them separate.

---

### 5. Basic Entry Point

A minimal starting point that:

- Loads configuration
- Validates environment (API keys present, CLIs installed)
- Prints status and exits

**Why:** Proves the foundation works before building complex features.

---

## Depends On

Nothing - this is the first phase.

## Success Criteria

- [ ] `supervisor/` folder exists with clear structure
- [ ] Configuration can be loaded and validated
- [ ] Entry point runs and reports environment status
- [ ] All API keys validated (format check, not actual API call)
- [ ] Documentation explains the structure

## Open Questions

1. **Language:** TypeScript only, or TypeScript + Python hybrid?
2. **Config format:** YAML, JSON, or .env?
3. **Monorepo vs separate:** Keep in Timmy repo or separate repo?

---

## Notes

This phase is intentionally minimal. We're laying groundwork, not building features. A solid foundation makes everything else easier.
