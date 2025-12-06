# Phase 02: Docker Sandbox

## Problem

Previously, Timmy spawned processes that escaped control. Even after shutting down Timmy, child processes continued running in the background, modifying files and causing damage. Only a full computer restart killed them.

We need **guaranteed isolation** where:
- Stop means STOP (everything dies)
- Processes can only touch designated folders
- Resource usage is capped
- No way to escape the sandbox

## Solution

Run the entire supervisor system inside a Docker container. Docker provides process isolation, filesystem restrictions, and guaranteed termination. When the container stops, everything inside dies - no exceptions.

## Features

### 1. Container Isolation

All supervisor and worker processes run inside a single container:

```
┌─────────────────────────────────────────────┐
│              HOST MACHINE                   │
│                                             │
│   ┌─────────────────────────────────────┐  │
│   │        DOCKER CONTAINER             │  │
│   │                                     │  │
│   │  Supervisor ─┬─► Claude process    │  │
│   │              ├─► Gemini process    │  │
│   │              └─► Codex process     │  │
│   │                                     │  │
│   │  docker stop = ALL processes die   │  │
│   └─────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

**Why:** Docker's process model guarantees that stopping a container terminates ALL processes inside it. No orphans, no escapes.

---

### 2. Filesystem Restrictions

Container can ONLY access explicitly mounted folders:

```
ALLOWED (mounted):
├── /workspace      → Target project repo (read/write)
├── /app/data       → Supervisor state (read/write)
└── /app/config     → Configuration (read only)

BLOCKED (not mounted):
├── /home/user/*    → Your personal files
├── /etc/*          → System configuration
└── Everything else → No access
```

**Why:** Even if an AI agent goes rogue, it cannot touch files outside the mounted paths.

---

### 3. Network Restrictions

Container can only make outbound calls to:

- Anthropic API (Claude)
- Google API (Gemini)
- OpenAI API (Codex)
- GitHub API
- ClickUp API

All other network access blocked.

**Why:** Prevents accidental or malicious network activity.

---

### 4. Resource Limits

Hard caps on container resources:

- CPU: Limited cores
- Memory: Maximum RAM
- Disk: Maximum storage
- Time: Maximum runtime per task

**Why:** Prevents runaway processes from consuming all system resources.

---

### 5. Kill Switch

Multiple ways to stop everything:

```bash
# Graceful stop (30 second timeout)
docker stop timmy-supervisor

# Immediate kill
docker kill timmy-supervisor

# Nuclear option (remove everything)
docker rm -f timmy-supervisor
```

**Why:** Guaranteed termination at multiple severity levels.

---

### 6. Emergency Stop Script

One-command emergency shutdown:

```bash
./scripts/emergency-stop.sh
```

Stops container, kills any orphans, cleans up.

**Why:** When things go wrong, you need one button to press.

---

### 7. Health Monitoring

Container reports its health status:

- Running / Stopped / Error
- Current resource usage
- Active processes count

**Why:** Know what's happening inside without guessing.

---

## Depends On

- Phase 01 (Foundation) - Project structure must exist

## Success Criteria

- [ ] Container builds successfully
- [ ] `docker stop` kills ALL processes (verified)
- [ ] Cannot access files outside mounted volumes (verified)
- [ ] Resource limits enforced
- [ ] Emergency stop script works
- [ ] Health check reports status

## Open Questions

1. **Single container or multi?** One container for everything, or separate containers for supervisor vs workers?
2. **Volume permissions:** Should workspace be read-only with specific write paths?
3. **GPU access:** Do we need GPU passthrough for local models later?

---

## Notes

This phase is about SAFETY, not features. We're building a cage before putting anything dangerous inside it. Better to over-restrict now and loosen later than the reverse.
