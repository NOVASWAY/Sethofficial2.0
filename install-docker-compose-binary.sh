#!/bin/bash
# Alternative: Download Docker Compose V2 binary directly

set -e

echo "🔧 Installing Docker Compose V2 (Binary Method)..."

# Get latest version
COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)

echo "Downloading Docker Compose ${COMPOSE_VERSION}..."

# Create directory
sudo mkdir -p /usr/local/lib/docker/cli-plugins

# Download binary
sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose

# Make executable
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

echo ""
echo "✅ Docker Compose V2 installed!"
echo ""
echo "Verify installation:"
echo "  docker compose version"
echo ""
echo "Now you can use:"
echo "  docker compose up -d --build"

