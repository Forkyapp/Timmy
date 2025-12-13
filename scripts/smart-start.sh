#!/bin/bash
# =========================================
# Smart Start - Auto-detects best run method
# =========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$PROJECT_ROOT"

# Check if Docker is available and running
docker_available() {
    command -v docker &> /dev/null && docker info &> /dev/null
}

# Check if .env exists (setup completed)
setup_done() {
    [ -f "$PROJECT_ROOT/.env" ] && [ -f "$PROJECT_ROOT/projects.json" ]
}

# Check if --local flag passed
LOCAL_MODE=false
DOCKER_MODE=false
for arg in "$@"; do
    case $arg in
        --local) LOCAL_MODE=true ;;
        --docker) DOCKER_MODE=true ;;
    esac
done

# Run setup if not done
if ! setup_done; then
    echo -e "${YELLOW}! Setup not complete. Running setup...${NC}"
    echo ""
    if [ -f "$PROJECT_ROOT/docker/scripts/setup-auth.sh" ]; then
        bash "$PROJECT_ROOT/docker/scripts/setup-auth.sh"
    else
        npm run init
    fi
fi

# Decide how to run
if [ "$LOCAL_MODE" = true ]; then
    echo -e "${CYAN}Starting locally...${NC}"
    npm run build && NODE_NO_WARNINGS=1 node dist/timmy.js
elif [ "$DOCKER_MODE" = true ] || docker_available; then
    echo -e "${GREEN}Starting with Docker...${NC}"

    # Build base image if not exists
    if ! docker images | grep -q "timmy-base"; then
        echo -e "${CYAN}Building base image (first time only)...${NC}"
        bash "$PROJECT_ROOT/docker/scripts/build-base.sh"
    fi

    # Start with docker compose
    docker compose up -d
    echo ""
    echo -e "${GREEN}✓ Timmy started in Docker${NC}"
    echo -e "  View logs: ${CYAN}docker compose logs -f${NC}"
    echo -e "  Stop:      ${CYAN}docker compose down${NC}"
else
    echo -e "${CYAN}Docker not available, starting locally...${NC}"
    npm run build && NODE_NO_WARNINGS=1 node dist/timmy.js
fi
