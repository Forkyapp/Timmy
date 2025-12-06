# Supervisor System - Master Plan

## Vision

A supervisory AI agent that monitors and controls Timmy's multi-AI pipeline. When worker agents (Gemini, Claude, Codex) make mistakes, the supervisor catches and corrects them.

```
                    ┌─────────────────────┐
                    │     SUPERVISOR      │
                    │  (Watches & Guides) │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
   ┌───────────┐        ┌───────────┐        ┌───────────┐
   │  GEMINI   │        │  CLAUDE   │        │  CODEX    │
   │ (Analyst) │        │ (Builder) │        │ (Reviewer)│
   └───────────┘        └───────────┘        └───────────┘
```

## Core Principles

1. **Isolation** - Everything runs in Docker, kill switch always works
2. **Safety** - Can only touch designated project folders
3. **Observable** - All decisions logged and traceable
4. **Controllable** - Human can intervene at any point

## Phases

| Phase | Name | Purpose |
|-------|------|---------|
| 01 | Foundation | Base project structure and configuration |
| 02 | Docker Sandbox | Complete isolation and kill switch |
| 03 | Model Layer | Unified access to all AI models |
| 04 | Supervisor Core | The decision-making brain |
| 05 | Pipeline Integration | Connect supervisor to Timmy |
| 06 | Monitoring | Observe, log, and control |

## Success Definition

When complete, we will have:

- [ ] Supervisor reviews every stage output
- [ ] Mistakes are caught before propagating
- [ ] `docker stop` kills everything instantly
- [ ] All actions are logged
- [ ] Human can pause/resume/abort anytime
