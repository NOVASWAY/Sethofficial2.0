#!/bin/bash

# Production Deployment Script
# Usage: ./scripts/deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
COMPOSE_FILE="docker-compose.prod.yml"

echo "🚀 Starting deployment to $ENVIRONMENT..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "❌ backend/.env file not found. Please create it from env.production"
    exit 1
fi

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Build images
echo "🔨 Building Docker images..."
docker-compose -f $COMPOSE_FILE build --no-cache backend

# Run database migrations
echo "🗄️ Running database migrations..."
docker-compose -f $COMPOSE_FILE run --rm backend \
    sqlx migrate run || echo "⚠️ Migration failed or already up to date"

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f $COMPOSE_FILE down

# Start services
echo "🚀 Starting services..."
docker-compose -f $COMPOSE_FILE up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Health check
echo "🏥 Running health checks..."
MAX_RETRIES=30
RETRY=0

while [ $RETRY -lt $MAX_RETRIES ]; do
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo "✅ Health check passed!"
        break
    fi
    RETRY=$((RETRY + 1))
    echo "⏳ Waiting for health check... ($RETRY/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    echo "❌ Health check failed after $MAX_RETRIES attempts"
    echo "📋 Showing logs..."
    docker-compose -f $COMPOSE_FILE logs backend
    exit 1
fi

# Show status
echo "📊 Service status:"
docker-compose -f $COMPOSE_FILE ps

echo "✅ Deployment complete!"
echo "📋 View logs with: docker-compose -f $COMPOSE_FILE logs -f"
