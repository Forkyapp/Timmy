#!/bin/bash
# =========================================
# Initialize Docker Volume Directories
# Phase 04: Volume Mounts
# Run this before first docker compose up
# =========================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

echo -e "${YELLOW}Initializing Docker volumes...${NC}"
echo ""

# Create data directories
echo "Creating data directories..."
mkdir -p ./data/cache
mkdir -p ./data/state
mkdir -p ./data/tracking

# Create config directory
echo "Creating config directory..."
mkdir -p ./config

# Create logs directory
echo "Creating logs directory..."
mkdir -p ./logs

# Create workspace directory
echo "Creating workspace directory..."
mkdir -p ./workspace

# Set permissions
echo "Setting permissions..."
chmod 755 ./data ./config ./logs ./workspace
chmod 700 ./data/cache ./data/state ./data/tracking

# Create default config files if missing
if [ ! -f ./config/projects.json ]; then
    echo "Creating default projects.json..."
    echo '{"projects":{}}' > ./config/projects.json
fi

if [ ! -f ./config/workspace.json ]; then
    echo "Creating default workspace.json..."
    echo '{"active":null}' > ./config/workspace.json
fi

echo ""
echo -e "${GREEN}Volumes initialized successfully!${NC}"
echo ""
echo "Directory structure:"
echo "  ./data/           - Persistent state (cache, queue, tracking)"
echo "  ./config/         - Configuration files (read-only in container)"
echo "  ./logs/           - Log files"
echo "  ./workspace/      - Target repositories for AI agents"
echo ""
echo "Next steps:"
echo "  1. Add your target repositories to ./workspace/"
echo "  2. Configure ./config/projects.json"
echo "  3. Run: docker compose up -d"
