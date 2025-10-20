#!/usr/bin/env node

// Real-time console log monitoring script
const fetch = require('node-fetch');

let lastLogCount = 0;
let lastSessionCount = 0;

async function checkConsoleLogs() {
    try {
        const response = await fetch('http://localhost:3333/mcp');
        const data = await response.json();
        
        if (response.ok) {
            const content = data.content;
            
            // Count sessions and logs
            const sessionMatches = content.match(/Session \d+:/g);
            const logMatches = content.match(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/g);
            
            const currentSessionCount = sessionMatches ? sessionMatches.length : 0;
            const currentLogCount = logMatches ? logMatches.length : 0;
            
            // Check for new logs
            if (currentLogCount > lastLogCount || currentSessionCount > lastSessionCount) {
                console.log(`\n🆕 NEW CONSOLE LOGS DETECTED!`);
                console.log(`📊 Sessions: ${currentSessionCount} (was ${lastSessionCount})`);
                console.log(`📝 Total Logs: ${currentLogCount} (was ${lastLogCount})`);
                console.log(`⏰ ${new Date().toLocaleTimeString()}`);
                console.log(`📄 Content: ${content.substring(0, 200)}...`);
                console.log(`\n🔍 Full logs available at: http://localhost:3333/view-logs\n`);
                
                lastLogCount = currentLogCount;
                lastSessionCount = currentSessionCount;
            } else {
                // Show status every 30 seconds
                if (Date.now() % 30000 < 1000) {
                    console.log(`👀 Monitoring... Sessions: ${currentSessionCount}, Logs: ${currentLogCount} - ${new Date().toLocaleTimeString()}`);
                }
            }
        } else {
            console.log(`❌ MCP server error: ${response.status}`);
        }
    } catch (error) {
        console.log(`❌ Error checking console logs: ${error.message}`);
    }
}

// Start monitoring
console.log('🚀 Starting real-time console log monitoring...');
console.log('📡 Monitoring MCP server at http://localhost:3333/mcp');
console.log('🌐 View logs at http://localhost:3333/view-logs');
console.log('⏹️  Press Ctrl+C to stop\n');

// Check every 2 seconds
setInterval(checkConsoleLogs, 2000);

// Initial check
checkConsoleLogs();
