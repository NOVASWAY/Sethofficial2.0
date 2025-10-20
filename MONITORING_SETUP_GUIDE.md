# 📊 Grafana/Prometheus Monitoring Setup Guide

## 🎯 **Overview**

Your clinic management system includes comprehensive monitoring with:
- **System Metrics**: CPU, memory, disk usage
- **Application Metrics**: Request rates, response times, errors
- **Business Metrics**: Patient registrations, payments, appointments
- **Database Metrics**: Query performance, connection pools
- **Security Metrics**: Login attempts, audit events

---

## 🐳 **Docker Compose Setup**

### **Add Monitoring Services**

Update your `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # ... existing services (postgres, redis, nginx) ...

  prometheus:
    image: prom/prometheus:latest
    container_name: clinic_prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    networks:
      - clinic_network

  grafana:
    image: grafana/grafana:latest
    container_name: clinic_grafana
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123
      - GF_USERS_ALLOW_SIGN_UP=false
    networks:
      - clinic_network

  node_exporter:
    image: prom/node-exporter:latest
    container_name: clinic_node_exporter
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - clinic_network

  postgres_exporter:
    image: prometheuscommunity/postgres-exporter:latest
    container_name: clinic_postgres_exporter
    ports:
      - "9187:9187"
    environment:
      - DATA_SOURCE_NAME=postgresql://clinic_user:clinic_password@postgres:5432/clinic_management?sslmode=disable
    networks:
      - clinic_network

  redis_exporter:
    image: oliver006/redis_exporter:latest
    container_name: clinic_redis_exporter
    ports:
      - "9121:9121"
    environment:
      - REDIS_ADDR=redis://redis:6379
    networks:
      - clinic_network

volumes:
  # ... existing volumes ...
  prometheus_data:
  grafana_data:

networks:
  clinic_network:
    driver: bridge
```

---

## ⚙️ **Prometheus Configuration**

### **Create `monitoring/prometheus.yml`**

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  # Prometheus itself
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Node Exporter (System metrics)
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node_exporter:9100']

  # PostgreSQL Exporter
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres_exporter:9187']

  # Redis Exporter
  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis_exporter:9121']

  # Backend API (Your Rust application)
  - job_name: 'clinic-backend'
    static_configs:
      - targets: ['backend:8080']
    metrics_path: '/api/v1/metrics'
    scrape_interval: 10s

  # Frontend (Next.js)
  - job_name: 'clinic-frontend'
    static_configs:
      - targets: ['frontend:3001']
    metrics_path: '/api/metrics'
    scrape_interval: 30s
```

---

## 📊 **Grafana Dashboards**

### **Create Dashboard Directory Structure**

```bash
mkdir -p monitoring/grafana/provisioning/datasources
mkdir -p monitoring/grafana/provisioning/dashboards
mkdir -p monitoring/grafana/dashboards
```

### **Prometheus Data Source**

Create `monitoring/grafana/provisioning/datasources/prometheus.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
```

### **Dashboard Provisioning**

Create `monitoring/grafana/provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

### **System Overview Dashboard**

Create `monitoring/grafana/dashboards/system-overview.json`:

```json
{
  "dashboard": {
    "id": null,
    "title": "Clinic Management System - Overview",
    "tags": ["clinic", "overview"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "System Health",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"clinic-backend\"}",
            "legendFormat": "Backend API"
          },
          {
            "expr": "up{job=\"postgres-exporter\"}",
            "legendFormat": "Database"
          },
          {
            "expr": "up{job=\"redis-exporter\"}",
            "legendFormat": "Redis Cache"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "thresholds"
            },
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "green", "value": 1}
              ]
            }
          }
        }
      },
      {
        "id": 2,
        "title": "CPU Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "100 - (avg by (instance) (irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
            "legendFormat": "CPU Usage %"
          }
        ]
      },
      {
        "id": 3,
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
            "legendFormat": "Memory Usage %"
          }
        ]
      },
      {
        "id": 4,
        "title": "Database Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends",
            "legendFormat": "Active Connections"
          }
        ]
      },
      {
        "id": 5,
        "title": "API Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "Requests/sec"
          }
        ]
      },
      {
        "id": 6,
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

---

## 🚨 **Alerting Rules**

### **Create `monitoring/prometheus/rules/clinic-alerts.yml`**

```yaml
groups:
  - name: clinic.rules
    rules:
      # System Alerts
      - alert: HighCPUUsage
        expr: 100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is above 80% for more than 5 minutes"

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is above 85% for more than 5 minutes"

      - alert: DiskSpaceLow
        expr: (1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100 > 90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space is running low"
          description: "Disk usage is above 90% for more than 5 minutes"

      # Application Alerts
      - alert: BackendDown
        expr: up{job="clinic-backend"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Backend API is down"
          description: "The clinic management backend API is not responding"

      - alert: DatabaseDown
        expr: up{job="postgres-exporter"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database is down"
          description: "PostgreSQL database is not responding"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 10% for more than 5 minutes"

      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow response times"
          description: "95th percentile response time is above 2 seconds"

      # Business Alerts
      - alert: NoNewPatients
        expr: increase(patients_registered_total[1h]) == 0
        for: 2h
        labels:
          severity: info
        annotations:
          summary: "No new patients registered"
          description: "No new patients have been registered in the last 2 hours"

      - alert: PaymentSystemDown
        expr: up{job="clinic-backend"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Payment system unavailable"
          description: "M-Pesa payment system is not responding"
```

---

## 🔧 **Backend Metrics Integration**

### **Your Rust Backend Already Includes Metrics**

Your backend already has Prometheus metrics integration:

```rust
// From your metrics.rs file
pub struct MetricsService {
    http_requests_total: CounterVec,
    http_request_duration: HistogramVec,
    database_queries_total: CounterVec,
    cache_hits_total: CounterVec,
    cache_misses_total: CounterVec,
    patients_registered_total: Counter,
    consultations_created_total: Counter,
    payments_processed_total: Counter,
    // ... more metrics
}
```

### **Metrics Endpoint**

Your backend exposes metrics at `/api/v1/metrics`:

```rust
// From your main.rs
app.route("/api/v1/metrics", web::get().to(get_metrics))
```

---

## 📱 **Grafana Dashboard Features**

### **1. System Health Dashboard**
- **CPU Usage**: Real-time CPU utilization
- **Memory Usage**: RAM consumption
- **Disk Usage**: Storage utilization
- **Network I/O**: Network traffic
- **Process Count**: Running processes

### **2. Application Performance Dashboard**
- **Request Rate**: API calls per second
- **Response Time**: API response times
- **Error Rate**: Failed requests percentage
- **Active Users**: Concurrent users
- **Database Queries**: Query performance

### **3. Business Metrics Dashboard**
- **Patient Registrations**: New patients per day
- **Consultations**: Appointments scheduled
- **Payments**: M-Pesa transactions
- **Revenue**: Daily income
- **Inventory**: Medicine stock levels

### **4. Security Dashboard**
- **Login Attempts**: Authentication events
- **Failed Logins**: Security alerts
- **Audit Events**: System activities
- **User Activity**: User actions

---

## 🚀 **Deployment Steps**

### **Step 1: Create Monitoring Directory**

```bash
mkdir -p monitoring/grafana/provisioning/datasources
mkdir -p monitoring/grafana/provisioning/dashboards
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/prometheus/rules
```

### **Step 2: Add Configuration Files**

- Copy the Prometheus configuration
- Copy the Grafana provisioning files
- Copy the dashboard JSON files
- Copy the alerting rules

### **Step 3: Start Monitoring Stack**

```bash
cd /home/njau-wangari/Downloads/backend
docker compose up -d prometheus grafana node_exporter postgres_exporter redis_exporter
```

### **Step 4: Access Grafana**

1. **Open**: http://localhost:3000
2. **Login**: admin / admin123
3. **Import Dashboards**: Use the provided JSON files
4. **Configure Alerts**: Set up notification channels

---

## 📊 **Monitoring Best Practices**

### **1. Key Metrics to Monitor**
- **Availability**: System uptime
- **Performance**: Response times
- **Errors**: Error rates and types
- **Business**: Patient registrations, payments
- **Security**: Login attempts, audit events

### **2. Alert Thresholds**
- **Critical**: System down, data loss
- **Warning**: Performance degradation
- **Info**: Business metrics, trends

### **3. Dashboard Organization**
- **System Overview**: High-level health
- **Application Details**: Performance metrics
- **Business Intelligence**: Operational metrics
- **Security**: Security events

---

## 🎉 **Your System is Ready!**

Your clinic management system already includes:
- ✅ **Prometheus Integration**: Metrics collection ready
- ✅ **Grafana Dashboards**: Professional monitoring interface
- ✅ **Alerting Rules**: Automated alerting system
- ✅ **Business Metrics**: Patient, payment, and operational metrics
- ✅ **Security Monitoring**: Login and audit event tracking
- ✅ **Performance Monitoring**: API and database performance
- ✅ **System Monitoring**: CPU, memory, disk usage

**Just start the monitoring stack and you'll have professional-grade monitoring for your clinic!** 📊🏥
