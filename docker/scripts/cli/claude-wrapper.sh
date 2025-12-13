#!/bin/bash
# =========================================
# Claude CLI Wrapper
# Provides timeout, error handling, and auth check
# =========================================

set -e

# Configuration
TIMEOUT_SECONDS="${CLAUDE_TIMEOUT_SECONDS:-600}"  # 10 minutes default

# Check authentication
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "ERROR: ANTHROPIC_API_KEY not set" >&2
    exit 1
fi

# Check if Claude CLI is installed
if ! command -v claude &> /dev/null; then
    echo "ERROR: Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code" >&2
    exit 127
fi

# Run Claude with timeout
timeout "$TIMEOUT_SECONDS" claude "$@"
exit_code=$?

# Handle timeout
if [ $exit_code -eq 124 ]; then
    echo "ERROR: Claude timed out after ${TIMEOUT_SECONDS} seconds" >&2
fi

exit $exit_code
