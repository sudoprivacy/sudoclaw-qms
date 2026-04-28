#!/bin/bash
# Sudoclaw QMS Build Script

set -e

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_info "Building Sudoclaw QMS..."

# Clean previous build
log_info "Cleaning previous build..."
rm -rf dist

# Build core package
log_info "Building core package..."
bun build packages/core/src/index.ts \
    --outdir dist \
    --target bun \
    --minify \
    --sourcemap

# Copy package.json for production
log_info "Copying production files..."
cp packages/core/package.json dist/

# Copy environment example
cp packages/core/.env.production.example dist/.env.example 2>/dev/null || true

log_info "Build completed!"
log_info "Output: dist/"
ls -la dist/