#!/bin/bash
set -e

echo "=========================================="
echo "Starting Clinic Management Backend"
echo "=========================================="
echo "Timestamp: $(date)"
echo "Working directory: $(pwd)"
echo "Binary location: $(which clinic-management-backend || echo 'NOT IN PATH')"
echo "Binary exists: $([ -f /usr/local/bin/clinic-management-backend ] && echo 'YES' || echo 'NO')"
echo "Environment variables:"
echo "  PORT: ${PORT:-NOT SET}"
echo "  DATABASE_URL: ${DATABASE_URL:+SET (${#DATABASE_URL} chars)}"
echo "  JWT_SECRET: ${JWT_SECRET:+SET}"
echo "=========================================="
echo "Checking migrations directory..."
if [ -d "/app/migrations" ]; then
    echo "✓ Migrations directory exists at /app/migrations"
    echo "Migration files:"
    ls -1 /app/migrations/*.sql 2>/dev/null | head -5 || echo "  No .sql files found"
else
    echo "✗ Migrations directory NOT found at /app/migrations"
    echo "Contents of /app:"
    ls -la /app/ || echo "  Could not list /app"
fi
echo "=========================================="

# Execute the binary and capture output
exec /usr/local/bin/clinic-management-backend

