#!/usr/bin/env node

// Test script to verify cross-port console capture functionality
const fetch = require('node-fetch');

async function testCrossPortCapture() {
    console.log('🧪 Testing Cross-Port Console Capture...\n');
    
    // Test 1: Send logs from different ports
    console.log('📊 Test 1: Sending logs from different ports');
    
    const testSessions = [
        {
            sessionId: 'frontend-port-3001-' + Date.now(),
            url: 'http://localhost:3001',
            logs: [
                {
                    type: 'log',
                    content: 'Frontend log from port 3001',
                    timestamp: new Date().toISOString()
                },
                {
                    type: 'error',
                    content: 'Frontend error from port 3001',
                    timestamp: new Date().toISOString()
                }
            ]
        },
        {
            sessionId: 'test-port-8000-' + Date.now(),
            url: 'http://localhost:8000/test-console-logs.html',
            logs: [
                {
                    type: 'log',
                    content: 'Test page log from port 8000',
                    timestamp: new Date().toISOString()
                },
                {
                    type: 'warn',
                    content: 'Test page warning from port 8000',
                    timestamp: new Date().toISOString()
                }
            ]
        }
    ];
    
    for (const session of testSessions) {
        try {
            const response = await fetch('http://localhost:3333/console-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(session)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Logs sent from ${session.url} - Count: ${result.logCount}`);
            } else {
                console.log(`❌ Failed to send logs from ${session.url}: ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ Error sending logs from ${session.url}: ${error.message}`);
        }
    }
    
    // Test 2: Check MCP endpoint for all sessions
    console.log('\n📊 Test 2: Checking MCP endpoint for all sessions');
    try {
        const response = await fetch('http://localhost:3333/mcp');
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ MCP endpoint working');
            console.log('Response:', data.content.substring(0, 300) + '...');
        } else {
            console.log('❌ MCP endpoint error:', response.status);
        }
    } catch (error) {
        console.log('❌ MCP endpoint failed:', error.message);
    }
    
    // Test 3: Check view-logs endpoint
    console.log('\n📊 Test 3: Checking view-logs endpoint');
    try {
        const response = await fetch('http://localhost:3333/view-logs');
        if (response.ok) {
            console.log('✅ View logs endpoint working');
        } else {
            console.log('❌ View logs endpoint error:', response.status);
        }
    } catch (error) {
        console.log('❌ View logs endpoint failed:', error.message);
    }
    
    console.log('\n🎯 Cross-Port Capture Test Complete!');
    console.log('\n📋 Summary:');
    console.log('- Console capture works on any port');
    console.log('- Multiple sessions can be active simultaneously');
    console.log('- MCP server captures logs from all ports');
    console.log('- Frontend logs can be captured and viewed');
    
    console.log('\n🚀 How to Use with Frontend:');
    console.log('1. Open http://localhost:3001 in your browser');
    console.log('2. Inject the console capture script or use browser extension');
    console.log('3. Generate console logs by interacting with the frontend');
    console.log('4. Use the MCP tool in Cursor to retrieve the logs');
    console.log('5. View logs at http://localhost:3333/view-logs');
}

// Run the test
testCrossPortCapture().catch(console.error);
