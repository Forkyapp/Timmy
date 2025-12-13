# Phase 02: Development Environment

## Problem

Developing Timmy currently requires:
- Installing Node.js locally
- Installing all dependencies
- Setting up environment variables
- Hoping your system matches production

Developers waste time on setup instead of coding. Environment differences cause bugs that only appear in production.

## Solution

Create a development-focused Docker setup with hot reload, debugging support, and immediate feedback. Run `docker compose up` and start coding.

## Features

### 1. Source Code Mounting

Mount local source code into container:

```yaml
# docker-compose.yml
services:
  timmy:
    volumes:
      - .:/app                    # Mount entire project
      - /app/node_modules         # Exclude node_modules (use container's)
```

**Why:** Edit files locally, changes appear in container immediately. No rebuild needed.

---

### 2. Hot Reload with Nodemon

Auto-restart on file changes:

```dockerfile
# Dockerfile.dev
FROM timmy-base:latest

# Install development dependencies globally
RUN npm install -g nodemon ts-node typescript

# Development command
CMD ["nodemon", "--exec", "ts-node", "timmy.ts"]
```

**nodemon.json:**
```json
{
  "watch": ["src", "lib", "timmy.ts"],
  "ext": "ts,json",
  "ignore": ["node_modules", "data", "dist"],
  "delay": 1000
}
```

**Why:** Save file → Timmy restarts automatically. Faster development cycle.

---

### 3. Debug Port Exposure

Enable Node.js debugging:

```yaml
# docker-compose.yml
services:
  timmy:
    ports:
      - "9229:9229"    # Node.js debug port
    command: nodemon --exec "node --inspect=0.0.0.0:9229 -r ts-node/register" timmy.ts
```

**VS Code launch.json:**
```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to Docker",
  "port": 9229,
  "address": "localhost",
  "localRoot": "${workspaceFolder}",
  "remoteRoot": "/app",
  "sourceMaps": true
}
```

**Why:** Set breakpoints in VS Code, debug inside container. Full debugging experience.

---

### 4. Environment Variables

Development-specific configuration:

```yaml
# docker-compose.yml
services:
  timmy:
    env_file:
      - .env                    # Main configuration
      - .env.development        # Development overrides
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
      - POLL_INTERVAL_MS=30000  # Faster polling for testing
```

**.env.development:**
```bash
# Development-specific settings
LOG_LEVEL=debug
DISABLE_COMMENTS=true           # Don't spam ClickUp during testing
MOCK_AI_RESPONSES=false         # Set true for offline development
```

**Why:** Clear separation between production and development settings.

---

### 5. TypeScript Compilation

Support both ts-node and compiled:

```dockerfile
# Dockerfile.dev

# Install TypeScript toolchain
RUN npm install -g typescript ts-node tsconfig-paths

# Enable TypeScript path aliases
ENV TS_NODE_PROJECT=/app/tsconfig.json
```

**Options:**
1. **ts-node** (default): Compile on-the-fly, slower startup, better for debugging
2. **tsc --watch**: Pre-compile, faster runtime, slight delay on changes

**Why:** Developer chooses based on their workflow.

---

### 6. Dependency Management

Handle npm packages properly:

```yaml
# docker-compose.yml
services:
  timmy:
    volumes:
      - .:/app
      - node_modules:/app/node_modules    # Named volume for deps
    command: sh -c "npm install && nodemon ..."
```

**Why:** `node_modules` inside container stays in sync. Named volume persists across restarts.

---

### 7. Shell Access

Easy access for debugging:

```bash
# Enter running container
docker compose exec timmy bash

# Run one-off command
docker compose exec timmy npm test

# Check logs
docker compose logs -f timmy
```

**Why:** Sometimes you need to poke around inside the container.

---

## Complete Development Setup

### Dockerfile.dev

```dockerfile
# =========================================
# Timmy Development Image
# =========================================
FROM timmy-base:latest

USER root

# Install development tools
RUN npm install -g \
    nodemon \
    ts-node \
    typescript \
    tsconfig-paths

# Install additional dev utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    vim \
    less \
    && rm -rf /var/lib/apt/lists/*

USER timmy

WORKDIR /app

# Expose debug port
EXPOSE 9229

# Default development command
CMD ["nodemon", "--exec", "ts-node -r tsconfig-paths/register", "timmy.ts"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  timmy:
    build:
      context: .
      dockerfile: docker/Dockerfile.dev
    container_name: timmy-dev

    volumes:
      # Source code (hot reload)
      - .:/app
      # Dependencies (persisted)
      - node_modules:/app/node_modules
      # Data (persisted)
      - ./data:/app/data

    env_file:
      - .env

    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug

    ports:
      - "9229:9229"    # Debug port

    # Keep container running
    tty: true
    stdin_open: true

volumes:
  node_modules:
```

---

## Development Workflow

```bash
# First time setup
docker compose build

# Start development
docker compose up -d

# Watch logs
docker compose logs -f

# Make changes to code (auto-reloads)

# Run tests
docker compose exec timmy npm test

# Shell access
docker compose exec timmy bash

# Stop
docker compose down
```

---

## Depends On

- Phase 01 (Base Image) - Need the base image

## Success Criteria

- [ ] `docker compose up` starts development environment
- [ ] File changes trigger auto-reload
- [ ] VS Code debugging works
- [ ] Tests can be run inside container
- [ ] Shell access works
- [ ] Environment variables load correctly
- [ ] node_modules persists across restarts

## Open Questions (Resolved)

1. **ts-node vs esbuild?** → **ts-node chosen.** Better compatibility with TypeScript path aliases and existing tsconfig. esbuild can be considered later if startup time becomes a problem.

2. **Separate test container?** → **Same container.** Tests run via `docker compose exec timmy npm test`. Simpler setup, and tests should run in the same environment as the code.

3. **Watch mode scope?** → **Specific patterns.** Configured in `nodemon.json` to watch `src/`, `lib/`, and `timmy.ts`. Ignores `node_modules`, `data`, `dist`, tests, and docker files.

---

## Notes

Development experience is critical. If it's painful to develop in Docker, people won't use it.

Hot reload should feel instant. If there's a noticeable delay, optimize it.
