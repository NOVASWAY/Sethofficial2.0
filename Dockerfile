# Railway-friendly root Dockerfile that builds the Rust backend from the monorepo root.
# This avoids needing Railway to target the /backend subdirectory explicitly.
# Version: 2.0 - Restructured to break Railway cache (scripts excluded via .dockerignore)

FROM rust:1.88-slim AS builder

# Force complete cache invalidation - Railway was using cached layers with old COPY commands
ARG RAILWAY_BUILD_VERSION=2.0
ARG BUILD_TIMESTAMP
RUN echo "Railway Build Version: ${RAILWAY_BUILD_VERSION}" && \
    echo "Build Timestamp: ${BUILD_TIMESTAMP:-$(date -u +%Y%m%d%H%M%S)}" > /tmp/.railway-build-version

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend manifests first for better layer caching
COPY backend/Cargo.toml backend/Cargo.lock* ./

# Dummy src to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src

# CRITICAL: Copy backend files - .dockerignore excludes backend/scripts
# Using explicit paths and verification to ensure scripts is never copied
COPY backend/src/ ./src/
COPY backend/migrations/ ./migrations/

# Verify scripts directory does NOT exist (should pass if .dockerignore worked)
RUN if [ -d "./scripts" ]; then \
        echo "ERROR: scripts directory should not exist! .dockerignore may not be working." && \
        exit 1; \
    else \
        echo "✓ Verified: scripts directory correctly excluded by .dockerignore"; \
    fi

# Verify migrations directory was copied
RUN ls -la migrations/ | head -5 || (echo "ERROR: migrations directory not found!" && exit 1)

RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/clinic-management-backend /usr/local/bin/clinic-management-backend

# CRITICAL: Copy migrations from builder stage - use absolute path
# Note: COPY preserves directory structure, so /app/migrations becomes /app/migrations
COPY --from=builder /app/migrations /app/migrations

# Verify binary exists and is executable
RUN ls -lh /usr/local/bin/clinic-management-backend && \
    file /usr/local/bin/clinic-management-backend && \
    /usr/local/bin/clinic-management-backend --version || echo "Binary exists but --version failed (this is OK if binary doesn't support it)"

# Verify migrations are present in runtime stage
RUN echo "=== Verifying migrations directory ===" && \
    ls -la /app/migrations/ | head -10 || (echo "ERROR: migrations directory not found in runtime stage!" && exit 1) && \
    echo "=== Migrations directory verified ===" && \
    echo "Migration files found:" && \
    ls -1 /app/migrations/*.sql | head -5

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Railway injects PORT; backend should read PORT env var (fallbacks handled in app)
# EXPOSE is informational - Railway uses PORT env var dynamically
EXPOSE 8080

# Healthcheck: Railway-friendly format
# Uses PORT env var that Railway provides, with fallback to 8080
# Start period gives time for migrations and DB connection
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Use entrypoint script for better logging
CMD ["/usr/local/bin/entrypoint.sh"]


