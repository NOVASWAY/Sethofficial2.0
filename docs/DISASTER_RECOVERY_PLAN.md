# Disaster Recovery Plan

**Date**: January 2025  
**Status**: Complete

---

## Executive Summary

This document outlines the comprehensive disaster recovery plan for the Clinic Management System, including recovery procedures, RTO/RPO definitions, testing procedures, and restoration guides.

---

## Recovery Objectives

### Recovery Time Objective (RTO)
- **Critical Systems**: 4 hours
- **Non-Critical Systems**: 24 hours
- **Full System Restoration**: 48 hours

### Recovery Point Objective (RPO)
- **Database**: 1 hour (maximum data loss)
- **Application State**: 15 minutes
- **File Uploads**: 1 hour

---

## Backup Strategy

### Automated Backups

1. **Database Backups**
   - Frequency: Daily at 2:00 AM
   - Retention: 30 days
   - Location: `/app/backups/database/`
   - Format: PostgreSQL dump files (compressed)

2. **File Backups**
   - Frequency: Daily at 2:30 AM
   - Retention: 30 days
   - Location: `/app/backups/files/`
   - Includes: Uploaded files, user documents

3. **Configuration Backups**
   - Frequency: Weekly
   - Retention: 90 days
   - Location: `/app/backups/config/`
   - Includes: Environment files, SSL certificates, nginx configs

### Backup Verification

```bash
# Verify backup integrity
./scripts/backup.sh verify

# Test backup restoration (on test server)
./scripts/backup.sh restore-test <backup_file>
```

---

## Disaster Scenarios & Recovery Procedures

### Scenario 1: Database Corruption or Loss

**Symptoms:**
- Database connection errors
- Data inconsistencies
- Application errors

**Recovery Procedure:**

1. **Immediate Actions** (5 minutes)
   ```bash
   # Stop application
   docker-compose stop backend
   
   # Create emergency backup of current state
   ./backend/scripts/disaster_recovery.sh create_emergency_backup
   ```

2. **Restore from Backup** (30-60 minutes)
   ```bash
   # Identify latest good backup
   ls -lh /app/backups/database/
   
   # Restore database
   ./scripts/backup.sh restore <backup_file>
   
   # Verify data integrity
   psql -U clinic_user -d clinic_management -c "SELECT COUNT(*) FROM users;"
   ```

3. **Post-Recovery** (15 minutes)
   ```bash
   # Restart services
   docker-compose up -d
   
   # Verify application health
   curl http://localhost/health
   
   # Run data integrity checks
   ./scripts/validate-data.sh
   ```

**RTO**: 1 hour  
**RPO**: 1 hour (latest backup)

---

### Scenario 2: Application Server Failure

**Symptoms:**
- Application not responding
- 500 errors
- Service crashes

**Recovery Procedure:**

1. **Immediate Actions** (5 minutes)
   ```bash
   # Check service status
   docker-compose ps
   docker-compose logs backend
   
   # Attempt restart
   docker-compose restart backend
   ```

2. **If Restart Fails** (15-30 minutes)
   ```bash
   # Rebuild containers
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   
   # Verify health
   curl http://localhost/health
   ```

3. **Full Restoration** (1-2 hours)
   ```bash
   # Deploy from backup/version control
   git pull origin main
   docker-compose down
   docker-compose build
   docker-compose up -d
   
   # Run migrations if needed
   cd backend && sqlx migrate run
   ```

**RTO**: 2 hours  
**RPO**: Minimal (application state may be lost)

---

### Scenario 3: Complete Data Center Failure

**Symptoms:**
- Complete system unavailability
- Network connectivity loss
- Infrastructure failure

**Recovery Procedure:**

1. **Initial Assessment** (30 minutes)
   - Assess damage scope
   - Identify available resources
   - Activate DR site if available

2. **Infrastructure Setup** (2-4 hours)
   ```bash
   # Provision new infrastructure
   # - Database server
   # - Application server
   # - Load balancer
   # - Network configuration
   ```

3. **Data Restoration** (2-4 hours)
   ```bash
   # Restore from off-site backup
   # - Download latest backup
   # - Restore database
   # - Restore files
   # - Restore configuration
   ```

4. **Application Deployment** (1-2 hours)
   ```bash
   # Deploy application
   git clone <repository>
   cp env.example .env
   # Update .env with production values
   docker-compose up -d
   ```

5. **Verification** (30 minutes)
   ```bash
   # Health checks
   curl https://yourdomain.com/health
   
   # Data verification
   ./scripts/validate-data.sh
   
   # User acceptance testing
   ```

**RTO**: 48 hours  
**RPO**: 1 hour (latest backup)

---

### Scenario 4: Security Breach

**Symptoms:**
- Unauthorized access detected
- Data exfiltration
- Malicious activity

**Recovery Procedure:**

1. **Immediate Actions** (5 minutes)
   ```bash
   # Isolate affected systems
   docker-compose stop
   
   # Preserve evidence
   ./scripts/backup.sh create_emergency_backup
   
   # Enable maintenance mode
   echo "System under maintenance" > /var/www/html/maintenance.html
   ```

2. **Investigation** (2-4 hours)
   - Review audit logs
   - Identify breach scope
   - Assess data compromise

3. **Remediation** (4-8 hours)
   ```bash
   # Rotate all secrets
   # - JWT_SECRET
   # - Database passwords
   # - API keys
   # - SSL certificates
   
   # Restore from pre-breach backup
   ./scripts/backup.sh restore <pre_breach_backup>
   
   # Update security configurations
   # - Review firewall rules
   # - Update access controls
   # - Patch vulnerabilities
   ```

4. **Post-Incident** (Ongoing)
   - Monitor for suspicious activity
   - Review security logs
   - Update incident response plan

**RTO**: 12 hours  
**RPO**: Pre-breach state

---

## Backup Restoration Procedures

### Database Restoration

```bash
# 1. Stop application
docker-compose stop backend

# 2. Create emergency backup
./backend/scripts/disaster_recovery.sh create_emergency_backup

# 3. Restore database
./scripts/backup.sh restore <backup_file>

# 4. Verify restoration
psql -U clinic_user -d clinic_management <<EOF
SELECT 
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM patients) as patients,
    (SELECT COUNT(*) FROM appointments) as appointments,
    (SELECT COUNT(*) FROM invoices) as invoices;
EOF

# 5. Restart application
docker-compose start backend
```

### Full System Restoration

```bash
# 1. Provision infrastructure
# (Follow infrastructure setup guide)

# 2. Clone repository
git clone <repository-url>
cd Sethofficial2.0

# 3. Configure environment
cp env.example .env
# Edit .env with production values

# 4. Restore database
./scripts/backup.sh restore <backup_file>

# 5. Restore files
tar -xzf <files_backup>.tar.gz -C /app/uploads

# 6. Start services
docker-compose up -d

# 7. Verify
curl http://localhost/health
```

---

## Testing Procedures

### Monthly DR Drill

1. **Schedule**: First Saturday of each month
2. **Duration**: 4 hours
3. **Procedure**:
   - Simulate disaster scenario
   - Execute recovery procedures
   - Verify restoration success
   - Document lessons learned

### Quarterly Full DR Test

1. **Schedule**: Quarterly
2. **Duration**: Full day
3. **Procedure**:
   - Full system restoration on test environment
   - End-to-end verification
   - Performance testing
   - Update DR plan based on findings

---

## Backup Retention Policy

| Backup Type | Retention Period | Storage Location |
|-------------|-----------------|------------------|
| Daily Database Backups | 30 days | Local + Cloud |
| Weekly Database Backups | 90 days | Cloud |
| Monthly Database Backups | 1 year | Cloud |
| File Backups | 30 days | Local + Cloud |
| Configuration Backups | 90 days | Cloud |

---

## Monitoring & Alerts

### Backup Monitoring

- Daily backup success/failure alerts
- Backup size monitoring
- Storage capacity alerts
- Backup integrity verification

### System Health Monitoring

- Database connectivity
- Application health
- Disk space
- Memory usage
- CPU utilization

---

## Contact Information

### Emergency Contacts

- **System Administrator**: [Contact Info]
- **Database Administrator**: [Contact Info]
- **DevOps Team**: [Contact Info]
- **Management**: [Contact Info]

### Escalation Path

1. Level 1: System Administrator (0-1 hour)
2. Level 2: DevOps Team (1-2 hours)
3. Level 3: Management (2-4 hours)

---

## Recovery Checklist

### Pre-Recovery
- [ ] Assess disaster scope
- [ ] Notify stakeholders
- [ ] Activate DR team
- [ ] Create emergency backup

### During Recovery
- [ ] Stop affected services
- [ ] Restore from backup
- [ ] Verify data integrity
- [ ] Restart services
- [ ] Health check verification

### Post-Recovery
- [ ] User notification
- [ ] System monitoring
- [ ] Incident documentation
- [ ] Lessons learned review
- [ ] Plan updates

---

## Appendices

### A. Backup Scripts

- `scripts/backup.sh` - Main backup script
- `backend/scripts/disaster_recovery.sh` - Emergency procedures
- `scripts/validate-data.sh` - Data integrity verification

### B. Recovery Time Estimates

| Component | Recovery Time |
|-----------|--------------|
| Database (100MB) | 5-10 minutes |
| Database (1GB) | 30-60 minutes |
| Database (10GB+) | 2-4 hours |
| Application | 15-30 minutes |
| Full System | 4-8 hours |

### C. Backup Locations

- **Primary**: `/app/backups/`
- **Secondary**: Cloud storage (S3, etc.)
- **Off-site**: Remote backup server

---

**Last Updated**: January 2025  
**Next Review**: Quarterly

