#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// Backend configuration
const BACKEND_DIR = '/home/njau-wangari/sethmed/clinic-management/backend';
const LOG_FILE = path.join(BACKEND_DIR, 'logs/app.log');

// Define backend tools
const BACKEND_TOOLS = [
  {
    name: 'get_backend_logs',
    description: 'Get recent backend logs from the Rust application',
    inputSchema: {
      type: 'object',
      properties: {
        lines: {
          type: 'number',
          description: 'Number of recent log lines to retrieve (default: 50)',
          default: 50
        },
        level: {
          type: 'string',
          description: 'Filter logs by level (error, warn, info, debug)',
          enum: ['error', 'warn', 'info', 'debug']
        }
      }
    }
  },
  {
    name: 'check_backend_status',
    description: 'Check if the Rust backend server is running and get status',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_backend_metrics',
    description: 'Get backend performance metrics and statistics',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'restart_backend',
    description: 'Restart the Rust backend server',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'run_backend_tests',
    description: 'Run backend tests and return results',
    inputSchema: {
      type: 'object',
      properties: {
        test_name: {
          type: 'string',
          description: 'Specific test name to run (optional)'
        }
      }
    }
  },
  {
    name: 'get_backend_config',
    description: 'Get current backend configuration and environment variables',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'check_database_connection',
    description: 'Test database connection from backend perspective',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Create the server
const server = new Server(
  {
    name: 'clinic-backend-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: BACKEND_TOOLS,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'get_backend_logs':
        return await handleGetBackendLogs(args);
      
      case 'check_backend_status':
        return await handleCheckBackendStatus(args);
      
      case 'get_backend_metrics':
        return await handleGetBackendMetrics(args);
      
      case 'restart_backend':
        return await handleRestartBackend(args);
      
      case 'run_backend_tests':
        return await handleRunBackendTests(args);
      
      case 'get_backend_config':
        return await handleGetBackendConfig(args);
      
      case 'check_database_connection':
        return await handleCheckDatabaseConnection(args);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Tool handlers
async function handleGetBackendLogs(args) {
  const { lines = 50, level } = args;
  
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Log file not found. Backend may not be running or logging may not be configured.',
          },
        ],
      };
    }
    
    let command = `tail -n ${lines} "${LOG_FILE}"`;
    if (level) {
      command = `grep -i "${level}" "${LOG_FILE}" | tail -n ${lines}`;
    }
    
    const { stdout } = await execAsync(command);
    
    return {
      content: [
        {
          type: 'text',
          text: `Backend logs (last ${lines} lines${level ? ` filtered by ${level}` : ''}):\n\n${stdout}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error reading logs: ${error.message}`,
        },
      ],
    };
  }
}

async function handleCheckBackendStatus(args) {
  try {
    // Check if backend process is running
    const { stdout } = await execAsync('ps aux | grep "clinic-management-backend" | grep -v grep');
    const isRunning = stdout.trim().length > 0;
    
    // Check if port 8081 is listening
    const { stdout: portCheck } = await execAsync('netstat -tlnp | grep :8081 || echo "Port 8081 not listening"');
    const portListening = !portCheck.includes('not listening');
    
    // Try to make a health check request
    let healthStatus = 'Unknown';
    try {
      const { stdout: healthCheck } = await execAsync('curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/health || echo "Connection failed"');
      healthStatus = healthCheck.trim();
    } catch (e) {
      healthStatus = 'Connection failed';
    }
    
    const status = {
      process_running: isRunning,
      port_listening: portListening,
      health_check: healthStatus,
      timestamp: new Date().toISOString()
    };
    
    return {
      content: [
        {
          type: 'text',
          text: `Backend Status:\n\n${JSON.stringify(status, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error checking backend status: ${error.message}`,
        },
      ],
    };
  }
}

async function handleGetBackendMetrics(args) {
  try {
    // Get system metrics
    const { stdout: memory } = await execAsync('free -h');
    const { stdout: disk } = await execAsync('df -h /');
    const { stdout: load } = await execAsync('uptime');
    
    // Get backend-specific metrics if available
    let backendMetrics = 'Backend metrics endpoint not available';
    try {
      const { stdout: metrics } = await execAsync('curl -s http://localhost:8081/metrics || echo "Metrics endpoint not available"');
      backendMetrics = metrics;
    } catch (e) {
      // Metrics endpoint not available
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `Backend Metrics:\n\nMemory:\n${memory}\n\nDisk:\n${disk}\n\nLoad:\n${load}\n\nBackend Metrics:\n${backendMetrics}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting metrics: ${error.message}`,
        },
      ],
    };
  }
}

async function handleRestartBackend(args) {
  try {
    // Kill existing backend processes
    await execAsync('pkill -f "clinic-management-backend" || true');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start backend in background
    const { stdout, stderr } = await execAsync(`cd ${BACKEND_DIR} && cargo run > logs/restart.log 2>&1 &`);
    
    return {
      content: [
        {
          type: 'text',
          text: `Backend restart initiated. Check logs for status.`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error restarting backend: ${error.message}`,
        },
      ],
    };
  }
}

async function handleRunBackendTests(args) {
  try {
    const { test_name } = args;
    
    let command = `cd ${BACKEND_DIR} && cargo test`;
    if (test_name) {
      command += ` -- ${test_name}`;
    }
    
    const { stdout, stderr } = await execAsync(command);
    
    return {
      content: [
        {
          type: 'text',
          text: `Backend Test Results${test_name ? ` for ${test_name}` : ''}:\n\n${stdout}\n\nErrors:\n${stderr}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error running tests: ${error.message}`,
        },
      ],
    };
  }
}

async function handleGetBackendConfig(args) {
  try {
    const envFile = path.join(BACKEND_DIR, 'env.example');
    const cargoFile = path.join(BACKEND_DIR, 'Cargo.toml');
    
    let config = {};
    
    if (fs.existsSync(envFile)) {
      const envContent = fs.readFileSync(envFile, 'utf8');
      config.environment_example = envContent;
    }
    
    if (fs.existsSync(cargoFile)) {
      const cargoContent = fs.readFileSync(cargoFile, 'utf8');
      config.cargo_toml = cargoContent;
    }
    
    // Get current environment variables (without sensitive data)
    const envVars = {};
    Object.keys(process.env).forEach(key => {
      if (key.includes('DATABASE') || key.includes('JWT') || key.includes('REDIS')) {
        envVars[key] = process.env[key] ? '[SET]' : '[NOT SET]';
      }
    });
    config.current_env = envVars;
    
    return {
      content: [
        {
          type: 'text',
          text: `Backend Configuration:\n\n${JSON.stringify(config, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting config: ${error.message}`,
        },
      ],
    };
  }
}

async function handleCheckDatabaseConnection(args) {
  try {
    // Try to connect to database using backend's connection string
    const { stdout } = await execAsync(`cd ${BACKEND_DIR} && cargo run --bin test-db-connection 2>&1 || echo "Database connection test failed"`);
    
    return {
      content: [
        {
          type: 'text',
          text: `Database Connection Test:\n\n${stdout}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error testing database connection: ${error.message}`,
        },
      ],
    };
  }
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Clinic Backend MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
