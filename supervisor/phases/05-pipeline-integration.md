# Phase 05: Pipeline Integration

## Problem

Timmy has an existing pipeline that works. The supervisor system is being built separately. We need to connect them without breaking what already works.

The challenge: How does the supervisor "plug into" Timmy's existing flow?

## Solution

Create an integration layer that sits between Timmy's orchestrator and the AI workers. Timmy continues to detect tasks and manage state, but execution flows through the supervisor.

## Features

### 1. Integration Architecture

```
BEFORE (Current Timmy):
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Timmy   │────►│ Gemini  │────►│ Claude  │────►│ Codex   │
│Orchestr │     │         │     │         │     │         │
└─────────┘     └─────────┘     └─────────┘     └─────────┘

AFTER (With Supervisor):
┌─────────┐     ┌─────────────────────────────────────────┐
│ Timmy   │────►│            SUPERVISOR                   │
│Orchestr │     │                                         │
└─────────┘     │  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
                │  │ Gemini  │  │ Claude  │  │ Codex   │ │
                │  └─────────┘  └─────────┘  └─────────┘ │
                └─────────────────────────────────────────┘
```

**Why:** Timmy stays responsible for ClickUp/GitHub. Supervisor handles AI coordination.

---

### 2. Handoff Protocol

Clear contract between Timmy and Supervisor:

```
TIMMY SENDS:
├── Task details (from ClickUp)
├── Repository info
├── Branch name
└── Configuration

SUPERVISOR RETURNS:
├── Status (success/failed)
├── Changes made (commits, files)
├── Review summary
└── PR ready (yes/no)
```

**Why:** Clean interface. Each system has clear responsibilities.

---

### 3. Stage Mapping

Map Timmy's current stages to supervised stages:

| Timmy Stage | Supervisor Handling |
|-------------|---------------------|
| `analyzing` | Gemini + Review checkpoint |
| `implementing` | Claude + Review checkpoint |
| `codex_reviewing` | Codex + Review checkpoint |
| `claude_fixing` | Claude + Final review |
| `pr_creating` | Supervisor approval required |

**Why:** Existing stage names preserved. Supervisor adds review layer.

---

### 4. State Synchronization

Keep Timmy's pipeline state in sync:

```
┌─────────────────────────────────────────────────────────┐
│            Timmy Pipeline State                         │
│  data/state/pipeline-state.json                        │
├─────────────────────────────────────────────────────────┤
│ {                                                       │
│   "task-123": {                                        │
│     "currentStage": "implementing",                    │
│     "supervisorStatus": "reviewing",  ← NEW           │
│     "reviewAttempts": 2,              ← NEW           │
│     ...                                                │
│   }                                                    │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
```

**Why:** Timmy can still report status. Supervisor progress visible.

---

### 5. Fallback Mode

If supervisor fails, option to run without it:

```
┌─────────────────────────────────────────────┐
│ SUPERVISOR_ENABLED=true   → Full supervision│
│ SUPERVISOR_ENABLED=false  → Legacy mode     │
└─────────────────────────────────────────────┘
```

**Why:** Safety net. Don't break everything if supervisor has issues.

---

### 6. Communication Channel

How Timmy talks to Supervisor (running in Docker):

```
Option A: HTTP API
┌─────────┐  POST /process   ┌────────────────┐
│ Timmy   │─────────────────►│  Supervisor    │
│         │◄─────────────────│  (Docker)      │
└─────────┘  JSON response   └────────────────┘

Option B: Shared Volume
┌─────────┐  Write task.json  ┌────────────────┐
│ Timmy   │──────────────────►│  Supervisor    │
│         │◄──────────────────│  (Docker)      │
└─────────┘  Read result.json └────────────────┘
```

**Why:** Need reliable communication. HTTP is cleaner, shared volume is simpler.

---

### 7. Error Propagation

When things go wrong:

```
Supervisor Error
     │
     ├── Transient (retry) → Supervisor retries internally
     │
     ├── Worker failed → Supervisor marks failed, Timmy notified
     │
     ├── Max retries exceeded → Escalate to human via ClickUp
     │
     └── Supervisor crash → Timmy detects timeout, uses fallback
```

**Why:** Errors shouldn't disappear silently. Clear escalation path.

---

## Depends On

- Phase 01-04 (all previous phases)
- Existing Timmy orchestrator

## Success Criteria

- [ ] Timmy can send task to supervisor
- [ ] Supervisor processes and returns result
- [ ] Pipeline state stays synchronized
- [ ] Fallback mode works
- [ ] Errors propagate correctly

## Open Questions

1. **Communication:** HTTP API or shared volume?
2. **Timmy changes:** Minimal changes to Timmy, or refactor orchestrator?
3. **Parallel processing:** One task at a time, or multiple?

---

## Notes

This is the "glue" phase. Technical but critical. Good integration means the system feels seamless. Bad integration means constant friction.
