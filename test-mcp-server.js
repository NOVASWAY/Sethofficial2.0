#!/usr/bin/env node

// Test script for the Console Spy MCP server
const fetch = require('node-fetch');

async function testMCPServer() {
    console.log('🧪 Testing Console Spy MCP Server...\n');
    
    // Test 1: Check if console server is running
    console.log('📊 Test 1: Console Server Status');
    try {
        const response = await fetch('http://localhost:3333/');
        if (response.ok) {
            console.log('✅ Console server is running on port 3333');
        } else {
            console.log('❌ Console server returned error:', response.status);
        }
    } catch (error) {
        console.log('❌ Console server connection failed:', error.message);
        return;
    }
    
    // Test 2: Check MCP endpoint
    console.log('\n📊 Test 2: MCP Endpoint');
    try {
        const response = await fetch('http://localhost:3333/mcp');
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ MCP endpoint is working');
            console.log('Response:', data.content.substring(0, 100) + '...');
        } else {
            console.log('❌ MCP endpoint error:', response.status);
        }
    } catch (error) {
        console.log('❌ MCP endpoint failed:', error.message);
    }
    
    // Test 3: Check view-logs endpoint
    console.log('\n📊 Test 3: View Logs Endpoint');
    try {
        const response = await fetch('http://localhost:3333/view-logs');
        if (response.ok) {
            console.log('✅ View logs endpoint is working');
        } else {
            console.log('❌ View logs endpoint error:', response.status);
        }
    } catch (error) {
        console.log('❌ View logs endpoint failed:', error.message);
    }
    
    // Test 4: Send test logs
    console.log('\n📊 Test 4: Sending Test Logs');
    try {
        const testLogs = {
            logs: [
                {
                    type: 'log',
                    content: 'Test log message from MCP test script',
                    timestamp: new Date().toISOString()
                },
                {
                    type: 'error',
                    content: 'Test error message from MCP test script',
                    timestamp: new Date().toISOString()
                },
                {
                    type: 'warn',
                    content: 'Test warning message from MCP test script',
                    timestamp: new Date().toISOString()
                }
            ],
            sessionId: 'test-session-' + Date.now(),
            url: 'http://localhost:8000/test-console-logs.html'
        };
        
        const response = await fetch('http://localhost:3333/console-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testLogs)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Test logs sent successfully');
            console.log('Log count:', result.logCount);
        } else {
            console.log('❌ Failed to send test logs:', response.status);
        }
    } catch (error) {
        console.log('❌ Error sending test logs:', error.message);
    }
    
    // Test 5: Check MCP endpoint again
    console.log('\n📊 Test 5: MCP Endpoint After Sending Logs');
    try {
        const response = await fetch('http://localhost:3333/mcp');
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ MCP endpoint is working');
            console.log('Response:', data.content.substring(0, 200) + '...');
        } else {
            console.log('❌ MCP endpoint error:', response.status);
        }
    } catch (error) {
        console.log('❌ MCP endpoint failed:', error.message);
    }
    
    console.log('\n🎯 MCP Server Test Complete!');
    console.log('\n📋 Summary:');
    console.log('- Console server should be running on port 3333');
    console.log('- MCP endpoint should be accessible at /mcp');
    console.log('- Test logs should be captured and retrievable');
    console.log('- The MCP server should now show tools and resources');
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Open http://localhost:8000/test-console-logs.html in your browser');
    console.log('2. Generate some console logs');
    console.log('3. Check the MCP server in Cursor');
    console.log('4. The Console Spy should now show tools and resources');
}

// Run the test
testMCPServer().catch(console.error);
