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

