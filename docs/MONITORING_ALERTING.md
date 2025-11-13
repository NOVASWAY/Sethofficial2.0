# Monitoring & Alerting Configuration

**Date**: January 2025  
**Status**: Complete

---

## Overview

This document describes the monitoring and alerting setup for the Clinic Management System, including Prometheus metrics, Grafana dashboards, alert channels, and runbooks.

---

## Monitoring Stack

### Components

1. **Prometheus** - Metrics collection and storage
2. **Grafana** - Visualization and dashboards
3. **Alertmanager** - Alert routing and notification
4. **Node Exporter** - System metrics
5. **PostgreSQL Exporter** - Database metrics

---

## Metrics Collection

### Application Metrics

- HTTP request rate
- HTTP response times
- Error rates
- Active connections
- Database query performance

### System Metrics

- CPU usage
- Memory usage
- Disk space
- Network I/O
- Container health

### Database Metrics

- Connection pool usage
- Query performance
- Transaction rates
- Replication lag (if applicable)

### Cache Metrics

- Hit/miss ratios
- Memory usage
- Eviction rates

---

## Alert Configuration

### Critical Alerts

| Alert Name | Condition | Threshold | Action |
|------------|-----------|-----------|--------|
| BackendDown | Backend service unavailable | 2 minutes | Immediate notification |
| DatabaseDown | Database unreachable | 1 minute | Immediate notification |
| HighErrorRate | Error rate > 10% | 5 minutes | Immediate investigation |
| DiskSpaceLow | Disk space < 10% | 5 minutes | Immediate action |

### Warning Alerts

| Alert Name | Condition | Threshold | Action |
|------------|-----------|-----------|--------|
| HighResponseTime | P95 latency > 2s | 5 minutes | Monitor |
| HighMemoryUsage | Memory > 90% | 5 minutes | Monitor |
| LowCacheHitRatio | Cache hit < 50% | 10 minutes | Review caching strategy |
| DatabaseConnectionPoolExhausted | Pool > 90% | 5 minutes | Scale or optimize |

---

## Alert Channels

### Email

- **Primary**: `admin@sethmedicalclinic.com`
- **Critical**: `devops@sethmedicalclinic.com`
- **Format**: HTML with alert details

### Slack (Optional)

- Webhook URL configured in environment
- Channel: `#clinic-alerts`
- Format: Rich messages with alert details

---

## Grafana Dashboards

### Available Dashboards

1. **Clinic Overview**
   - System health overview
   - Request rates and latency
   - Error rates
   - Active users

2. **Database Performance**
   - Connection pool usage
   - Query performance
   - Transaction rates
   - Slow queries

3. **System Resources**
   - CPU usage
   - Memory usage
   - Disk I/O
   - Network traffic

4. **Application Metrics**
   - API endpoint performance
   - Error rates by endpoint
   - User activity
   - Cache performance

---

## Alert Runbooks

### BackendDown

**Symptoms:**
- Backend service not responding
- HTTP 503 errors
- Health check failures

**Actions:**
1. Check service status: `docker-compose ps`
2. Check logs: `docker-compose logs backend`
3. Restart service: `docker-compose restart backend`
4. If restart fails, check resource usage
5. Scale if needed: `docker-compose up -d --scale backend=2`

**Verification:**
```bash
curl http://localhost/health
curl http://localhost/api/health
```

---

### DatabaseDown

**Symptoms:**
- Database connection errors
- Application errors
- Health check failures

**Actions:**
1. Check database status: `docker-compose ps postgres`
2. Check logs: `docker-compose logs postgres`
3. Check disk space: `df -h`
4. Restart database: `docker-compose restart postgres`
5. Verify connections: `psql -U clinic_user -d clinic_management`

**Verification:**
```bash
psql -U clinic_user -d clinic_management -c "SELECT 1;"
```

---

### HighErrorRate

**Symptoms:**
- Error rate > 10%
- HTTP 5xx errors
- User complaints

**Actions:**
1. Check error logs: `docker-compose logs backend | grep ERROR`
2. Check application metrics in Grafana
3. Identify failing endpoints
4. Check database connection pool
5. Check external service dependencies
6. Review recent deployments

**Verification:**
- Monitor error rate in Grafana
- Check application logs

---

### DiskSpaceLow

**Symptoms:**
- Disk space < 10%
- Write failures
- Performance degradation

**Actions:**
1. Identify large files: `du -sh /*`
2. Clean up old backups: `find /app/backups -mtime +30 -delete`
3. Clean up logs: `journalctl --vacuum-time=7d`
4. Clean up Docker: `docker system prune -a`
5. Consider increasing disk size

**Verification:**
```bash
df -h
```

---

### HighMemoryUsage

**Symptoms:**
- Memory usage > 90%
- OOM kills
- Performance degradation

**Actions:**
1. Identify memory consumers: `docker stats`
2. Check for memory leaks
3. Restart services if needed
4. Scale horizontally if possible
5. Optimize application memory usage

**Verification:**
```bash
free -h
docker stats
```

---

## Monitoring Validation

### Health Checks

```bash
# Check Prometheus
curl http://localhost:9090/-/healthy

# Check Grafana
curl http://localhost:3000/api/health

# Check Alertmanager
curl http://localhost:9093/-/healthy
```

### Metrics Validation

```bash
# Check if metrics are being collected
curl http://localhost:9090/api/v1/query?query=up

# Check specific metric
curl http://localhost:9090/api/v1/query?query=http_requests_total
```

---

## Setup Instructions

### 1. Start Monitoring Stack

```bash
cd monitoring
docker-compose up -d
```

### 2. Configure Alert Channels

Edit `monitoring/prometheus/alertmanager.yml`:
- Update email addresses
- Configure Slack webhook (optional)
- Set SMTP credentials

### 3. Access Dashboards

- **Grafana**: http://localhost:3000
  - Default credentials: `admin` / `admin`
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

### 4. Import Dashboards

1. Log into Grafana
2. Navigate to Dashboards > Import
3. Import `monitoring/grafana/dashboards/clinic-overview.json`

---

## Maintenance

### Regular Tasks

- **Weekly**: Review alert effectiveness
- **Monthly**: Update dashboards
- **Quarterly**: Review and optimize alert thresholds

### Backup

- Backup Grafana dashboards
- Backup Prometheus configuration
- Backup Alertmanager configuration

---

## Troubleshooting

### Metrics Not Appearing

1. Check Prometheus targets: http://localhost:9090/targets
2. Verify service discovery
3. Check network connectivity
4. Review service logs

### Alerts Not Firing

1. Check Alertmanager configuration
2. Verify alert rules syntax
3. Check Prometheus evaluation
4. Test alert routing

### High Alert Volume

1. Review alert thresholds
2. Adjust grouping rules
3. Add inhibition rules
4. Consolidate similar alerts

---

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)

---

**Last Updated**: January 2025

