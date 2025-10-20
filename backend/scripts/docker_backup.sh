#!/bin/bash

# Seth Medical Clinic - Docker Database Backup Script
# This script creates backups using Docker exec to access PostgreSQL

set -euo pipefail

# Configuration
BACKUP_DIR="/home/njau-wangari/Downloads/backend/backups"
CONTAINER_NAME="clinic_postgres"
DB_NAME="clinic_management"
DB_USER="clinic_user"
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

# Check if Docker container is running
check_container() {
    if ! docker ps | grep -q "$CONTAINER_NAME"; then
        error_exit "PostgreSQL container '$CONTAINER_NAME' is not running"
    fi
    log "PostgreSQL container is running"
}

# Create database backup using Docker
create_backup() {
    log "Starting database backup using Docker..."
    
    # Create backup using pg_dump inside the container
    if docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" \
        --verbose \
        --format=plain \
        --no-owner \
        --no-privileges > "$BACKUP_FILE" 2>>"$LOG_FILE"; then
        
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
    "container_name": "$CONTAINER_NAME",
    "backup_file": "$(basename "$BACKUP_FILE")",
    "backup_size": "$BACKUP_SIZE",
    "backup_type": "full",
    "compression": "$([ "${BACKUP_FILE##*.}" = "gz" ] && echo "gzip" || echo "none")",
    "retention_days": $RETENTION_DAYS,
    "created_by": "docker_backup_script",
    "version": "1.0.0"
}
EOF
    
    success "Backup metadata created: $metadata_file"
}

# List available backups
list_backups() {
    log "=== Available Backups ==="
    
    if [ -d "$BACKUP_DIR" ]; then
        local backups=$(find "$BACKUP_DIR" -name "clinic_backup_*.sql*" -type f | sort -r)
        
        if [ -n "$backups" ]; then
            echo "$backups" | while read -r backup; do
                local size=$(du -h "$backup" | cut -f1)
                local date=$(stat -c %y "$backup" | cut -d' ' -f1)
                local time=$(stat -c %y "$backup" | cut -d' ' -f2 | cut -d'.' -f1)
                log "📁 $backup ($size) - $date $time"
            done
        else
            warning "No backups found in $BACKUP_DIR"
        fi
    else
        warning "Backup directory does not exist: $BACKUP_DIR"
    fi
}

# Restore from backup
restore_backup() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        error_exit "Backup file not found: $backup_file"
    fi
    
    log "=== Restoring from Backup ==="
    log "Backup file: $backup_file"
    
    # Create emergency backup before restore
    log "Creating emergency backup before restore..."
    local emergency_backup=$(./scripts/docker_backup.sh backup 2>/dev/null | tail -n 1)
    log "Emergency backup created: $emergency_backup"
    
    # Stop the backend application
    log "Stopping backend application..."
    pkill -f "clinic-management-backend" || warning "Backend application was not running"
    
    # Drop and recreate database
    log "Recreating database..."
    docker exec "$CONTAINER_NAME" dropdb -U "$DB_USER" "$DB_NAME" || warning "Database did not exist"
    docker exec "$CONTAINER_NAME" createdb -U "$DB_USER" "$DB_NAME"
    
    # Restore from backup
    log "Restoring database from backup..."
    if [ "${backup_file##*.}" = "gz" ]; then
        gunzip -c "$backup_file" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"
    else
        docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$backup_file"
    fi
    
    if [ $? -eq 0 ]; then
        success "Database restored successfully from: $backup_file"
    else
        error_exit "Database restore failed"
    fi
    
    # Restart the backend application
    log "Restarting backend application..."
    cd "/home/njau-wangari/Downloads/backend"
    nohup cargo run > logs/clinic_backend.log 2>&1 &
    
    # Wait for application to start
    sleep 10
    
    # Verify application is running
    if curl -s http://localhost:8080/health >/dev/null; then
        success "Backend application restarted successfully"
    else
        warning "Backend application may not have started properly"
    fi
}

# Main backup process
main() {
    log "=== Starting Clinic Database Backup Process (Docker) ==="
    log "Backup timestamp: $TIMESTAMP"
    log "Database: $DB_NAME"
    log "Container: $CONTAINER_NAME"
    log "Backup directory: $BACKUP_DIR"
    log "Retention: $RETENTION_DAYS days"
    
    # Execute backup steps
    create_backup_dir
    check_container
    create_backup
    verify_backup
    create_metadata
    cleanup_old_backups
    
    success "=== Backup Process Completed Successfully ==="
    
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
        restore_backup "$2"
        ;;
    "list")
        list_backups
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
