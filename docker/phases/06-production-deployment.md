# Phase 06: Production Deployment

## Problem

Development Docker setup is not optimized for production:
- Includes development dependencies
- Has debugging ports exposed
- Uses unoptimized Node.js settings
- Lacks proper security hardening
- No consideration for CI/CD

## Solution

Create a production-optimized Docker configuration with multi-stage builds, security hardening, and deployment automation.

## Features

### 1. Multi-Stage Build

Separate build and runtime stages:

```dockerfile
# =========================================
# Stage 1: Builder
# =========================================
FROM node:20-slim AS builder

WORKDIR /build

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev)
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# =========================================
# Stage 2: Runtime
# =========================================
FROM node:20-slim AS runtime

WORKDIR /app

# Copy only production artifacts
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json ./

CMD ["node", "dist/timmy.js"]
```

**Why:** Final image contains only what's needed to run. No TypeScript, no dev dependencies, smaller attack surface.

---

### 2. Image Size Optimization

Minimize image size:

```dockerfile
# Use slim base
FROM node:20-slim

# Single RUN command to reduce layers
RUN apt-get update \
    && apt-get install -y --no-install-recommends git curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Use .dockerignore
```

**.dockerignore:**
```
node_modules
dist
.git
*.md
*.log
.env*
data/
logs/
tests/
__tests__/
*.test.ts
```

**Size targets:**
- Development: ~400MB
- Production: ~200MB

**Why:** Smaller images = faster pulls, less storage, smaller attack surface.

---

### 3. Security Hardening

Lock down the production image:

```dockerfile
# Non-root user (already in base)
USER timmy

# No shell for non-root user
RUN chsh -s /usr/sbin/nologin timmy

# Read-only root filesystem
# (set via docker-compose or runtime flag)

# Drop capabilities
# (set via docker-compose)
```

**docker-compose.prod.yml:**
```yaml
services:
  timmy:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
```

**Why:** Defense in depth. Limit what a compromised container can do.

---

### 4. Secrets Management

Handle secrets properly in production:

```yaml
# docker-compose.prod.yml
services:
  timmy:
    secrets:
      - anthropic_api_key
      - github_token
      - clickup_api_key
    environment:
      - ANTHROPIC_API_KEY_FILE=/run/secrets/anthropic_api_key
      - GITHUB_TOKEN_FILE=/run/secrets/github_token

secrets:
  anthropic_api_key:
    external: true    # Created outside compose
  github_token:
    external: true
  clickup_api_key:
    external: true
```

**Creating secrets:**
```bash
# Docker Swarm mode
docker secret create anthropic_api_key ./secrets/anthropic.txt

# Or with external secret management
# (Vault, AWS Secrets Manager, etc.)
```

**Application code to read secrets:**
```typescript
function getSecret(envName: string): string {
  const fileEnv = `${envName}_FILE`;

  // Check for Docker secret file
  if (process.env[fileEnv]) {
    return fs.readFileSync(process.env[fileEnv], 'utf8').trim();
  }

  // Fall back to environment variable
  return process.env[envName] || '';
}
```

**Why:** Environment variables can leak in logs/errors. Files are more secure.

---

### 5. Health Checks (Production)

Comprehensive health monitoring:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node /app/scripts/healthcheck.js
```

**healthcheck.js (Production):**
```javascript
const fs = require('fs');
const path = require('path');

async function healthCheck() {
  const checks = {
    filesystem: false,
    memory: false,
    eventLoop: false
  };

  // Check filesystem access
  try {
    fs.accessSync('/app/data', fs.constants.W_OK);
    checks.filesystem = true;
  } catch {}

  // Check memory usage
  const used = process.memoryUsage();
  const heapPercent = used.heapUsed / used.heapTotal;
  checks.memory = heapPercent < 0.9;  // Under 90% heap usage

  // Check event loop (not blocked)
  const start = Date.now();
  await new Promise(r => setImmediate(r));
  checks.eventLoop = (Date.now() - start) < 100;  // Under 100ms delay

  // All checks must pass
  const healthy = Object.values(checks).every(Boolean);

  if (!healthy) {
    console.error('Health check failed:', checks);
    process.exit(1);
  }

  process.exit(0);
}

healthCheck();
```

**Why:** Production health checks should verify real functionality, not just "process is running".

---

### 6. Graceful Shutdown

Handle termination signals properly:

```typescript
// timmy.ts
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');

  // Stop accepting new tasks
  await stopPolling();

  // Wait for current task to complete (with timeout)
  await waitForCurrentTask(30000);

  // Clean up resources
  await cleanup();

  console.log('Shutdown complete');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, forcing shutdown...');
  process.exit(1);
});
```

**Docker stop timeout:**
```yaml
services:
  timmy:
    stop_grace_period: 60s    # Wait up to 60s for graceful shutdown
```

**Why:** Complete current work before stopping. Prevents data corruption.

---

### 7. CI/CD Integration

GitHub Actions workflow:

```yaml
# .github/workflows/docker.yml
name: Docker Build & Push

on:
  push:
    branches: [main]
  release:
    types: [published]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile.prod
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Why:** Automated builds ensure consistent, tested images.

---

### 8. Container Registry

Push images to registry:

```bash
# Build
docker build -t ghcr.io/myorg/timmy:latest -f docker/Dockerfile.prod .

# Push
docker push ghcr.io/myorg/timmy:latest

# Pull on server
docker pull ghcr.io/myorg/timmy:latest
```

**docker-compose.prod.yml (using registry):**
```yaml
services:
  timmy:
    image: ghcr.io/myorg/timmy:latest
    # No build context needed
```

**Why:** Deploy same image everywhere. No building on production servers.

---

## Complete Production Dockerfile

```dockerfile
# =========================================
# Timmy Production Image
# Multi-stage build for minimal size
# =========================================

# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first (cache layer)
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/
COPY lib/ ./lib/
COPY timmy.ts ./

# Build TypeScript
RUN npm run build

# Prune to production dependencies only
RUN npm prune --production


# Stage 2: AI CLIs
FROM node:20-slim AS cli-installer

# Install AI CLIs
RUN npm install -g \
    @anthropic-ai/claude-code \
    @google/generative-ai-cli \
    @openai/codex-cli \
    2>/dev/null || true


# Stage 3: Runtime
FROM node:20-slim AS runtime

LABEL maintainer="Timmy Team"
LABEL version="1.0"
LABEL description="Timmy - ClickUp to Claude Code Integration"

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN groupadd -r timmy && useradd -r -g timmy -s /usr/sbin/nologin timmy

WORKDIR /app

# Copy built application
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json ./

# Copy AI CLIs
COPY --from=cli-installer /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=cli-installer /usr/local/bin /usr/local/bin

# Copy scripts
COPY docker/scripts/ ./scripts/
RUN chmod +x ./scripts/*.sh 2>/dev/null || true

# Create directories
RUN mkdir -p /app/data/cache /app/data/state /app/data/tracking /app/logs \
    && chown -R timmy:timmy /app

# Set environment
ENV NODE_ENV=production
ENV TZ=UTC

# Switch to non-root
USER timmy

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node scripts/healthcheck.js || exit 1

# Start application
CMD ["node", "dist/timmy.js"]
```

---

## Production docker-compose.prod.yml

```yaml
version: '3.8'

services:
  timmy:
    image: ghcr.io/myorg/timmy:latest
    container_name: timmy-prod
    restart: unless-stopped

    volumes:
      - ${WORKSPACE_PATH}:/workspace:rw
      - timmy-data:/app/data:rw
      - ./config:/app/config:ro
      - ./logs:/app/logs:rw

    env_file:
      - .env.production

    environment:
      - NODE_ENV=production

    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 512M

    security_opt:
      - no-new-privileges:true

    cap_drop:
      - ALL

    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"

    healthcheck:
      test: ["CMD", "node", "scripts/healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

    stop_grace_period: 60s

volumes:
  timmy-data:
    driver: local
```

---

## Depends On

- Phase 01 (Base Image)
- Phase 02 (Development Environment) - for testing
- Phase 03 (AI CLI Integration)
- Phase 04 (Volume Mounts)
- Phase 05 (Compose Orchestration)

## Success Criteria

- [ ] Multi-stage build produces minimal image
- [ ] Image size under 200MB
- [ ] No development dependencies in production
- [ ] Security hardening applied
- [ ] Secrets handled properly (not in env vars)
- [ ] Health checks verify real functionality
- [ ] Graceful shutdown works
- [ ] CI/CD pipeline builds and pushes images
- [ ] Production deployment runs stable

## Open Questions

1. **Registry?** GitHub Container Registry, Docker Hub, or private?
2. **Blue-green deployment?** Strategy for zero-downtime updates?
3. **Monitoring?** Prometheus metrics, logs aggregation?
4. **Scaling?** Horizontal scaling with multiple instances?

---

## Notes

Production is where things get real. Everything that was "fine in development" becomes a problem:

- That console.log now fills up disk
- That uncaught exception now crashes the service
- That env var is now visible in process list

Test in production-like environments. Use the same image locally that you deploy.

**Remember:** The production container should be boring. No surprises.
