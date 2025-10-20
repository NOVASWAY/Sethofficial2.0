#!/bin/bash

# Database Backup Script for Clinic Management System
# This script creates automated backups of the PostgreSQL database

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="clinic_backup_$DATE.sql"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Create backup directory if it doesn't exist
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

# Load environment variables
load_environment() {
    if [ -f "$PROJECT_ROOT/.env" ]; then
        export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
        log_info "Loaded environment variables"
    else
        log_warning "No .env file found, using defaults"
    fi
}

# Create database backup
create_backup() {
    log_info "Creating database backup..."
    
    # Check if running in Docker
    if [ -f "$PROJECT_ROOT/docker-compose.yml" ] && docker-compose ps postgres | grep -q "Up"; then
        log_info "Creating backup from Docker container"
        docker-compose exec -T postgres pg_dump \
            -U clinic_user \
            -d clinic_management \
            --verbose \
            --no-password \
            --format=custom \
            --compress=9 \
            --file="/tmp/$BACKUP_FILE"
        
        # Copy backup from container to host
        docker-compose exec -T postgres cat "/tmp/$BACKUP_FILE" > "$BACKUP_DIR/$BACKUP_FILE"
        docker-compose exec -T postgres rm "/tmp/$BACKUP_FILE"
    else
        log_info "Creating backup from local PostgreSQL"
        pg_dump \
            -h localhost \
            -U clinic_user \
            -d clinic_management \
            --verbose \
            --format=custom \
            --compress=9 \
            --file="$BACKUP_DIR/$BACKUP_FILE"
    fi
    
    # Verify backup file
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ] && [ -s "$BACKUP_DIR/$BACKUP_FILE" ]; then
        BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
        log_success "Backup created successfully: $BACKUP_FILE ($BACKUP_SIZE)"
    else
        log_error "Backup creation failed"
        exit 1
    fi
}

# Create compressed archive
create_archive() {
    log_info "Creating compressed archive..."
    
    ARCHIVE_FILE="$BACKUP_DIR/clinic_backup_$DATE.tar.gz"
    
    cd "$BACKUP_DIR"
    tar -czf "$ARCHIVE_FILE" "$BACKUP_FILE"
    
    if [ -f "$ARCHIVE_FILE" ]; then
        ARCHIVE_SIZE=$(du -h "$ARCHIVE_FILE" | cut -f1)
        log_success "Archive created: $(basename "$ARCHIVE_FILE") ($ARCHIVE_SIZE)"
        
        # Remove uncompressed backup file
        rm "$BACKUP_FILE"
        log_info "Removed uncompressed backup file"
    else
        log_error "Archive creation failed"
        exit 1
    fi
}

# Upload to cloud storage (optional)
upload_to_cloud() {
    if [ -n "$CLOUD_STORAGE_PROVIDER" ] && [ -n "$AWS_S3_BUCKET" ]; then
        log_info "Uploading backup to cloud storage..."
        
        case "$CLOUD_STORAGE_PROVIDER" in
            "aws")
                if command -v aws &> /dev/null; then
                    aws s3 cp "$ARCHIVE_FILE" "s3://$AWS_S3_BUCKET/backups/"
                    log_success "Backup uploaded to S3"
                else
                    log_warning "AWS CLI not found, skipping cloud upload"
                fi
                ;;
            *)
                log_warning "Unsupported cloud storage provider: $CLOUD_STORAGE_PROVIDER"
                ;;
        esac
    else
        log_info "Cloud storage not configured, skipping upload"
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Find and remove old backup files
    find "$BACKUP_DIR" -name "clinic_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    # Count remaining backups
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "clinic_backup_*.tar.gz" -type f | wc -l)
    log_success "Cleanup completed. $BACKUP_COUNT backup(s) remaining"
}

# Send notification (optional)
send_notification() {
    if [ -n "$NOTIFICATION_WEBHOOK" ]; then
        log_info "Sending backup notification..."
        
        MESSAGE="✅ Database backup completed successfully\n📁 File: $BACKUP_FILE\n📅 Date: $(date)\n💾 Size: $ARCHIVE_SIZE"
        
        curl -X POST "$NOTIFICATION_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"$MESSAGE\"}" \
            --silent --show-error || log_warning "Failed to send notification"
    fi
}

# Restore from backup
restore_backup() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        log_error "Backup file not specified"
        echo "Usage: $0 restore <backup_file>"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warning "This will replace the current database. Are you sure? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    log_info "Restoring database from $backup_file..."
    
    # Check if running in Docker
    if [ -f "$PROJECT_ROOT/docker-compose.yml" ] && docker-compose ps postgres | grep -q "Up"; then
        log_info "Restoring to Docker container"
        
        # Copy backup to container
        docker-compose exec -T postgres cat > "/tmp/restore_backup.sql" < "$backup_file"
        
        # Restore database
        docker-compose exec -T postgres pg_restore \
            -U clinic_user \
            -d clinic_management \
            --verbose \
            --clean \
            --if-exists \
            "/tmp/restore_backup.sql"
        
        # Clean up
        docker-compose exec -T postgres rm "/tmp/restore_backup.sql"
    else
        log_info "Restoring to local PostgreSQL"
        pg_restore \
            -h localhost \
            -U clinic_user \
            -d clinic_management \
            --verbose \
            --clean \
            --if-exists \
            "$backup_file"
    fi
    
    log_success "Database restored successfully"
}

# List available backups
list_backups() {
    log_info "Available backups:"
    
    if [ -d "$BACKUP_DIR" ]; then
        ls -la "$BACKUP_DIR"/clinic_backup_*.tar.gz 2>/dev/null | while read -r line; do
            echo "  $line"
        done
    else
        log_warning "No backup directory found"
    fi
}

# Main function
main() {
    case "${1:-backup}" in
        "backup")
            log_info "Starting database backup process..."
            create_backup_dir
            load_environment
            create_backup
            create_archive
            upload_to_cloud
            cleanup_old_backups
            send_notification
            log_success "Backup process completed successfully"
            ;;
        "restore")
            restore_backup "$2"
            ;;
        "list")
            list_backups
            ;;
        *)
            echo "Usage: $0 [backup|restore|list] [backup_file]"
            echo ""
            echo "Commands:"
            echo "  backup  - Create a new database backup (default)"
            echo "  restore - Restore database from backup file"
            echo "  list    - List available backup files"
            echo ""
            echo "Examples:"
            echo "  $0 backup"
            echo "  $0 restore backups/clinic_backup_20240101_120000.tar.gz"
            echo "  $0 list"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
