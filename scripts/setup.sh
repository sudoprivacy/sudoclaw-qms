#!/bin/bash
# Sudoclaw QMS Development Setup Script

set -e

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

# Check Bun is installed
if ! command -v bun &> /dev/null; then
    log_info "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    source ~/.bashrc
fi

log_info "Bun version: $(bun --version)"

# Install dependencies
log_info "Installing dependencies..."
bun install

# Create data directory
log_info "Creating data directory..."
mkdir -p packages/core/data

# Create environment file if not exists
if [ ! -f packages/core/.env ]; then
    log_info "Creating development environment file..."
    cp packages/core/.env.example packages/core/.env
fi

log_info "Setup completed!"
log_info "To start the server: bun run packages/core/src/index.ts"
log_info "Default admin credentials: admin / admin123"