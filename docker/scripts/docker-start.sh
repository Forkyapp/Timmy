#!/bin/bash
# =========================================
# Start Timmy Docker Environment
# Phase 05: Compose Orchestration
# =========================================
# Usage:
#   ./docker/scripts/docker-start.sh [dev|prod]
#   ./docker/scripts/docker-start.sh          # defaults to dev
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

# Determine environment
ENV="${1:-dev}"

echo -e "${YELLOW}Starting Timmy in ${ENV} mode...${NC}"
echo ""

case "$ENV" in
    dev|development)
        echo "Using: docker-compose.yml (development)"
        echo ""

        # Build if needed
        docker compose build

        # Start
        docker compose up -d

        echo ""
        echo -e "${GREEN}Timmy started in development mode!${NC}"
        echo ""
        echo "Useful commands:"
        echo "  docker compose logs -f     # Watch logs"
        echo "  docker compose ps          # Check status"
        echo "  docker compose exec timmy bash  # Shell access"
        echo ""
        echo "Following logs (Ctrl+C to exit)..."
        echo ""
        docker compose logs -f
        ;;

    prod|production)
        echo "Using: docker-compose.yml + docker-compose.prod.yml"
        echo ""

        # Build if needed
        docker compose -f docker-compose.yml -f docker-compose.prod.yml build

        # Start
        docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

        echo ""
        echo -e "${GREEN}Timmy started in production mode!${NC}"
        echo ""
        echo "Useful commands:"
        echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
        echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml ps"
        ;;

    *)
        echo -e "${RED}Unknown environment: $ENV${NC}"
        echo ""
        echo "Usage: $0 [dev|prod]"
        echo ""
        echo "  dev   - Development mode (default)"
        echo "          Hot reload, debug port, verbose logging"
        echo ""
        echo "  prod  - Production mode"
        echo "          Resource limits, auto-restart, quiet logging"
        exit 1
        ;;
esac
