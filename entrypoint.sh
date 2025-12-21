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

# Execute the binary and capture output
exec /usr/local/bin/clinic-management-backend

