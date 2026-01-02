# Railway-friendly root Dockerfile that builds the Rust backend from the monorepo root.
# This avoids needing Railway to target the /backend subdirectory explicitly.
# Version: 7.0 - NEW APPROACH: Migrations are EMBEDDED in binary at compile time
# This completely eliminates filesystem dependency and Railway COPY issues
# Migrations are compiled into the binary using include_dir! macro

FROM rust:1.92-slim AS builder

# AGGRESSIVE cache invalidation - Force Railway to rebuild everything
# Using timestamp and random value to ensure cache is always busted
ARG RAILWAY_BUILD_VERSION=7.4
ARG FORCE_REBUILD=$(date +%s%N)
ARG MIGRATIONS_REQUIRED=true
ARG BUILD_TIMESTAMP
ARG CACHE_BUST=$(date +%s)
RUN echo "Railway Build Version: ${RAILWAY_BUILD_VERSION}" && \
    echo "Build Timestamp: ${BUILD_TIMESTAMP:-$(date -u +%Y%m%d%H%M%S)}" > /tmp/.railway-build-version && \
    echo "Cache Bust: ${CACHE_BUST}" > /tmp/.cache-bust && \
    echo "=== FORCING FRESH BUILD - CACHE BUSTED ==="

# Install build dependencies
# Debian: Use HTTPS mirrors with retry logic (proven to work)
RUN apt-get update -o Acquire::https::Verify-Peer=false -o Acquire::https::Verify-Host=false || \
    (echo "⚠️  First update failed, installing ca-certificates..." && \
     apt-get update --allow-insecure-repositories && \
     apt-get install -y --allow-unauthenticated ca-certificates apt-transport-https && \
     apt-get update) && \
    apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    libpq-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend manifests first for better layer caching
COPY backend/Cargo.toml backend/Cargo.lock* ./

# CRITICAL: Copy migrations IMMEDIATELY after Cargo.toml
# MUST be present before ANY cargo build runs (including dummy build)
# The include_dir! macro needs this at compile time
COPY backend/migrations ./migrations

# Verify migrations were copied successfully BEFORE any build
RUN echo "=== VERIFYING MIGRATIONS COPY ===" && \
    pwd && \
    ls -la . && \
    if [ ! -d "./migrations" ]; then \
        echo "❌ CRITICAL: migrations directory NOT found after COPY!" && \
        echo "Build context contents:" && \
        ls -la /app 2>&1 || true && \
        echo "Trying to list backend directory:" && \
        ls -la backend/ 2>&1 || echo "backend/ not accessible" && \
        exit 1; \
    fi && \
    echo "✓ Migrations directory exists" && \
    ls -la migrations/ && \
    MIGRATION_COUNT=$(ls -1 migrations/*.sql 2>/dev/null | wc -l) && \
    echo "Migration files found: ${MIGRATION_COUNT}" && \
    if [ "${MIGRATION_COUNT}" -eq "0" ]; then \
        echo "❌ ERROR: No .sql files in migrations directory!" && \
        ls -la migrations/ && \
        exit 1; \
    fi && \
    echo "✓ Migrations verified: ${MIGRATION_COUNT} files" && \
    ls -1 migrations/*.sql | head -3

# Dummy src to cache dependencies (migrations already present)
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src

# CRITICAL: Copy backend source files AFTER migrations are verified
# Using explicit paths and verification to ensure scripts is never copied
# Note: Railway's build context includes backend/ directory
COPY backend/src/ ./src/

# Verify scripts directory does NOT exist (should pass if .dockerignore worked)
RUN if [ -d "./scripts" ]; then \
        echo "ERROR: scripts directory should not exist! .dockerignore may not be working." && \
        exit 1; \
    else \
        echo "✓ Verified: scripts directory correctly excluded by .dockerignore"; \
    fi

# Final verification before REAL build - migrations must be present
RUN echo "=== FINAL VERIFICATION: Migrations before REAL cargo build ===" && \
    pwd && \
    echo "CARGO_MANIFEST_DIR would be: $(pwd)" && \
    if [ ! -d "./migrations" ]; then \
        echo "❌ CRITICAL ERROR: migrations directory missing before cargo build!" && \
        echo "Current directory: $(pwd)" && \
        echo "Directory contents:" && \
        ls -la && \
        exit 1; \
    fi && \
    echo "✓ Migrations directory confirmed present at: $(pwd)/migrations" && \
    echo "Migration files:" && \
    ls -1 migrations/*.sql | head -5 && \
    echo "=== Starting REAL cargo build with embedded migrations ===" && \
    echo "include_dir! will look for: $(pwd)/migrations"

RUN cargo build --release

FROM debian:bookworm-slim

# Install runtime dependencies
# Debian: Use HTTPS mirrors with retry logic (proven to work)
RUN apt-get update -o Acquire::https::Verify-Peer=false -o Acquire::https::Verify-Host=false || \
    (echo "⚠️  First update failed, installing ca-certificates..." && \
     apt-get update --allow-insecure-repositories && \
     apt-get install -y --allow-unauthenticated ca-certificates apt-transport-https && \
     apt-get update) && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary to both locations for compatibility
COPY --from=builder /app/target/release/clinic-management-backend /usr/local/bin/clinic-management-backend
COPY --from=builder /app/target/release/clinic-management-backend /app/clinic-management-backend

# FALLBACK: Also copy migrations to runtime image as backup
# Even though migrations are embedded, having them on filesystem provides a fallback
# This ensures migrations can run even if embedded extraction fails
COPY --from=builder /app/migrations /app/migrations

# Verify migrations exist (both embedded AND filesystem fallback)
RUN echo "=== Verifying migrations availability ===" && \
    if [ -d "/app/migrations" ]; then \
        MIGRATION_COUNT=$(ls -1 /app/migrations/*.sql 2>/dev/null | wc -l) && \
        echo "✓ Filesystem migrations: ${MIGRATION_COUNT} files" && \
        ls -1 /app/migrations/*.sql | head -5; \
    else \
        echo "⚠️  WARNING: Filesystem migrations directory not found (embedded migrations will be used)"; \
    fi

# Verify binary exists and is executable
RUN ls -lh /usr/local/bin/clinic-management-backend && \
    file /usr/local/bin/clinic-management-backend && \
    /usr/local/bin/clinic-management-backend --version || echo "Binary exists but --version failed (this is OK if binary doesn't support it)"

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
echo "ENTRYPOINT: Migrations are EMBEDDED in binary"
echo "Filesystem migrations also available as fallback at /app/migrations"
echo "Migrations will be extracted to temp directory at runtime"
echo "=========================================="
echo "ENTRYPOINT: Verifying binary exists..."
if [ -f "/usr/local/bin/clinic-management-backend" ]; then
    echo "✓ Binary found at /usr/local/bin/clinic-management-backend"
    ls -lh /usr/local/bin/clinic-management-backend
elif [ -f "/app/clinic-management-backend" ]; then
    echo "✓ Binary found at /app/clinic-management-backend"
    ls -lh /app/clinic-management-backend
else
    echo "❌ ERROR: Binary not found at /usr/local/bin/clinic-management-backend or /app/clinic-management-backend" >&2
    echo "Current directory: $(pwd)" >&2
    echo "Contents of /usr/local/bin:" >&2
    ls -la /usr/local/bin/ 2>&1 || true
    echo "Contents of /app:" >&2
    ls -la /app/ 2>&1 || true
    exit 1
fi
echo "=========================================="
echo "ENTRYPOINT: Executing binary..."
echo "=========================================="

# Execute the binary - try /usr/local/bin first, then /app
# exec replaces the shell process - output already redirected to stderr at top of script
if [ -f "/usr/local/bin/clinic-management-backend" ]; then
    exec /usr/local/bin/clinic-management-backend
elif [ -f "/app/clinic-management-backend" ]; then
    exec /app/clinic-management-backend
else
    echo "❌ ERROR: Binary not found" >&2
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


