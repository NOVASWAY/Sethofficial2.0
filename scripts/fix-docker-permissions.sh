#!/bin/bash

# Fix Docker Permissions Script
# Adds current user to docker group

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Fixing Docker Permissions${NC}"
echo "================================"
echo ""

# Check if docker group exists, create if not
if ! getent group docker > /dev/null 2>&1; then
    echo "Docker group doesn't exist. Creating it..."
    sudo groupadd docker
fi

# Check if already in docker group
if groups | grep -q docker; then
    echo -e "${GREEN}✅ You are already in the docker group!${NC}"
    echo ""
    echo "If you still have permission issues, try:"
    echo "  newgrp docker"
    echo "  Or log out and log back in"
    exit 0
fi

echo "This script will:"
echo "  1. Create docker group (if needed)"
echo "  2. Add your user to the 'docker' group"
echo "  3. Set proper permissions on Docker socket"
echo ""
echo "You will need to enter your sudo password."
echo ""
read -p "Continue? (yes/no): " proceed

if [ "$proceed" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Adding user $USER to docker group..."
sudo usermod -aG docker "$USER"

# Fix Docker socket permissions
echo ""
echo "Setting Docker socket permissions..."
if [ -S /var/run/docker.sock ]; then
    sudo chown root:docker /var/run/docker.sock 2>/dev/null || true
    sudo chmod 660 /var/run/docker.sock 2>/dev/null || true
    echo "  Docker socket permissions updated"
else
    echo "  Warning: Docker socket not found at /var/run/docker.sock"
    echo "  This might be a snap installation - permissions may be handled differently"
fi

echo ""
echo -e "${GREEN}✅ User added to docker group!${NC}"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "You need to either:"
echo "  1. Run: newgrp docker"
echo "  2. Or log out and log back in"
echo ""
echo "After that, you can run:"
echo "  ./scripts/docker-start-safe.sh"

