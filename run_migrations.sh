#!/bin/bash
# Manual migration script for Railway
# This can be run via: railway run --service seth-clinic-backend bash run_migrations.sh

set -e

echo "=========================================="
echo "Running Database Migrations Manually"
echo "=========================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set"
    exit 1
fi

echo "✅ DATABASE_URL is set (${#DATABASE_URL} characters)"

# Check if migrations directory exists
MIGRATIONS_DIR="/app/migrations"
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "⚠️  /app/migrations not found, trying current directory..."
    MIGRATIONS_DIR="./migrations"
    if [ ! -d "$MIGRATIONS_DIR" ]; then
        echo "❌ ERROR: Migrations directory not found"
        echo "Current directory: $(pwd)"
        echo "Contents:"
        ls -la
        exit 1
    fi
fi

echo "✅ Migrations directory found: $MIGRATIONS_DIR"
echo "Migration files:"
ls -1 "$MIGRATIONS_DIR"/*.sql | head -10

# Check if sqlx-cli is available
if ! command -v sqlx &> /dev/null; then
    echo "⚠️  sqlx-cli not found, installing..."
    cargo install sqlx-cli --features postgres --no-default-features || {
        echo "❌ Failed to install sqlx-cli"
        exit 1
    }
fi

echo "✅ sqlx-cli is available"
echo "=========================================="
echo "Running migrations..."
echo "=========================================="

# Run migrations
sqlx migrate run --database-url "$DATABASE_URL" --source "$MIGRATIONS_DIR" || {
    echo "❌ Migration failed"
    exit 1
}

echo "=========================================="
echo "✅ Migrations completed successfully!"
echo "=========================================="

# Verify tables were created
echo "Verifying tables..."
sqlx query --database-url "$DATABASE_URL" "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" || echo "Could not verify tables"

