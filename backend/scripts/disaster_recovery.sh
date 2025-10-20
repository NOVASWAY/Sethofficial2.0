#!/bin/bash

# Seth Medical Clinic - Disaster Recovery Script
# This script handles disaster recovery procedures for the clinic management system

set -euo pipefail

# Configuration
BACKUP_DIR="/backups"
DB_NAME="clinic_management"
DB_USER="clinic_user"
DB_HOST="localhost"
DB_PORT="5432"
APP_DIR="/home/njau-wangari/Downloads/backend"
LOG_FILE="/var/log/clinic_disaster_recovery.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Info message
info() {
    log "${BLUE}INFO: $1${NC}"
}

# Check system health
check_system_health() {
    log "=== System Health Check ==="
    
    # Check disk space
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 90 ]; then
        warning "Disk usage is high: ${disk_usage}%"
    else
        info "Disk usage: ${disk_usage}%"
    fi
    
    # Check memory usage
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ "$memory_usage" -gt 90 ]; then
        warning "Memory usage is high: ${memory_usage}%"
    else
        info "Memory usage: ${memory_usage}%"
    fi
    
    # Check if PostgreSQL is running
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
        success "PostgreSQL is running and accessible"
    else
        warning "PostgreSQL is not accessible"
        return 1
    fi
    
    # Check if backend application is running
    if pgrep -f "clinic-management-backend" >/dev/null; then
        success "Backend application is running"
    else
        warning "Backend application is not running"
    fi
    
    return 0
}

# Create emergency backup
create_emergency_backup() {
    log "=== Creating Emergency Backup ==="
    
    local emergency_backup="${BACKUP_DIR}/emergency_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose --no-password --format=plain --no-owner --no-privileges \
        --file="$emergency_backup" 2>>"$LOG_FILE"; then
        
        success "Emergency backup created: $emergency_backup"
        echo "$emergency_backup"
    else
        error_exit "Failed to create emergency backup"
    fi
}

# Restore from backup
restore_from_backup() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        error_exit "Backup file not found: $backup_file"
    fi
    
    log "=== Restoring from Backup ==="
    log "Backup file: $backup_file"
    
    # Create emergency backup before restore
    local emergency_backup=$(create_emergency_backup)
    log "Emergency backup created before restore: $emergency_backup"
    
    # Stop the backend application
    log "Stopping backend application..."
    pkill -f "clinic-management-backend" || warning "Backend application was not running"
    
    # Drop and recreate database
    log "Recreating database..."
    dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" || warning "Database did not exist"
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    
    # Restore from backup
    log "Restoring database from backup..."
    if [ "${backup_file##*.}" = "gz" ]; then
        gunzip -c "$backup_file" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
    else
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$backup_file"
    fi
    
    if [ $? -eq 0 ]; then
        success "Database restored successfully from: $backup_file"
    else
        error_exit "Database restore failed"
    fi
    
    # Restart the backend application
    log "Restarting backend application..."
    cd "$APP_DIR"
    nohup cargo run > /var/log/clinic_backend.log 2>&1 &
    
    # Wait for application to start
    sleep 10
    
    # Verify application is running
    if curl -s http://localhost:8080/health >/dev/null; then
        success "Backend application restarted successfully"
    else
        warning "Backend application may not have started properly"
    fi
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

# Test backup integrity
test_backup_integrity() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        error_exit "Backup file not found: $backup_file"
    fi
    
    log "=== Testing Backup Integrity ==="
    log "Testing backup: $backup_file"
    
    if [ "${backup_file##*.}" = "gz" ]; then
        if gunzip -t "$backup_file" 2>/dev/null; then
            success "Compressed backup integrity test passed"
        else
            error_exit "Backup file is corrupted"
        fi
    else
        if head -n 1 "$backup_file" | grep -q "PostgreSQL database dump"; then
            success "Backup integrity test passed"
        else
            error_exit "Backup file appears to be corrupted"
        fi
    fi
}

# Full disaster recovery procedure
full_disaster_recovery() {
    log "=== FULL DISASTER RECOVERY PROCEDURE ==="
    warning "This will completely restore the system from the latest backup"
    
    # Find the latest backup
    local latest_backup=$(find "$BACKUP_DIR" -name "clinic_backup_*.sql*" -type f | sort -r | head -n 1)
    
    if [ -z "$latest_backup" ]; then
        error_exit "No backups found for disaster recovery"
    fi
    
    log "Latest backup found: $latest_backup"
    
    # Test backup integrity
    test_backup_integrity "$latest_backup"
    
    # Confirm with user
    echo -n "Are you sure you want to proceed with full disaster recovery? (yes/no): "
    read -r confirmation
    
    if [ "$confirmation" != "yes" ]; then
        log "Disaster recovery cancelled by user"
        exit 0
    fi
    
    # Perform restore
    restore_from_backup "$latest_backup"
    
    success "=== DISASTER RECOVERY COMPLETED ==="
    log "System has been restored from: $latest_backup"
}

# Main function
main() {
    case "${1:-help}" in
        "health")
            check_system_health
            ;;
        "backup")
            create_emergency_backup
            ;;
        "restore")
            if [ -z "${2:-}" ]; then
                error_exit "Restore requires backup file path as second argument"
            fi
            restore_from_backup "$2"
            ;;
        "list")
            list_backups
            ;;
        "test")
            if [ -z "${2:-}" ]; then
                error_exit "Test requires backup file path as second argument"
            fi
            test_backup_integrity "$2"
            ;;
        "recover")
            full_disaster_recovery
            ;;
        "help"|*)
            echo "Seth Medical Clinic - Disaster Recovery Script"
            echo ""
            echo "Usage: $0 {health|backup|restore <file>|list|test <file>|recover|help}"
            echo ""
            echo "Commands:"
            echo "  health   - Check system health status"
            echo "  backup   - Create emergency backup"
            echo "  restore  - Restore from specific backup file"
            echo "  list     - List available backups"
            echo "  test     - Test backup file integrity"
            echo "  recover  - Full disaster recovery procedure"
            echo "  help     - Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 health"
            echo "  $0 backup"
            echo "  $0 restore /backups/clinic_backup_20250101_120000.sql.gz"
            echo "  $0 test /backups/clinic_backup_20250101_120000.sql.gz"
            echo "  $0 recover"
            ;;
    esac
}

# Execute main function with all arguments
main "$@"
