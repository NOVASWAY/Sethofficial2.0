#!/bin/bash

# Seth Medical Clinic - Database Backup Script
# This script creates automated backups of the PostgreSQL database

set -euo pipefail

# Configuration
BACKUP_DIR="/home/njau-wangari/Downloads/backend/backups"
DB_NAME="clinic_management"
DB_USER="clinic_user"
DB_HOST="localhost"
DB_PORT="5432"
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/clinic_backup_${TIMESTAMP}.sql"
BACKUP_FILE_COMPRESSED="${BACKUP_FILE}.gz"
LOG_FILE="/home/njau-wangari/Downloads/backend/logs/clinic_backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "${RED}ERROR: $1${NC}"
    exit 1
}

# Success message
success() {
    log "${GREEN}SUCCESS: $1${NC}"
}

# Warning message
warning() {
    log "${YELLOW}WARNING: $1${NC}"
}

# Create backup directory if it doesn't exist
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR" || error_exit "Failed to create backup directory: $BACKUP_DIR"
        log "Created backup directory: $BACKUP_DIR"
    fi
}

# Check if PostgreSQL is running
check_postgres() {
    # Test connection using psql
    if ! PGPASSWORD=clinic_password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        error_exit "PostgreSQL is not running or not accessible"
    fi
    log "PostgreSQL connection verified"
}

# Create database backup
create_backup() {
    log "Starting database backup..."
    
    # Create backup with pg_dump
    if PGPASSWORD=clinic_password pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose \
        --format=plain \
        --no-owner \
        --no-privileges \
        --file="$BACKUP_FILE" 2>>"$LOG_FILE"; then
        
        success "Database backup created: $BACKUP_FILE"
        
        # Compress the backup
        if gzip "$BACKUP_FILE"; then
            success "Backup compressed: $BACKUP_FILE_COMPRESSED"
            BACKUP_FILE="$BACKUP_FILE_COMPRESSED"
        else
            warning "Failed to compress backup, keeping uncompressed version"
        fi
        
        # Get backup size
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log "Backup size: $BACKUP_SIZE"
        
    else
        error_exit "Failed to create database backup"
    fi
}

# Verify backup integrity
verify_backup() {
    log "Verifying backup integrity..."
    
    if [ -f "$BACKUP_FILE" ]; then
        if [ "${BACKUP_FILE##*.}" = "gz" ]; then
            # Test compressed backup
            if gunzip -t "$BACKUP_FILE" 2>/dev/null; then
                success "Compressed backup integrity verified"
            else
                error_exit "Backup file is corrupted"
            fi
        else
            # Test uncompressed backup
            if head -n 1 "$BACKUP_FILE" | grep -q "PostgreSQL database dump"; then
                success "Backup integrity verified"
            else
                error_exit "Backup file appears to be corrupted"
            fi
        fi
    else
        error_exit "Backup file not found: $BACKUP_FILE"
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    if [ -d "$BACKUP_DIR" ]; then
        OLD_BACKUPS=$(find "$BACKUP_DIR" -name "clinic_backup_*.sql*" -type f -mtime +$RETENTION_DAYS)
        
        if [ -n "$OLD_BACKUPS" ]; then
            echo "$OLD_BACKUPS" | while read -r backup; do
                log "Removing old backup: $backup"
                rm -f "$backup"
            done
            success "Old backups cleaned up"
        else
            log "No old backups to clean up"
        fi
    fi
}

# Create backup metadata
create_metadata() {
    local metadata_file="${BACKUP_FILE}.meta"
    
    cat > "$metadata_file" << EOF
{
    "backup_timestamp": "$(date -Iseconds)",
    "database_name": "$DB_NAME",
    "database_user": "$DB_USER",
    "database_host": "$DB_HOST",
    "database_port": "$DB_PORT",
    "backup_file": "$(basename "$BACKUP_FILE")",
    "backup_size": "$BACKUP_SIZE",
    "backup_type": "full",
    "compression": "$([ "${BACKUP_FILE##*.}" = "gz" ] && echo "gzip" || echo "none")",
    "retention_days": $RETENTION_DAYS,
    "created_by": "clinic_backup_script",
    "version": "1.0.0"
}
EOF
    
    success "Backup metadata created: $metadata_file"
}

# Send notification (if configured)
send_notification() {
    local status="$1"
    local message="$2"
    
    # This is a placeholder for notification systems
    # In production, you might integrate with:
    # - Email notifications
    # - Slack/Discord webhooks
    # - SMS alerts
    # - Monitoring systems like Prometheus/Grafana
    
    if [ "$status" = "success" ]; then
        log "📧 Notification: Backup completed successfully - $message"
    else
        log "🚨 Notification: Backup failed - $message"
    fi
}

# Main backup process
main() {
    log "=== Starting Clinic Database Backup Process ==="
    log "Backup timestamp: $TIMESTAMP"
    log "Database: $DB_NAME"
    log "Backup directory: $BACKUP_DIR"
    log "Retention: $RETENTION_DAYS days"
    
    # Execute backup steps
    create_backup_dir
    check_postgres
    create_backup
    verify_backup
    create_metadata
    cleanup_old_backups
    
    success "=== Backup Process Completed Successfully ==="
    send_notification "success" "Database backup completed: $BACKUP_FILE"
    
    # Return backup file path for external scripts
    echo "$BACKUP_FILE"
}

# Handle script arguments
case "${1:-backup}" in
    "backup")
        main
        ;;
    "restore")
        if [ -z "${2:-}" ]; then
            error_exit "Restore requires backup file path as second argument"
        fi
        log "Restore functionality not implemented in this script"
        log "Use: psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $2"
        ;;
    "list")
        log "Available backups:"
        if [ -d "$BACKUP_DIR" ]; then
            ls -la "$BACKUP_DIR"/clinic_backup_*.sql* 2>/dev/null || log "No backups found"
        else
            log "Backup directory does not exist"
        fi
        ;;
    "cleanup")
        cleanup_old_backups
        ;;
    *)
        echo "Usage: $0 {backup|restore <file>|list|cleanup}"
        echo "  backup  - Create a new database backup (default)"
        echo "  restore - Restore from backup file"
        echo "  list    - List available backups"
        echo "  cleanup - Clean up old backups"
        exit 1
        ;;
esac
