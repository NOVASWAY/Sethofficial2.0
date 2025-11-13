#!/bin/bash

# Migration Rollback Script
# This script helps rollback database migrations

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
MIGRATIONS_DIR="backend/migrations"
DATABASE_URL="${DATABASE_URL:-postgresql://clinic_user:clinic_password@localhost:5432/clinic_management}"

echo "=========================================="
echo "Migration Rollback Script"
echo "=========================================="
echo ""

# Check if sqlx-cli is installed
if ! command -v sqlx &> /dev/null; then
    echo -e "${RED}Error: sqlx-cli not found${NC}"
    echo "Install with: cargo install sqlx-cli"
    exit 1
fi

# List available migrations
echo "Available migrations:"
sqlx migrate info --database-url "$DATABASE_URL" || {
    echo -e "${YELLOW}Warning: Could not list migrations${NC}"
}

echo ""
read -p "Enter migration number to rollback to (or 'all' to rollback all): " ROLLBACK_TO

if [ "$ROLLBACK_TO" = "all" ]; then
    echo -e "${YELLOW}Warning: This will rollback ALL migrations!${NC}"
    read -p "Are you sure? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Rollback cancelled"
        exit 0
    fi
    
    # Rollback all migrations
    echo "Rolling back all migrations..."
    # Note: sqlx doesn't have a direct "rollback all" command
    # You would need to manually rollback each migration
    echo -e "${YELLOW}Manual rollback required. Review migration files in $MIGRATIONS_DIR${NC}"
else
    # Rollback to specific migration
    echo "Rolling back to migration: $ROLLBACK_TO"
    
    # Note: sqlx doesn't have built-in rollback
    # You would need to create rollback scripts for each migration
    echo -e "${YELLOW}Rollback scripts need to be created for each migration${NC}"
    echo "See migration files in $MIGRATIONS_DIR for rollback SQL"
fi

echo ""
echo -e "${GREEN}Rollback complete${NC}"

