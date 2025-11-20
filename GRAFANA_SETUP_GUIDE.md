# Grafana Setup Guide

**Date**: Generated automatically  
**Status**: Complete Grafana configuration guide

---

## ✅ Grafana Stack Configuration

The Grafana monitoring stack is now fully configured with:
- ✅ Secure credentials
- ✅ Comprehensive dashboards
- ✅ Proper datasource configuration
- ✅ Dashboard provisioning

---

## 🔐 Credentials

### Default Credentials
- **Username**: `admin`
- **Password**: `7FVcqxgSOq/PyH21Q3MsxkxfeHmLsjh6` (secure, randomly generated)

### Change Password
1. Login to Grafana: http://localhost:3002
2. Go to: Configuration → Users → Admin User
3. Click "Change Password"
4. Update `.env` file with new password:
   ```bash
   GRAFANA_ADMIN_PASSWORD=your_new_password
   ```

---

## 📊 Configured Dashboards

### 1. System Overview Dashboard
**File**: `monitoring/grafana/dashboards/clinic-system-overview.json`
- System Health Status (Backend, Database, Redis)
- HTTP Request Rate
- Response Time (p95)
- Active Patients Count
- Database Connections
- Cache Hit Ratio
- Error Rate (4xx, 5xx)

### 2. Performance Metrics Dashboard
**File**: `monitoring/grafana/dashboards/clinic-performance.json`
- Request Rate by Endpoint
- Response Time Percentiles (p50, p95, p99)
- Database Query Duration
- Database Query Rate
- Cache Operations
- Memory Usage

### 3. Business Metrics Dashboard
**File**: `monitoring/grafana/dashboards/clinic-business-metrics.json`
- Total Patients
- Total Consultations
- Total Appointments
- Total Prescriptions
- Total Invoices
- Compliance Score
- Audit Events

### 4. Database Metrics Dashboard
**File**: `monitoring/grafana/dashboards/clinic-database-metrics.json`
- Active Database Connections
- Database Query Rate
- Database Query Duration (p95)
- Database Query Errors

### 5. Cache Metrics Dashboard
**File**: `monitoring/grafana/dashboards/clinic-cache-metrics.json`
- Cache Hit Ratio (Gauge)
- Cache Size
- Cache Operations Rate
- Cache Operations by Status (Hits/Misses)

---

## 🔧 Configuration Files

### Grafana Configuration
- **Docker Compose**: `monitoring-docker-compose.yml`
- **Datasource**: `monitoring/grafana/datasources/prometheus.yml`
- **Dashboard Provisioning**: `monitoring/grafana/provisioning/dashboards/dashboard.yml`

### Prometheus Configuration
- **Config**: `monitoring/prometheus.yml`
- **Backend Metrics**: Scrapes from `backend:8080/metrics`

---

## 🚀 Starting Grafana Stack

### Start Monitoring Services
```bash
# Start Grafana and Prometheus
docker-compose -f monitoring-docker-compose.yml up -d

# Check status
docker-compose -f monitoring-docker-compose.yml ps

# View logs
docker-compose -f monitoring-docker-compose.yml logs -f grafana
```

### Access URLs
- **Grafana**: http://localhost:3002
- **Prometheus**: http://localhost:9090
- **Node Exporter**: http://localhost:9100/metrics

---

## 📋 Dashboard Details

### Dashboard Auto-Provisioning
Dashboards are automatically provisioned from:
- **Path**: `/var/lib/grafana/dashboards`
- **Folder**: "Clinic Management"
- **Update Interval**: 10 seconds
- **Editable**: Yes (changes persist)

### Dashboard Features
- ✅ Real-time metrics (30s refresh)
- ✅ Time range selection
- ✅ Export/Import capability
- ✅ Customizable panels
- ✅ Alerting support
- ✅ Annotation support

---

## 🔍 Metrics Available

### HTTP Metrics
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration histogram
- `http_requests_in_flight` - Current in-flight requests

### Database Metrics
- `database_connections_active` - Active connections
- `database_queries_total` - Total queries
- `database_query_duration_seconds` - Query duration

### Cache Metrics
- `cache_operations_total` - Cache operations
- `cache_hit_ratio` - Cache hit ratio (0-1)
- `cache_size` - Cache size in bytes

### Business Metrics
- `patients_total` - Total patients
- `consultations_total` - Total consultations
- `appointments_total` - Total appointments
- `prescriptions_total` - Total prescriptions
- `invoices_total` - Total invoices

### System Metrics
- `memory_usage` - Memory usage
- `cpu_usage` - CPU usage
- `uptime_seconds` - System uptime

### Compliance Metrics
- `audit_events_total` - Audit events
- `compliance_score` - Compliance score (0-100)
- `data_retention_operations` - Data retention ops

---

## 🎯 Using Dashboards

### Viewing Dashboards
1. Login to Grafana: http://localhost:3002
2. Navigate to: Dashboards → Browse
3. Select "Clinic Management" folder
4. Choose a dashboard

### Customizing Dashboards
1. Open any dashboard
2. Click "Settings" (gear icon)
3. Click "Edit" to modify panels
4. Changes are saved automatically

### Creating Alerts
1. Open a dashboard panel
2. Click "Edit"
3. Go to "Alert" tab
4. Configure alert conditions
5. Set notification channels

---

## 🔧 Troubleshooting

### Dashboard Not Showing
- Check dashboard files are in `monitoring/grafana/dashboards/`
- Verify JSON is valid: `python3 -m json.tool dashboard.json`
- Check Grafana logs: `docker-compose -f monitoring-docker-compose.yml logs grafana`
- Restart Grafana: `docker-compose -f monitoring-docker-compose.yml restart grafana`

### No Data in Dashboards
- Verify Prometheus is scraping: http://localhost:9090/targets
- Check backend metrics endpoint: http://localhost:8080/metrics
- Verify datasource connection in Grafana
- Check Prometheus configuration: `monitoring/prometheus.yml`

### Can't Login
- Default username: `admin`
- Check password in `.env` file: `GRAFANA_ADMIN_PASSWORD`
- Reset password: Delete `grafana_data` volume and restart

---

## 📝 Environment Variables

Add to `.env` file:
```bash
# Grafana Credentials
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=7FVcqxgSOq/PyH21Q3MsxkxfeHmLsjh6
```

---

## ✅ Verification Checklist

- [x] Grafana container running
- [x] Prometheus container running
- [x] Datasource configured
- [x] Dashboards provisioned
- [x] Secure credentials set
- [x] Backend metrics endpoint accessible
- [x] Prometheus scraping backend
- [x] All dashboards visible in Grafana

---

**Last Updated**: Generated automatically

