# Phase 05: Compose Orchestration

## Problem

Managing Docker containers manually is error-prone:
- Multiple commands to start/stop
- Easy to forget environment variables
- No coordination between services
- Different configurations for dev/prod

We need a single source of truth for container configuration.

## Solution

Use Docker Compose to define and orchestrate all containers. One file describes the entire setup. One command starts everything.

## Features

### 1. Service Definition

Define Timmy as a service:

```yaml
# docker-compose.yml
version: '3.8'

services:
  timmy:
    build:
      context: .
      dockerfile: docker/Dockerfile
    container_name: timmy
    restart: unless-stopped
```

**Why:** Declarative configuration. The file IS the documentation.

---

### 2. Multi-File Configuration

Separate files for different environments:

```
docker/
├── docker-compose.yml           # Base configuration
├── docker-compose.dev.yml       # Development overrides
├── docker-compose.prod.yml      # Production overrides
└── docker-compose.test.yml      # Testing configuration
```

**Usage:**
```bash
# Development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up

# Shorthand with COMPOSE_FILE env var
export COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml
docker compose up
```

**Why:** Share common config, override only what differs.

---

### 3. Environment Management

Handle environment variables cleanly:

```yaml
# docker-compose.yml
services:
  timmy:
    env_file:
      - .env                    # Default environment
    environment:
      - NODE_ENV=${NODE_ENV:-production}
```

**.env file:**
```bash
# ClickUp
CLICKUP_API_KEY=pk_xxx
CLICKUP_WORKSPACE_ID=12345

# GitHub
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=myorg
GITHUB_REPO=myapp

# AI Services
ANTHROPIC_API_KEY=sk-xxx
GOOGLE_API_KEY=xxx
OPENAI_API_KEY=sk-xxx
```

**Why:** Secrets stay out of compose files. Easy to switch environments.

---

### 4. Health Checks

Monitor container health:

```yaml
services:
  timmy:
    healthcheck:
      test: ["CMD", "node", "scripts/healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

**healthcheck.js:**
```javascript
// scripts/healthcheck.js
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});

req.on('error', () => process.exit(1));
req.end();
```

**Why:** Docker restarts unhealthy containers. Monitoring systems can track health.

---

### 5. Resource Limits

Prevent runaway resource usage:

```yaml
services:
  timmy:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 512M
```

**Why:** AI processes can be resource-hungry. Limits protect the host system.

---

### 6. Logging Configuration

Centralized logging:

```yaml
services:
  timmy:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

**Alternative: External Logging:**
```yaml
logging:
  driver: "syslog"
  options:
    syslog-address: "udp://logs.example.com:514"
```

**Why:** Prevent disk fill from unbounded logs. Enable log aggregation.

---

### 7. Dependency Management

Define startup order:

```yaml
services:
  timmy:
    depends_on:
      redis:
        condition: service_healthy

  redis:
    image: redis:alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
```

**Why:** Ensures dependencies are ready before Timmy starts.

---

### 8. Network Configuration

Isolate container network:

```yaml
services:
  timmy:
    networks:
      - timmy-network

networks:
  timmy-network:
    driver: bridge
```

**Why:** Containers on same network can communicate. Isolation from other containers.

---

## Complete Configuration Files

### docker-compose.yml (Base)

```yaml
version: '3.8'

services:
  timmy:
    build:
      context: .
      dockerfile: docker/Dockerfile
    container_name: timmy

    volumes:
      - ${WORKSPACE_PATH:-./workspace}:/workspace:rw
      - ./data:/app/data:rw
      - ./config:/app/config:ro
      - ./logs:/app/logs:rw

    env_file:
      - .env

    networks:
      - timmy-network

    healthcheck:
      test: ["CMD", "node", "-e", "console.log('healthy')"]
      interval: 30s
      timeout: 10s
      retries: 3

    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  timmy-network:
    driver: bridge
```

### docker-compose.dev.yml (Development)

```yaml
version: '3.8'

services:
  timmy:
    build:
      dockerfile: docker/Dockerfile.dev

    volumes:
      - .:/app:rw
      - node_modules:/app/node_modules

    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug

    ports:
      - "9229:9229"    # Debug port

    tty: true
    stdin_open: true

    command: nodemon --exec "ts-node -r tsconfig-paths/register" timmy.ts

volumes:
  node_modules:
```

### docker-compose.prod.yml (Production)

```yaml
version: '3.8'

services:
  timmy:
    build:
      dockerfile: docker/Dockerfile.prod

    environment:
      - NODE_ENV=production

    restart: unless-stopped

    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 512M
```

---

## Helper Scripts

### scripts/docker-start.sh

```bash
#!/bin/bash
set -e

# Determine environment
ENV=${1:-dev}

case $ENV in
  dev|development)
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
    docker compose logs -f
    ;;
  prod|production)
    docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    ;;
  *)
    echo "Usage: $0 [dev|prod]"
    exit 1
    ;;
esac
```

### scripts/docker-stop.sh

```bash
#!/bin/bash
set -e

echo "Stopping Timmy containers..."
docker compose down

echo "Verifying no orphan processes..."
docker ps -a | grep timmy || echo "All clean"

echo "Done"
```

---

## Usage Commands

```bash
# Development
./scripts/docker-start.sh dev
# or
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Production
./scripts/docker-start.sh prod

# View logs
docker compose logs -f timmy

# Stop everything
./scripts/docker-stop.sh

# Rebuild
docker compose build --no-cache

# Shell access
docker compose exec timmy bash

# View status
docker compose ps
```

---

## Depends On

- Phase 01 (Base Image)
- Phase 02 (Development Environment)
- Phase 03 (AI CLI Integration)
- Phase 04 (Volume Mounts)

## Success Criteria

- [ ] `docker compose up` starts all services
- [ ] `docker compose down` stops cleanly
- [ ] Development and production configs work
- [ ] Health checks report status
- [ ] Resource limits enforced
- [ ] Logs captured and rotated
- [ ] Environment variables load correctly

## Open Questions

1. **Compose version?** v2 (docker compose) vs v1 (docker-compose)?
2. **Multiple replicas?** Scale Timmy horizontally?
3. **Swarm/K8s?** Future migration to orchestrators?
4. **Secrets management?** Docker secrets vs .env files?

---

## Notes

Docker Compose is the glue that holds everything together. A well-designed compose file makes operations simple:

- Start: `docker compose up -d`
- Stop: `docker compose down`
- Logs: `docker compose logs -f`
- Status: `docker compose ps`

Keep the compose files clean and documented. They're the first thing someone looks at.
