# Railway-friendly root Dockerfile that builds the Rust backend from the monorepo root.
# This avoids needing Railway to target the /backend subdirectory explicitly.
# Version: 2.0 - Restructured to break Railway cache (scripts excluded via .dockerignore)

FROM rust:1.88-slim AS builder

# Force complete cache invalidation - Railway was using cached layers with old COPY commands
ARG RAILWAY_BUILD_VERSION=3.0
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

# Verify migrations directory was copied in builder stage
RUN echo "=== Verifying migrations in builder stage ===" && \
    ls -la migrations/ || (echo "ERROR: migrations directory not found in builder!" && exit 1) && \
    echo "Migration files in builder:" && \
    ls -1 migrations/*.sql && \
    echo "=== Migrations verified in builder stage ==="

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
# Copy the entire migrations directory with all .sql files
COPY --from=builder /app/migrations /app/migrations

# Immediately verify migrations were copied (before any other operations)
RUN echo "=== IMMEDIATE VERIFICATION: Migrations after COPY ===" && \
    ls -la /app/ && \
    echo "---" && \
    if [ -d "/app/migrations" ]; then \
        echo "✓ Migrations directory exists" && \
        ls -la /app/migrations/ && \
        echo "Migration .sql files:" && \
        ls -1 /app/migrations/*.sql || echo "WARNING: No .sql files found!"; \
    else \
        echo "❌ ERROR: Migrations directory NOT found at /app/migrations!" && \
        echo "Contents of /app:" && \
        ls -la /app/ && \
        exit 1; \
    fi && \
    echo "=== Migrations verification complete ==="

# Verify binary exists and is executable
RUN ls -lh /usr/local/bin/clinic-management-backend && \
    file /usr/local/bin/clinic-management-backend && \
    /usr/local/bin/clinic-management-backend --version || echo "Binary exists but --version failed (this is OK if binary doesn't support it)"

# Additional verification - count migration files
RUN echo "=== Final migrations verification ===" && \
    MIGRATION_COUNT=$(ls -1 /app/migrations/*.sql 2>/dev/null | wc -l) && \
    echo "Migration files count: ${MIGRATION_COUNT}" && \
    if [ "${MIGRATION_COUNT}" -eq "0" ]; then \
        echo "❌ ERROR: No migration files found!" && \
        exit 1; \
    else \
        echo "✓ Found ${MIGRATION_COUNT} migration file(s)" && \
        ls -1 /app/migrations/*.sql; \
    fi

# Create entrypoint script inline (avoids COPY issues with Railway build context)
RUN cat > /usr/local/bin/entrypoint.sh << 'ENTRYPOINT_EOF'
#!/bin/bash
set -e

# Force output to stderr so it appears in Railway logs immediately
exec 1>&2

echo "=========================================="
echo "ENTRYPOINT: Starting Clinic Management Backend"
echo "=========================================="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Working directory: $(pwd)"
echo "Binary location: $(which clinic-management-backend || echo 'NOT IN PATH')"
echo "Binary exists at /usr/local/bin: $([ -f /usr/local/bin/clinic-management-backend ] && echo 'YES' || echo 'NO')"
echo "Binary exists at /app: $([ -f /app/clinic-management-backend ] && echo 'YES' || echo 'NO')"
echo "Environment variables:"
echo "  PORT: ${PORT:-NOT SET}"
echo "  DATABASE_URL: ${DATABASE_URL:+SET (${#DATABASE_URL} chars)}"
echo "  JWT_SECRET: ${JWT_SECRET:+SET}"
echo "=========================================="
echo "ENTRYPOINT: Checking migrations directory..."
echo "Current directory contents:"
ls -la /app/ || echo "  Could not list /app"
echo "---"
if [ -d "/app/migrations" ]; then
    echo "✓ Migrations directory EXISTS at /app/migrations"
    echo "Migration directory contents:"
    ls -la /app/migrations/ || echo "  Could not list migrations directory"
    echo "Migration .sql files:"
    ls -1 /app/migrations/*.sql 2>/dev/null | head -10 || echo "  ⚠️  No .sql files found in /app/migrations/"
    MIGRATION_COUNT=$(ls -1 /app/migrations/*.sql 2>/dev/null | wc -l)
    echo "Total migration files: ${MIGRATION_COUNT}"
else
    echo "❌ CRITICAL: Migrations directory NOT found at /app/migrations"
    echo "Contents of /app:"
    ls -la /app/ || echo "  Could not list /app"
    echo "❌ This will cause migration failures!"
fi
echo "=========================================="
echo "ENTRYPOINT: Executing binary..."
echo "=========================================="

# Execute the binary - try /usr/local/bin first, then /app
if [ -f "/usr/local/bin/clinic-management-backend" ]; then
    exec /usr/local/bin/clinic-management-backend
elif [ -f "/app/clinic-management-backend" ]; then
    exec /app/clinic-management-backend
else
    echo "❌ ERROR: Binary not found at /usr/local/bin/clinic-management-backend or /app/clinic-management-backend" >&2
    exit 1
fi
ENTRYPOINT_EOF
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


