# Phase 03: AI CLI Integration

## Problem

Timmy orchestrates multiple AI tools via their CLI interfaces:
- Claude Code CLI (`claude`)
- Gemini CLI (`gemini`)
- Codex CLI (`codex`)

These CLIs must be installed and configured inside the container. Each has different installation methods and authentication requirements.

## Solution

Create a Docker layer that installs all AI CLIs and handles their authentication. This ensures consistent AI tool availability across all environments.

## Features

### 1. Claude Code CLI

Install Anthropic's Claude Code CLI:

```dockerfile
# Install Claude CLI via npm
RUN npm install -g @anthropic-ai/claude-code

# Or via direct download (if not on npm)
# RUN curl -fsSL https://claude.ai/install.sh | sh
```

**Configuration:**
```yaml
environment:
  - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
  - CLAUDE_CLI_PATH=claude
```

**Verification:**
```bash
claude --version
```

**Why:** Claude handles code implementation - the core AI workload.

---

### 2. Gemini CLI

Install Google's Gemini CLI:

```dockerfile
# Install Gemini CLI
RUN npm install -g @google/generative-ai-cli

# Alternative: pip install if Python-based
# RUN pip install google-generativeai
```

**Configuration:**
```yaml
environment:
  - GOOGLE_API_KEY=${GOOGLE_API_KEY}
  - GEMINI_CLI_PATH=gemini
```

**Verification:**
```bash
gemini --version
```

**Why:** Gemini handles task analysis and specification generation.

---

### 3. Codex CLI

Install OpenAI's Codex CLI:

```dockerfile
# Install Codex CLI
RUN npm install -g @openai/codex-cli

# Or pip if Python-based
# RUN pip install openai
```

**Configuration:**
```yaml
environment:
  - OPENAI_API_KEY=${OPENAI_API_KEY}
  - CODEX_CLI_PATH=codex
```

**Verification:**
```bash
codex --version
```

**Why:** Codex handles code review and quality checks.

---

### 4. CLI Wrapper Scripts

Create wrapper scripts for consistent usage:

```bash
#!/bin/bash
# /app/scripts/claude-wrapper.sh

# Check authentication
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "ERROR: ANTHROPIC_API_KEY not set"
    exit 1
fi

# Run Claude with timeout
timeout 600 claude "$@"
exit_code=$?

if [ $exit_code -eq 124 ]; then
    echo "ERROR: Claude timed out after 10 minutes"
fi

exit $exit_code
```

**Why:** Consistent error handling and timeouts across all CLI tools.

---

### 5. Authentication Management

Handle API keys securely:

```yaml
# docker-compose.yml
services:
  timmy:
    secrets:
      - anthropic_key
      - google_key
      - openai_key
    environment:
      - ANTHROPIC_API_KEY_FILE=/run/secrets/anthropic_key

secrets:
  anthropic_key:
    file: ./secrets/anthropic.txt
  google_key:
    file: ./secrets/google.txt
  openai_key:
    file: ./secrets/openai.txt
```

**Alternative (Environment Variables):**
```yaml
# Simpler but less secure
environment:
  - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

**Why:** Docker secrets are more secure than environment variables for production.

---

### 6. CLI Health Checks

Verify CLIs are working:

```dockerfile
# healthcheck.sh
#!/bin/bash

# Check Claude
claude --help > /dev/null 2>&1 || exit 1

# Check Gemini
gemini --help > /dev/null 2>&1 || exit 1

# Check Codex
codex --help > /dev/null 2>&1 || exit 1

echo "All CLIs healthy"
exit 0
```

**Why:** Fail fast if CLI tools are broken.

---

### 7. Fallback Configuration

Handle missing or broken CLIs:

```typescript
// src/shared/config/cli-config.ts
export const cliConfig = {
  claude: {
    path: process.env.CLAUDE_CLI_PATH || 'claude',
    timeout: 600000, // 10 minutes
    fallback: null    // No fallback for Claude
  },
  gemini: {
    path: process.env.GEMINI_CLI_PATH || 'gemini',
    timeout: 300000, // 5 minutes
    fallback: 'claude' // Can use Claude as fallback analyzer
  },
  codex: {
    path: process.env.CODEX_CLI_PATH || 'codex',
    timeout: 300000,
    fallback: 'claude' // Can use Claude as fallback reviewer
  }
};
```

**Why:** Graceful degradation when a CLI is unavailable.

---

## Complete Dockerfile Addition

```dockerfile
# =========================================
# AI CLI Layer
# =========================================

# Switch to root for installation
USER root

# Install Python for any Python-based CLIs
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js-based CLIs
RUN npm install -g \
    @anthropic-ai/claude-code \
    @google/generative-ai-cli \
    @openai/codex-cli \
    || echo "Some CLIs may not be available on npm"

# Create wrapper scripts directory
RUN mkdir -p /app/scripts

# Copy wrapper scripts
COPY docker/scripts/claude-wrapper.sh /app/scripts/
COPY docker/scripts/gemini-wrapper.sh /app/scripts/
COPY docker/scripts/codex-wrapper.sh /app/scripts/
RUN chmod +x /app/scripts/*.sh

# Verify installations
RUN claude --version || echo "Claude CLI not installed"
RUN gemini --version || echo "Gemini CLI not installed"
RUN codex --version || echo "Codex CLI not installed"

# Switch back to non-root
USER timmy
```

---

## Environment Configuration

```yaml
# docker-compose.yml
services:
  timmy:
    environment:
      # API Keys
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}

      # CLI Paths
      - CLAUDE_CLI_PATH=/app/scripts/claude-wrapper.sh
      - GEMINI_CLI_PATH=/app/scripts/gemini-wrapper.sh
      - CODEX_CLI_PATH=/app/scripts/codex-wrapper.sh

      # Timeouts
      - CLAUDE_TIMEOUT=600000
      - GEMINI_TIMEOUT=300000
      - CODEX_TIMEOUT=300000
```

---

## Testing CLI Integration

```bash
# Test each CLI
docker compose exec timmy claude --help
docker compose exec timmy gemini --help
docker compose exec timmy codex --help

# Test with actual API call (minimal)
docker compose exec timmy claude "Hello, respond with 'OK'"
```

---

## Depends On

- Phase 01 (Base Image)
- Phase 02 (Development Environment) - for dev testing

## Success Criteria

- [ ] Claude CLI installed and responsive
- [ ] Gemini CLI installed and responsive
- [ ] Codex CLI installed and responsive
- [ ] API keys load correctly from environment
- [ ] Wrapper scripts provide consistent timeouts
- [ ] Health checks verify CLI availability
- [ ] Timmy can call each CLI and receive responses

## Open Questions

1. **CLI versioning?** Pin specific versions or use latest?
2. **Offline mode?** Mock CLIs for testing without API calls?
3. **Rate limiting?** Should wrapper scripts handle rate limits?
4. **Installation source?** npm, pip, or direct binary download?

---

## Notes

CLI availability may change. Tools may update, rename, or disappear. Build defensively:
- Check if CLI exists before using
- Have fallback strategies
- Log version information at startup
- Handle graceful degradation

The wrapper scripts are critical - they ensure consistent behavior and prevent runaway processes.
