# Phase 04: Volume Mounts

## Problem

Timmy needs access to:
- Target repositories (for AI to analyze and modify code)
- Persistent state (cache, queue, pipeline status)
- Configuration files (API keys, project settings)

Without proper volume management:
- Container restart loses all state
- AI can't access repositories
- Configuration changes require rebuilding

## Solution

Design a volume mounting strategy that provides appropriate access levels while maintaining security. Define clear boundaries for read/write access.

## Features

### 1. Workspace Volume (Target Repositories)

Mount repositories AI will work on:

```yaml
# docker-compose.yml
volumes:
  - ${WORKSPACE_PATH:-./workspace}:/workspace:rw
```

**Structure:**
```
/workspace/
├── my-app/           # Target repo 1
│   ├── .git/
│   ├── src/
│   └── package.json
├── other-project/    # Target repo 2
│   ├── .git/
│   └── ...
└── .workspace.json   # Workspace metadata
```

**Permissions:** Read + Write (AI needs to modify code)

**Why:** AI agents need full access to make changes, create branches, commit code.

---

### 2. Data Volume (Persistent State)

Mount state that persists across restarts:

```yaml
volumes:
  - ./data:/app/data:rw
```

**Structure:**
```
/app/data/
├── cache/
│   └── processed-tasks.json    # Tasks already processed
├── state/
│   ├── task-queue.json         # Pending tasks
│   └── pipeline-state.json     # Pipeline execution state
└── tracking/
    └── pr-tracking.json        # Created PRs
```

**Permissions:** Read + Write

**Why:** Without this, every container restart would reprocess all tasks.

---

### 3. Config Volume (Configuration)

Mount configuration files:

```yaml
volumes:
  - ./config:/app/config:ro    # Read-only for security
```

**Structure:**
```
/app/config/
├── .env                # Environment variables
├── projects.json       # Project configurations
└── workspace.json      # Active workspace
```

**Permissions:** Read-Only

**Why:** Configuration should not be modified by the application. Read-only prevents accidental changes.

---

### 4. Git Credentials

Handle Git authentication for private repos:

```yaml
volumes:
  # Option 1: Mount SSH keys
  - ~/.ssh:/home/timmy/.ssh:ro

  # Option 2: Mount Git credentials
  - ~/.gitconfig:/home/timmy/.gitconfig:ro
  - ~/.git-credentials:/home/timmy/.git-credentials:ro
```

**For HTTPS authentication:**
```bash
# Inside container
git config --global credential.helper store
```

**Why:** AI needs to clone, fetch, push to private repositories.

---

### 5. Logs Volume (Optional)

Separate volume for logs:

```yaml
volumes:
  - ./logs:/app/logs:rw
```

**Why:** Keep logs even if container is removed. Useful for debugging.

---

### 6. Temp Volume (Transient Data)

For data that doesn't need persistence:

```yaml
volumes:
  - timmy-temp:/tmp
```

**Why:** Named volume for temporary files. Survives restart but can be easily cleaned.

---

## Complete Volume Configuration

### docker-compose.yml

```yaml
version: '3.8'

services:
  timmy:
    volumes:
      # Source code (development only)
      - .:/app:rw

      # Target repositories
      - ${WORKSPACE_PATH:-./workspace}:/workspace:rw

      # Persistent data
      - ./data:/app/data:rw

      # Configuration (read-only)
      - ./config:/app/config:ro

      # Git credentials
      - ~/.ssh:/home/timmy/.ssh:ro
      - ~/.gitconfig:/home/timmy/.gitconfig:ro

      # Logs
      - ./logs:/app/logs:rw

      # Node modules (named volume)
      - node_modules:/app/node_modules

volumes:
  node_modules:
  timmy-temp:
```

---

## Volume Permissions Matrix

| Volume | Container Path | Host Path | Access | Purpose |
|--------|----------------|-----------|--------|---------|
| Source | /app | ./ | rw | Application code (dev) |
| Workspace | /workspace | ./workspace | rw | Target repositories |
| Data | /app/data | ./data | rw | Persistent state |
| Config | /app/config | ./config | **ro** | Configuration |
| SSH | /home/timmy/.ssh | ~/.ssh | **ro** | Git authentication |
| Logs | /app/logs | ./logs | rw | Log files |
| Modules | /app/node_modules | named | rw | Dependencies |

---

## Security Considerations

### 1. Read-Only Where Possible

```yaml
# Config should never be written by app
- ./config:/app/config:ro

# SSH keys should never be modified
- ~/.ssh:/home/timmy/.ssh:ro
```

### 2. Limit Workspace Scope

```yaml
# Bad: Mount entire home directory
- ~/:/workspace:rw   # DANGEROUS

# Good: Mount specific project folder
- ~/projects/my-app:/workspace/my-app:rw
```

### 3. File Ownership

Ensure container user can access mounted files:

```bash
# On host, before starting container
chown -R 1000:1000 ./data ./logs

# Or use user mapping in compose
services:
  timmy:
    user: "${UID:-1000}:${GID:-1000}"
```

---

## Directory Initialization

Script to set up directories before first run:

```bash
#!/bin/bash
# scripts/init-volumes.sh

# Create directories if they don't exist
mkdir -p ./data/cache
mkdir -p ./data/state
mkdir -p ./data/tracking
mkdir -p ./config
mkdir -p ./logs
mkdir -p ./workspace

# Set permissions
chmod 755 ./data ./config ./logs ./workspace
chmod 700 ./data/cache ./data/state ./data/tracking

# Create default config if missing
if [ ! -f ./config/projects.json ]; then
    echo '{"projects":{}}' > ./config/projects.json
fi

echo "Volumes initialized successfully"
```

---

## Environment Variables for Paths

```bash
# .env
WORKSPACE_PATH=./workspace
DATA_PATH=./data
CONFIG_PATH=./config
LOG_PATH=./logs

# Path to specific repo (for single-project mode)
GITHUB_REPO_PATH=/workspace/my-app
```

---

## Depends On

- Phase 01 (Base Image)
- Phase 02 (Development Environment)

## Success Criteria

- [ ] Container starts with all volumes mounted
- [ ] State persists across container restarts
- [ ] AI can read/write to workspace
- [ ] Config changes reflect without rebuild
- [ ] Git operations work (clone, push)
- [ ] Read-only volumes cannot be written
- [ ] Proper file permissions on all volumes

## Open Questions (Resolved)

1. **Volume driver?** → **Local volumes.** Using Docker named volumes for workspace and git-cache. Network storage can be considered for production clustering.

2. **Backup strategy?** → **Data volume only.** The `./data` directory is mounted from host and can be backed up normally. Workspace is ephemeral (cloned repos).

3. **Multi-workspace?** → **Clone-based approach.** Instead of mounting multiple host paths, repos are cloned into a single `/workspace` volume. No worktrees needed.

4. **Windows compatibility?** → **Named volumes.** Using named volumes (`workspace:`, `git-cache:`) instead of host paths avoids Windows path issues.

---

## Implementation Decision: Clone-Based Workflow

**We chose to CLONE repositories inside the container instead of mounting host repos.**

### Why Clone Instead of Mount?

1. **Complete isolation** - Container can't break host repo
2. **No worktrees needed** - Eliminates orchestration complexity
3. **Simpler workflow** - Clone → branch → work → push → done
4. **Stateless containers** - Each task starts fresh
5. **Matches CI/CD patterns** - Same approach pipelines use

### Volume Strategy

```
Named Volumes (isolated from host):
  - workspace:/workspace       # Cloned repos live here
  - git-cache:/home/timmy/.git-cache  # Speeds up clones

Host Mounts:
  - ./data:/app/data          # Persistent state
  - ./logs:/app/logs          # Log files
  - ~/.ssh (read-only)        # Git authentication
```

### Git Helper Functions

Available via `source /app/scripts/git-helpers.sh`:
- `clone_repo <url> [name]` - Clone with caching
- `prepare_branch <repo> <branch>` - Set up feature branch
- `cleanup_repo <name>` - Remove cloned repo
- `list_repos` - Show all cloned repos

---

## Notes

Volume mounting is where "container isolation" meets "real-world usefulness". Be deliberate about what you mount:

- Only mount what's necessary
- Default to read-only
- Document every mount

A misconfigured volume can bypass all other security measures.
