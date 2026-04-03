#!/bin/bash
# =========================================
# Codex CLI Wrapper
# Provides timeout, error handling, and auth check
# =========================================

set -e

# Configuration
TIMEOUT_SECONDS="${CODEX_TIMEOUT_SECONDS:-300}"  # 5 minutes default

# Load secret from Docker secrets file if available, fall back to env var
if [ -n "$OPENAI_API_KEY_FILE" ] && [ -f "$OPENAI_API_KEY_FILE" ]; then
    export OPENAI_API_KEY="$(cat "$OPENAI_API_KEY_FILE")"
fi

# Check authentication
if [ -z "$OPENAI_API_KEY" ]; then
    echo "ERROR: OPENAI_API_KEY not set (set env var or mount Docker secret)" >&2
    exit 1
fi

# Check if Codex CLI is installed
if ! command -v codex &> /dev/null; then
    echo "ERROR: Codex CLI not found. Install with: npm install -g @openai/codex" >&2
    exit 127
fi

# Run Codex with timeout
timeout "$TIMEOUT_SECONDS" codex "$@"
exit_code=$?

# Handle timeout
if [ $exit_code -eq 124 ]; then
    echo "ERROR: Codex timed out after ${TIMEOUT_SECONDS} seconds" >&2
fi

exit $exit_code
