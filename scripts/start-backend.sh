#!/bin/bash

# Seth Medical Clinic Backend Startup Script

echo "🏥 Starting Seth Medical Clinic Backend..."

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp backend/env.example backend/.env
    echo "📝 Please edit backend/.env with your configuration before running again."
    exit 1
fi

# Load environment variables
export $(cat backend/.env | grep -v '^#' | xargs)

# Check if PostgreSQL is running
echo "🔍 Checking PostgreSQL connection..."
if ! pg_isready -h localhost -p 5432 -U $POSTGRES_USER 2>/dev/null; then
    echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
    echo "💡 You can use Docker: docker run -d --name postgres -e POSTGRES_DB=clinic_management -e POSTGRES_USER=clinic_user -e POSTGRES_PASSWORD=clinic_password -p 5432:5432 postgres:15-alpine"
    exit 1
fi

# Check if Redis is running
echo "🔍 Checking Redis connection..."
if ! redis-cli ping 2>/dev/null | grep -q PONG; then
    echo "❌ Redis is not running. Please start Redis first."
    echo "💡 You can use Docker: docker run -d --name redis -p 6379:6379 redis:7-alpine"
    exit 1
fi

# Navigate to backend directory
cd backend

# Install dependencies if needed
if [ ! -d "target" ]; then
    echo "📦 Building Rust dependencies..."
    cargo build
fi

# Run the backend
echo "🚀 Starting backend server on $HOST:$PORT..."
cargo run
