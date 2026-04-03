#!/bin/bash
# =========================================
# Build Timmy Development Image
# Phase 02: Development Environment
# Requires: timmy-base image (run build-base.sh first)
# =========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_IMAGE="timmy-base:latest"
IMAGE_NAME="timmy-dev"
IMAGE_TAG="${1:-latest}"
DOCKERFILE="docker/Dockerfile.dev"

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${YELLOW}Building Timmy Development Image${NC}"
echo "Base: ${BASE_IMAGE}"
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "Dockerfile: ${DOCKERFILE}"
echo ""

cd "$PROJECT_ROOT"

# Check if base image exists
if ! docker image inspect "$BASE_IMAGE" &> /dev/null; then
    echo -e "${RED}Error: Base image '${BASE_IMAGE}' not found${NC}"
    echo ""
    echo "Please build the base image first:"
    echo "  ./docker/scripts/build-base.sh"
    exit 1
fi

# Build the image
echo -e "${YELLOW}Starting build...${NC}"
docker build \
    -f "$DOCKERFILE" \
    -t "${IMAGE_NAME}:${IMAGE_TAG}" \
    --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    .

echo ""
echo -e "${GREEN}Build complete!${NC}"
echo ""

# Show image info
echo -e "${YELLOW}Image Information:${NC}"
docker images "${IMAGE_NAME}:${IMAGE_TAG}"

# Show image size
IMAGE_SIZE=$(docker images "${IMAGE_NAME}:${IMAGE_TAG}" --format "{{.Size}}")
echo ""
echo -e "Image size: ${GREEN}${IMAGE_SIZE}${NC}"

# Verify tools are installed
echo ""
echo -e "${YELLOW}Verifying development tools...${NC}"

# Check nodemon
NODEMON_VERSION=$(docker run --rm "${IMAGE_NAME}:${IMAGE_TAG}" nodemon --version 2>/dev/null || echo "NOT FOUND")
echo -e "nodemon: ${GREEN}${NODEMON_VERSION}${NC}"

# Check ts-node
TSNODE_VERSION=$(docker run --rm "${IMAGE_NAME}:${IMAGE_TAG}" ts-node --version 2>/dev/null || echo "NOT FOUND")
echo -e "ts-node: ${GREEN}${TSNODE_VERSION}${NC}"

# Check TypeScript
TSC_VERSION=$(docker run --rm "${IMAGE_NAME}:${IMAGE_TAG}" tsc --version 2>/dev/null || echo "NOT FOUND")
echo -e "typescript: ${GREEN}${TSC_VERSION}${NC}"

echo ""
echo -e "${GREEN}Development image ready!${NC}"
echo ""
echo "Usage:"
echo "  docker compose up -d      # Start development environment"
echo "  docker compose logs -f    # Watch logs"
echo "  docker compose down       # Stop everything"
echo ""
echo "Debug in VS Code:"
echo "  1. Start container: docker compose up -d"
echo "  2. In VS Code: Run > Start Debugging > 'Attach to Docker'"
