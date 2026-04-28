# Sudoclaw QMS Dockerfile
# Multi-stage build for production deployment

# ============================================
# Build stage
# ============================================
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lockb ./
COPY packages/core/package.json ./packages/core/
COPY packages/admin/package.json ./packages/admin/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY packages/core/src ./packages/core/src
COPY packages/core/tsconfig.json ./packages/core/
COPY packages/admin/src ./packages/admin/src
COPY packages/admin/tsconfig.json ./packages/admin/
COPY packages/admin/vite.config.ts ./packages/admin/
COPY packages/admin/index.html ./packages/admin/
COPY packages/admin/public ./packages/admin/public
COPY packages/shared/src ./packages/shared/src

# Build admin frontend
RUN bun run --cwd packages/admin build

# Build core backend
RUN bun build packages/core/src/index.ts --outdir ./packages/core/dist --target bun

# ============================================
# Production stage
# ============================================
FROM oven/bun:1-slim AS production

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create data directory
RUN mkdir -p /var/lib/sudoclaw-qms

# Copy built files
COPY --from=builder /app/packages/core/dist ./dist
COPY --from=builder /app/packages/admin/dist ./admin
COPY --from=builder /app/packages/core/package.json ./package.json

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=6078
ENV HOST=0.0.0.0
ENV SERVE_ADMIN=true

# Expose port
EXPOSE 6078

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:6078/health || exit 1

# Run
CMD ["bun", "run", "dist/index.js"]