#!/bin/bash
# Wrapper script to use docker compose v2 or fix docker-compose v1

# Try docker compose v2 first (if plugin is installed)
if docker compose version >/dev/null 2>&1; then
    exec docker compose "$@"
# Otherwise, try to fix docker-compose v1 by installing distutils
elif command -v docker-compose >/dev/null 2>&1; then
    # Check if distutils is available
    python3 -c "import distutils" 2>/dev/null || {
        echo "Error: docker-compose requires python3-distutils"
        echo "Please run: sudo apt-get install -y python3-distutils"
        echo "Or install docker-compose-plugin: sudo apt-get install -y docker-compose-plugin"
        exit 1
    }
    exec docker-compose "$@"
else
    echo "Error: Neither 'docker compose' nor 'docker-compose' is available"
    exit 1
fi

