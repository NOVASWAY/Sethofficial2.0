#!/bin/bash

# Safe Docker Startup Script
# Performs pre-flight checks before starting containers
# Prevents system failures by ensuring resources are available

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HEALTH_CHECK_SCRIPT="$SCRIPT_DIR/system-health-check.sh"

# Minimum requirements
MIN_DISK_GB=10
MIN_MEM_GB=4
MIN_DOCKER_DISK_GB=5

# Function to check if Docker is running
check_docker() {
    echo -e "${BLUE}🐳 Checking Docker...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed!${NC}"
        exit 1
    fi
    
    # Check if we can access Docker
    if ! docker info &> /dev/null; then
        local error_msg=$(docker info 2>&1)
        
        # Check for permission denied
        if echo "$error_msg" | grep -q "permission denied"; then
            echo -e "${RED}❌ Permission denied accessing Docker!${NC}"
            echo ""
            echo "  Your user is not in the 'docker' group."
            echo "  To fix this, run:"
            echo "    sudo usermod -aG docker $USER"
            echo "    newgrp docker"
            echo "  Or log out and log back in."
            exit 1
        elif echo "$error_msg" | grep -q "Cannot connect"; then
            echo -e "${RED}❌ Docker daemon is not running!${NC}"
            echo "  Start Docker with:"
            echo "    sudo systemctl start docker"
            echo "  Or if using snap:"
            echo "    sudo snap start docker"
            exit 1
        else
            echo -e "${RED}❌ Cannot connect to Docker daemon!${NC}"
            echo "  Error: $error_msg"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Function to check disk space
check_disk_space() {
    echo -e "${BLUE}💾 Checking disk space...${NC}"
    
    local available_gb=$(df -BG "$PROJECT_DIR" | tail -1 | awk '{print $4}' | sed 's/G//')
    local usage=$(df "$PROJECT_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    
    echo "  Available: ${available_gb}GB"
    echo "  Usage: ${usage}%"
    
    if [ "$available_gb" -lt "$MIN_DISK_GB" ]; then
        echo -e "${RED}❌ Insufficient disk space! Need at least ${MIN_DISK_GB}GB, have ${available_gb}GB${NC}"
        echo "  Run cleanup: ./scripts/docker-cleanup.sh"
        exit 1
    fi
    
    if [ "$usage" -ge 90 ]; then
        echo -e "${YELLOW}⚠️  Disk usage is ${usage}% - consider cleaning up${NC}"
    fi
    
    echo -e "${GREEN}✅ Disk space OK${NC}"
}

# Function to check memory
check_memory() {
    echo -e "${BLUE}🧠 Checking memory...${NC}"
    
    if command -v free &> /dev/null; then
        local total_gb=$(free -g | awk 'NR==2{print $2}')
        local available_gb=$(free -g | awk 'NR==2{print $7}')
        
        echo "  Total: ${total_gb}GB"
        echo "  Available: ${available_gb}GB"
        
        if [ "$available_gb" -lt "$MIN_MEM_GB" ]; then
            echo -e "${RED}❌ Insufficient memory! Need at least ${MIN_MEM_GB}GB available${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✅ Memory OK${NC}"
    else
        echo "  ⚠️  Cannot check memory (free command not available)"
    fi
}

# Function to check Docker disk space
check_docker_disk() {
    echo -e "${BLUE}🐳 Checking Docker disk space...${NC}"
    
    local docker_root=$(docker info 2>/dev/null | grep "Docker Root Dir" | awk '{print $4}' || echo "/var/lib/docker")
    
    if [ -d "$docker_root" ]; then
        local available_gb=$(df -BG "$docker_root" | tail -1 | awk '{print $4}' | sed 's/G//')
        
        echo "  Docker root: $docker_root"
        echo "  Available: ${available_gb}GB"
        
        if [ "$available_gb" -lt "$MIN_DOCKER_DISK_GB" ]; then
            echo -e "${RED}❌ Insufficient Docker disk space! Need at least ${MIN_DOCKER_DISK_GB}GB${NC}"
            echo "  Clean up with: docker system prune -a --volumes"
            exit 1
        fi
        
        echo -e "${GREEN}✅ Docker disk space OK${NC}"
    fi
}

# Function to check for port conflicts
check_ports() {
    echo -e "${BLUE}🔌 Checking ports...${NC}"
    
    local ports=(80 443 3000 5432 6379 8080)
    local conflicts=0
    
    for port in "${ports[@]}"; do
        if command -v lsof &> /dev/null; then
            if lsof -i :$port &> /dev/null; then
                local process=$(lsof -i :$port 2>/dev/null | tail -n +2 | awk '{print $1, $2}' | head -1)
                echo -e "${YELLOW}⚠️  Port $port is in use by: $process${NC}"
                conflicts=$((conflicts + 1))
            fi
        elif command -v netstat &> /dev/null; then
            if netstat -tuln 2>/dev/null | grep -q ":$port "; then
                echo -e "${YELLOW}⚠️  Port $port is in use${NC}"
                conflicts=$((conflicts + 1))
            fi
        fi
    done
    
    if [ "$conflicts" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Found $conflicts port conflict(s) - containers may fail to start${NC}"
        read -p "Continue anyway? (yes/no): " proceed
        if [ "$proceed" != "yes" ]; then
            exit 1
        fi
    else
        echo -e "${GREEN}✅ No port conflicts${NC}"
    fi
}

# Function to check for existing containers
check_existing_containers() {
    echo -e "${BLUE}📦 Checking for existing containers...${NC}"
    
    local running=$(docker ps --filter "name=clinic-" --format "{{.Names}}" | wc -l)
    
    if [ "$running" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Found $running running container(s):${NC}"
        docker ps --filter "name=clinic-" --format "  - {{.Names}} ({{.Status}})"
        echo ""
        read -p "Stop existing containers and start fresh? (yes/no): " restart
        if [ "$restart" = "yes" ]; then
            echo "  Stopping existing containers..."
            docker ps --filter "name=clinic-" --format "{{.Names}}" | xargs -r docker stop
        fi
    else
        echo -e "${GREEN}✅ No conflicting containers${NC}"
    fi
}

# Function to start containers
start_containers() {
    echo ""
    echo -e "${BLUE}🚀 Starting containers...${NC}"
    
    local compose_file="${1:-docker-compose.yml}"
    
    if [ ! -f "$PROJECT_DIR/$compose_file" ]; then
        echo -e "${RED}❌ Compose file not found: $compose_file${NC}"
        exit 1
    fi
    
    cd "$PROJECT_DIR"
    
    echo "  Using: $compose_file"
    echo "  Building images (if needed)..."
    docker-compose -f "$compose_file" build --no-cache 2>&1 | grep -E "(Step|Successfully|Error)" || true
    
    echo "  Starting services..."
    docker-compose -f "$compose_file" up -d
    
    echo ""
    echo "  Waiting for services to be healthy..."
    sleep 5
    
    # Check container status
    local unhealthy=$(docker ps --filter "name=clinic-" --filter "health=unhealthy" --format "{{.Names}}" | wc -l)
    if [ "$unhealthy" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Some containers are unhealthy. Check logs with:${NC}"
        echo "  docker-compose -f $compose_file logs"
    fi
    
    echo ""
    echo -e "${GREEN}✅ Containers started!${NC}"
    echo ""
    echo "View logs: docker-compose -f $compose_file logs -f"
    echo "View status: docker-compose -f $compose_file ps"
}

# Main function
main() {
    echo -e "${BLUE}🏥 Safe Docker Startup${NC}"
    echo "================================"
    echo ""
    
    # Parse arguments
    COMPOSE_FILE="${1:-docker-compose.yml}"
    SKIP_CHECKS="${2:-}"
    
    if [ "$SKIP_CHECKS" != "--skip-checks" ]; then
        check_docker
        check_disk_space
        check_memory
        check_docker_disk
        check_ports
        check_existing_containers
        
        echo ""
        echo -e "${GREEN}✅ All pre-flight checks passed!${NC}"
        echo ""
        read -p "Start containers? (yes/no): " proceed
        if [ "$proceed" != "yes" ]; then
            echo "Cancelled."
            exit 0
        fi
    fi
    
    start_containers "$COMPOSE_FILE"
    
    echo ""
    echo "Run health check: ./scripts/system-health-check.sh"
}

# Run main function
main "$@"

