#!/bin/bash
# =========================================
# Build Timmy Base Image
# Phase 01: Base Image
# Supports: AMD64 (Intel/AMD) and ARM64 (Apple Silicon)
# =========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="timmy-base"
IMAGE_TAG="${1:-latest}"
DOCKERFILE="docker/Dockerfile.base"
PLATFORM="${2:-}" # Optional: linux/amd64, linux/arm64, or linux/amd64,linux/arm64

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${YELLOW}Building Timmy Base Image${NC}"
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "Dockerfile: ${DOCKERFILE}"
if [ -n "$PLATFORM" ]; then
    echo "Platform: ${PLATFORM}"
fi
echo ""

cd "$PROJECT_ROOT"

# Build the image
echo -e "${YELLOW}Starting build...${NC}"

if [ -n "$PLATFORM" ]; then
    # Multi-platform build using buildx
    # Requires: docker buildx create --use (run once)
    echo "Using docker buildx for multi-platform build..."
    docker buildx build \
        -f "$DOCKERFILE" \
        -t "${IMAGE_NAME}:${IMAGE_TAG}" \
        --platform "$PLATFORM" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --load \
        .
else
    # Standard build (uses host architecture)
    docker build \
        -f "$DOCKERFILE" \
        -t "${IMAGE_NAME}:${IMAGE_TAG}" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        .
fi

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

# Verify success criteria
echo ""
echo -e "${YELLOW}Verifying success criteria...${NC}"

# Check Node.js version
NODE_VERSION=$(docker run --rm "${IMAGE_NAME}:${IMAGE_TAG}" node --version)
echo -e "Node.js version: ${GREEN}${NODE_VERSION}${NC}"

# Check Git is installed
GIT_VERSION=$(docker run --rm "${IMAGE_NAME}:${IMAGE_TAG}" git --version)
echo -e "Git version: ${GREEN}${GIT_VERSION}${NC}"

# Check non-root user can write to /app/data
echo -n "Non-root user write access: "
if docker run --rm "${IMAGE_NAME}:${IMAGE_TAG}" touch /app/data/test-write 2>/dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    exit 1
fi

# Check health check passes
echo -n "Health check: "
if docker run --rm "${IMAGE_NAME}:${IMAGE_TAG}" node -e "console.log('healthy')" >/dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}All checks passed!${NC}"
echo ""
echo "Usage:"
echo "  ./docker/scripts/build-base.sh [tag] [platform]"
echo ""
echo "Examples:"
echo "  ./docker/scripts/build-base.sh                    # Build for current arch"
echo "  ./docker/scripts/build-base.sh latest linux/arm64 # Build for Apple Silicon"
echo "  ./docker/scripts/build-base.sh latest linux/amd64 # Build for Intel/AMD"
echo ""
echo "To use this image as base for other Dockerfiles:"
echo "  FROM ${IMAGE_NAME}:${IMAGE_TAG}"
