#!/bin/bash
# Start the clinic management system using Docker Compose

echo "🏥 Starting Clinic Management System..."
echo ""

# Check if docker compose is available
if docker compose version >/dev/null 2>&1; then
    echo "✅ Using Docker Compose V2"
    docker compose up -d --build
elif command -v docker-compose >/dev/null 2>&1; then
    echo "⚠️  Using docker-compose v1 (may have issues with Python 3.12)"
    docker-compose up -d --build
else
    echo "❌ Error: Neither 'docker compose' nor 'docker-compose' is available"
    echo ""
    echo "Please install Docker Compose V2 plugin:"
    echo "  sudo apt-get install -y docker-compose-plugin"
    exit 1
fi

echo ""
echo "✅ System starting! Check status with:"
echo "   docker compose ps"
echo ""
echo "View logs with:"
echo "   docker compose logs -f"
