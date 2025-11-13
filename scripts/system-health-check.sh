#!/bin/bash

# System Health Check Script
# Monitors disk space, memory, CPU, and Docker resources
# Prevents system failures by alerting before resources are exhausted

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Thresholds (adjust based on your system)
DISK_WARNING=80  # Percentage
DISK_CRITICAL=90
MEM_WARNING=80   # Percentage
MEM_CRITICAL=90
DOCKER_DISK_WARNING=10  # GB
DOCKER_DISK_CRITICAL=5

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Function to check disk space
check_disk_space() {
    echo -e "${BLUE}💾 Disk Space Check${NC}"
    echo "-------------------"
    
    local usage=$(df -h "$PROJECT_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    local available=$(df -h "$PROJECT_DIR" | tail -1 | awk '{print $4}')
    local total=$(df -h "$PROJECT_DIR" | tail -1 | awk '{print $2}')
    local used=$(df -h "$PROJECT_DIR" | tail -1 | awk '{print $3}')
    
    echo "  Total: $total"
    echo "  Used:  $used"
    echo "  Available: $available"
    echo "  Usage: ${usage}%"
    
    if [ "$usage" -ge "$DISK_CRITICAL" ]; then
        echo -e "  ${RED}❌ CRITICAL: Disk usage is ${usage}%!${NC}"
        return 2
    elif [ "$usage" -ge "$DISK_WARNING" ]; then
        echo -e "  ${YELLOW}⚠️  WARNING: Disk usage is ${usage}%${NC}"
        return 1
    else
        echo -e "  ${GREEN}✅ Disk space OK${NC}"
        return 0
    fi
}

# Function to check memory
check_memory() {
    echo ""
    echo -e "${BLUE}🧠 Memory Check${NC}"
    echo "-------------------"
    
    if command -v free &> /dev/null; then
        local total=$(free -m | awk 'NR==2{print $2}')
        local used=$(free -m | awk 'NR==2{print $3}')
        local available=$(free -m | awk 'NR==2{print $7}')
        local usage=$((used * 100 / total))
        
        echo "  Total:     ${total}MB"
        echo "  Used:      ${used}MB"
        echo "  Available: ${available}MB"
        echo "  Usage:     ${usage}%"
        
        if [ "$usage" -ge "$MEM_CRITICAL" ]; then
            echo -e "  ${RED}❌ CRITICAL: Memory usage is ${usage}%!${NC}"
            return 2
        elif [ "$usage" -ge "$MEM_WARNING" ]; then
            echo -e "  ${YELLOW}⚠️  WARNING: Memory usage is ${usage}%${NC}"
            return 1
        else
            echo -e "  ${GREEN}✅ Memory OK${NC}"
            return 0
        fi
    else
        echo "  ⚠️  'free' command not available"
        return 0
    fi
}

# Function to check Docker disk usage
check_docker_disk() {
    echo ""
    echo -e "${BLUE}🐳 Docker Disk Usage${NC}"
    echo "-------------------"
    
    if ! command -v docker &> /dev/null; then
        echo "  ⚠️  Docker not installed"
        return 0
    fi
    
    if ! docker info &> /dev/null; then
        echo "  ⚠️  Docker daemon not running"
        return 0
    fi
    
    docker system df
    
    # Check Docker root directory space
    local docker_root=$(docker info 2>/dev/null | grep "Docker Root Dir" | awk '{print $4}' || echo "/var/lib/docker")
    if [ -d "$docker_root" ]; then
        local available_gb=$(df -BG "$docker_root" | tail -1 | awk '{print $4}' | sed 's/G//')
        echo ""
        echo "  Docker root available: ${available_gb}GB"
        
        if [ "$available_gb" -lt "$DOCKER_DISK_CRITICAL" ]; then
            echo -e "  ${RED}❌ CRITICAL: Only ${available_gb}GB available for Docker!${NC}"
            return 2
        elif [ "$available_gb" -lt "$DOCKER_DISK_WARNING" ]; then
            echo -e "  ${YELLOW}⚠️  WARNING: Only ${available_gb}GB available for Docker${NC}"
            return 1
        else
            echo -e "  ${GREEN}✅ Docker disk space OK${NC}"
            return 0
        fi
    fi
}

# Function to check Docker containers
check_docker_containers() {
    echo ""
    echo -e "${BLUE}📦 Docker Containers${NC}"
    echo "-------------------"
    
    if ! docker info &> /dev/null; then
        echo "  ⚠️  Docker daemon not running"
        return 0
    fi
    
    local running=$(docker ps --filter "name=clinic-" --format "{{.Names}}" | wc -l)
    local stopped=$(docker ps -a --filter "name=clinic-" --format "{{.Names}}" | wc -l)
    
    echo "  Running: $running"
    echo "  Stopped: $stopped"
    
    # Check for unhealthy containers
    local unhealthy=$(docker ps --filter "name=clinic-" --filter "health=unhealthy" --format "{{.Names}}" | wc -l)
    if [ "$unhealthy" -gt 0 ]; then
        echo -e "  ${RED}❌ Found $unhealthy unhealthy container(s)!${NC}"
        docker ps --filter "name=clinic-" --filter "health=unhealthy" --format "  - {{.Names}} ({{.Status}})"
        return 1
    fi
    
    # Check container resource usage
    echo ""
    echo "  Container Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" \
        $(docker ps --filter "name=clinic-" --format "{{.Names}}") 2>/dev/null || echo "  No containers running"
    
    echo -e "  ${GREEN}✅ Containers OK${NC}"
    return 0
}

# Function to check for port conflicts
check_ports() {
    echo ""
    echo -e "${BLUE}🔌 Port Check${NC}"
    echo "-------------------"
    
    local ports=(80 443 3000 3001 5432 6379 8080 9090)
    local conflicts=0
    
    for port in "${ports[@]}"; do
        if command -v lsof &> /dev/null; then
            local process=$(lsof -i :$port 2>/dev/null | tail -n +2)
            if [ ! -z "$process" ]; then
                local pid=$(echo "$process" | awk '{print $2}' | head -1)
                local name=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
                echo -e "  ${YELLOW}⚠️  Port $port is in use by: $name (PID: $pid)${NC}"
                conflicts=$((conflicts + 1))
            fi
        elif command -v netstat &> /dev/null; then
            if netstat -tuln 2>/dev/null | grep -q ":$port "; then
                echo -e "  ${YELLOW}⚠️  Port $port is in use${NC}"
                conflicts=$((conflicts + 1))
            fi
        fi
    done
    
    if [ "$conflicts" -eq 0 ]; then
        echo -e "  ${GREEN}✅ No port conflicts detected${NC}"
        return 0
    else
        echo -e "  ${YELLOW}⚠️  Found $conflicts potential port conflict(s)${NC}"
        return 1
    fi
}

# Function to provide recommendations
provide_recommendations() {
    echo ""
    echo -e "${BLUE}💡 Recommendations${NC}"
    echo "-------------------"
    
    local issues=0
    
    # Check disk space
    local disk_usage=$(df "$PROJECT_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -ge "$DISK_WARNING" ]; then
        echo "  - Run cleanup script: ./scripts/docker-cleanup.sh"
        echo "  - Remove old Docker images: docker image prune -a"
        echo "  - Remove unused volumes: docker volume prune"
        issues=$((issues + 1))
    fi
    
    # Check Docker disk
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        local docker_root=$(docker info 2>/dev/null | grep "Docker Root Dir" | awk '{print $4}' || echo "/var/lib/docker")
        if [ -d "$docker_root" ]; then
            local available_gb=$(df -BG "$docker_root" | tail -1 | awk '{print $4}' | sed 's/G//')
            if [ "$available_gb" -lt "$DOCKER_DISK_WARNING" ]; then
                echo "  - Clean Docker system: docker system prune -a --volumes"
                echo "  - Remove build cache: docker builder prune -a"
                issues=$((issues + 1))
            fi
        fi
    fi
    
    if [ "$issues" -eq 0 ]; then
        echo -e "  ${GREEN}✅ System is healthy!${NC}"
    fi
}

# Main function
main() {
    echo -e "${BLUE}🏥 System Health Check${NC}"
    echo "================================"
    echo ""
    
    local exit_code=0
    
    check_disk_space || exit_code=$?
    check_memory || exit_code=$?
    check_docker_disk || exit_code=$?
    check_docker_containers || exit_code=$?
    check_ports || exit_code=$?
    provide_recommendations
    
    echo ""
    if [ "$exit_code" -eq 0 ]; then
        echo -e "${GREEN}✅ All checks passed!${NC}"
    elif [ "$exit_code" -eq 1 ]; then
        echo -e "${YELLOW}⚠️  Some warnings detected${NC}"
    else
        echo -e "${RED}❌ Critical issues detected!${NC}"
    fi
    
    exit $exit_code
}

# Run main function
main

