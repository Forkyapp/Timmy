#!/bin/bash
# =========================================
# Git Helper Scripts for Clone-Based Workflow
# Phase 04: Volume Mounts
# =========================================
# Usage:
#   source /app/scripts/git-helpers.sh
#   clone_repo "https://github.com/owner/repo.git" "repo-name"
#   prepare_branch "repo-name" "feature/task-123"
# =========================================

GIT_CACHE_DIR="${GIT_CACHE_DIR:-/home/timmy/.git-cache}"
WORKSPACE_DIR="${WORKSPACE_PATH:-/workspace}"

# Clone a repository with caching for speed
# Usage: clone_repo <repo_url> [local_name]
clone_repo() {
    local repo_url="$1"
    local local_name="${2:-$(basename "$repo_url" .git)}"
    local target_dir="$WORKSPACE_DIR/$local_name"

    echo "Cloning $repo_url to $target_dir..."

    # Create cache directory if it doesn't exist
    mkdir -p "$GIT_CACHE_DIR"

    # If repo already exists, just fetch updates
    if [ -d "$target_dir/.git" ]; then
        echo "Repository already exists, fetching updates..."
        cd "$target_dir"
        git fetch --all --prune
        git checkout main 2>/dev/null || git checkout master 2>/dev/null || true
        git pull --ff-only 2>/dev/null || true
        return 0
    fi

    # Clone with reference cache if available
    local cache_path="$GIT_CACHE_DIR/$(echo "$repo_url" | md5sum | cut -d' ' -f1)"

    if [ -d "$cache_path" ]; then
        echo "Using cached clone for speed..."
        git clone --reference "$cache_path" "$repo_url" "$target_dir"
    else
        echo "First clone, creating cache..."
        # Clone to cache first (bare repo)
        git clone --bare "$repo_url" "$cache_path" 2>/dev/null || true
        # Then clone normally
        git clone "$repo_url" "$target_dir"
    fi

    echo "Clone complete: $target_dir"
}

# Prepare a branch for working on a task
# Usage: prepare_branch <repo_name> <branch_name> [base_branch]
prepare_branch() {
    local repo_name="$1"
    local branch_name="$2"
    local base_branch="${3:-main}"
    local target_dir="$WORKSPACE_DIR/$repo_name"

    if [ ! -d "$target_dir/.git" ]; then
        echo "ERROR: Repository not found: $target_dir"
        return 1
    fi

    cd "$target_dir"

    # Fetch latest
    git fetch origin

    # Try to checkout base branch (main or master)
    git checkout "$base_branch" 2>/dev/null || git checkout master 2>/dev/null || {
        echo "ERROR: Could not checkout base branch"
        return 1
    }

    # Pull latest
    git pull --ff-only

    # Create and checkout feature branch
    if git show-ref --verify --quiet "refs/heads/$branch_name"; then
        echo "Branch $branch_name already exists, checking out..."
        git checkout "$branch_name"
    else
        echo "Creating new branch: $branch_name"
        git checkout -b "$branch_name"
    fi

    echo "Ready to work on: $branch_name"
}

# Clean up a workspace (delete cloned repo)
# Usage: cleanup_repo <repo_name>
cleanup_repo() {
    local repo_name="$1"
    local target_dir="$WORKSPACE_DIR/$repo_name"

    if [ -d "$target_dir" ]; then
        echo "Removing repository: $target_dir"
        rm -rf "$target_dir"
        echo "Cleanup complete"
    else
        echo "Repository not found: $target_dir"
    fi
}

# List all cloned repositories
# Usage: list_repos
list_repos() {
    echo "Cloned repositories in $WORKSPACE_DIR:"
    if [ -d "$WORKSPACE_DIR" ]; then
        for dir in "$WORKSPACE_DIR"/*/; do
            if [ -d "$dir/.git" ]; then
                local repo_name=$(basename "$dir")
                local branch=$(cd "$dir" && git branch --show-current 2>/dev/null || echo "unknown")
                echo "  - $repo_name (branch: $branch)"
            fi
        done
    else
        echo "  (none)"
    fi
}

# Get the path to a cloned repository
# Usage: get_repo_path <repo_name>
get_repo_path() {
    local repo_name="$1"
    echo "$WORKSPACE_DIR/$repo_name"
}
