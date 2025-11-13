#!/bin/bash

# Setup Docker Group Script
# Creates docker group and adds user to it

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Setting Up Docker Group${NC}"
echo "================================"
echo ""

# Check if docker group exists
if getent group docker > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker group already exists${NC}"
else
    echo "Creating docker group..."
    sudo groupadd docker
    echo -e "${GREEN}✅ Docker group created${NC}"
fi

# Check if user is already in docker group
if groups | grep -q docker; then
    echo -e "${GREEN}✅ You are already in the docker group${NC}"
else
    echo "Adding user $USER to docker group..."
    sudo usermod -aG docker "$USER"
    echo -e "${GREEN}✅ User added to docker group${NC}"
fi

# Fix Docker socket permissions
echo ""
echo "Setting Docker socket permissions..."
if [ -S /var/run/docker.sock ]; then
    sudo chown root:docker /var/run/docker.sock
    sudo chmod 660 /var/run/docker.sock
    echo -e "${GREEN}✅ Docker socket permissions updated${NC}"
    ls -la /var/run/docker.sock
else
    echo -e "${YELLOW}⚠️  Docker socket not found at /var/run/docker.sock${NC}"
fi

echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "You need to activate the new group membership:"
echo ""
echo "  Option 1: Activate in current session"
echo "    newgrp docker"
echo ""
echo "  Option 2: Log out and log back in (most reliable)"
echo ""
echo "  Option 3: Start a new terminal session"
echo ""
echo "After activating, test with:"
echo "  docker ps"

