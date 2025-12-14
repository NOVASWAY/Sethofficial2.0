#!/bin/bash
# Fix Docker permissions by adding user to docker group

echo "🔧 Fixing Docker permissions..."
echo ""
echo "Adding user to docker group..."
echo "You'll need to run this with sudo:"
echo ""
echo "  sudo usermod -aG docker $USER"
echo ""
echo "After running that command, you need to:"
echo "  1. Log out and log back in, OR"
echo "  2. Run: newgrp docker"
echo ""
echo "Then you can use docker commands without sudo."

