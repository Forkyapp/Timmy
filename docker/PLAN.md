# Docker Containerization - Master Plan

## Vision

Run Timmy entirely inside Docker containers instead of directly on the host machine. This provides isolation, reproducibility, and easy deployment across different environments.

```
┌─────────────────────────────────────────────────────────────┐
│                     HOST MACHINE                            │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              DOCKER CONTAINER                        │  │
│   │                                                     │  │
│   │   ┌───────────────────────────────────────────┐   │  │
│   │   │               TIMMY                        │   │  │
│   │   │                                           │   │  │
│   │   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  │   │  │
│   │   │  │ Gemini  │  │ Claude  │  │  Codex  │  │   │  │
│   │   │  │  CLI    │  │  CLI    │  │  CLI    │  │   │  │
│   │   │  └─────────┘  └─────────┘  └─────────┘  │   │  │
│   │   │                                           │   │  │
│   │   │         Node.js Runtime                   │   │  │
│   │   └───────────────────────────────────────────┘   │  │
│   │                                                     │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   Mounted Volumes:                                          │
│   ├── /workspace  → Target repos (read/write)               │
│   ├── /app/data   → Timmy state (persistent)                │
│   └── /app/config → Configuration (read only)               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Why Docker?

### Current Problems (Running on Host)

1. **Process Escape** - Child processes continue running after Timmy stops
2. **Environment Pollution** - Node modules, CLI tools pollute host system
3. **Inconsistent Setup** - "Works on my machine" problems
4. **No Isolation** - AI processes can access any file on the system
5. **Hard to Deploy** - Manual setup required on each new machine

### Docker Solutions

1. **Guaranteed Termination** - `docker stop` kills ALL processes
2. **Clean Environment** - Everything contained, nothing leaks
3. **Reproducible** - Same container = same behavior everywhere
4. **Filesystem Isolation** - Only mounted volumes accessible
5. **One-Command Deploy** - `docker compose up` and done

## Core Principles

1. **Isolation** - Container can only access what we explicitly allow
2. **Reproducibility** - Build once, run anywhere
3. **Simplicity** - Single command to start/stop
4. **Development Friendly** - Hot reload, easy debugging
5. **Production Ready** - Optimized for deployment

## Phases

| Phase | Name | Purpose |
|-------|------|---------|
| 01 | Base Image | Node.js runtime with essential tools |
| 02 | Development Environment | Hot reload, debugging, local testing |
| 03 | AI CLI Integration | Install and configure Claude, Gemini, Codex CLIs |
| 04 | Volume Mounts | Workspace, data, and config management |
| 05 | Compose Orchestration | Multi-container setup with docker-compose |
| 06 | Production Deployment | Optimized builds, secrets management |

## Architecture Overview

### Container Types

```
┌────────────────────────────────────────────────────┐
│                 DEVELOPMENT MODE                    │
│                                                    │
│  Single container with:                            │
│  - Source mounted (hot reload)                     │
│  - All CLIs installed                              │
│  - Debug ports exposed                             │
│  - Verbose logging                                 │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│                 PRODUCTION MODE                     │
│                                                    │
│  Optimized container with:                         │
│  - Built application (no source)                   │
│  - Minimal image size                              │
│  - Health checks                                   │
│  - Resource limits                                 │
└────────────────────────────────────────────────────┘
```

### Volume Strategy

```
HOST                          CONTAINER
────────────────────────────────────────────────────
./target-repos/             → /workspace/
  ├── repo-a/                   (AI agents work here)
  └── repo-b/

./data/                     → /app/data/
  ├── cache/                    (Persistent state)
  ├── state/
  └── tracking/

./config/                   → /app/config/
  ├── .env                      (Read-only)
  └── projects.json
```

### Network Access

Container needs outbound access to:
- `api.anthropic.com` (Claude API)
- `generativelanguage.googleapis.com` (Gemini API)
- `api.openai.com` (Codex API)
- `api.clickup.com` (ClickUp API)
- `api.github.com` (GitHub API)

No inbound ports needed unless running webhooks.

## Success Definition

When complete, we will have:

- [ ] `docker compose up` starts Timmy in container
- [ ] `docker compose down` stops everything cleanly
- [ ] Development mode with hot reload working
- [ ] All AI CLIs functional inside container
- [ ] Workspace repos accessible with proper permissions
- [ ] State persists across container restarts
- [ ] Production build optimized and tested
- [ ] Documentation for setup and usage

## Relationship to Other Plans

### vs Supervisor Docker Sandbox (Phase 02)

```
Docker Containerization (This Plan)    Supervisor Docker Sandbox
───────────────────────────────────    ─────────────────────────
WHERE Timmy runs                       HOW supervisor controls agents
Infrastructure setup                   Safety and isolation layer
Development/Production                 Runtime process management
```

This plan provides the **foundation** - the container where Timmy lives.
The supervisor's Docker sandbox adds an **additional safety layer** within that container.

### Integration Points

```
┌─────────────────────────────────────────────────────┐
│              DOCKER CONTAINER (This Plan)           │
│                                                     │
│   ┌───────────────────────────────────────────┐   │
│   │    SUPERVISOR SANDBOX (Phase 02)          │   │
│   │                                           │   │
│   │    ┌─────┐  ┌─────┐  ┌─────┐           │   │
│   │    │ AI  │  │ AI  │  │ AI  │           │   │
│   │    └─────┘  └─────┘  └─────┘           │   │
│   │                                           │   │
│   └───────────────────────────────────────────┘   │
│                                                     │
│   Timmy Core (Orchestration, API Clients, etc.)   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Quick Start (Target)

```bash
# Development
docker compose up -d          # Start Timmy
docker compose logs -f        # Watch logs
docker compose down           # Stop everything

# Production
docker compose -f docker-compose.prod.yml up -d

# Emergency stop
./scripts/docker-stop.sh      # Kill everything immediately
```

## File Structure (Target)

```
docker/
├── PLAN.md                    # This document
├── phases/                    # Phase documentation
│   ├── 01-base-image.md
│   ├── 02-development-environment.md
│   ├── 03-ai-cli-integration.md
│   ├── 04-volume-mounts.md
│   ├── 05-compose-orchestration.md
│   └── 06-production-deployment.md
├── Dockerfile                 # Main Dockerfile
├── Dockerfile.dev             # Development Dockerfile
├── docker-compose.yml         # Development compose
├── docker-compose.prod.yml    # Production compose
└── scripts/
    ├── docker-start.sh
    ├── docker-stop.sh
    └── docker-build.sh
```

---

## Notes

This plan focuses on **running Timmy** in Docker. Security controls (like the supervisor's kill switch) are separate concerns handled by the Supervisor plan.

The goal is: anyone should be able to clone the repo and run `docker compose up` to have a working Timmy instance.
