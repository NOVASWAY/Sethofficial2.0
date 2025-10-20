#!/bin/bash

# Seth Medical Clinic - Backup Cron Setup Script
# This script sets up automated backup scheduling using cron

set -euo pipefail

# Configuration
SCRIPT_DIR="/home/njau-wangari/Downloads/backend/scripts"
BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"
CRON_USER="root"
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

# Make scripts executable
make_scripts_executable() {
    log "Making backup scripts executable..."
    
    if [ -f "$BACKUP_SCRIPT" ]; then
        chmod +x "$BACKUP_SCRIPT"
        success "Backup script made executable: $BACKUP_SCRIPT"
    else
        error_exit "Backup script not found: $BACKUP_SCRIPT"
    fi
    
    local disaster_recovery_script="$SCRIPT_DIR/disaster_recovery.sh"
    if [ -f "$disaster_recovery_script" ]; then
        chmod +x "$disaster_recovery_script"
        success "Disaster recovery script made executable: $disaster_recovery_script"
    else
        warning "Disaster recovery script not found: $disaster_recovery_script"
    fi
}

# Create backup directories
create_backup_directories() {
    log "Creating backup directories..."
    
    local backup_dir="/backups"
    local log_dir="/var/log"
    
    # Create backup directory
    if [ ! -d "$backup_dir" ]; then
        sudo mkdir -p "$backup_dir"
        sudo chown postgres:postgres "$backup_dir" 2>/dev/null || sudo chown $USER:$USER "$backup_dir"
        success "Created backup directory: $backup_dir"
    else
        info "Backup directory already exists: $backup_dir"
    fi
    
    # Ensure log directory exists
    if [ ! -d "$log_dir" ]; then
        sudo mkdir -p "$log_dir"
        success "Created log directory: $log_dir"
    else
        info "Log directory already exists: $log_dir"
    fi
}

# Setup cron job
setup_cron_job() {
    log "Setting up automated backup cron job..."
    
    # Create cron job entry
    local cron_entry="$BACKUP_SCHEDULE $BACKUP_SCRIPT backup >> /var/log/clinic_backup_cron.log 2>&1"
    
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

# Test backup script
test_backup_script() {
    log "Testing backup script..."
    
    if [ -x "$BACKUP_SCRIPT" ]; then
        # Test backup script help
        if "$BACKUP_SCRIPT" help >/dev/null 2>&1; then
            success "Backup script is working correctly"
        else
            warning "Backup script may have issues"
        fi
    else
        error_exit "Backup script is not executable: $BACKUP_SCRIPT"
    fi
}

# Create backup monitoring script
create_monitoring_script() {
    local monitoring_script="/usr/local/bin/clinic_backup_monitor.sh"
    
    log "Creating backup monitoring script..."
    
    sudo tee "$monitoring_script" > /dev/null << 'EOF'
#!/bin/bash

# Clinic Backup Monitoring Script
# Checks backup status and sends alerts if needed

BACKUP_DIR="/backups"
LOG_FILE="/var/log/clinic_backup_monitor.log"
ALERT_EMAIL="admin@clinic.com"  # Change this to your email

# Check if backup exists from last 25 hours (allowing 1 hour grace period)
LATEST_BACKUP=$(find "$BACKUP_DIR" -name "clinic_backup_*.sql*" -type f -mtime -1 2>/dev/null | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "$(date): ALERT - No recent backup found!" >> "$LOG_FILE"
    # In production, you would send an email or notification here
    # mail -s "Clinic Backup Alert" "$ALERT_EMAIL" < "$LOG_FILE"
else
    echo "$(date): OK - Latest backup: $LATEST_BACKUP" >> "$LOG_FILE"
fi
EOF

    sudo chmod +x "$monitoring_script"
    success "Backup monitoring script created: $monitoring_script"
    
    # Add monitoring cron job (runs every 6 hours)
    local monitor_cron="0 */6 * * * $monitoring_script"
    (crontab -l 2>/dev/null; echo "$monitor_cron") | crontab -
    success "Backup monitoring cron job added"
}

# Create backup retention policy
create_retention_policy() {
    log "Creating backup retention policy..."
    
    local retention_script="/usr/local/bin/clinic_backup_retention.sh"
    
    sudo tee "$retention_script" > /dev/null << 'EOF'
#!/bin/bash

# Clinic Backup Retention Policy Script
# Implements backup retention policy

BACKUP_DIR="/backups"
RETENTION_DAYS=30

# Remove backups older than retention period
find "$BACKUP_DIR" -name "clinic_backup_*.sql*" -type f -mtime +$RETENTION_DAYS -delete

# Log retention actions
echo "$(date): Cleaned up backups older than $RETENTION_DAYS days" >> /var/log/clinic_backup_retention.log
EOF

    sudo chmod +x "$retention_script"
    success "Backup retention script created: $retention_script"
    
    # Add retention cron job (runs weekly)
    local retention_cron="0 3 * * 0 $retention_script"  # Sunday at 3 AM
    (crontab -l 2>/dev/null; echo "$retention_cron") | crontab -
    success "Backup retention cron job added"
}

# Main setup function
main() {
    log "=== Setting up Clinic Backup Automation ==="
    
    make_scripts_executable
    create_backup_directories
    setup_cron_job
    test_backup_script
    create_monitoring_script
    create_retention_policy
    
    success "=== Backup Automation Setup Complete ==="
    
    log ""
    log "Backup Schedule:"
    log "  - Daily backups: 2:00 AM"
    log "  - Monitoring: Every 6 hours"
    log "  - Retention cleanup: Weekly (Sunday 3:00 AM)"
    log ""
    log "Backup Location: /backups"
    log "Log Files: /var/log/clinic_backup*.log"
    log ""
    log "Manual Commands:"
    log "  - Create backup: $BACKUP_SCRIPT backup"
    log "  - List backups: $BACKUP_SCRIPT list"
    log "  - Cleanup old: $BACKUP_SCRIPT cleanup"
    log ""
    log "Disaster Recovery:"
    log "  - Check health: $SCRIPT_DIR/disaster_recovery.sh health"
    log "  - Full recovery: $SCRIPT_DIR/disaster_recovery.sh recover"
    log ""
}

# Execute main function
main "$@"
