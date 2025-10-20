use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use tracing::{info, warn, error, debug, instrument, Level};
use sqlx::{PgPool, Row};

use crate::metrics::MetricsService;
use crate::audit::{AuditLogger, AuditAction, AuditResource, AuditResult};

/// Log levels for structured logging
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
    Fatal,
}

impl From<Level> for LogLevel {
    fn from(level: Level) -> Self {
        match level {
            Level::TRACE => LogLevel::Trace,
            Level::DEBUG => LogLevel::Debug,
            Level::INFO => LogLevel::Info,
            Level::WARN => LogLevel::Warn,
            Level::ERROR => LogLevel::Error,
        }
    }
}

/// Structured log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub level: LogLevel,
    pub message: String,
    pub module: String,
    pub function: Option<String>,
    pub user_id: Option<Uuid>,
    pub session_id: Option<String>,
    pub request_id: Option<String>,
    pub trace_id: Option<String>,
    pub span_id: Option<String>,
    pub context: HashMap<String, serde_json::Value>,
    pub error_details: Option<ErrorDetails>,
    pub performance_metrics: Option<PerformanceMetrics>,
}

/// Error details for structured error logging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorDetails {
    pub error_type: String,
    pub error_code: Option<String>,
    pub stack_trace: Option<String>,
    pub error_chain: Vec<String>,
    pub recovery_suggestions: Vec<String>,
}

/// Performance metrics for log entries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub duration_ms: Option<f64>,
    pub memory_usage_mb: Option<f64>,
    pub cpu_usage_percent: Option<f64>,
    pub database_queries: Option<u32>,
    pub cache_hits: Option<u32>,
    pub cache_misses: Option<u32>,
}

/// Health check status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

/// Health check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheck {
    pub name: String,
    pub status: HealthStatus,
    pub message: String,
    pub details: Option<serde_json::Value>,
    pub response_time_ms: f64,
    pub last_checked: DateTime<Utc>,
}

/// System health summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHealth {
    pub overall_status: HealthStatus,
    pub checks: Vec<HealthCheck>,
    pub uptime_seconds: u64,
    pub version: String,
    pub environment: String,
    pub last_updated: DateTime<Utc>,
}

/// Alert severity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AlertSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Alert types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertType {
    SystemError,
    PerformanceDegradation,
    SecurityViolation,
    ResourceExhaustion,
    BusinessRuleViolation,
    DataIntegrity,
    ExternalServiceFailure,
}

/// Alert configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertConfig {
    pub id: String,
    pub name: String,
    pub alert_type: AlertType,
    pub severity: AlertSeverity,
    pub enabled: bool,
    pub threshold: Option<f64>,
    pub condition: String,
    pub notification_channels: Vec<String>,
    pub cooldown_minutes: u32,
    pub last_triggered: Option<DateTime<Utc>>,
}

/// Alert instance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub id: Uuid,
    pub config_id: String,
    pub title: String,
    pub message: String,
    pub severity: AlertSeverity,
    pub alert_type: AlertType,
    pub triggered_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub acknowledged_by: Option<Uuid>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub context: HashMap<String, serde_json::Value>,
    pub notifications_sent: Vec<String>,
}

/// Monitoring service that coordinates logging, metrics, and alerting
pub struct MonitoringService {
    pub metrics_service: Arc<MetricsService>,
    pub audit_logger: Arc<AuditLogger>,
    pub database_pool: PgPool,
    pub alerts: HashMap<String, AlertConfig>,
    pub start_time: SystemTime,
}

impl MonitoringService {
    /// Create a new monitoring service
    pub async fn new(database_pool: PgPool) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let metrics_service = Arc::new(MetricsService::new()?);
        let audit_logger = Arc::new(AuditLogger::new(database_pool.clone()));
        
        // Initialize default alert configurations
        let mut alerts = HashMap::new();
        alerts.insert("high_error_rate".to_string(), AlertConfig {
            id: "high_error_rate".to_string(),
            name: "High Error Rate".to_string(),
            alert_type: AlertType::SystemError,
            severity: AlertSeverity::High,
            enabled: true,
            threshold: Some(0.05), // 5% error rate
            condition: "error_rate > 0.05".to_string(),
            notification_channels: vec!["email".to_string(), "slack".to_string()],
            cooldown_minutes: 15,
            last_triggered: None,
        });
        
        alerts.insert("database_connection_failure".to_string(), AlertConfig {
            id: "database_connection_failure".to_string(),
            name: "Database Connection Failure".to_string(),
            alert_type: AlertType::ExternalServiceFailure,
            severity: AlertSeverity::Critical,
            enabled: true,
            threshold: None,
            condition: "database_connections_active == 0".to_string(),
            notification_channels: vec!["email".to_string(), "sms".to_string()],
            cooldown_minutes: 5,
            last_triggered: None,
        });
        
        alerts.insert("high_memory_usage".to_string(), AlertConfig {
            id: "high_memory_usage".to_string(),
            name: "High Memory Usage".to_string(),
            alert_type: AlertType::ResourceExhaustion,
            severity: AlertSeverity::Medium,
            enabled: true,
            threshold: Some(0.85), // 85% memory usage
            condition: "memory_usage > 0.85".to_string(),
            notification_channels: vec!["email".to_string()],
            cooldown_minutes: 30,
            last_triggered: None,
        });
        
        Ok(Self {
            metrics_service,
            audit_logger,
            database_pool,
            alerts,
            start_time: SystemTime::now(),
        })
    }
    
    /// Log a structured log entry
    #[instrument(skip(self))]
    pub async fn log(&self, entry: LogEntry) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Store log entry in database
        sqlx::query(
            "INSERT INTO application_logs (
                id, timestamp, level, message, module, function, user_id, 
                session_id, request_id, trace_id, span_id, context, 
                error_details, performance_metrics
            ) VALUES ($1, $2, $3::log_level, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)"
        )
        .bind(entry.id)
        .bind(entry.timestamp)
        .bind(serde_json::to_value(&entry.level)?)
        .bind(&entry.message)
        .bind(&entry.module)
        .bind(entry.function.as_ref())
        .bind(entry.user_id)
        .bind(entry.session_id.as_ref())
        .bind(entry.request_id.as_ref())
        .bind(entry.trace_id.as_ref())
        .bind(entry.span_id.as_ref())
        .bind(serde_json::to_value(&entry.context)?)
        .bind(entry.error_details.as_ref().map(|e| serde_json::to_value(e)).transpose()?)
        .bind(entry.performance_metrics.as_ref().map(|p| serde_json::to_value(p)).transpose()?)
        .execute(&self.database_pool)
        .await?;
        
        // Update metrics based on log level
        match entry.level {
            LogLevel::Error | LogLevel::Fatal => {
                self.metrics_service.record_audit_event("error", "high", "logged");
            }
            LogLevel::Warn => {
                self.metrics_service.record_audit_event("warning", "medium", "logged");
            }
            _ => {
                self.metrics_service.record_audit_event("info", "low", "logged");
            }
        }
        
        // Check for alerts
        self.check_alerts(&entry).await?;
        
        Ok(())
    }
    
    /// Create a log entry builder
    pub fn log_builder() -> LogEntryBuilder {
        LogEntryBuilder::new()
    }
    
    /// Perform system health checks
    #[instrument(skip(self))]
    pub async fn perform_health_checks(&self) -> Result<SystemHealth, Box<dyn std::error::Error + Send + Sync>> {
        let mut checks = Vec::new();
        
        // Database health check
        let db_start = Instant::now();
        let db_health = match sqlx::query("SELECT 1").fetch_one(&self.database_pool).await {
            Ok(_) => HealthCheck {
                name: "database".to_string(),
                status: HealthStatus::Healthy,
                message: "Database connection is healthy".to_string(),
                details: None,
                response_time_ms: db_start.elapsed().as_millis() as f64,
                last_checked: Utc::now(),
            },
            Err(e) => HealthCheck {
                name: "database".to_string(),
                status: HealthStatus::Unhealthy,
                message: format!("Database connection failed: {}", e),
                details: Some(serde_json::json!({"error": e.to_string()})),
                response_time_ms: db_start.elapsed().as_millis() as f64,
                last_checked: Utc::now(),
            },
        };
        checks.push(db_health);
        
        // Memory health check
        let memory_usage = self.get_memory_usage();
        let memory_health = HealthCheck {
            name: "memory".to_string(),
            status: if memory_usage > 0.9 {
                HealthStatus::Unhealthy
            } else if memory_usage > 0.8 {
                HealthStatus::Degraded
            } else {
                HealthStatus::Healthy
            },
            message: format!("Memory usage: {:.1}%", memory_usage * 100.0),
            details: Some(serde_json::json!({"usage_percent": memory_usage})),
            response_time_ms: 0.0,
            last_checked: Utc::now(),
        };
        checks.push(memory_health);
        
        // Determine overall status
        let overall_status = if checks.iter().any(|c| c.status == HealthStatus::Unhealthy) {
            HealthStatus::Unhealthy
        } else if checks.iter().any(|c| c.status == HealthStatus::Degraded) {
            HealthStatus::Degraded
        } else {
            HealthStatus::Healthy
        };
        
        let uptime = self.start_time.elapsed().unwrap_or(Duration::from_secs(0));
        
        Ok(SystemHealth {
            overall_status,
            checks,
            uptime_seconds: uptime.as_secs(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            environment: std::env::var("ENVIRONMENT").unwrap_or_else(|_| "development".to_string()),
            last_updated: Utc::now(),
        })
    }
    
    /// Get current memory usage
    fn get_memory_usage(&self) -> f64 {
        // This is a simplified implementation
        // In a real system, you'd use system APIs to get actual memory usage
        0.0 // Placeholder
    }
    
    /// Check for alerts based on log entry
    async fn check_alerts(&self, entry: &LogEntry) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        for (config_id, config) in &self.alerts {
            if !config.enabled {
                continue;
            }
            
            // Check if alert should be triggered
            let should_trigger = match config.alert_type {
                AlertType::SystemError => {
                    entry.level == LogLevel::Error || entry.level == LogLevel::Fatal
                }
                AlertType::SecurityViolation => {
                    entry.message.to_lowercase().contains("security") ||
                    entry.message.to_lowercase().contains("unauthorized") ||
                    entry.message.to_lowercase().contains("forbidden")
                }
                _ => false,
            };
            
            if should_trigger {
                // Check cooldown
                let can_trigger = if let Some(last_triggered) = config.last_triggered {
                    let cooldown_duration = Duration::from_secs(config.cooldown_minutes as u64 * 60);
                    Utc::now() - last_triggered > chrono::Duration::seconds(config.cooldown_minutes as i64 * 60)
                } else {
                    true
                };
                
                if can_trigger {
                    self.trigger_alert(config, entry).await?;
                }
            }
        }
        
        Ok(())
    }
    
    /// Trigger an alert
    async fn trigger_alert(&self, config: &AlertConfig, entry: &LogEntry) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let alert = Alert {
            id: Uuid::new_v4(),
            config_id: config.id.clone(),
            title: config.name.clone(),
            message: format!("Alert triggered: {}", entry.message),
            severity: config.severity.clone(),
            alert_type: config.alert_type.clone(),
            triggered_at: Utc::now(),
            resolved_at: None,
            acknowledged_by: None,
            acknowledged_at: None,
            context: entry.context.clone(),
            notifications_sent: Vec::new(),
        };
        
        // Store alert in database
        sqlx::query(
            "INSERT INTO alerts (
                id, config_id, title, message, severity, alert_type, 
                triggered_at, context, notifications_sent
            ) VALUES ($1, $2, $3, $4, $5::alert_severity, $6::alert_type, $7, $8, $9)"
        )
        .bind(alert.id)
        .bind(&alert.config_id)
        .bind(&alert.title)
        .bind(&alert.message)
        .bind(serde_json::to_value(&alert.severity)?)
        .bind(serde_json::to_value(&alert.alert_type)?)
        .bind(alert.triggered_at)
        .bind(serde_json::to_value(&alert.context)?)
        .bind(serde_json::to_value(&alert.notifications_sent)?)
        .execute(&self.database_pool)
        .await?;
        
        // Send notifications (placeholder)
        for channel in &config.notification_channels {
            info!("Sending alert notification via {}", channel);
            // In a real implementation, you'd integrate with notification services
        }
        
        // Update metrics
        self.metrics_service.record_audit_event("alert", "high", "triggered");
        
        Ok(())
    }
    
    /// Get recent alerts
    pub async fn get_recent_alerts(&self, limit: Option<i64>) -> Result<Vec<Alert>, sqlx::Error> {
        let limit = limit.unwrap_or(50);
        
        let rows = sqlx::query(
            "SELECT id, config_id, title, message, severity, alert_type, 
             triggered_at, resolved_at, acknowledged_by, acknowledged_at, 
             context, notifications_sent 
             FROM alerts 
             ORDER BY triggered_at DESC 
             LIMIT $1"
        )
        .bind(limit)
        .fetch_all(&self.database_pool)
        .await?;
        
        let mut alerts = Vec::new();
        for row in rows {
            let alert = Alert {
                id: row.get("id"),
                config_id: row.get("config_id"),
                title: row.get("title"),
                message: row.get("message"),
                severity: serde_json::from_value(row.get("severity")).map_err(|e| sqlx::Error::Decode(Box::new(e)))?,
                alert_type: serde_json::from_value(row.get("alert_type")).map_err(|e| sqlx::Error::Decode(Box::new(e)))?,
                triggered_at: row.get("triggered_at"),
                resolved_at: row.get("resolved_at"),
                acknowledged_by: row.get("acknowledged_by"),
                acknowledged_at: row.get("acknowledged_at"),
                context: serde_json::from_value(row.get("context")).map_err(|e| sqlx::Error::Decode(Box::new(e)))?,
                notifications_sent: serde_json::from_value(row.get("notifications_sent")).map_err(|e| sqlx::Error::Decode(Box::new(e)))?,
            };
            alerts.push(alert);
        }
        
        Ok(alerts)
    }
    
    /// Get log statistics
    pub async fn get_log_statistics(&self, hours: i64) -> Result<HashMap<String, i64>, sqlx::Error> {
        let start_time = Utc::now() - chrono::Duration::hours(hours);
        
        let rows = sqlx::query(
            "SELECT level, COUNT(*) as count 
             FROM application_logs 
             WHERE timestamp >= $1 
             GROUP BY level 
             ORDER BY count DESC"
        )
        .bind(start_time)
        .fetch_all(&self.database_pool)
        .await?;
        
        let mut stats = HashMap::new();
        for row in rows {
            let level: serde_json::Value = row.get("level");
            let count: i64 = row.get("count");
            stats.insert(level.to_string(), count);
        }
        
        Ok(stats)
    }
}

/// Log entry builder for fluent logging
pub struct LogEntryBuilder {
    entry: LogEntry,
}

impl LogEntryBuilder {
    pub fn new() -> Self {
        Self {
            entry: LogEntry {
                id: Uuid::new_v4(),
                timestamp: Utc::now(),
                level: LogLevel::Info,
                message: String::new(),
                module: String::new(),
                function: None,
                user_id: None,
                session_id: None,
                request_id: None,
                trace_id: None,
                span_id: None,
                context: HashMap::new(),
                error_details: None,
                performance_metrics: None,
            },
        }
    }
    
    pub fn level(mut self, level: LogLevel) -> Self {
        self.entry.level = level;
        self
    }
    
    pub fn message(mut self, message: impl Into<String>) -> Self {
        self.entry.message = message.into();
        self
    }
    
    pub fn module(mut self, module: impl Into<String>) -> Self {
        self.entry.module = module.into();
        self
    }
    
    pub fn function(mut self, function: impl Into<String>) -> Self {
        self.entry.function = Some(function.into());
        self
    }
    
    pub fn user_id(mut self, user_id: Uuid) -> Self {
        self.entry.user_id = Some(user_id);
        self
    }
    
    pub fn session_id(mut self, session_id: impl Into<String>) -> Self {
        self.entry.session_id = Some(session_id.into());
        self
    }
    
    pub fn request_id(mut self, request_id: impl Into<String>) -> Self {
        self.entry.request_id = Some(request_id.into());
        self
    }
    
    pub fn trace_id(mut self, trace_id: impl Into<String>) -> Self {
        self.entry.trace_id = Some(trace_id.into());
        self
    }
    
    pub fn span_id(mut self, span_id: impl Into<String>) -> Self {
        self.entry.span_id = Some(span_id.into());
        self
    }
    
    pub fn context(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.entry.context.insert(key.into(), value);
        self
    }
    
    pub fn error_details(mut self, error_details: ErrorDetails) -> Self {
        self.entry.error_details = Some(error_details);
        self
    }
    
    pub fn performance_metrics(mut self, performance_metrics: PerformanceMetrics) -> Self {
        self.entry.performance_metrics = Some(performance_metrics);
        self
    }
    
    pub fn build(self) -> LogEntry {
        self.entry
    }
}

impl Default for LogEntryBuilder {
    fn default() -> Self {
        Self::new()
    }
}
