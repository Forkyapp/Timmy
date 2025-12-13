#!/bin/bash
# =========================================
# Gemini CLI Wrapper
# Provides timeout, error handling, and auth check
# =========================================

set -e

# Configuration
TIMEOUT_SECONDS="${GEMINI_TIMEOUT_SECONDS:-300}"  # 5 minutes default

# Check authentication
if [ -z "$GOOGLE_API_KEY" ] && [ -z "$GEMINI_API_KEY" ]; then
    echo "ERROR: GOOGLE_API_KEY or GEMINI_API_KEY not set" >&2
    exit 1
fi

# Check if Gemini CLI is installed
if ! command -v gemini &> /dev/null; then
    echo "ERROR: Gemini CLI not found" >&2
    exit 127
fi

# Run Gemini with timeout
timeout "$TIMEOUT_SECONDS" gemini "$@"
exit_code=$?

# Handle timeout
if [ $exit_code -eq 124 ]; then
    echo "ERROR: Gemini timed out after ${TIMEOUT_SECONDS} seconds" >&2
fi

exit $exit_code
