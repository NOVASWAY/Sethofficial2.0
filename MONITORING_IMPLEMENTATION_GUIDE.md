# 📊 Comprehensive Monitoring and Logging System Implementation Guide

## 🎯 **Overview**

The clinic management system now includes a comprehensive monitoring and logging infrastructure that provides:

- **Structured Logging**: Centralized logging with context, performance metrics, and error tracking
- **Metrics Collection**: Prometheus-compatible metrics for system and business KPIs
- **Health Monitoring**: Automated health checks for all system components
- **Alerting System**: Configurable alerts for critical events and performance issues
- **Performance Monitoring**: Request tracking, database query monitoring, and resource usage
- **Log Retention**: Automated cleanup and retention policies

---

## 🏗️ **Architecture Components**

### **1. Monitoring Service (`monitoring.rs`)**
- Centralized monitoring service that coordinates logging, metrics, and alerting
- Structured log entry management with context and performance data
- Health check orchestration and system status monitoring
- Alert configuration and triggering system

### **2. Metrics Service (`metrics.rs`)**
- Prometheus-compatible metrics collection
- HTTP request metrics (count, duration, status codes)
- Database performance metrics
- Business metrics (patients, consultations, appointments)
- System metrics (memory, CPU, uptime)
- Compliance and audit metrics

### **3. Audit System (`audit.rs`)**
- Comprehensive audit logging for all user actions
- Security event tracking
- Compliance reporting
- User activity monitoring

### **4. Monitoring Middleware (`monitoring_middleware.rs`)**
- Automatic request logging and metrics collection
- Database query monitoring
- Performance tracking
- Request context extraction

---

## 📊 **Database Schema**

### **Core Monitoring Tables**

#### **application_logs**
```sql
- id: UUID (Primary Key)
- timestamp: TIMESTAMPTZ
- level: log_level (trace, debug, info, warn, error, fatal)
- message: TEXT
- module: VARCHAR(255)
- function: VARCHAR(255)
- user_id: UUID (Foreign Key)
- session_id: VARCHAR(255)
- request_id: VARCHAR(255)
- trace_id: VARCHAR(255)
- span_id: VARCHAR(255)
- context: JSONB
- error_details: JSONB
- performance_metrics: JSONB
```

#### **health_checks**
```sql
- id: UUID (Primary Key)
- name: VARCHAR(255)
- status: health_status (healthy, degraded, unhealthy, unknown)
- message: TEXT
- details: JSONB
- response_time_ms: DECIMAL(10,3)
- last_checked: TIMESTAMPTZ
```

#### **alerts**
```sql
- id: UUID (Primary Key)
- config_id: VARCHAR(255)
- title: VARCHAR(255)
- message: TEXT
- severity: alert_severity (low, medium, high, critical)
- alert_type: alert_type (system_error, performance_degradation, etc.)
- triggered_at: TIMESTAMPTZ
- resolved_at: TIMESTAMPTZ
- acknowledged_by: UUID
- acknowledged_at: TIMESTAMPTZ
- context: JSONB
- notifications_sent: TEXT[]
```

#### **alert_configs**
```sql
- id: VARCHAR(255) (Primary Key)
- name: VARCHAR(255)
- alert_type: alert_type
- severity: alert_severity
- enabled: BOOLEAN
- threshold: DECIMAL(10,3)
- condition: TEXT
- notification_channels: TEXT[]
- cooldown_minutes: INTEGER
- last_triggered: TIMESTAMPTZ
```

#### **system_metrics**
```sql
- id: UUID (Primary Key)
- metric_name: VARCHAR(255)
- metric_value: DECIMAL(15,6)
- metric_labels: JSONB
- timestamp: TIMESTAMPTZ
```

#### **performance_metrics**
```sql
- id: UUID (Primary Key)
- operation_name: VARCHAR(255)
- duration_ms: DECIMAL(10,3)
- memory_usage_mb: DECIMAL(10,3)
- cpu_usage_percent: DECIMAL(5,2)
- database_queries: INTEGER
- cache_hits: INTEGER
- cache_misses: INTEGER
- user_id: UUID
- session_id: VARCHAR(255)
- request_id: VARCHAR(255)
- context: JSONB
- timestamp: TIMESTAMPTZ
```

#### **log_retention_policies**
```sql
- id: UUID (Primary Key)
- log_type: VARCHAR(255)
- retention_days: INTEGER
- enabled: BOOLEAN
- last_cleanup: TIMESTAMPTZ
```

---

## 🔧 **API Endpoints**

### **Logging Endpoints**
- `POST /api/v1/monitoring/logs` - Create structured log entry
- `GET /api/v1/monitoring/logs/statistics` - Get log statistics

### **Health Monitoring**
- `GET /api/v1/monitoring/health` - Get system health status

### **Alerting**
- `GET /api/v1/monitoring/alerts` - Get recent alerts
- `GET /api/v1/monitoring/alerts/configs` - Get alert configurations
- `POST /api/v1/monitoring/alerts/configs` - Create alert configuration
- `PUT /api/v1/monitoring/alerts/configs/{id}` - Update alert configuration
- `DELETE /api/v1/monitoring/alerts/configs/{id}` - Delete alert configuration
- `POST /api/v1/monitoring/alerts/{id}/acknowledge` - Acknowledge alert
- `POST /api/v1/monitoring/alerts/{id}/resolve` - Resolve alert

### **Metrics and Performance**
- `GET /api/v1/monitoring/performance` - Get performance metrics
- `GET /api/v1/monitoring/system` - Get system metrics
- `GET /api/v1/monitoring/dashboard` - Get monitoring dashboard data

### **Maintenance**
- `POST /api/v1/monitoring/cleanup` - Trigger log cleanup

---

## 🚨 **Default Alert Configurations**

The system comes with pre-configured alerts for common issues:

### **High Error Rate**
- **Type**: System Error
- **Severity**: High
- **Threshold**: 5% error rate
- **Channels**: Email, Slack
- **Cooldown**: 15 minutes

### **Database Connection Failure**
- **Type**: External Service Failure
- **Severity**: Critical
- **Condition**: No active database connections
- **Channels**: Email, SMS
- **Cooldown**: 5 minutes

### **High Memory Usage**
- **Type**: Resource Exhaustion
- **Severity**: Medium
- **Threshold**: 85% memory usage
- **Channels**: Email
- **Cooldown**: 30 minutes

### **Slow Response Time**
- **Type**: Performance Degradation
- **Severity**: Medium
- **Threshold**: 2 seconds average response time
- **Channels**: Email
- **Cooldown**: 20 minutes

### **Security Violation**
- **Type**: Security Violation
- **Severity**: High
- **Condition**: Any security-related events
- **Channels**: Email, SMS
- **Cooldown**: 10 minutes

---

## 📈 **Log Retention Policies**

Default retention periods:
- **Application Logs**: 30 days
- **Audit Logs**: 90 days
- **Performance Metrics**: 7 days
- **System Metrics**: 14 days
- **Alerts**: 60 days
- **Health Checks**: 7 days

---

## 🔍 **Usage Examples**

### **Creating a Structured Log Entry**
```rust
use crate::monitoring::{LogLevel, LogEntryBuilder, PerformanceMetrics};

let log_entry = LogEntryBuilder::new()
    .level(LogLevel::Info)
    .message("User login successful")
    .module("auth")
    .function("login")
    .user_id(user_id)
    .session_id(session_id)
    .request_id(request_id)
    .context("ip_address", serde_json::Value::String(ip_address))
    .context("user_agent", serde_json::Value::String(user_agent))
    .performance_metrics(PerformanceMetrics {
        duration_ms: Some(150.0),
        database_queries: Some(2),
        ..Default::default()
    })
    .build();

monitoring_service.log(log_entry).await?;
```

### **Recording Metrics**
```rust
// HTTP request metrics
metrics_service.record_http_request("GET", "/api/v1/patients", 200, duration);

// Database query metrics
metrics_service.record_database_query("SELECT", "patients", "success", duration);

// Business metrics
metrics_service.update_patients_count(1250);
metrics_service.update_consultations_count(3450);
```

### **Performing Health Checks**
```rust
let health = monitoring_service.perform_health_checks().await?;
match health.overall_status {
    HealthStatus::Healthy => println!("System is healthy"),
    HealthStatus::Degraded => println!("System is degraded"),
    HealthStatus::Unhealthy => println!("System is unhealthy"),
    HealthStatus::Unknown => println!("System status unknown"),
}
```

---

## 🛠️ **Configuration**

### **Environment Variables**
```bash
# Monitoring Configuration
MONITORING_ENABLED=true
LOG_LEVEL=info
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=60
ALERT_COOLDOWN_MINUTES=15

# Log Retention
LOG_RETENTION_DAYS=30
AUDIT_RETENTION_DAYS=90
PERFORMANCE_RETENTION_DAYS=7

# Alerting
ALERT_EMAIL_ENABLED=true
ALERT_SLACK_ENABLED=true
ALERT_SMS_ENABLED=false
```

### **Database Configuration**
The monitoring system automatically creates the required database tables and indexes. Ensure your database user has the necessary permissions to create tables and indexes.

---

## 📊 **Monitoring Dashboard**

The system provides a comprehensive monitoring dashboard accessible via:
`GET /api/v1/monitoring/dashboard`

This endpoint returns:
- System health status
- Recent alerts
- Log statistics (24h)
- Performance metrics
- System resource usage

---

## 🔧 **Maintenance**

### **Log Cleanup**
The system includes automated log cleanup based on retention policies. You can also trigger manual cleanup:
```bash
curl -X POST http://localhost:8080/api/v1/monitoring/cleanup
```

### **Database Maintenance**
Regular maintenance tasks:
- Monitor disk usage for log tables
- Review and adjust retention policies
- Analyze alert patterns and adjust thresholds
- Review performance metrics for optimization opportunities

---

## 🚀 **Integration with External Tools**

### **Prometheus Integration**
The metrics service provides Prometheus-compatible metrics that can be scraped by Prometheus:
```yaml
scrape_configs:
  - job_name: 'clinic-management'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### **Grafana Dashboards**
Create Grafana dashboards using the collected metrics:
- HTTP request rates and response times
- Database query performance
- System resource usage
- Business metrics (patient registrations, consultations)
- Error rates and alert status

### **Log Aggregation**
The structured logs can be integrated with log aggregation systems:
- **ELK Stack**: Elasticsearch, Logstash, Kibana
- **Fluentd**: For log forwarding
- **Splunk**: For enterprise log analysis

---

## 🔒 **Security Considerations**

### **Log Security**
- Sensitive data is not logged in plain text
- User passwords and tokens are excluded from logs
- IP addresses and user agents are logged for security analysis
- Log access is restricted to authorized personnel

### **Alert Security**
- Alert configurations are protected by authentication
- Sensitive alert information is encrypted
- Alert notifications use secure channels

---

## 📋 **Best Practices**

### **Logging**
1. Use appropriate log levels (trace, debug, info, warn, error, fatal)
2. Include relevant context in log entries
3. Avoid logging sensitive information
4. Use structured logging for better analysis

### **Metrics**
1. Define meaningful metric names and labels
2. Set appropriate alert thresholds
3. Monitor business metrics alongside technical metrics
4. Regular review and adjustment of metrics

### **Alerting**
1. Set realistic alert thresholds
2. Use appropriate cooldown periods
3. Configure multiple notification channels
4. Regularly review and tune alert rules

### **Performance**
1. Monitor database query performance
2. Track memory and CPU usage
3. Monitor response times
4. Set up performance regression alerts

---

## 🎯 **Next Steps**

1. **Set up external monitoring tools** (Prometheus, Grafana)
2. **Configure notification channels** (email, Slack, SMS)
3. **Create custom dashboards** for different user roles
4. **Set up log aggregation** for centralized log analysis
5. **Implement custom health checks** for business logic
6. **Create monitoring runbooks** for incident response

---

## 📞 **Support**

For issues or questions about the monitoring system:
1. Check the application logs for error details
2. Review the health check status
3. Examine recent alerts for patterns
4. Consult the API documentation for endpoint details

The monitoring system is designed to be self-diagnosing and provides comprehensive visibility into system health and performance.
