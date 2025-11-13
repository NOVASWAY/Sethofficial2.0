# Docker Safety & Resource Management

This directory contains scripts to prevent Docker containers from breaking your system by managing resources and providing safe cleanup procedures.

## Problem Solved

Previously, running containers could:
- Consume unlimited CPU and memory, freezing your system
- Fill up disk space with logs and volumes
- Create port conflicts
- Leave orphaned containers and volumes

## Solutions Implemented

### 1. Resource Limits
All docker-compose files now include:
- **Memory limits** (`mem_limit`) - Prevents containers from using all RAM
- **CPU limits** (`cpus`) - Prevents CPU exhaustion
- **Memory reservations** (`mem_reservation`) - Guarantees minimum resources
- **Redis memory limits** - Prevents Redis from growing indefinitely
- **Prometheus size limits** - Limits monitoring data to 5GB

### 2. Safe Cleanup Script
`docker-cleanup.sh` - Safely removes all containers, volumes, and networks

**Usage:**
```bash
./scripts/docker-cleanup.sh
```

**What it does:**
- Stops all clinic containers gracefully
- Removes containers
- Optionally removes volumes (with confirmation)
- Removes networks
- Cleans up Docker system (images, cache)
- Shows disk space after cleanup

**Safety features:**
- Asks for confirmation before removing volumes (data deletion)
- Won't run as root
- Checks disk space before cleanup
- Graceful shutdown with 30s timeout

### 3. System Health Check
`system-health-check.sh` - Monitors system resources

**Usage:**
```bash
./scripts/system-health-check.sh
```

**What it checks:**
- Disk space usage (warns at 80%, critical at 90%)
- Memory usage (warns at 80%, critical at 90%)
- Docker disk space (warns at 10GB, critical at 5GB)
- Container health status
- Port conflicts
- Provides recommendations

**Exit codes:**
- `0` - All checks passed
- `1` - Warnings detected
- `2` - Critical issues detected

### 4. Safe Startup Script
`docker-start-safe.sh` - Pre-flight checks before starting containers

**Usage:**
```bash
# Start with default docker-compose.yml
./scripts/docker-start-safe.sh

# Start with specific compose file
./scripts/docker-start-safe.sh docker-compose.prod.yml

# Skip pre-flight checks (not recommended)
./scripts/docker-start-safe.sh docker-compose.yml --skip-checks
```

**What it checks:**
- Docker daemon is running
- Minimum 10GB disk space available
- Minimum 4GB memory available
- Minimum 5GB Docker disk space
- Port conflicts
- Existing containers

**Safety features:**
- Won't start if resources are insufficient
- Warns about port conflicts
- Optionally stops existing containers
- Shows container status after startup

## Quick Start Guide

### First Time Setup
1. Check system health:
   ```bash
   ./scripts/system-health-check.sh
   ```

2. If warnings appear, clean up:
   ```bash
   ./scripts/docker-cleanup.sh
   ```

3. Start containers safely:
   ```bash
   ./scripts/docker-start-safe.sh
   ```

### Regular Maintenance

**Daily:**
- Run health check: `./scripts/system-health-check.sh`

**Weekly:**
- Clean up unused resources: `./scripts/docker-cleanup.sh` (choose not to remove volumes)

**When system feels slow:**
- Run cleanup script
- Check Docker disk: `docker system df`
- Remove old images: `docker image prune -a`

### Emergency Cleanup

If your system is frozen or out of space:

1. **Stop all containers immediately:**
   ```bash
   docker ps -q | xargs docker stop
   ```

2. **Free up disk space:**
   ```bash
   docker system prune -a --volumes
   ```

3. **Run cleanup script:**
   ```bash
   ./scripts/docker-cleanup.sh
   ```

## Resource Limits Summary

| Service | Memory Limit | CPU Limit | Notes |
|---------|-------------|-----------|-------|
| PostgreSQL | 2GB | 2.0 | Can be reduced if needed |
| Redis | 768MB | 1.0 | Has internal 512MB limit |
| Backend | 2GB | 2.0 | Main application |
| Frontend | 1.5GB | 1.5 | Next.js application |
| Nginx | 256MB | 0.5 | Reverse proxy |
| Prometheus | 1GB | 1.0 | 5GB data limit |
| Grafana | 512MB | 0.5 | Monitoring dashboard |

**Total (with monitoring):** ~8GB RAM, ~7 CPUs

**Total (without monitoring):** ~6.5GB RAM, ~6 CPUs

## Automatic Cleanup (Optional)

To set up automatic cleanup via cron:

```bash
# Edit crontab
crontab -e

# Add daily cleanup at 2 AM (keeps volumes)
0 2 * * * /home/njau/projects/Sethofficial2.0/scripts/system-health-check.sh >> /tmp/docker-health.log 2>&1

# Add weekly full cleanup on Sundays at 3 AM (asks for confirmation)
0 3 * * 0 /home/njau/projects/Sethofficial2.0/scripts/docker-cleanup.sh >> /tmp/docker-cleanup.log 2>&1
```

## Troubleshooting

### Containers won't start
1. Check disk space: `df -h`
2. Check Docker: `docker info`
3. Check ports: `./scripts/system-health-check.sh`
4. Check logs: `docker-compose logs`

### System is slow
1. Check resource usage: `docker stats`
2. Run health check: `./scripts/system-health-check.sh`
3. Clean up: `./scripts/docker-cleanup.sh`

### Out of disk space
1. Emergency cleanup: `docker system prune -a --volumes`
2. Check large files: `du -sh /var/lib/docker/*`
3. Remove old images: `docker image prune -a`

### Port conflicts
1. Find what's using the port: `lsof -i :PORT` or `netstat -tuln | grep PORT`
2. Stop conflicting service or change port in docker-compose.yml

## Best Practices

1. **Always use the safe startup script** - It prevents most issues
2. **Run health checks regularly** - Catch problems early
3. **Clean up weekly** - Prevents disk space issues
4. **Monitor resource usage** - Use `docker stats` to see real-time usage
5. **Keep backups** - Before major cleanup, backup important data
6. **Don't run as root** - Scripts will prevent this

## Additional Resources

- Docker documentation: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- System monitoring: `htop`, `iotop`, `nethogs`

