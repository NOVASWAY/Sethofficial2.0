#!/bin/bash

# Docker Cleanup Script for Seth Medical Clinic
# This script safely stops and removes all containers, volumes, and networks
# to prevent system resource exhaustion

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILES=(
    "$PROJECT_DIR/docker-compose.yml"
    "$PROJECT_DIR/docker-compose.prod.yml"
    "$PROJECT_DIR/backend/docker-compose.yml"
    "$PROJECT_DIR/monitoring-docker-compose.yml"
)

echo -e "${YELLOW}🧹 Docker Cleanup Script${NC}"
echo "================================"
echo ""

# Function to check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        echo -e "${RED}❌ Do not run this script as root!${NC}"
        exit 1
    fi
}

# Function to check disk space before cleanup
check_disk_space() {
    local available_space=$(df -BG "$PROJECT_DIR" | tail -1 | awk '{print $4}' | sed 's/G//')
    if [ "$available_space" -lt 5 ]; then
        echo -e "${RED}⚠️  Warning: Less than 5GB disk space available!${NC}"
        echo "Proceeding with cleanup anyway..."
    fi
}

# Function to stop all containers
stop_containers() {
    echo -e "${YELLOW}🛑 Stopping all containers...${NC}"
    
    # Stop containers from all compose files
    for compose_file in "${COMPOSE_FILES[@]}"; do
        if [ -f "$compose_file" ]; then
            echo "  Processing: $(basename "$compose_file")"
            cd "$(dirname "$compose_file")"
            docker-compose -f "$compose_file" down --timeout 30 2>/dev/null || true
        fi
    done
    
    # Stop any remaining clinic containers
    echo "  Stopping any remaining clinic containers..."
    docker ps -a --filter "name=clinic-" --format "{{.Names}}" | while read container; do
        if [ ! -z "$container" ]; then
            echo "    Stopping: $container"
            docker stop "$container" --time 30 2>/dev/null || true
        fi
    done
    
    echo -e "${GREEN}✅ Containers stopped${NC}"
}

# Function to remove containers
remove_containers() {
    echo -e "${YELLOW}🗑️  Removing containers...${NC}"
    
    # Remove containers from compose files
    for compose_file in "${COMPOSE_FILES[@]}"; do
        if [ -f "$compose_file" ]; then
            cd "$(dirname "$compose_file")"
            docker-compose -f "$compose_file" rm -f 2>/dev/null || true
        fi
    done
    
    # Remove any remaining clinic containers
    docker ps -a --filter "name=clinic-" --format "{{.Names}}" | while read container; do
        if [ ! -z "$container" ]; then
            echo "    Removing: $container"
            docker rm -f "$container" 2>/dev/null || true
        fi
    done
    
    echo -e "${GREEN}✅ Containers removed${NC}"
}

# Function to remove volumes (with confirmation)
remove_volumes() {
    echo ""
    echo -e "${YELLOW}📦 Volume Management${NC}"
    echo "The following volumes will be removed:"
    
    # List volumes
    docker volume ls --filter "name=clinic" --format "{{.Name}}" | while read volume; do
        if [ ! -z "$volume" ]; then
            size=$(docker system df -v | grep "$volume" | awk '{print $3}' || echo "unknown")
            echo "  - $volume ($size)"
        fi
    done
    
    # Check for compose volumes
    for compose_file in "${COMPOSE_FILES[@]}"; do
        if [ -f "$compose_file" ]; then
            cd "$(dirname "$compose_file")"
            docker-compose -f "$compose_file" config --volumes 2>/dev/null | while read volume; do
                if [ ! -z "$volume" ]; then
                    echo "  - $volume (from $(basename "$compose_file"))"
                fi
            done
        fi
    done
    
    echo ""
    read -p "Remove volumes? This will DELETE ALL DATA! (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        echo -e "${YELLOW}🗑️  Removing volumes...${NC}"
        
        # Remove volumes from compose files
        for compose_file in "${COMPOSE_FILES[@]}"; do
            if [ -f "$compose_file" ]; then
                cd "$(dirname "$compose_file")"
                docker-compose -f "$compose_file" down -v 2>/dev/null || true
            fi
        done
        
        # Remove any remaining clinic volumes
        docker volume ls --filter "name=clinic" --format "{{.Name}}" | while read volume; do
            if [ ! -z "$volume" ]; then
                echo "    Removing volume: $volume"
                docker volume rm "$volume" 2>/dev/null || true
            fi
        done
        
        echo -e "${GREEN}✅ Volumes removed${NC}"
    else
        echo -e "${YELLOW}⚠️  Skipping volume removal${NC}"
    fi
}

# Function to remove networks
remove_networks() {
    echo -e "${YELLOW}🌐 Removing networks...${NC}"
    
    # Remove networks from compose files
    for compose_file in "${COMPOSE_FILES[@]}"; do
        if [ -f "$compose_file" ]; then
            cd "$(dirname "$compose_file")"
            docker-compose -f "$compose_file" down --remove-orphans 2>/dev/null || true
        fi
    done
    
    # Remove clinic networks
    docker network ls --filter "name=clinic" --format "{{.Name}}" | while read network; do
        if [ ! -z "$network" ]; then
            echo "    Removing network: $network"
            docker network rm "$network" 2>/dev/null || true
        fi
    done
    
    echo -e "${GREEN}✅ Networks removed${NC}"
}

# Function to clean up Docker system
cleanup_docker_system() {
    echo ""
    echo -e "${YELLOW}🧹 Cleaning up Docker system...${NC}"
    
    # Remove unused images
    echo "  Removing unused images..."
    docker image prune -af --filter "label=project=seth-clinic" 2>/dev/null || true
    
    # Remove unused containers
    echo "  Removing unused containers..."
    docker container prune -f 2>/dev/null || true
    
    # Remove unused networks
    echo "  Removing unused networks..."
    docker network prune -f 2>/dev/null || true
    
    # Remove build cache (optional, can be large)
    echo ""
    read -p "Remove Docker build cache? (yes/no): " remove_cache
    if [ "$remove_cache" = "yes" ]; then
        echo "  Removing build cache..."
        docker builder prune -af 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ Docker system cleaned${NC}"
}

# Function to show disk space after cleanup
show_disk_space() {
    echo ""
    echo -e "${YELLOW}💾 Disk Space After Cleanup${NC}"
    df -h "$PROJECT_DIR" | tail -1
    echo ""
    docker system df
}

# Main execution
main() {
    check_root
    check_disk_space
    
    echo ""
    echo "This script will:"
    echo "  1. Stop all clinic containers"
    echo "  2. Remove all clinic containers"
    echo "  3. Optionally remove volumes (with confirmation)"
    echo "  4. Remove clinic networks"
    echo "  5. Clean up Docker system"
    echo ""
    read -p "Continue? (yes/no): " proceed
    
    if [ "$proceed" != "yes" ]; then
        echo -e "${YELLOW}⚠️  Cleanup cancelled${NC}"
        exit 0
    fi
    
    stop_containers
    remove_containers
    remove_volumes
    remove_networks
    cleanup_docker_system
    show_disk_space
    
    echo ""
    echo -e "${GREEN}✅ Cleanup complete!${NC}"
    echo ""
    echo "To start fresh, run:"
    echo "  docker-compose up -d"
}

# Run main function
main

