# Phase 01: Base Image

## Problem

Timmy requires a specific runtime environment:
- Node.js 18+ with npm
- TypeScript compilation
- Git for repository operations
- Various system utilities

Setting this up manually on each machine is error-prone and time-consuming. Different machines may have different versions, causing "works on my machine" issues.

## Solution

Create a base Docker image that provides a consistent, reproducible runtime environment for Timmy. This image becomes the foundation for both development and production containers.

## Features

### 1. Node.js Runtime

Base image with Node.js LTS and npm:

```dockerfile
FROM node:20-slim

# Ensures consistent Node.js version across all environments
# Slim variant reduces image size while keeping essentials
```

**Why:** Node.js 20 LTS provides stability. Slim variant keeps image small (~200MB vs ~1GB for full).

---

### 2. Essential System Tools

Install required system utilities:

```dockerfile
RUN apt-get update && apt-get install -y \
    git \
    curl \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*
```

**Required Tools:**
- `git` - Repository operations (clone, branch, commit)
- `curl` - API health checks and downloads
- `ca-certificates` - HTTPS connections
- `gnupg` - Package verification

**Why:** These are minimum requirements for Timmy's core functionality.

---

### 3. Working Directory Structure

Set up application directory:

```dockerfile
WORKDIR /app

# Create directory structure
RUN mkdir -p /app/data/cache \
             /app/data/state \
             /app/data/tracking \
             /app/config
```

**Directory Layout:**
```
/app/
├── src/           # Application source (or dist/)
├── data/          # Runtime state
│   ├── cache/     # Processed tasks
│   ├── state/     # Queue, pipeline state
│   └── tracking/  # PR tracking
└── config/        # Configuration files
```

**Why:** Consistent paths inside container, matching Timmy's expected structure.

---

### 4. Non-Root User

Run as non-root for security:

```dockerfile
# Create timmy user
RUN groupadd -r timmy && useradd -r -g timmy timmy

# Set ownership
RUN chown -R timmy:timmy /app

# Switch to non-root user
USER timmy
```

**Why:** Running as root inside container is a security risk. Non-root limits damage from container escape.

---

### 5. Environment Variables

Set default environment:

```dockerfile
ENV NODE_ENV=production
ENV NPM_CONFIG_LOGLEVEL=warn
ENV TZ=UTC
```

**Why:** Sensible defaults that can be overridden at runtime.

---

### 6. Health Check Foundation

Prepare for health monitoring:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1
```

**Why:** Docker can automatically detect unhealthy containers. Actual check will be more sophisticated later.

---

## Dockerfile (Complete)

```dockerfile
# =========================================
# Timmy Base Image
# =========================================
FROM node:20-slim

LABEL maintainer="Timmy Team"
LABEL description="Base image for Timmy automation system"
LABEL version="1.0"

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN groupadd -r timmy && useradd -r -g timmy timmy

# Set up working directory
WORKDIR /app

# Create directory structure
RUN mkdir -p /app/data/cache \
             /app/data/state \
             /app/data/tracking \
             /app/config \
    && chown -R timmy:timmy /app

# Set environment
ENV NODE_ENV=production
ENV NPM_CONFIG_LOGLEVEL=warn
ENV TZ=UTC

# Switch to non-root user
USER timmy

# Basic health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1
```

---

## Image Variants

### Base (This Phase)
- Node.js + system tools
- No application code
- ~250MB

### Development (Phase 02)
- Base + development tools
- TypeScript, nodemon, etc.
- ~400MB

### Production (Phase 06)
- Base + compiled application
- No dev dependencies
- ~300MB

---

## Depends On

Nothing - this is the first phase.

## Success Criteria

- [ ] Dockerfile builds without errors
- [ ] Image size under 300MB
- [ ] Node.js version is 20.x
- [ ] Git is installed and functional
- [ ] Non-root user can write to /app/data
- [ ] Health check passes
- [ ] Can be used as base for dev/prod images

## Open Questions (Resolved)

1. **Alpine vs Slim?** → **Slim chosen.** Alpine can have compatibility issues with npm packages that use native bindings (like `better-sqlite3`). Slim provides good balance of size and compatibility.

2. **Node version pinning?** → **20.x (minor) chosen.** Using `node:20-slim` gives us automatic patch updates while staying on LTS. For production deployments requiring strict reproducibility, pin to specific version in docker-compose.

3. **Multi-architecture?** → **Yes, ARM64 supported.** The `node:20-slim` base image supports both AMD64 and ARM64. Build script supports explicit platform targeting via `docker buildx`.

---

## Notes

This phase creates the foundation. Keep it minimal - only include what every variant needs. Specific tools (AI CLIs, dev tools) go in later phases.

A clean base image makes debugging easier. When something breaks, you know it's not the base.
