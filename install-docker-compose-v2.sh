#!/bin/bash
# Install Docker Compose V2 Plugin

set -e

echo "🔧 Installing Docker Compose V2 Plugin..."

# Method 1: Add Docker's official repository (Recommended)
echo ""
echo "Method 1: Adding Docker's official repository..."

# Install prerequisites
sudo apt-get update
sudo apt-get install -y ca-certificates curl

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update and install
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

echo ""
echo "✅ Docker Compose V2 plugin installed!"
echo ""
echo "Verify installation:"
echo "  docker compose version"
echo ""
echo "Now you can use:"
echo "  docker compose up -d --build"

