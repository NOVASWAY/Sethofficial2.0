#!/bin/bash

# Seth Medical Clinic - Automated Backup Setup Script
# This script sets up automated backup scheduling

set -euo pipefail

# Configuration
SCRIPT_DIR="/home/njau-wangari/Downloads/backend/scripts"
BACKUP_SCRIPT="$SCRIPT_DIR/docker_backup.sh"
BACKUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
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

# Make backup script executable
make_script_executable() {
    log "Making backup script executable..."
    
    if [ -f "$BACKUP_SCRIPT" ]; then
        chmod +x "$BACKUP_SCRIPT"
        success "Backup script made executable: $BACKUP_SCRIPT"
    else
        error_exit "Backup script not found: $BACKUP_SCRIPT"
    fi
}

# Test backup script
test_backup_script() {
    log "Testing backup script..."
    
    if [ -x "$BACKUP_SCRIPT" ]; then
        # Test backup script help
        if "$BACKUP_SCRIPT" list >/dev/null 2>&1; then
            success "Backup script is working correctly"
        else
            warning "Backup script may have issues"
        fi
    else
        error_exit "Backup script is not executable: $BACKUP_SCRIPT"
    fi
}

# Setup cron job
setup_cron_job() {
    log "Setting up automated backup cron job..."
    
    # Create cron job entry
    local cron_entry="$BACKUP_SCHEDULE cd $SCRIPT_DIR && ./docker_backup.sh backup >> /home/njau-wangari/Downloads/backend/logs/backup_cron.log 2>&1"
    
    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
        warning "Backup cron job already exists"
        log "Current cron jobs:"
        crontab -l | grep "$BACKUP_SCRIPT" || true
    else
        # Add cron job
        (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
        success "Backup cron job added: $cron_entry"
    fi
    
    # Show current cron jobs
    log "Current cron jobs:"
    crontab -l | grep -E "(clinic|backup)" || log "No clinic-related cron jobs found"
}

# Create backup monitoring script
create_monitoring_script() {
    local monitoring_script="/home/njau-wangari/Downloads/backend/scripts/backup_monitor.sh"
    
    log "Creating backup monitoring script..."
    
    cat > "$monitoring_script" << 'EOF'
#!/bin/bash

# Clinic Backup Monitoring Script
# Checks backup status and sends alerts if needed

BACKUP_DIR="/home/njau-wangari/Downloads/backend/backups"
LOG_FILE="/home/njau-wangari/Downloads/backend/logs/backup_monitor.log"

# Check if backup exists from last 25 hours (allowing 1 hour grace period)
LATEST_BACKUP=$(find "$BACKUP_DIR" -name "clinic_backup_*.sql.gz" -type f -mtime -1 2>/dev/null | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "$(date): ALERT - No recent backup found!" >> "$LOG_FILE"
    echo "ALERT: No recent backup found for clinic database!"
else
    echo "$(date): OK - Latest backup: $LATEST_BACKUP" >> "$LOG_FILE"
    echo "OK: Latest backup found: $LATEST_BACKUP"
fi
EOF

    chmod +x "$monitoring_script"
    success "Backup monitoring script created: $monitoring_script"
    
    # Add monitoring cron job (runs every 6 hours)
    local monitor_cron="0 */6 * * * $monitoring_script"
    (crontab -l 2>/dev/null; echo "$monitor_cron") | crontab -
    success "Backup monitoring cron job added"
}

# Create backup retention script
create_retention_script() {
    local retention_script="/home/njau-wangari/Downloads/backend/scripts/backup_retention.sh"
    
    log "Creating backup retention script..."
    
    cat > "$retention_script" << 'EOF'
#!/bin/bash

# Clinic Backup Retention Script
# Implements backup retention policy

BACKUP_DIR="/home/njau-wangari/Downloads/backend/backups"
RETENTION_DAYS=30
LOG_FILE="/home/njau-wangari/Downloads/backend/logs/backup_retention.log"

# Remove backups older than retention period
find "$BACKUP_DIR" -name "clinic_backup_*.sql*" -type f -mtime +$RETENTION_DAYS -delete

# Log retention actions
echo "$(date): Cleaned up backups older than $RETENTION_DAYS days" >> "$LOG_FILE"
EOF

    chmod +x "$retention_script"
    success "Backup retention script created: $retention_script"
    
    # Add retention cron job (runs weekly)
    local retention_cron="0 3 * * 0 $retention_script"  # Sunday at 3 AM
    (crontab -l 2>/dev/null; echo "$retention_cron") | crontab -
    success "Backup retention cron job added"
}

# Main setup function
main() {
    log "=== Setting up Clinic Automated Backup System ==="
    
    make_script_executable
    test_backup_script
    setup_cron_job
    create_monitoring_script
    create_retention_script
    
    success "=== Automated Backup System Setup Complete ==="
    
    log ""
    log "Backup Schedule:"
    log "  - Daily backups: 2:00 AM"
    log "  - Monitoring: Every 6 hours"
    log "  - Retention cleanup: Weekly (Sunday 3:00 AM)"
    log ""
    log "Backup Location: /home/njau-wangari/Downloads/backend/backups"
    log "Log Files: /home/njau-wangari/Downloads/backend/logs/backup*.log"
    log ""
    log "Manual Commands:"
    log "  - Create backup: $BACKUP_SCRIPT backup"
    log "  - List backups: $BACKUP_SCRIPT list"
    log "  - Cleanup old: $BACKUP_SCRIPT cleanup"
    log ""
    log "To view cron jobs: crontab -l"
    log "To remove cron jobs: crontab -e"
    log ""
}

# Execute main function
main "$@"
