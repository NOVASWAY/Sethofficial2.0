use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use tracing::{info, warn, debug, error};

use crate::error::ApiError;

// Performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub timestamp: u64,
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub disk_usage: f64,
    pub network_io: NetworkMetrics,
    pub database_metrics: DatabaseMetrics,
    pub api_metrics: ApiMetrics,
    pub cache_metrics: CacheMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMetrics {
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub packets_sent: u64,
    pub packets_received: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseMetrics {
    pub active_connections: i64,
    pub idle_connections: i64,
    pub cache_hit_ratio: f64,
    pub slow_queries: i64,
    pub deadlocks: i64,
    pub locks_waiting: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiMetrics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub average_response_time_ms: f64,
    pub requests_per_second: f64,
    pub error_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheMetrics {
    pub hit_rate: f64,
    pub miss_rate: f64,
    pub total_entries: usize,
    pub memory_usage_bytes: usize,
    pub evictions: u64,
}

// Performance thresholds
#[derive(Debug, Clone)]
pub struct PerformanceThresholds {
    pub cpu_warning: f64,
    pub cpu_critical: f64,
    pub memory_warning: f64,
    pub memory_critical: f64,
    pub disk_warning: f64,
    pub disk_critical: f64,
    pub response_time_warning_ms: f64,
    pub response_time_critical_ms: f64,
    pub error_rate_warning: f64,
    pub error_rate_critical: f64,
}

impl Default for PerformanceThresholds {
    fn default() -> Self {
        Self {
            cpu_warning: 70.0,
            cpu_critical: 90.0,
            memory_warning: 80.0,
            memory_critical: 95.0,
            disk_warning: 85.0,
            disk_critical: 95.0,
            response_time_warning_ms: 1000.0,
            response_time_critical_ms: 5000.0,
            error_rate_warning: 5.0,
            error_rate_critical: 10.0,
        }
    }
}

// Performance alert
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceAlert {
    pub id: String,
    pub timestamp: u64,
    pub severity: String,
    pub category: String,
    pub message: String,
    pub metric_name: String,
    pub metric_value: f64,
    pub threshold: f64,
    pub resolved: bool,
}

// Performance monitoring service
pub struct PerformanceMonitor {
    metrics_history: Arc<RwLock<Vec<PerformanceMetrics>>>,
    alerts: Arc<RwLock<Vec<PerformanceAlert>>>,
    thresholds: PerformanceThresholds,
    max_history_size: usize,
}

impl PerformanceMonitor {
    pub fn new(thresholds: PerformanceThresholds) -> Self {
        Self {
            metrics_history: Arc::new(RwLock::new(Vec::new())),
            alerts: Arc::new(RwLock::new(Vec::new())),
            thresholds,
            max_history_size: 1000,
        }
    }

    /// Collect current performance metrics
    pub async fn collect_metrics(&self) -> Result<PerformanceMetrics, ApiError> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let cpu_usage = self.get_cpu_usage().await?;
        let memory_usage = self.get_memory_usage().await?;
        let disk_usage = self.get_disk_usage().await?;
        let network_io = self.get_network_metrics().await?;
        let database_metrics = self.get_database_metrics().await?;
        let api_metrics = self.get_api_metrics().await?;
        let cache_metrics = self.get_cache_metrics().await?;

        let metrics = PerformanceMetrics {
            timestamp,
            cpu_usage,
            memory_usage,
            disk_usage,
            network_io,
            database_metrics,
            api_metrics,
            cache_metrics,
        };

        // Store metrics
        self.store_metrics(metrics.clone()).await;

        // Check for alerts
        self.check_alerts(&metrics).await;

        Ok(metrics)
    }

    /// Store metrics in history
    async fn store_metrics(&self, metrics: PerformanceMetrics) {
        let mut history = self.metrics_history.write().await;
        history.push(metrics);

        // Keep only recent metrics
        if history.len() > self.max_history_size {
            history.remove(0);
        }
    }

    /// Check for performance alerts
    async fn check_alerts(&self, metrics: &PerformanceMetrics) {
        let mut alerts = self.alerts.write().await;

        // Check CPU usage
        if metrics.cpu_usage >= self.thresholds.cpu_critical {
            self.create_alert(
                &mut alerts,
                "CRITICAL",
                "CPU",
                format!("CPU usage is {:.2}%", metrics.cpu_usage),
                "cpu_usage",
                metrics.cpu_usage,
                self.thresholds.cpu_critical,
            );
        } else if metrics.cpu_usage >= self.thresholds.cpu_warning {
            self.create_alert(
                &mut alerts,
                "WARNING",
                "CPU",
                format!("CPU usage is {:.2}%", metrics.cpu_usage),
                "cpu_usage",
                metrics.cpu_usage,
                self.thresholds.cpu_warning,
            );
        }

        // Check memory usage
        if metrics.memory_usage >= self.thresholds.memory_critical {
            self.create_alert(
                &mut alerts,
                "CRITICAL",
                "Memory",
                format!("Memory usage is {:.2}%", metrics.memory_usage),
                "memory_usage",
                metrics.memory_usage,
                self.thresholds.memory_critical,
            );
        } else if metrics.memory_usage >= self.thresholds.memory_warning {
            self.create_alert(
                &mut alerts,
                "WARNING",
                "Memory",
                format!("Memory usage is {:.2}%", metrics.memory_usage),
                "memory_usage",
                metrics.memory_usage,
                self.thresholds.memory_warning,
            );
        }

        // Check disk usage
        if metrics.disk_usage >= self.thresholds.disk_critical {
            self.create_alert(
                &mut alerts,
                "CRITICAL",
                "Disk",
                format!("Disk usage is {:.2}%", metrics.disk_usage),
                "disk_usage",
                metrics.disk_usage,
                self.thresholds.disk_critical,
            );
        } else if metrics.disk_usage >= self.thresholds.disk_warning {
            self.create_alert(
                &mut alerts,
                "WARNING",
                "Disk",
                format!("Disk usage is {:.2}%", metrics.disk_usage),
                "disk_usage",
                metrics.disk_usage,
                self.thresholds.disk_warning,
            );
        }

        // Check API response time
        if metrics.api_metrics.average_response_time_ms >= self.thresholds.response_time_critical_ms {
            self.create_alert(
                &mut alerts,
                "CRITICAL",
                "API",
                format!("Average response time is {:.2}ms", metrics.api_metrics.average_response_time_ms),
                "response_time",
                metrics.api_metrics.average_response_time_ms,
                self.thresholds.response_time_critical_ms,
            );
        } else if metrics.api_metrics.average_response_time_ms >= self.thresholds.response_time_warning_ms {
            self.create_alert(
                &mut alerts,
                "WARNING",
                "API",
                format!("Average response time is {:.2}ms", metrics.api_metrics.average_response_time_ms),
                "response_time",
                metrics.api_metrics.average_response_time_ms,
                self.thresholds.response_time_warning_ms,
            );
        }

        // Check error rate
        if metrics.api_metrics.error_rate >= self.thresholds.error_rate_critical {
            self.create_alert(
                &mut alerts,
                "CRITICAL",
                "API",
                format!("Error rate is {:.2}%", metrics.api_metrics.error_rate),
                "error_rate",
                metrics.api_metrics.error_rate,
                self.thresholds.error_rate_critical,
            );
        } else if metrics.api_metrics.error_rate >= self.thresholds.error_rate_warning {
            self.create_alert(
                &mut alerts,
                "WARNING",
                "API",
                format!("Error rate is {:.2}%", metrics.api_metrics.error_rate),
                "error_rate",
                metrics.api_metrics.error_rate,
                self.thresholds.error_rate_warning,
            );
        }
    }

    /// Create a performance alert
    fn create_alert(
        &self,
        alerts: &mut Vec<PerformanceAlert>,
        severity: &str,
        category: &str,
        message: String,
        metric_name: &str,
        metric_value: f64,
        threshold: f64,
    ) {
        let alert = PerformanceAlert {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            severity: severity.to_string(),
            category: category.to_string(),
            message,
            metric_name: metric_name.to_string(),
            metric_value,
            threshold,
            resolved: false,
        };

        alerts.push(alert);
        warn!("Performance Alert: {} - {}", severity, message);
    }

    /// Get CPU usage (simplified implementation)
    async fn get_cpu_usage(&self) -> Result<f64, ApiError> {
        // In a real implementation, you would read from /proc/stat or use a system library
        // For now, return a mock value
        Ok(25.0)
    }

    /// Get memory usage (simplified implementation)
    async fn get_memory_usage(&self) -> Result<f64, ApiError> {
        // In a real implementation, you would read from /proc/meminfo or use a system library
        // For now, return a mock value
        Ok(45.0)
    }

    /// Get disk usage (simplified implementation)
    async fn get_disk_usage(&self) -> Result<f64, ApiError> {
        // In a real implementation, you would check disk space
        // For now, return a mock value
        Ok(60.0)
    }

    /// Get network metrics (simplified implementation)
    async fn get_network_metrics(&self) -> Result<NetworkMetrics, ApiError> {
        // In a real implementation, you would read from /proc/net/dev
        // For now, return mock values
        Ok(NetworkMetrics {
            bytes_sent: 1024000,
            bytes_received: 2048000,
            packets_sent: 1000,
            packets_received: 2000,
        })
    }

    /// Get database metrics (simplified implementation)
    async fn get_database_metrics(&self) -> Result<DatabaseMetrics, ApiError> {
        // In a real implementation, you would query the database
        // For now, return mock values
        Ok(DatabaseMetrics {
            active_connections: 5,
            idle_connections: 10,
            cache_hit_ratio: 95.5,
            slow_queries: 2,
            deadlocks: 0,
            locks_waiting: 1,
        })
    }

    /// Get API metrics (simplified implementation)
    async fn get_api_metrics(&self) -> Result<ApiMetrics, ApiError> {
        // In a real implementation, you would track API calls
        // For now, return mock values
        Ok(ApiMetrics {
            total_requests: 1000,
            successful_requests: 950,
            failed_requests: 50,
            average_response_time_ms: 250.0,
            requests_per_second: 10.5,
            error_rate: 5.0,
        })
    }

    /// Get cache metrics (simplified implementation)
    async fn get_cache_metrics(&self) -> Result<CacheMetrics, ApiError> {
        // In a real implementation, you would get from cache service
        // For now, return mock values
        Ok(CacheMetrics {
            hit_rate: 85.0,
            miss_rate: 15.0,
            total_entries: 1000,
            memory_usage_bytes: 1024000,
            evictions: 50,
        })
    }

    /// Get metrics history
    pub async fn get_metrics_history(&self, limit: Option<usize>) -> Vec<PerformanceMetrics> {
        let history = self.metrics_history.read().await;
        let limit = limit.unwrap_or(100);
        
        if history.len() <= limit {
            history.clone()
        } else {
            history[history.len() - limit..].to_vec()
        }
    }

    /// Get active alerts
    pub async fn get_active_alerts(&self) -> Vec<PerformanceAlert> {
        let alerts = self.alerts.read().await;
        alerts.iter().filter(|alert| !alert.resolved).cloned().collect()
    }

    /// Get all alerts
    pub async fn get_all_alerts(&self, limit: Option<usize>) -> Vec<PerformanceAlert> {
        let alerts = self.alerts.read().await;
        let limit = limit.unwrap_or(100);
        
        if alerts.len() <= limit {
            alerts.clone()
        } else {
            alerts[alerts.len() - limit..].to_vec()
        }
    }

    /// Resolve an alert
    pub async fn resolve_alert(&self, alert_id: &str) -> Result<(), ApiError> {
        let mut alerts = self.alerts.write().await;
        
        if let Some(alert) = alerts.iter_mut().find(|a| a.id == alert_id) {
            alert.resolved = true;
            info!("Resolved alert: {}", alert_id);
            Ok(())
        } else {
            Err(ApiError::not_found("Alert not found"))
        }
    }

    /// Get performance summary
    pub async fn get_performance_summary(&self) -> Result<PerformanceSummary, ApiError> {
        let history = self.metrics_history.read().await;
        let alerts = self.alerts.read().await;

        if history.is_empty() {
            return Err(ApiError::not_found("No metrics available"));
        }

        let latest = history.last().unwrap();
        let active_alerts = alerts.iter().filter(|a| !a.resolved).count();
        let critical_alerts = alerts.iter().filter(|a| !a.resolved && a.severity == "CRITICAL").count();

        // Calculate averages
        let avg_cpu = history.iter().map(|m| m.cpu_usage).sum::<f64>() / history.len() as f64;
        let avg_memory = history.iter().map(|m| m.memory_usage).sum::<f64>() / history.len() as f64;
        let avg_response_time = history.iter().map(|m| m.api_metrics.average_response_time_ms).sum::<f64>() / history.len() as f64;

        Ok(PerformanceSummary {
            current_status: self.get_overall_status(latest, active_alerts, critical_alerts),
            latest_metrics: latest.clone(),
            average_metrics: AverageMetrics {
                cpu_usage: avg_cpu,
                memory_usage: avg_memory,
                response_time_ms: avg_response_time,
            },
            active_alerts_count: active_alerts,
            critical_alerts_count: critical_alerts,
            uptime_seconds: self.get_uptime(),
        })
    }

    /// Get overall system status
    fn get_overall_status(&self, metrics: &PerformanceMetrics, active_alerts: usize, critical_alerts: usize) -> String {
        if critical_alerts > 0 {
            "CRITICAL".to_string()
        } else if active_alerts > 0 {
            "WARNING".to_string()
        } else if metrics.cpu_usage > self.thresholds.cpu_warning 
            || metrics.memory_usage > self.thresholds.memory_warning
            || metrics.api_metrics.average_response_time_ms > self.thresholds.response_time_warning_ms {
            "WARNING".to_string()
        } else {
            "HEALTHY".to_string()
        }
    }

    /// Get system uptime
    fn get_uptime(&self) -> u64 {
        // In a real implementation, you would track system start time
        // For now, return a mock value
        86400 // 24 hours
    }
}

// Performance summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceSummary {
    pub current_status: String,
    pub latest_metrics: PerformanceMetrics,
    pub average_metrics: AverageMetrics,
    pub active_alerts_count: usize,
    pub critical_alerts_count: usize,
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AverageMetrics {
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub response_time_ms: f64,
}

// Performance optimization recommendations
pub struct PerformanceOptimizer;

impl PerformanceOptimizer {
    /// Get performance optimization recommendations
    pub async fn get_optimization_recommendations(
        metrics: &PerformanceMetrics,
        thresholds: &PerformanceThresholds,
    ) -> Vec<OptimizationRecommendation> {
        let mut recommendations = Vec::new();

        // CPU optimization
        if metrics.cpu_usage > thresholds.cpu_warning {
            recommendations.push(OptimizationRecommendation {
                category: "CPU".to_string(),
                priority: if metrics.cpu_usage > thresholds.cpu_critical { "High" } else { "Medium" }.to_string(),
                description: format!("CPU usage is {:.2}%", metrics.cpu_usage),
                recommendations: vec![
                    "Consider scaling horizontally by adding more instances".to_string(),
                    "Optimize database queries to reduce CPU load".to_string(),
                    "Implement caching to reduce computation".to_string(),
                    "Review and optimize application code".to_string(),
                ],
            });
        }

        // Memory optimization
        if metrics.memory_usage > thresholds.memory_warning {
            recommendations.push(OptimizationRecommendation {
                category: "Memory".to_string(),
                priority: if metrics.memory_usage > thresholds.memory_critical { "High" } else { "Medium" }.to_string(),
                description: format!("Memory usage is {:.2}%", metrics.memory_usage),
                recommendations: vec![
                    "Increase available memory".to_string(),
                    "Optimize memory usage in application code".to_string(),
                    "Implement memory pooling".to_string(),
                    "Review and fix memory leaks".to_string(),
                ],
            });
        }

        // Response time optimization
        if metrics.api_metrics.average_response_time_ms > thresholds.response_time_warning_ms {
            recommendations.push(OptimizationRecommendation {
                category: "API Performance".to_string(),
                priority: if metrics.api_metrics.average_response_time_ms > thresholds.response_time_critical_ms { "High" } else { "Medium" }.to_string(),
                description: format!("Average response time is {:.2}ms", metrics.api_metrics.average_response_time_ms),
                recommendations: vec![
                    "Optimize database queries".to_string(),
                    "Implement response caching".to_string(),
                    "Use connection pooling".to_string(),
                    "Optimize API endpoints".to_string(),
                ],
            });
        }

        // Error rate optimization
        if metrics.api_metrics.error_rate > thresholds.error_rate_warning {
            recommendations.push(OptimizationRecommendation {
                category: "Error Rate".to_string(),
                priority: if metrics.api_metrics.error_rate > thresholds.error_rate_critical { "High" } else { "Medium" }.to_string(),
                description: format!("Error rate is {:.2}%", metrics.api_metrics.error_rate),
                recommendations: vec![
                    "Review error logs for common issues".to_string(),
                    "Implement better error handling".to_string(),
                    "Add input validation".to_string(),
                    "Improve system stability".to_string(),
                ],
            });
        }

        recommendations
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationRecommendation {
    pub category: String,
    pub priority: String,
    pub description: String,
    pub recommendations: Vec<String>,
}
