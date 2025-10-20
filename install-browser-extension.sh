#!/bin/bash

# Browser Extension Installer for ConsoleSpy
echo "🌐 Installing ConsoleSpy Browser Extension..."

# Check if Chrome is installed
if command -v google-chrome &> /dev/null; then
    CHROME_PATH=$(which google-chrome)
    echo "✅ Chrome found at: $CHROME_PATH"
elif command -v chromium-browser &> /dev/null; then
    CHROME_PATH=$(which chromium-browser)
    echo "✅ Chromium found at: $CHROME_PATH"
else
    echo "❌ Chrome/Chromium not found. Please install Chrome first."
    exit 1
fi

# Extension directory
EXTENSION_DIR="/home/njau-wangari/sethmed/clinic-management/consolespy/extension"

if [ ! -d "$EXTENSION_DIR" ]; then
    echo "❌ Extension directory not found: $EXTENSION_DIR"
    exit 1
fi

echo "📦 Extension files found in: $EXTENSION_DIR"
echo ""
echo "🔧 Manual Installation Steps:"
echo "1. Open Chrome and go to: chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. Click 'Load unpacked'"
echo "4. Navigate to: $EXTENSION_DIR"
echo "5. Select the extension folder"
echo ""
echo "🌐 Or install from Chrome Web Store:"
echo "   https://chromewebstore.google.com/detail/consolespy/dakkehkpcaahfjembkhchoplffakkcie"
echo ""
echo "✅ After installation:"
echo "   - Click the ConsoleSpy icon in your browser toolbar"
echo "   - Navigate to: http://localhost:3006 (your clinic management app)"
echo "   - All console logs will be captured for Cursor debugging!"
