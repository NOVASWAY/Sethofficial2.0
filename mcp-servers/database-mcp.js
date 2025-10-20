#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { Client } = require('pg');

// Database connection
const dbConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://clinic_user:clinic_password@localhost:5432/clinic_management'
};

// Define database tools
const DATABASE_TOOLS = [
  {
    name: 'query_database',
    description: 'Execute SQL queries on the clinic management database',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'SQL query to execute'
        },
        limit: {
          type: 'number',
          description: 'Limit number of results (default: 100)',
          default: 100
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_table_schema',
    description: 'Get schema information for database tables',
    inputSchema: {
      type: 'object',
      properties: {
        table_name: {
          type: 'string',
          description: 'Name of the table to get schema for (optional - gets all tables if not specified)'
        }
      }
    }
  },
  {
    name: 'get_patient_data',
    description: 'Get patient information from the database',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient ID to search for'
        },
        name: {
          type: 'string',
          description: 'Patient name to search for'
        },
        limit: {
          type: 'number',
          description: 'Limit number of results',
          default: 10
        }
      }
    }
  },
  {
    name: 'get_appointment_data',
    description: 'Get appointment information from the database',
    inputSchema: {
      type: 'object',
      properties: {
        date_from: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)'
        },
        date_to: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)'
        },
        status: {
          type: 'string',
          description: 'Appointment status filter'
        },
        limit: {
          type: 'number',
          description: 'Limit number of results',
          default: 20
        }
      }
    }
  },
  {
    name: 'get_system_stats',
    description: 'Get system statistics and counts',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Create the server
const server = new Server(
  {
    name: 'clinic-database-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Database connection helper
async function getDbConnection() {
  const client = new Client(dbConfig);
  await client.connect();
  return client;
}

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: DATABASE_TOOLS,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'query_database':
        return await handleQueryDatabase(args);
      
      case 'get_table_schema':
        return await handleGetTableSchema(args);
      
      case 'get_patient_data':
        return await handleGetPatientData(args);
      
      case 'get_appointment_data':
        return await handleGetAppointmentData(args);
      
      case 'get_system_stats':
        return await handleGetSystemStats(args);
      
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
async function handleQueryDatabase(args) {
  const client = await getDbConnection();
  try {
    const { query, limit = 100 } = args;
    
    // Add safety limit if not present and query is a SELECT statement
    let safeQuery = query;
    if (query.toLowerCase().trim().startsWith('select') && !query.toLowerCase().includes('limit')) {
      // Remove trailing semicolon if present before adding LIMIT
      safeQuery = query.replace(/;?\s*$/, '') + ` LIMIT ${limit}`;
    }
    
    const result = await client.query(safeQuery);
    
    return {
      content: [
        {
          type: 'text',
          text: `Query executed successfully. Rows returned: ${result.rows.length}\n\n${JSON.stringify(result.rows, null, 2)}`,
        },
      ],
    };
  } finally {
    await client.end();
  }
}

async function handleGetTableSchema(args) {
  const client = await getDbConnection();
  try {
    const { table_name } = args;
    
    let query = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public'
    `;
    
    if (table_name) {
      query += ` AND table_name = $1`;
      const result = await client.query(query, [table_name]);
      return {
        content: [
          {
            type: 'text',
            text: `Schema for table '${table_name}':\n\n${JSON.stringify(result.rows, null, 2)}`,
          },
        ],
      };
    } else {
      const result = await client.query(query);
      return {
        content: [
          {
            type: 'text',
            text: `Database schema:\n\n${JSON.stringify(result.rows, null, 2)}`,
          },
        ],
      };
    }
  } finally {
    await client.end();
  }
}

async function handleGetPatientData(args) {
  const client = await getDbConnection();
  try {
    const { patient_id, name, limit = 10 } = args;
    
    let query = 'SELECT * FROM patients WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (patient_id) {
      paramCount++;
      query += ` AND id = $${paramCount}`;
      params.push(patient_id);
    }
    
    if (name) {
      paramCount++;
      query += ` AND (first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount})`;
      params.push(`%${name}%`);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1}`;
    params.push(limit);
    
    const result = await client.query(query, params);
    
    return {
      content: [
        {
          type: 'text',
          text: `Patient data (${result.rows.length} results):\n\n${JSON.stringify(result.rows, null, 2)}`,
        },
      ],
    };
  } finally {
    await client.end();
  }
}

async function handleGetAppointmentData(args) {
  const client = await getDbConnection();
  try {
    const { date_from, date_to, status, limit = 20 } = args;
    
    let query = `
      SELECT a.*, p.first_name, p.last_name, p.phone_number
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;
    
    if (date_from) {
      paramCount++;
      query += ` AND a.appointment_date >= $${paramCount}`;
      params.push(date_from);
    }
    
    if (date_to) {
      paramCount++;
      query += ` AND a.appointment_date <= $${paramCount}`;
      params.push(date_to);
    }
    
    if (status) {
      paramCount++;
      query += ` AND a.status = $${paramCount}`;
      params.push(status);
    }
    
    query += ` ORDER BY a.appointment_date DESC LIMIT $${paramCount + 1}`;
    params.push(limit);
    
    const result = await client.query(query, params);
    
    return {
      content: [
        {
          type: 'text',
          text: `Appointment data (${result.rows.length} results):\n\n${JSON.stringify(result.rows, null, 2)}`,
        },
      ],
    };
  } finally {
    await client.end();
  }
}

async function handleGetSystemStats(args) {
  const client = await getDbConnection();
  try {
    const queries = [
      'SELECT COUNT(*) as total_patients FROM patients',
      'SELECT COUNT(*) as total_appointments FROM appointments',
      'SELECT COUNT(*) as total_users FROM users',
      'SELECT COUNT(*) as pending_appointments FROM appointments WHERE status = \'pending\'',
      'SELECT COUNT(*) as completed_appointments FROM appointments WHERE status = \'completed\'',
      'SELECT COUNT(*) as total_invoices FROM invoices',
      'SELECT COUNT(*) as paid_invoices FROM invoices WHERE status = \'paid\''
    ];
    
    const results = {};
    
    for (const query of queries) {
      const result = await client.query(query);
      const key = Object.keys(result.rows[0])[0];
      results[key] = parseInt(result.rows[0][key]);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `Clinic Management System Statistics:\n\n${JSON.stringify(results, null, 2)}`,
        },
      ],
    };
  } finally {
    await client.end();
  }
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Clinic Database MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
