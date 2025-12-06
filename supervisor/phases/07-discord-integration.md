# Phase 07: Discord Integration

## Problem

The existing Discord bot operates independently from the supervisor. It creates ClickUp tasks directly without oversight, which can lead to:

- Junk tasks from noisy channels
- Duplicate or unclear tasks
- No way to control the supervisor remotely
- Missing visibility into what the system is doing

We need to connect Discord with the supervisor for both input control and remote management.

## Solution

Integrate Discord as a dual-purpose interface:
1. **Input Gate** - Supervisor reviews Discord messages before task creation
2. **Control Panel** - Commands to manage the supervisor remotely
3. **Notification Channel** - Real-time updates on supervisor activity

## Features

### 1. Supervised Task Creation

Supervisor reviews before creating ClickUp tasks:

```
Discord Message: "Bug: login button broken"
                      │
                      ▼
              ┌───────────────┐
              │  AI Analysis  │
              │  (existing)   │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │  SUPERVISOR   │
              │   Reviews     │
              └───────┬───────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
     [APPROVE]               [REJECT]
          │                       │
          ▼                       ▼
    Create Task             Reply: "Not actionable"
    in ClickUp              or silently ignore
```

**Why:** Prevents noise from becoming tasks. Supervisor ensures quality.

---

### 2. Discord Commands

Control supervisor from Discord:

| Command | Action | Response |
|---------|--------|----------|
| `/status` | Show current state | "Processing task-456, stage: implementing" |
| `/queue` | Show pending tasks | List of waiting tasks |
| `/pause` | Pause pipeline | "⏸️ Pipeline paused" |
| `/resume` | Resume pipeline | "▶️ Pipeline resumed" |
| `/abort` | Cancel current task | "🛑 Task cancelled" |
| `/approve` | Force approve stage | "✅ Stage approved, continuing" |
| `/skip` | Skip current stage | "⏭️ Skipped to next stage" |
| `/logs` | Recent activity | Last 10 decisions |
| `/help` | Show commands | Command list |

**Why:** Control from anywhere. No need to SSH into server.

---

### 3. Real-Time Notifications

Supervisor posts updates to Discord:

```
┌─────────────────────────────────────────────────────────┐
│ #timmy-notifications                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🟢 [10:30] Task started: "Add user authentication"     │
│                                                         │
│ 📝 [10:31] Gemini analysis complete                    │
│    └─ Supervisor: APPROVED                              │
│                                                         │
│ ⚠️ [10:45] Implementation review                        │
│    └─ Supervisor: REVISION NEEDED                       │
│    └─ Reason: "Missing error handling"                 │
│                                                         │
│ 🔄 [10:47] Claude fixing implementation...             │
│                                                         │
│ ✅ [10:52] Implementation approved                      │
│                                                         │
│ 🎉 [11:05] PR created: github.com/org/repo/pull/123   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Why:** See what's happening without checking logs.

---

### 4. Alert Levels

Different notification urgency:

| Level | When | Discord Behavior |
|-------|------|------------------|
| **INFO** | Normal progress | Post to channel |
| **WARNING** | Revision needed | Post + highlight |
| **ERROR** | Task failed | Post + @mention |
| **CRITICAL** | System issue | Post + @everyone |

**Why:** Important issues get attention. Routine updates don't spam.

---

### 5. Permission Control

Restrict who can control supervisor:

```yaml
discord:
  permissions:
    # Roles that can use commands
    control_roles:
      - "Developer"
      - "Tech Lead"

    # Roles that can see notifications
    view_roles:
      - "Developer"
      - "QA"
      - "Product"

    # Users with full admin access
    admin_users:
      - "123456789"  # Your Discord user ID
```

**Why:** Not everyone should be able to pause the pipeline.

---

### 6. Channel Configuration

Separate channels for different purposes:

```
#bug-reports        → Monitored for task creation
#timmy-commands     → Send commands here
#timmy-notifications → Receive updates here
```

**Why:** Keep noise organized. Commands don't mix with notifications.

---

### 7. Conversation Context

When creating tasks, include Discord thread context:

```
Original message + 10 previous messages
            │
            ▼
    ┌───────────────┐
    │  SUPERVISOR   │
    │   Analyzes    │
    │   Context     │
    └───────────────┘
            │
            ▼
    Better task description
    with full context
```

**Why:** Single message often lacks context. Thread history helps.

---

### 8. Feedback Loop

Supervisor explains decisions back to Discord:

```
User: "@Timmy bug: something is slow"

Timmy: "📋 Task created: 'Investigate performance issue'
        Priority: MEDIUM
        Assigned to: Bot

        I'll start working on this. Track progress with /status"

--- OR ---

Timmy: "❌ Could not create task.
        Reason: Message too vague.
        Please specify what is slow and steps to reproduce."
```

**Why:** Users know what happened to their request.

---

## Depends On

- Phase 04 (Supervisor Core) - Supervisor must exist
- Phase 05 (Pipeline Integration) - Must be connected to Timmy
- Phase 06 (Monitoring) - Logging infrastructure
- Existing Discord bot code in `src/core/discord/`

## Success Criteria

- [ ] `/status` command works and returns supervisor state
- [ ] `/pause` and `/resume` control the pipeline
- [ ] Task creation goes through supervisor review
- [ ] Notifications posted for all major events
- [ ] Permissions restrict command access
- [ ] Rejection feedback sent to Discord

## Open Questions

1. **Slash commands vs prefix?** Discord slash commands (`/status`) or prefix (`!status`)?
2. **Notification frequency:** Every event or summarized?
3. **Thread support:** Create Discord threads for each task?
4. **Multi-server:** Support multiple Discord servers?

---

## Notes

This phase connects humans to the supervisor. Discord becomes the "face" of the system - where you interact with it, where it reports back. Good UX here builds trust in the whole system.

The existing Discord code (`src/core/discord/`) provides the foundation. We're extending it, not replacing it.
