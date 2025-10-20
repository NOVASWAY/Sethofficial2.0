#!/bin/bash

# Complete MCP Setup for Clinic Management System
echo "🚀 Starting Complete MCP Toolkit for Clinic Management System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a service is running
check_service() {
    local service_name=$1
    local port=$2
    
    if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        echo -e "${GREEN}✅ $service_name is running on port $port${NC}"
        return 0
    else
        echo -e "${RED}❌ $service_name is not running on port $port${NC}"
        return 1
    fi
}

# Function to start a service if not running
start_service() {
    local service_name=$1
    local start_command=$2
    
    if ! check_service "$service_name" "$3" 2>/dev/null; then
        echo -e "${YELLOW}🔄 Starting $service_name...${NC}"
        eval "$start_command" &
        sleep 3
        if check_service "$service_name" "$3" 2>/dev/null; then
            echo -e "${GREEN}✅ $service_name started successfully${NC}"
        else
            echo -e "${RED}❌ Failed to start $service_name${NC}"
        fi
    fi
}

echo -e "${BLUE}📋 Checking system status...${NC}"

# Check and start required services
echo -e "\n${BLUE}🗄️  Database Services:${NC}"
start_service "PostgreSQL" "sudo systemctl start postgresql" "5432"
start_service "Redis" "sudo systemctl start redis" "6379"

echo -e "\n${BLUE}🌐 Web Services:${NC}"
start_service "Nginx" "sudo systemctl start nginx" "80"

echo -e "\n${BLUE}🔧 Application Services:${NC}"
start_service "Backend" "cd /home/njau-wangari/sethmed/clinic-management/backend && cargo run" "8080"
start_service "Frontend" "cd /home/njau-wangari/sethmed/clinic-management && npm run dev" "3006"

echo -e "\n${BLUE}🛠️  MCP Services:${NC}"
start_service "ConsoleSpy" "cd /home/njau-wangari/sethmed/clinic-management/consolespy && ./start-servers.sh" "8766"

echo -e "\n${BLUE}📊 System Status Summary:${NC}"
echo "=================================="

# Check all services
services=(
    "PostgreSQL:5432"
    "Redis:6379"
    "Nginx:80"
    "Backend:8080"
    "Frontend:3006"
    "ConsoleSpy:8766"
)

all_running=true
for service in "${services[@]}"; do
    IFS=':' read -r name port <<< "$service"
    if ! check_service "$name" "$port" 2>/dev/null; then
        all_running=false
    fi
done

echo -e "\n${BLUE}🎯 MCP Toolkit Status:${NC}"
echo "=================================="

if [ "$all_running" = true ]; then
    echo -e "${GREEN}✅ All services are running!${NC}"
    echo -e "${GREEN}🎉 Your complete MCP toolkit is ready!${NC}"
else
    echo -e "${YELLOW}⚠️  Some services may need attention${NC}"
fi

echo -e "\n${BLUE}🔗 Access Points:${NC}"
echo "=================================="
echo -e "${GREEN}Frontend App:${NC}     http://localhost:3006"
echo -e "${GREEN}Backend API:${NC}      http://localhost:8080"
echo -e "${GREEN}Database:${NC}         postgresql://localhost:5432/clinic_management"
echo -e "${GREEN}Redis:${NC}            redis://localhost:6379"
echo -e "${GREEN}ConsoleSpy:${NC}       http://localhost:8766/sse"

echo -e "\n${BLUE}🛠️  MCP Servers Available in Cursor:${NC}"
echo "=================================="
echo -e "${GREEN}• ConsoleSpy:${NC}     Browser console access"
echo -e "${GREEN}• ClinicDatabase:${NC} Database queries and management"
echo -e "${GREEN}• ClinicBackend:${NC}  Backend monitoring and logs"
echo -e "${GREEN}• ClinicSystem:${NC}   System monitoring and services"

echo -e "\n${BLUE}📖 Next Steps:${NC}"
echo "=================================="
echo "1. Restart Cursor to load MCP configuration"
echo "2. Install browser extension: ./install-browser-extension.sh"
echo "3. Open your app: http://localhost:3006"
echo "4. Use MCP tools in Cursor for debugging!"

echo -e "\n${GREEN}🎉 Complete MCP Toolkit is ready for your clinic management system!${NC}"
