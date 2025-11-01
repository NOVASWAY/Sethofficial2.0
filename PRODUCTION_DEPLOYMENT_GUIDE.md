# 🚀 Production Deployment Guide

**Date**: January 2025  
**Status**: ✅ Complete Deployment Configuration

---

## Overview

This guide provides comprehensive instructions for deploying the Clinic Management System to production, including Docker setup, SSL configuration, monitoring, and backup procedures.

---

## 1. Prerequisites

### System Requirements

- **OS**: Linux (Ubuntu 20.04+ recommended)
- **CPU**: 2+ cores
- **RAM**: 4GB minimum, 8GB+ recommended
- **Storage**: 50GB+ SSD
- **Network**: Static IP address, domain name configured

### Required Software

- Docker 20.10+
- Docker Compose 2.0+
- Nginx (or use containerized version)
- SSL Certificate (Let's Encrypt recommended)
- PostgreSQL client tools
- Backup storage (S3, local, or network drive)

---

## 2. Environment Setup

### A. Clone and Prepare Repository

```bash
# Clone repository
git clone <repository-url>
cd Sethofficial2.0

# Create production environment file
cp backend/env.production backend/.env
# Edit .env with production values
```

### B. Production Environment Variables

**File**: `backend/.env`

```bash
# Database Configuration
DATABASE_URL=postgresql://clinic_user:STRONG_PASSWORD@postgres:5432/clinic_management
POSTGRES_PASSWORD=STRONG_PASSWORD
POSTGRES_USER=clinic_user
POSTGRES_DB=clinic_management

# JWT Configuration (CHANGE IN PRODUCTION!)
JWT_SECRET=generate-a-random-32-character-secret-key-here
JWT_EXPIRATION_HOURS=24
REFRESH_TOKEN_EXPIRATION_DAYS=7

# Server Configuration
RUST_LOG=info
HOST=0.0.0.0
PORT=8080
ENVIRONMENT=production

# SSL Configuration
SSL_ENABLED=true
SSL_CERT_PATH=/etc/nginx/certs/cert.pem
SSL_KEY_PATH=/etc/nginx/certs/key.pem

# CORS Configuration
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Redis Configuration
REDIS_URL=redis://redis:6379
REDIS_ENABLED=true

# M-Pesa Configuration (Production)
MPESA_ENVIRONMENT=production
MPESA_CONSUMER_KEY=your_production_consumer_key
MPESA_CONSUMER_SECRET=your_production_consumer_secret
MPESA_BUSINESS_SHORT_CODE=your_business_short_code
MPESA_PASSKEY=your_production_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback

# SMS Configuration
SMS_API_KEY=your_africastalking_api_key
SMS_USERNAME=your_africastalking_username
SMS_SENDER_ID=SETHMED
SMS_BASE_URL=https://api.africastalking.com/version1

# Email Configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your_sendgrid_api_key
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Seth Medical Clinic

# Data Encryption (CHANGE IN PRODUCTION!)
ENCRYPTION_KEY=generate-a-random-32-byte-key-here-123456789012

# Security
RATE_LIMIT_REQUESTS_PER_MINUTE=100
ALLOWED_IPS=  # Optional: comma-separated IPs for admin access
```

### C. Generate Secure Keys

```bash
# Generate JWT secret (32+ characters)
openssl rand -base64 32

# Generate encryption key (32 bytes)
openssl rand -hex 32

# Store securely - never commit to git!
```

---

## 3. SSL Certificate Setup

### Option A: Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Certificates will be in:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem

# Copy to project
sudo mkdir -p backend/certs
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem backend/certs/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem backend/certs/key.pem
sudo chmod 644 backend/certs/*.pem

# Auto-renewal (add to crontab)
sudo crontab -e
# Add: 0 0 * * * certbot renew --quiet && docker-compose -f docker-compose.prod.yml restart nginx
```

### Option B: Self-Signed (Development Only)

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout backend/certs/key.pem \
  -out backend/certs/cert.pem \
  -subj "/C=KE/ST=Nairobi/L=Nairobi/O=Seth Medical Clinic/CN=yourdomain.com"
```

---

## 4. Docker Production Setup

### A. Production Docker Compose

**File**: `docker-compose.prod.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: clinic_postgres_prod
    restart: always
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-clinic_management}
      POSTGRES_USER: ${POSTGRES_USER:-clinic_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - "127.0.0.1:5432:5432"  # Only expose on localhost
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/scripts/backup.sh:/backup.sh
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - clinic_network

  redis:
    image: redis:7-alpine
    container_name: clinic_redis_prod
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-}
    ports:
      - "127.0.0.1:6379:6379"  # Only expose on localhost
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - clinic_network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: clinic_backend_prod
    restart: always
    env_file:
      - ./backend/.env
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - clinic_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    container_name: clinic_nginx_prod
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./backend/nginx/nginx-ssl.conf:/etc/nginx/conf.d/default.conf:ro
      - ./backend/certs:/etc/nginx/certs:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - backend
    networks:
      - clinic_network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  nginx_logs:
    driver: local

networks:
  clinic_network:
    driver: bridge
```

### B. Build and Deploy

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Run database migrations
docker-compose -f docker-compose.prod.yml run --rm backend \
  sqlx migrate run

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f backend
```

---

## 5. Database Setup

### A. Run Migrations

```bash
# Using Docker
docker-compose -f docker-compose.prod.yml exec backend \
  sqlx migrate run

# Or directly with sqlx
cd backend
sqlx migrate run
```

### B. Performance Indexes

```bash
# Run performance optimization migration
sqlx migrate run
# This will execute 008_performance_indexes.sql
```

### C. Initial Admin User

```sql
-- Create admin user (adjust values)
INSERT INTO users (
    id, username, email, password_hash, role, name, 
    department, permissions, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'admin',
    'admin@clinic.com',
    -- Hash password: use backend to generate hash
    '$argon2id$v=19$m=65536,t=3,p=4$...',
    'admin',
    'System Administrator',
    'Administration',
    '["all"]'::jsonb,
    true,
    NOW(),
    NOW()
);
```

---

## 6. Backup Configuration

### A. Automated Database Backups

**File**: `backend/scripts/setup_automated_backups.sh`

The system already includes backup scripts. Configure cron:

```bash
# Edit crontab
crontab -e

# Daily backups at 2 AM
0 2 * * * /path/to/backend/scripts/backup.sh >> /var/log/clinic_backup.log 2>&1

# Weekly full backup on Sundays
0 3 * * 0 /path/to/backend/scripts/disaster_recovery.sh >> /var/log/clinic_backup.log 2>&1
```

### B. Backup Storage

```bash
# Local backup directory
BACKUP_DIR=/var/backups/clinic_management

# Or use S3 (install aws-cli)
aws s3 sync $BACKUP_DIR s3://your-backup-bucket/clinic-backups/
```

### C. Test Restore Procedure

```bash
# Test restore from backup
cd backend
./scripts/disaster_recovery.sh restore backup_file.sql.gz
```

---

## 7. Monitoring Setup

### A. Health Checks

**Endpoints:**
- `GET /health` - Basic health check
- `GET /status` - Detailed status
- `GET /api/test/database` - Database connection test

### B. Logging

```bash
# View backend logs
docker-compose -f docker-compose.prod.yml logs -f backend

# View nginx logs
docker-compose -f docker-compose.prod.yml logs -f nginx

# View all logs
docker-compose -f docker-compose.prod.yml logs -f
```

### C. Resource Monitoring

```bash
# Install monitoring tools
sudo apt-get install htop iotop nethogs

# Monitor Docker containers
docker stats

# Monitor disk usage
df -h
du -sh /var/lib/docker/volumes/*
```

### D. Set Up Alerts

**Recommended:**
- **Uptime Monitoring**: UptimeRobot, Pingdom
- **Error Tracking**: Sentry, Rollbar
- **Performance Monitoring**: New Relic, Datadog
- **Log Aggregation**: ELK Stack, Papertrail

---

## 8. Security Hardening

### A. Firewall Configuration

```bash
# Install UFW
sudo apt-get install ufw

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

### B. Fail2Ban (DDoS Protection)

```bash
# Install fail2ban
sudo apt-get install fail2ban

# Configure for Nginx
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
# Edit /etc/fail2ban/jail.local to protect Nginx
sudo systemctl restart fail2ban
```

### C. Security Headers

Already configured in `nginx/nginx-ssl.conf`:
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Referrer-Policy

### D. Regular Updates

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Update Docker images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

---

## 9. CI/CD Pipeline

### A. GitHub Actions Workflow

**File**: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Build Backend
        run: |
          cd backend
          docker build -f Dockerfile.prod -t clinic-backend:${{ github.sha }} .
      
      - name: Deploy to Server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/clinic-management
            git pull
            docker-compose -f docker-compose.prod.yml pull
            docker-compose -f docker-compose.prod.yml up -d --build
            docker-compose -f docker-compose.prod.yml exec -T backend sqlx migrate run
```

### B. Manual Deployment Script

**File**: `scripts/deploy.sh`

```bash
#!/bin/bash
set -e

echo "🚀 Starting production deployment..."

# Pull latest code
git pull origin main

# Build and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec -T backend sqlx migrate run

# Health check
sleep 5
curl -f http://localhost/health || exit 1

echo "✅ Deployment complete!"
```

---

## 10. Maintenance Procedures

### A. Regular Maintenance Tasks

**Daily:**
- Monitor logs for errors
- Check disk space
- Verify backups completed

**Weekly:**
- Review error logs
- Check performance metrics
- Verify SSL certificate validity
- Update dependencies (if needed)

**Monthly:**
- Security updates
- Database optimization (VACUUM, ANALYZE)
- Review and rotate logs
- Test disaster recovery

### B. Database Maintenance

```sql
-- Vacuum and analyze tables
VACUUM ANALYZE;

-- Check database size
SELECT pg_size_pretty(pg_database_size('clinic_management'));

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 11. Troubleshooting

### Common Issues

#### A. Database Connection Issues

```bash
# Check database is running
docker-compose -f docker-compose.prod.yml ps postgres

# Test connection
docker-compose -f docker-compose.prod.yml exec backend \
  sqlx database create --database-url $DATABASE_URL

# Check logs
docker-compose -f docker-compose.prod.yml logs postgres
```

#### B. SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in backend/certs/cert.pem -text -noout

# Test SSL
openssl s_client -connect yourdomain.com:443

# Renew Let's Encrypt
sudo certbot renew
sudo systemctl reload nginx
```

#### C. Performance Issues

```bash
# Check container resources
docker stats

# Check database connections
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U clinic_user -d clinic_management -c \
  "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U clinic_user -d clinic_management -c \
  "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

---

## 12. Rollback Procedure

### A. Quick Rollback

```bash
# Stop current version
docker-compose -f docker-compose.prod.yml down

# Checkout previous version
git checkout <previous-commit-hash>

# Restart
docker-compose -f docker-compose.prod.yml up -d
```

### B. Database Rollback

```bash
# Restore from backup
cd backend
./scripts/disaster_recovery.sh restore backup_file.sql.gz

# Or rollback migration
sqlx migrate revert
```

---

## 13. Production Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] SSL certificates obtained and installed
- [ ] Database migrations tested
- [ ] Backup procedures tested
- [ ] Security hardening applied
- [ ] Monitoring configured
- [ ] Load testing completed
- [ ] Documentation reviewed

### Post-Deployment

- [ ] Health checks passing
- [ ] All services running
- [ ] Database accessible
- [ ] SSL certificates valid
- [ ] Backups running
- [ ] Monitoring active
- [ ] Error tracking configured
- [ ] Team notified

---

## 14. Support & Maintenance

### Contact Information

- **Technical Support**: [support@yourdomain.com]
- **Emergency Contact**: [phone]
- **Documentation**: [wiki/documentation-url]

### Escalation Procedures

1. **Level 1**: Monitor and restart services
2. **Level 2**: Check logs and diagnose issues
3. **Level 3**: Database/backup restoration
4. **Level 4**: Vendor/specialist contact

---

## 15. Post-Deployment Monitoring

### Key Metrics to Monitor

1. **API Response Times**: Should be <200ms for most endpoints
2. **Error Rates**: Should be <1%
3. **Database Connection Pool**: Should not exceed 80% capacity
4. **Disk Space**: Monitor and alert at 80% usage
5. **Memory Usage**: Alert at 85% usage
6. **Backup Success Rate**: Should be 100%

### Alerting Thresholds

- API errors > 5%: **Critical**
- Response time > 1s: **Warning**
- Database down: **Critical**
- Disk space > 90%: **Critical**
- Backup failure: **Critical**

---

## Files Created

1. ✅ `PRODUCTION_DEPLOYMENT_GUIDE.md` - This guide
2. ✅ `docker-compose.prod.yml` - Production Docker Compose
3. ✅ `.github/workflows/deploy.yml` - CI/CD pipeline (to be created)

---

**Status**: ✅ **Production deployment guide complete!** System is ready for production deployment following this guide.
