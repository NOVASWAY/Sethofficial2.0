# Deployment Guide

## Clinic Management System - Production Deployment Guide

### Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Deployment](#docker-deployment)
4. [Manual Deployment](#manual-deployment)
5. [SSL Configuration](#ssl-configuration)
6. [Monitoring Setup](#monitoring-setup)
7. [Backup Configuration](#backup-configuration)
8. [Security Hardening](#security-hardening)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance](#maintenance)

## Prerequisites

### System Requirements
- **Operating System**: Ubuntu 20.04+ or CentOS 8+
- **CPU**: 4+ cores recommended
- **RAM**: 8GB+ recommended
- **Storage**: 100GB+ SSD recommended
- **Network**: Stable internet connection

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Git
- curl/wget
- SSL certificates (for production)

### Domain and DNS
- Domain name configured
- DNS records pointing to your server
- SSL certificate (Let's Encrypt recommended)

## Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/clinic-management.git
cd clinic-management
```

### 2. Environment Configuration
```bash
# Copy environment template
cp env.example .env

# Edit environment variables
nano .env
```

### 3. Required Environment Variables
```bash
# Database
POSTGRES_PASSWORD=your_secure_postgres_password_here
DATABASE_URL=postgresql://clinic_user:your_secure_postgres_password_here@postgres:5432/clinic_management

# Redis
REDIS_PASSWORD=your_secure_redis_password_here
REDIS_URL=redis://:your_secure_redis_password_here@redis:6379

# JWT Secret (generate a secure random string)
JWT_SECRET=your_very_long_and_secure_jwt_secret_key_here_at_least_32_characters

# Domain
DOMAIN=yourclinic.com
SUBDOMAIN=app
```

### 4. Generate Secure Passwords
```bash
# Generate secure passwords
openssl rand -base64 32  # For POSTGRES_PASSWORD
openssl rand -base64 32  # For REDIS_PASSWORD
openssl rand -base64 64  # For JWT_SECRET
```

## Docker Deployment

### 1. Quick Start (Development)
```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 2. Production Deployment
```bash
# Start production services
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 3. Using Deployment Script
```bash
# Make script executable
chmod +x scripts/deploy.sh

# Deploy to development
./scripts/deploy.sh development deploy

# Deploy to production
./scripts/deploy.sh production deploy

# Check deployment status
./scripts/deploy.sh production status

# View logs
./scripts/deploy.sh production logs backend
```

### 4. Service Management
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart specific service
docker-compose restart backend

# Update services
docker-compose pull
docker-compose up -d

# View service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Manual Deployment

### 1. Backend Deployment

#### Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

#### Install Dependencies
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y pkg-config libssl-dev libpq-dev

# CentOS/RHEL
sudo yum install -y pkgconfig openssl-devel postgresql-devel
```

#### Build and Run
```bash
cd backend
cargo build --release
./target/release/clinic-management-backend
```

### 2. Frontend Deployment

#### Install Node.js
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Build and Serve
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Serve with nginx or serve package
npx serve -s out -l 3000
```

### 3. Database Setup

#### Install PostgreSQL
```bash
# Ubuntu/Debian
sudo apt-get install -y postgresql postgresql-contrib

# CentOS/RHEL
sudo yum install -y postgresql-server postgresql-contrib
```

#### Configure Database
```bash
# Create database and user
sudo -u postgres psql
CREATE DATABASE clinic_management;
CREATE USER clinic_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE clinic_management TO clinic_user;
\q

# Run migrations
cd backend
DATABASE_URL="postgresql://clinic_user:your_secure_password@localhost:5432/clinic_management" sqlx migrate run
```

## SSL Configuration

### 1. Let's Encrypt (Recommended)
```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourclinic.com -d app.yourclinic.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 2. Manual SSL Certificate
```bash
# Create SSL directory
sudo mkdir -p /etc/nginx/ssl

# Copy certificates
sudo cp your-cert.pem /etc/nginx/ssl/cert.pem
sudo cp your-key.pem /etc/nginx/ssl/key.pem

# Set permissions
sudo chmod 600 /etc/nginx/ssl/key.pem
sudo chmod 644 /etc/nginx/ssl/cert.pem
```

### 3. Nginx SSL Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name yourclinic.com app.yourclinic.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # Rest of your configuration...
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourclinic.com app.yourclinic.com;
    return 301 https://$server_name$request_uri;
}
```

## Monitoring Setup

### 1. Enable Monitoring Stack
```bash
# Start with monitoring profile
docker-compose --profile monitoring up -d

# Access monitoring services
# Prometheus: http://your-domain:9090
# Grafana: http://your-domain:3000 (admin/admin)
```

### 2. Configure Grafana
```bash
# Import dashboards
# 1. Go to Grafana UI
# 2. Import dashboard from monitoring/grafana/dashboards/
# 3. Configure data source (Prometheus)
```

### 3. Set Up Alerts
```bash
# Configure alert rules in monitoring/prometheus/alerts.yml
# Set up notification channels in Grafana
```

## Backup Configuration

### 1. Automated Backups
```bash
# Make backup script executable
chmod +x scripts/backup.sh

# Test backup
./scripts/backup.sh backup

# Set up cron job for daily backups
crontab -e
# Add: 0 2 * * * /path/to/clinic-management/scripts/backup.sh backup
```

### 2. Cloud Storage Backup
```bash
# Configure AWS S3 (optional)
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_S3_BUCKET=your-clinic-backups

# Backup will automatically upload to S3
./scripts/backup.sh backup
```

### 3. Restore from Backup
```bash
# List available backups
./scripts/backup.sh list

# Restore from backup
./scripts/backup.sh restore backups/clinic_backup_20240101_120000.tar.gz
```

## Security Hardening

### 1. Firewall Configuration
```bash
# UFW (Ubuntu)
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 5432/tcp  # Block direct database access
sudo ufw deny 6379/tcp  # Block direct Redis access

# Firewalld (CentOS)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 2. System Hardening
```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install security tools
sudo apt-get install -y fail2ban ufw

# Configure fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Docker Security
```bash
# Run containers as non-root user
# Use read-only filesystems where possible
# Limit container resources
# Scan images for vulnerabilities
docker scan clinic-backend:latest
```

### 4. Database Security
```bash
# Change default passwords
# Limit database access
# Enable SSL connections
# Regular security updates
```

## Troubleshooting

### 1. Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose logs service-name

# Check resource usage
docker stats

# Check disk space
df -h
```

#### Database Connection Issues
```bash
# Test database connectivity
docker-compose exec postgres pg_isready -U clinic_user -d clinic_management

# Check database logs
docker-compose logs postgres
```

#### Frontend Not Loading
```bash
# Check nginx configuration
docker-compose exec nginx nginx -t

# Check frontend logs
docker-compose logs frontend
```

### 2. Performance Issues
```bash
# Check resource usage
docker stats

# Monitor database performance
docker-compose exec postgres psql -U clinic_user -d clinic_management -c "SELECT * FROM pg_stat_activity;"

# Check application logs
docker-compose logs backend | grep -i error
```

### 3. Health Checks
```bash
# Backend health
curl -f http://localhost:8080/health

# Frontend health
curl -f http://localhost/health

# Database health
docker-compose exec postgres pg_isready -U clinic_user -d clinic_management
```

## Maintenance

### 1. Regular Updates
```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Update Docker images
docker-compose pull
docker-compose up -d

# Update application
git pull origin main
docker-compose build
docker-compose up -d
```

### 2. Log Management
```bash
# Rotate logs
sudo logrotate -f /etc/logrotate.conf

# Clean old logs
docker system prune -f
```

### 3. Database Maintenance
```bash
# Vacuum database
docker-compose exec postgres psql -U clinic_user -d clinic_management -c "VACUUM ANALYZE;"

# Check database size
docker-compose exec postgres psql -U clinic_user -d clinic_management -c "SELECT pg_size_pretty(pg_database_size('clinic_management'));"
```

### 4. Backup Verification
```bash
# Test backup restoration
./scripts/backup.sh restore backups/latest_backup.tar.gz

# Verify backup integrity
./scripts/backup.sh list
```

### 5. Security Updates
```bash
# Update dependencies
cd backend && cargo update
cd frontend && npm audit fix

# Scan for vulnerabilities
docker scan clinic-backend:latest
npm audit
```

---

This deployment guide provides comprehensive instructions for deploying the Clinic Management System in both development and production environments. Follow the steps carefully and adapt them to your specific infrastructure requirements.
