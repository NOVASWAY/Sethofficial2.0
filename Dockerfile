# Railway-friendly root Dockerfile that builds the Rust backend from the monorepo root.
# This avoids needing Railway to target the /backend subdirectory explicitly.

FROM rust:1.88-slim AS builder

# Cache busting: Force rebuild when Dockerfile changes
ARG CACHE_BUST=1

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

# CRITICAL: Force cache invalidation with unique build ID
# This breaks Railway's aggressive caching of COPY layers
ARG BUILD_ID
RUN echo "Build ID: ${BUILD_ID:-$(date +%s)}" > /tmp/build-id.txt && cat /tmp/build-id.txt

# Copy backend source files in a single operation to break cache
# .dockerignore ensures backend/scripts is excluded from build context
# Using trailing slashes and explicit directory structure
COPY backend/src ./src
COPY backend/migrations ./migrations
# Explicitly verify scripts is NOT copied (should fail if scripts exists in context)
RUN test ! -d ./scripts || (echo "ERROR: scripts directory should not exist!" && exit 1)

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
COPY --from=builder /app/migrations ./migrations

# Verify migrations are present in runtime stage
RUN ls -la migrations/ | head -5 || (echo "ERROR: migrations directory not found in runtime stage!" && exit 1)

# Railway injects PORT; backend should read PORT env var (fallbacks handled in app)
# EXPOSE is informational - Railway uses PORT env var dynamically
EXPOSE 8080

# Healthcheck: Railway-friendly format
# Uses PORT env var that Railway provides, with fallback to 8080
# Start period gives time for migrations and DB connection
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

CMD ["clinic-management-backend"]


