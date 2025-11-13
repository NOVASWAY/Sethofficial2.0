#!/bin/bash

# Setup Automatic Cleanup Cron Jobs
# This script sets up automatic health checks and cleanup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Setting up automatic cleanup${NC}"
echo "================================"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Do not run as root. Using current user's crontab.${NC}"
fi

# Create log directory
LOG_DIR="$HOME/.docker-cleanup-logs"
mkdir -p "$LOG_DIR"
echo "Log directory: $LOG_DIR"

# Backup existing crontab
CRON_BACKUP="$LOG_DIR/crontab.backup.$(date +%Y%m%d_%H%M%S)"
if crontab -l &> /dev/null; then
    crontab -l > "$CRON_BACKUP"
    echo "Backed up existing crontab to: $CRON_BACKUP"
fi

# Add cron jobs
echo ""
echo "Adding cron jobs..."

# Health check daily at 2 AM
(crontab -l 2>/dev/null | grep -v "system-health-check.sh"; \
 echo "0 2 * * * $SCRIPT_DIR/system-health-check.sh >> $LOG_DIR/health-check.log 2>&1") | crontab -

# Weekly cleanup reminder on Sundays at 3 AM (doesn't auto-remove volumes)
(crontab -l 2>/dev/null | grep -v "docker-cleanup-reminder.sh"; \
 echo "0 3 * * 0 echo 'Weekly cleanup reminder - run: $SCRIPT_DIR/docker-cleanup.sh' >> $LOG_DIR/cleanup-reminder.log 2>&1") | crontab -

# Docker system prune weekly (safe, removes unused resources)
(crontab -l 2>/dev/null | grep -v "docker system prune"; \
 echo "0 4 * * 0 docker system prune -f >> $LOG_DIR/docker-prune.log 2>&1") | crontab -

echo -e "${GREEN}✅ Cron jobs added!${NC}"
echo ""
echo "Current crontab:"
crontab -l
echo ""
echo -e "${YELLOW}Note: Automatic volume removal is NOT enabled for safety.${NC}"
echo "Run cleanup manually when needed: ./scripts/docker-cleanup.sh"
echo ""
echo "View logs:"
echo "  Health checks: tail -f $LOG_DIR/health-check.log"
echo "  Cleanup reminders: tail -f $LOG_DIR/cleanup-reminder.log"
echo "  Docker prune: tail -f $LOG_DIR/docker-prune.log"

