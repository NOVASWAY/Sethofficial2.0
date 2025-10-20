#!/bin/bash

# Browser Debug Setup Script for Clinic Management System
# This script starts the ConsoleSpy MCP servers for browser debugging

echo "🚀 Starting Browser Debug Tools for Clinic Management System..."

# Navigate to the consolespy directory
cd "$(dirname "$0")/consolespy"

# Check if the directory exists
if [ ! -d "consolespy" ]; then
    echo "❌ ConsoleSpy directory not found. Please run the setup first."
    exit 1
fi

# Start the servers
echo "📡 Starting ConsoleSpy MCP servers..."
echo "   - Console log server on port 3001"
echo "   - MCP server on port 8766"
echo ""
echo "🔧 To connect to Cursor:"
echo "   1. Open Cursor Settings > Features > MCP"
echo "   2. Add new MCP server:"
echo "      - Name: ConsoleSpy"
echo "      - Type: sse"
echo "      - URL: http://localhost:8766/sse"
echo ""
echo "🌐 Install the browser extension:"
echo "   - Load the extension from: $(pwd)/extension/consolespy-extension.zip"
echo "   - Or visit: https://chromewebstore.google.com/detail/consolespy/dakkehkpcaahfjembkhchoplffakkcie"
echo ""
echo "Press Ctrl+C to stop the servers"
echo ""

# Start the servers
./start-servers.sh
