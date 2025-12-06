# Phase 06: Monitoring & Control

## Problem

Once the system is running, we need visibility. What is the supervisor doing? What decisions is it making? How do we intervene if something goes wrong?

Without monitoring, the system is a black box. We can't debug issues, improve performance, or build trust in the supervisor's decisions.

## Solution

Build comprehensive monitoring and control capabilities. Every action is logged. Real-time status is visible. Humans can pause, resume, or abort at any time.

## Features

### 1. Real-Time Dashboard

See what's happening right now:

```
┌─────────────────────────────────────────────────────────┐
│               SUPERVISOR DASHBOARD                      │
├─────────────────────────────────────────────────────────┤
│ Status: RUNNING                     Uptime: 4h 23m     │
├─────────────────────────────────────────────────────────┤
│ Current Task: task-456 "Add user authentication"       │
│ Stage: implementing (attempt 2/3)                      │
│ Worker: Claude                                          │
│ Supervisor: Reviewing previous attempt...              │
├─────────────────────────────────────────────────────────┤
│ Queue: 3 tasks waiting                                 │
│ Completed today: 7 tasks                               │
│ Success rate: 85%                                      │
└─────────────────────────────────────────────────────────┘
```

**Why:** Know system status at a glance. Catch issues early.

---

### 2. Decision Log

Every supervisor decision recorded:

```
┌─────────────────────────────────────────────────────────┐
│ DECISION LOG                                            │
├─────────────────────────────────────────────────────────┤
│ [10:30:15] task-456 | Stage: analysis                  │
│            Decision: REVISE                             │
│            Reason: "Spec missing error handling"       │
│                                                         │
│ [10:32:45] task-456 | Stage: analysis (retry 1)        │
│            Decision: APPROVE                            │
│            Reason: "Spec now complete"                 │
│                                                         │
│ [10:45:22] task-456 | Stage: implementation            │
│            Decision: REVISE                             │
│            Reason: "Used wrong auth library"           │
└─────────────────────────────────────────────────────────┘
```

**Why:** Audit trail. Understand WHY things happened. Debug issues. Improve rules.

---

### 3. Model Interaction Log

All AI model calls recorded:

```
┌─────────────────────────────────────────────────────────┐
│ MODEL CALL: call-789                                    │
├─────────────────────────────────────────────────────────┤
│ Model: claude-opus                                      │
│ Role: worker (implementation)                          │
│ Task: task-456                                          │
│ Duration: 47.3s                                        │
│ Tokens: 2,341 in / 8,923 out                          │
│                                                         │
│ [View Prompt] [View Response] [View Files Changed]     │
└─────────────────────────────────────────────────────────┘
```

**Why:** Debug model issues. Track costs. Analyze performance.

---

### 4. Human Control Panel

Manual intervention options:

| Command | Effect |
|---------|--------|
| **Pause** | Stop processing, keep state |
| **Resume** | Continue from where paused |
| **Abort** | Cancel current task, notify ClickUp |
| **Skip Review** | Bypass supervisor for current stage |
| **Force Approve** | Override REVISE/REJECT decision |
| **Shutdown** | Graceful stop of entire system |

**Why:** Humans stay in control. Can intervene when needed.

---

### 5. Alerts & Notifications

Automatic alerts for important events:

```
ALERT TRIGGERS:
├── Task failed after max retries
├── Supervisor made unusual decision (confidence < 70%)
├── Worker timeout exceeded
├── Resource usage high
├── Error rate spike
└── System health degraded
```

Notification channels:
- ClickUp comment on task
- Terminal notification
- (Optional) Slack/Discord webhook

**Why:** Don't have to watch constantly. System tells you when attention needed.

---

### 6. Performance Metrics

Track system performance over time:

```
METRICS:
├── Tasks completed per day
├── Average time per stage
├── Revision rate (how often supervisor requests fixes)
├── Success rate (tasks completed vs failed)
├── Model usage (calls per model)
└── Cost tracking (API usage)
```

**Why:** Measure improvement. Identify bottlenecks. Justify the system's value.

---

### 7. Debug Mode

Enhanced logging for troubleshooting:

```bash
# Normal mode
SUPERVISOR_LOG_LEVEL=info

# Debug mode (verbose)
SUPERVISOR_LOG_LEVEL=debug

# Trace mode (everything)
SUPERVISOR_LOG_LEVEL=trace
```

Debug mode captures:
- Full prompts sent to models
- Complete responses
- Internal supervisor reasoning
- State transitions

**Why:** When things break, need full visibility to diagnose.

---

### 8. Replay Capability

Re-run past decisions for analysis:

```
"What would happen if we ran task-456 again
 with updated business rules?"

→ Load historical inputs
→ Run through supervisor with new rules
→ Compare decisions
```

**Why:** Test rule changes. Understand impact before deploying.

---

## Depends On

- All previous phases (01-05)

## Success Criteria

- [ ] Dashboard shows real-time status
- [ ] All decisions logged with reasoning
- [ ] Human can pause/resume/abort
- [ ] Alerts working for critical events
- [ ] Metrics being collected
- [ ] Debug mode provides full visibility

## Open Questions

1. **Dashboard:** Terminal UI, web UI, or both?
2. **Log storage:** Local files, database, or cloud?
3. **Retention:** How long to keep logs?
4. **Access control:** Who can use control panel?

---

## Notes

This phase makes the system trustworthy. Without monitoring, we're flying blind. With good monitoring, we can confidently let the system run and know we'll be alerted if anything needs attention.

This is the final phase. After this, the system is complete and ready for production use.
