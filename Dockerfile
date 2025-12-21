# Railway-friendly root Dockerfile that builds the Rust backend from the monorepo root.
# This avoids needing Railway to target the /backend subdirectory explicitly.

FROM rust:1.88-slim as builder

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

# Cache busting: Create a marker file to force rebuild of COPY layers
# This ensures Railway doesn't use cached layers with old COPY commands
RUN echo "build-$(date +%s)" > /tmp/.cache-bust && cat /tmp/.cache-bust

# Copy actual backend source
# IMPORTANT: Only copy src and migrations - scripts directory is intentionally excluded
# This prevents Railway build failures when scripts directory is not in build context
COPY backend/src ./src
COPY backend/migrations ./migrations

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


