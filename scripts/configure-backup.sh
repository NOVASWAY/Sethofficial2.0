#!/bin/bash

# Backup Configuration Script
# This script helps configure the backup system

set -e

echo "=========================================="
echo "Backup System Configuration"
echo "=========================================="
echo ""

ENV_FILE="backend/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Creating $ENV_FILE from env.example..."
    cp backend/env.example "$ENV_FILE"
fi

echo "Current backup configuration:"
echo "---------------------------"
grep -E "^BACKUP_" "$ENV_FILE" || echo "No backup configuration found"
echo ""

read -p "Do you want to configure backup system? (y/n): " configure
if [ "$configure" != "y" ]; then
    echo "Skipping backup configuration."
    exit 0
fi

echo ""
echo "Backup Schedule Configuration"
echo "-----------------------------"
echo "Cron expression format: minute hour day month weekday"
echo "Examples:"
echo "  '0 2 * * *' - Daily at 2:00 AM"
echo "  '0 0 * * 0' - Weekly on Sunday at midnight"
echo "  '0 2 1 * *' - Monthly on 1st at 2:00 AM"
echo ""

read -p "Backup schedule (cron expression, default: '0 2 * * *'): " cron_expr
cron_expr=${cron_expr:-"0 2 * * *"}

read -p "Backup retention days (default: 30): " retention_days
retention_days=${retention_days:-30}

read -p "Backup storage path (default: ./backups): " backup_path
backup_path=${backup_path:-./backups}

read -p "Enable compression? (y/n, default: y): " enable_compression
enable_compression=${enable_compression:-y}

read -p "Include files in backup? (y/n, default: y): " include_files
include_files=${include_files:-y}

read -p "Max backup size in MB (default: 1024): " max_size_mb
max_size_mb=${max_size_mb:-1024}

# Update .env file
sed -i "s|^BACKUP_ENABLED=.*|BACKUP_ENABLED=true|" "$ENV_FILE" || echo "BACKUP_ENABLED=true" >> "$ENV_FILE"
sed -i "s|^BACKUP_CRON_EXPRESSION=.*|BACKUP_CRON_EXPRESSION=$cron_expr|" "$ENV_FILE" || echo "BACKUP_CRON_EXPRESSION=$cron_expr" >> "$ENV_FILE"
sed -i "s|^BACKUP_RETENTION_DAYS=.*|BACKUP_RETENTION_DAYS=$retention_days|" "$ENV_FILE" || echo "BACKUP_RETENTION_DAYS=$retention_days" >> "$ENV_FILE"
sed -i "s|^BACKUP_PATH=.*|BACKUP_PATH=$backup_path|" "$ENV_FILE" || echo "BACKUP_PATH=$backup_path" >> "$ENV_FILE"

if [ "$enable_compression" = "y" ]; then
    sed -i "s|^BACKUP_COMPRESSION=.*|BACKUP_COMPRESSION=true|" "$ENV_FILE" || echo "BACKUP_COMPRESSION=true" >> "$ENV_FILE"
else
    sed -i "s|^BACKUP_COMPRESSION=.*|BACKUP_COMPRESSION=false|" "$ENV_FILE" || echo "BACKUP_COMPRESSION=false" >> "$ENV_FILE"
fi

if [ "$include_files" = "y" ]; then
    sed -i "s|^BACKUP_INCLUDE_FILES=.*|BACKUP_INCLUDE_FILES=true|" "$ENV_FILE" || echo "BACKUP_INCLUDE_FILES=true" >> "$ENV_FILE"
else
    sed -i "s|^BACKUP_INCLUDE_FILES=.*|BACKUP_INCLUDE_FILES=false|" "$ENV_FILE" || echo "BACKUP_INCLUDE_FILES=false" >> "$ENV_FILE"
fi

sed -i "s|^BACKUP_MAX_SIZE_MB=.*|BACKUP_MAX_SIZE_MB=$max_size_mb|" "$ENV_FILE" || echo "BACKUP_MAX_SIZE_MB=$max_size_mb" >> "$ENV_FILE"

# Create backup directory if it doesn't exist
mkdir -p "$backup_path"
echo "✅ Created backup directory: $backup_path"

echo ""
echo "✅ Backup configuration complete!"
echo ""
echo "Configuration:"
echo "  Schedule: $cron_expr"
echo "  Retention: $retention_days days"
echo "  Storage: $backup_path"
echo "  Compression: $enable_compression"
echo "  Include Files: $include_files"
echo "  Max Size: $max_size_mb MB"
echo ""
echo "⚠️  Note: Backup scheduler runs within the application."
echo "    Ensure the backend service is running for scheduled backups."

