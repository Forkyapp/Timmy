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

# Add GitHub to known hosts to avoid SSH host verification prompts
mkdir -p ~/.ssh 2>/dev/null || true
if [ ! -f ~/.ssh/known_hosts ] || ! grep -q "github.com" ~/.ssh/known_hosts 2>/dev/null; then
    ssh-keyscan -H github.com >> ~/.ssh/known_hosts 2>/dev/null || true
fi

# Trust workspace directories for Git operations
git config --global --add safe.directory '/workspace' 2>/dev/null || true
git config --global --add safe.directory '/workspace/*' 2>/dev/null || true
git config --global --add safe.directory '*' 2>/dev/null || true

# Source git helpers if available
if [ -f /app/scripts/git-helpers.sh ]; then
    # shellcheck source=/dev/null
    . /app/scripts/git-helpers.sh
fi

# =========================================
# Auto-clone repositories from projects.json
# =========================================
if [ -f /app/projects.json ]; then
    echo "🔍 Checking for repositories to clone..."

    # Read projects from projects.json and clone if needed
    # This uses jq if available, otherwise falls back to grep
    if command -v jq >/dev/null 2>&1; then
        # Extract all project paths and clone URLs
        while IFS='|' read -r owner repo path; do
            if [ -n "$owner" ] && [ -n "$repo" ] && [ -n "$path" ]; then
                # Check if repository exists
                if [ ! -d "$path/.git" ]; then
                    echo "📦 Cloning $owner/$repo to $path..."
                    mkdir -p "$(dirname "$path")" 2>/dev/null || true

                    # Try to clone the repository (shallow clone for speed)
                    if git clone --depth 1 --single-branch "https://github.com/$owner/$repo.git" "$path" 2>/dev/null; then
                        echo "✓ Successfully cloned $owner/$repo (shallow clone)"
                    elif git clone "git@github.com:$owner/$repo.git" "$path" 2>/dev/null; then
                        echo "✓ Successfully cloned $owner/$repo (via SSH)"
                    else
                        echo "⚠️  Failed to clone $owner/$repo (may need authentication)"
                        echo "   You can manually clone it later or set up SSH keys"
                    fi
                else
                    echo "✓ Repository $owner/$repo already exists at $path"
                fi
            fi
        done < <(jq -r '.projects[] | "\(.github.owner)|\(.github.repo)|\(.github.path)"' /app/projects.json 2>/dev/null)
    fi
fi

exec "$@"
