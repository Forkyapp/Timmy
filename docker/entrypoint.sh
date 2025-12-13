#!/bin/bash
# =========================================
# Timmy Docker Entrypoint
# Phase 04: Volume Mounts & Permissions
# Fixes permissions and runs as non-root user
# =========================================

set -e

# Fix ownership of mounted volumes (run as root)
if [ "$(id -u)" = "0" ]; then
    # Ensure timmy user owns writable directories
    chown -R timmy:timmy /app/node_modules 2>/dev/null || true
    chown -R timmy:timmy /app/data 2>/dev/null || true
    chown -R timmy:timmy /app/logs 2>/dev/null || true
    chown -R timmy:timmy /workspace 2>/dev/null || true
    chown -R timmy:timmy /home/timmy/.git-cache 2>/dev/null || true

    # Fix SSH directory permissions (must be strict for SSH to work)
    if [ -d /home/timmy/.ssh ]; then
        chmod 700 /home/timmy/.ssh 2>/dev/null || true
        chmod 600 /home/timmy/.ssh/* 2>/dev/null || true
        chmod 644 /home/timmy/.ssh/*.pub 2>/dev/null || true
        chmod 644 /home/timmy/.ssh/known_hosts 2>/dev/null || true
    fi

    # Drop to timmy user and re-execute this script
    exec gosu timmy "$0" "$@"
fi

# Now running as timmy user

# Set up git cache directory
export GIT_CACHE_DIR="/home/timmy/.git-cache"
mkdir -p "$GIT_CACHE_DIR" 2>/dev/null || true

# Configure Git if not already configured
if [ -z "$(git config --global user.email 2>/dev/null)" ]; then
    git config --global user.email "timmy@docker.local" 2>/dev/null || true
fi
if [ -z "$(git config --global user.name 2>/dev/null)" ]; then
    git config --global user.name "Timmy Bot" 2>/dev/null || true
fi

# Trust workspace directories for Git operations
git config --global --add safe.directory '/workspace' 2>/dev/null || true
git config --global --add safe.directory '*' 2>/dev/null || true

# Source git helpers if available
if [ -f /app/scripts/git-helpers.sh ]; then
    # shellcheck source=/dev/null
    . /app/scripts/git-helpers.sh
fi

exec "$@"
