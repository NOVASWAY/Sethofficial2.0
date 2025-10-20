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

// Define system tools
const SYSTEM_TOOLS = [
  {
    name: 'get_system_status',
    description: 'Get overall system status including all services',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_docker_status',
    description: 'Get Docker containers status for the clinic management system',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_nginx_status',
    description: 'Get Nginx status and configuration',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_redis_status',
    description: 'Get Redis status and memory usage',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_postgres_status',
    description: 'Get PostgreSQL database status and connections',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_system_logs',
    description: 'Get system logs and error messages',
    inputSchema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Service name to get logs for (nginx, postgres, redis, docker)',
          enum: ['nginx', 'postgres', 'redis', 'docker', 'system']
        },
        lines: {
          type: 'number',
          description: 'Number of log lines to retrieve (default: 50)',
          default: 50
        }
      }
    }
  },
  {
    name: 'restart_service',
    description: 'Restart a specific service',
    inputSchema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Service to restart',
          enum: ['nginx', 'postgres', 'redis', 'docker', 'backend', 'frontend']
        }
      },
      required: ['service']
    }
  },
  {
    name: 'get_network_status',
    description: 'Get network status and port usage',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Create the server
const server = new Server(
  {
    name: 'clinic-system-mcp',
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
    tools: SYSTEM_TOOLS,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'get_system_status':
        return await handleGetSystemStatus(args);
      
      case 'get_docker_status':
        return await handleGetDockerStatus(args);
      
      case 'get_nginx_status':
        return await handleGetNginxStatus(args);
      
      case 'get_redis_status':
        return await handleGetRedisStatus(args);
      
      case 'get_postgres_status':
        return await handleGetPostgresStatus(args);
      
      case 'get_system_logs':
        return await handleGetSystemLogs(args);
      
      case 'restart_service':
        return await handleRestartService(args);
      
      case 'get_network_status':
        return await handleGetNetworkStatus(args);
      
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
async function handleGetSystemStatus(args) {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      services: {}
    };
    
    // Check each service
    const services = ['nginx', 'postgres', 'redis', 'docker'];
    
    for (const service of services) {
      try {
        const { stdout } = await execAsync(`systemctl is-active ${service} || echo "inactive"`);
        status.services[service] = stdout.trim();
      } catch (e) {
        status.services[service] = 'unknown';
      }
    }
    
    // Check application ports
    const ports = [3000, 3006, 8080, 5432, 6379, 80, 443];
    status.ports = {};
    
    for (const port of ports) {
      try {
        const { stdout } = await execAsync(`netstat -tlnp | grep :${port} || echo "not listening"`);
        status.ports[port] = !stdout.includes('not listening');
      } catch (e) {
        status.ports[port] = false;
      }
    }
    
    // System resources
    const { stdout: memory } = await execAsync('free -h');
    const { stdout: disk } = await execAsync('df -h /');
    const { stdout: load } = await execAsync('uptime');
    
    status.resources = {
      memory,
      disk,
      load
    };
    
    return {
      content: [
        {
          type: 'text',
          text: `System Status:\n\n${JSON.stringify(status, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting system status: ${error.message}`,
        },
      ],
    };
  }
}

async function handleGetDockerStatus(args) {
  try {
    const { stdout: containers } = await execAsync('docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"');
    const { stdout: images } = await execAsync('docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"');
    
    return {
      content: [
        {
          type: 'text',
          text: `Docker Status:\n\nContainers:\n${containers}\n\nImages:\n${images}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting Docker status: ${error.message}`,
        },
      ],
    };
  }
}

async function handleGetNginxStatus(args) {
  try {
    const { stdout: status } = await execAsync('systemctl status nginx --no-pager || echo "Nginx not running"');
    const { stdout: config } = await execAsync('nginx -t 2>&1 || echo "Config test failed"');
    
    return {
      content: [
        {
          type: 'text',
          text: `Nginx Status:\n\n${status}\n\nConfig Test:\n${config}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting Nginx status: ${error.message}`,
        },
      ],
    };
  }
}

async function handleGetRedisStatus(args) {
  try {
    const { stdout: info } = await execAsync('redis-cli info server memory stats 2>/dev/null || echo "Redis not accessible"');
    const { stdout: ping } = await execAsync('redis-cli ping 2>/dev/null || echo "Redis not responding"');
    
    return {
      content: [
        {
          type: 'text',
          text: `Redis Status:\n\nPing: ${ping}\n\nInfo:\n${info}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting Redis status: ${error.message}`,
        },
      ],
    };
  }
}

async function handleGetPostgresStatus(args) {
  try {
    const { stdout: status } = await execAsync('systemctl status postgresql --no-pager || echo "PostgreSQL not running"');
    const { stdout: connections } = await execAsync('psql -U clinic_user -d clinic_management -c "SELECT count(*) as active_connections FROM pg_stat_activity;" 2>/dev/null || echo "Database connection failed"');
    
    return {
      content: [
        {
          type: 'text',
          text: `PostgreSQL Status:\n\n${status}\n\nActive Connections:\n${connections}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting PostgreSQL status: ${error.message}`,
        },
      ],
    };
  }
}

async function handleGetSystemLogs(args) {
  try {
    const { service = 'system', lines = 50 } = args;
    
    let logCommand;
    switch (service) {
      case 'nginx':
        logCommand = `journalctl -u nginx -n ${lines} --no-pager`;
        break;
      case 'postgres':
        logCommand = `journalctl -u postgresql -n ${lines} --no-pager`;
        break;
      case 'redis':
        logCommand = `journalctl -u redis -n ${lines} --no-pager`;
        break;
      case 'docker':
        logCommand = `journalctl -u docker -n ${lines} --no-pager`;
        break;
      default:
        logCommand = `journalctl -n ${lines} --no-pager`;
    }
    
    const { stdout } = await execAsync(logCommand);
    
    return {
      content: [
        {
          type: 'text',
          text: `${service} logs (last ${lines} lines):\n\n${stdout}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting ${args.service} logs: ${error.message}`,
        },
      ],
    };
  }
}

async function handleRestartService(args) {
  try {
    const { service } = args;
    
    let restartCommand;
    switch (service) {
      case 'backend':
        restartCommand = 'pkill -f "clinic-management-backend" && sleep 2 && cd /home/njau-wangari/sethmed/clinic-management/backend && cargo run &';
        break;
      case 'frontend':
        restartCommand = 'pkill -f "next dev" && sleep 2 && cd /home/njau-wangari/sethmed/clinic-management && npm run dev &';
        break;
      default:
        restartCommand = `sudo systemctl restart ${service}`;
    }
    
    const { stdout, stderr } = await execAsync(restartCommand);
    
    return {
      content: [
        {
          type: 'text',
          text: `${service} restart initiated.\nOutput: ${stdout}\nErrors: ${stderr}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error restarting ${args.service}: ${error.message}`,
        },
      ],
    };
  }
}

async function handleGetNetworkStatus(args) {
  try {
    const { stdout: ports } = await execAsync('netstat -tlnp | grep LISTEN');
    const { stdout: connections } = await execAsync('ss -tuln');
    
    return {
      content: [
        {
          type: 'text',
          text: `Network Status:\n\nListening Ports:\n${ports}\n\nAll Connections:\n${connections}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting network status: ${error.message}`,
        },
      ],
    };
  }
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Clinic System MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
