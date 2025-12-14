#!/bin/bash
# Start the Clinic Management System
# This script handles Docker permissions and starts all services

set -e

echo "🏥 Starting Clinic Management System..."
echo ""

# Check if user is in docker group
if ! groups | grep -q docker; then
    echo "⚠️  You're not in the docker group."
    echo ""
    echo "To fix this, run:"
    echo "  sudo usermod -aG docker $USER"
    echo ""
    echo "Then either:"
    echo "  1. Log out and log back in, OR"
    echo "  2. Run: newgrp docker"
    echo ""
    echo "After that, run this script again."
    exit 1
fi

# Check if docker compose is available
if ! docker compose version >/dev/null 2>&1; then
    echo "❌ Docker Compose V2 is not installed"
    echo "Please run: ./install-docker-compose-binary.sh"
    exit 1
fi

echo "✅ Docker Compose V2: $(docker compose version | head -1)"
echo "✅ User is in docker group"
echo ""
echo "🚀 Starting services..."
echo ""

# Start the system
docker compose up -d --build

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check status
echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "✅ System is starting!"
echo ""
echo "View logs: docker compose logs -f"
echo "Check health: curl http://localhost:8080/health"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8080"

