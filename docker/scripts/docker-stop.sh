#!/bin/bash
# =========================================
# Stop Timmy Docker Environment
# Phase 05: Compose Orchestration
# =========================================
# Usage:
#   ./docker/scripts/docker-stop.sh [--clean]
#
# Options:
#   --clean   Also remove volumes (fresh start)
# =========================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

CLEAN=false
if [ "$1" = "--clean" ]; then
    CLEAN=true
fi

echo -e "${YELLOW}Stopping Timmy containers...${NC}"

# Stop all configurations
docker compose down 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.prod.yml down 2>/dev/null || true

if [ "$CLEAN" = true ]; then
    echo ""
    echo -e "${YELLOW}Removing volumes (--clean mode)...${NC}"
    docker volume rm timmy_node_modules 2>/dev/null || true
    docker volume rm timmy_workspace 2>/dev/null || true
    docker volume rm timmy_git-cache 2>/dev/null || true
    echo "Volumes removed."
fi

echo ""
echo -e "${YELLOW}Checking for orphan containers...${NC}"
ORPHANS=$(docker ps -a --filter "name=timmy" --format "{{.Names}}" 2>/dev/null || echo "")

if [ -n "$ORPHANS" ]; then
    echo -e "${RED}Found orphan containers:${NC}"
    echo "$ORPHANS"
    echo ""
    read -p "Remove them? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker rm -f $ORPHANS
        echo "Removed."
    fi
else
    echo "No orphan containers found."
fi

echo ""
echo -e "${GREEN}Timmy stopped successfully!${NC}"

if [ "$CLEAN" = true ]; then
    echo ""
    echo "Note: Volumes were removed. Next start will:"
    echo "  - Reinstall npm dependencies"
    echo "  - Re-clone any repositories"
    echo "  - Start fresh"
fi
