# Sudoclaw QMS Dockerfile
# Multi-stage build for production deployment

# ============================================
# Stage 1: Frontend Build
# ============================================
FROM oven/bun:1-debian AS frontend-builder

WORKDIR /app

# Install build tools (some node modules may need them)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential && rm -rf /var/lib/apt/lists/*

# Copy package files for monorepo
COPY package.json bun.lock ./
COPY packages/core/package.json ./packages/core/
COPY packages/admin/package.json ./packages/admin/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies
RUN bun install --frozen-lockfile

# Copy admin frontend source files
COPY packages/admin/package.json ./packages/admin/
COPY packages/admin/src ./packages/admin/src
COPY packages/admin/tsconfig.json ./packages/admin/
COPY packages/admin/tsconfig.node.json ./packages/admin/
COPY packages/admin/vite.config.ts ./packages/admin/
COPY packages/admin/index.html ./packages/admin/
COPY packages/admin/public ./packages/admin/public
COPY packages/shared ./packages/shared

# Build admin frontend (vite outputs to packages/admin/dist)
RUN bun run --cwd packages/admin build

# ============================================
# Stage 2: Backend Dependencies
# ============================================
FROM oven/bun:1-debian AS backend-deps

WORKDIR /app

# Install build tools for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lock ./
COPY packages/core/package.json ./packages/core/
COPY packages/admin/package.json ./packages/admin/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN bun install --frozen-lockfile

# ============================================
# Stage 3: Production Build
# ============================================
FROM oven/bun:1-debian AS production

WORKDIR /app

# Install runtime tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && rm -rf /var/lib/apt/lists/*

# Copy backend dependencies from Stage 2
COPY --from=backend-deps /app/node_modules ./node_modules
COPY --from=backend-deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=backend-deps /app/packages/admin/node_modules ./packages/admin/node_modules
COPY package.json bun.lock ./

# Copy core backend source
COPY packages/core/src ./packages/core/src
COPY packages/core/tsconfig.json ./packages/core/
COPY packages/core/package.json ./packages/core/

# Copy shared package (no dependencies, no node_modules)
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/package.json ./packages/shared/

# Copy built frontend from Stage 1 (place at ./admin as expected by backend code)
COPY --from=frontend-builder /app/packages/admin/dist ./admin

# Create data directory with proper permissions
RUN mkdir -p /var/lib/sudoclaw-qms && chmod -R 777 /var/lib/sudoclaw-qms

# Expose port
EXPOSE 6100

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:6100/health || exit 1

# Set production environment
ENV NODE_ENV=production
ENV PORT=6100
ENV HOST=0.0.0.0
ENV SERVE_ADMIN=true

# Start the application
CMD ["bun", "run", "packages/core/src/index.ts"]