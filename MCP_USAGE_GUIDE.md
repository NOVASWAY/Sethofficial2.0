# 🎯 MCP Usage Guide - Clinic Management System

## 🚀 What You Now Have

Your clinic management system now has **complete MCP integration** that gives Cursor full visibility into your entire stack:

### ✅ **4 MCP Servers Running:**
1. **ConsoleSpy** - Browser console access
2. **ClinicDatabase** - Database queries and management  
3. **ClinicBackend** - Backend monitoring and logs
4. **ClinicSystem** - System monitoring and services

### ✅ **All Services Running:**
- Frontend (Next.js): http://localhost:3006
- Backend (Rust): http://localhost:8080
- Database (PostgreSQL): localhost:5432
- Redis: localhost:6379
- ConsoleSpy: http://localhost:8766/sse

## 🎯 How to Use in Cursor

### 1. **Restart Cursor**
Close and reopen Cursor to load the MCP configuration.

### 2. **Access MCP Tools**
In Cursor, you can now use these MCP tools:

#### **Database Tools:**
```
query_database - Execute SQL queries
get_table_schema - Get database schemas
get_patient_data - Query patient information
get_appointment_data - Query appointments
get_system_stats - Get system statistics
```

#### **Backend Tools:**
```
get_backend_logs - View backend logs
check_backend_status - Check backend health
get_backend_metrics - Get performance metrics
restart_backend - Restart backend service
run_backend_tests - Run backend tests
```

#### **System Tools:**
```
get_system_status - Overall system status
get_docker_status - Docker containers
get_nginx_status - Nginx status
get_redis_status - Redis status
get_postgres_status - PostgreSQL status
restart_service - Restart any service
```

#### **Browser Tools:**
```
getConsoleLogs - Get browser console logs
```

## 🔍 Example Usage Scenarios

### **Scenario 1: Debug a Patient Login Issue**
1. Use `getConsoleLogs` to see browser errors
2. Use `get_backend_logs` to check server logs
3. Use `query_database` to check patient data
4. Use `check_backend_status` to verify API health

### **Scenario 2: Monitor System Performance**
1. Use `get_system_status` for overall health
2. Use `get_backend_metrics` for performance data
3. Use `get_redis_status` for cache performance
4. Use `get_postgres_status` for database health

### **Scenario 3: Debug Database Issues**
1. Use `get_table_schema` to understand structure
2. Use `query_database` to test queries
3. Use `get_system_stats` for data counts
4. Use `check_database_connection` to test connectivity

### **Scenario 4: Deploy and Monitor**
1. Use `restart_backend` to deploy changes
2. Use `restart_service` to restart services
3. Use `get_system_logs` to monitor deployment
4. Use `get_system_status` to verify everything is running

## 🛠️ Quick Commands

### **Check Everything is Working:**
```bash
./start-complete-mcp.sh
```

### **Install Browser Extension:**
```bash
./install-browser-extension.sh
```

### **View System Status:**
Use MCP tool: `get_system_status`

### **Check Database:**
Use MCP tool: `query_database` with query: `SELECT COUNT(*) FROM patients;`

### **View Backend Logs:**
Use MCP tool: `get_backend_logs`

## 🎉 Benefits You Now Have

### **Unified Debugging:**
- Debug frontend, backend, and database from one place
- No more switching between browser, terminal, and database tools
- Real-time monitoring of your entire system

### **Faster Development:**
- Instant access to logs and system status
- Quick database queries without leaving Cursor
- Automated service management

### **Complete Visibility:**
- See everything from frontend console to database queries
- Monitor system resources and performance
- Track errors across all layers

### **Automated Management:**
- Restart services with one command
- Run tests and health checks
- Monitor system health continuously

## 🔧 Maintenance

### **Daily:**
- Use `get_system_status` to check all services
- Use `get_backend_logs` to review any errors

### **Weekly:**
- Use `get_system_stats` to review system usage
- Use `get_backend_metrics` to check performance

### **When Issues Arise:**
- Use `getConsoleLogs` for frontend issues
- Use `get_backend_logs` for backend issues
- Use `query_database` for data issues
- Use `restart_service` to fix service issues

## 🚨 Troubleshooting

### **MCP Tools Not Working:**
1. Restart Cursor completely
2. Check `~/.cursor/mcp.json` exists
3. Run `./start-complete-mcp.sh` to restart services

### **Services Not Running:**
1. Run `./start-complete-mcp.sh`
2. Use `get_system_status` to check what's down
3. Use `restart_service` to fix individual services

### **Database Issues:**
1. Use `check_database_connection`
2. Use `get_postgres_status`
3. Check database credentials in `~/.cursor/mcp.json`

## 🎯 You're All Set!

Your clinic management system now has **enterprise-level debugging and monitoring capabilities** integrated directly into Cursor IDE. You can:

- **Debug** your entire stack from one place
- **Monitor** system health in real-time  
- **Manage** services and databases
- **Query** data directly from Cursor
- **Track** performance and errors

**Happy debugging! 🚀**
