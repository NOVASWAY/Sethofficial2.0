use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use prometheus::{
    Counter, CounterVec, Gauge, GaugeVec, Histogram, HistogramVec, 
    IntCounter, IntCounterVec, IntGauge, IntGaugeVec, Registry, 
    TextEncoder, Encoder, Opts, HistogramOpts
};
use serde::{Deserialize, Serialize};
use tracing::{info, warn, debug};

/// Metrics service for Prometheus integration
pub struct MetricsService {
    registry: Registry,
    
    // HTTP metrics
    http_requests_total: CounterVec,
    http_request_duration: HistogramVec,
    http_requests_in_flight: GaugeVec,
    
    // Database metrics
    database_connections_active: Gauge,
    database_queries_total: CounterVec,
    database_query_duration: HistogramVec,
    
    // Cache metrics
    cache_operations_total: CounterVec,
    cache_hit_ratio: Gauge,
    cache_size: Gauge,
    
    // Business metrics
    patients_total: IntGauge,
    consultations_total: IntGauge,
    appointments_total: IntGauge,
    prescriptions_total: IntGauge,
    invoices_total: IntGauge,
    
    // System metrics
    memory_usage: Gauge,
    cpu_usage: Gauge,
    uptime_seconds: Counter,
    
    // Compliance metrics
    audit_events_total: CounterVec,
    compliance_score: Gauge,
    data_retention_operations: CounterVec,
}

impl MetricsService {
    /// Create a new metrics service
    pub fn new() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let registry = Registry::new();
        
        // HTTP metrics
        let http_requests_total = CounterVec::new(
            Opts::new("http_requests_total", "Total number of HTTP requests"),
            &["method", "endpoint", "status_code"]
        )?;
        
        let http_request_duration = HistogramVec::new(
            HistogramOpts::new("http_request_duration_seconds", "HTTP request duration in seconds"),
            &["method", "endpoint"]
        )?;
        
        let http_requests_in_flight = GaugeVec::new(
            Opts::new("http_requests_in_flight", "Number of HTTP requests currently being processed"),
            &["method", "endpoint"]
        )?;
        
        // Database metrics
        let database_connections_active = Gauge::new(
            "database_connections_active",
            "Number of active database connections"
        )?;
        
        let database_queries_total = CounterVec::new(
            Opts::new("database_queries_total", "Total number of database queries"),
            &["operation", "table", "status"]
        )?;
        
        let database_query_duration = HistogramVec::new(
            HistogramOpts::new("database_query_duration_seconds", "Database query duration in seconds"),
            &["operation", "table"]
        )?;
        
        // Cache metrics
        let cache_operations_total = CounterVec::new(
            Opts::new("cache_operations_total", "Total number of cache operations"),
            &["operation", "cache_type", "status"]
        )?;
        
        let cache_hit_ratio = Gauge::new(
            "cache_hit_ratio",
            "Cache hit ratio (0.0 to 1.0)"
        )?;
        
        let cache_size = Gauge::new(
            "cache_size",
            "Current cache size in bytes"
        )?;
        
        // Business metrics
        let patients_total = IntGauge::new(
            "patients_total",
            "Total number of patients"
        )?;
        
        let consultations_total = IntGauge::new(
            "consultations_total",
            "Total number of consultations"
        )?;
        
        let appointments_total = IntGauge::new(
            "appointments_total",
            "Total number of appointments"
        )?;
        
        let prescriptions_total = IntGauge::new(
            "prescriptions_total",
            "Total number of prescriptions"
        )?;
        
        let invoices_total = IntGauge::new(
            "invoices_total",
            "Total number of invoices"
        )?;
        
        // System metrics
        let memory_usage = Gauge::new(
            "memory_usage_bytes",
            "Current memory usage in bytes"
        )?;
        
        let cpu_usage = Gauge::new(
            "cpu_usage_percent",
            "Current CPU usage percentage"
        )?;
        
        let uptime_seconds = Counter::new(
            "uptime_seconds_total",
            "Total uptime in seconds"
        )?;
        
        // Compliance metrics
        let audit_events_total = CounterVec::new(
            Opts::new("audit_events_total", "Total number of audit events"),
            &["event_type", "severity", "status"]
        )?;
        
        let compliance_score = Gauge::new(
            "compliance_score",
            "Current compliance score (0.0 to 1.0)"
        )?;
        
        let data_retention_operations = CounterVec::new(
            Opts::new("data_retention_operations_total", "Total number of data retention operations"),
            &["operation", "status"]
        )?;
        
        // Register all metrics
        registry.register(Box::new(http_requests_total.clone()))?;
        registry.register(Box::new(http_request_duration.clone()))?;
        registry.register(Box::new(http_requests_in_flight.clone()))?;
        registry.register(Box::new(database_connections_active.clone()))?;
        registry.register(Box::new(database_queries_total.clone()))?;
        registry.register(Box::new(database_query_duration.clone()))?;
        registry.register(Box::new(cache_operations_total.clone()))?;
        registry.register(Box::new(cache_hit_ratio.clone()))?;
        registry.register(Box::new(cache_size.clone()))?;
        registry.register(Box::new(patients_total.clone()))?;
        registry.register(Box::new(consultations_total.clone()))?;
        registry.register(Box::new(appointments_total.clone()))?;
        registry.register(Box::new(prescriptions_total.clone()))?;
        registry.register(Box::new(invoices_total.clone()))?;
        registry.register(Box::new(memory_usage.clone()))?;
        registry.register(Box::new(cpu_usage.clone()))?;
        registry.register(Box::new(uptime_seconds.clone()))?;
        registry.register(Box::new(audit_events_total.clone()))?;
        registry.register(Box::new(compliance_score.clone()))?;
        registry.register(Box::new(data_retention_operations.clone()))?;
        
        info!("📊 Metrics service initialized with Prometheus registry");
        
        Ok(Self {
            registry,
            http_requests_total,
            http_request_duration,
            http_requests_in_flight,
            database_connections_active,
            database_queries_total,
            database_query_duration,
            cache_operations_total,
            cache_hit_ratio,
            cache_size,
            patients_total,
            consultations_total,
            appointments_total,
            prescriptions_total,
            invoices_total,
            memory_usage,
            cpu_usage,
            uptime_seconds,
            audit_events_total,
            compliance_score,
            data_retention_operations,
        })
    }
    
    /// Record HTTP request metrics
    pub fn record_http_request(&self, method: &str, endpoint: &str, status_code: u16, duration: Duration) {
        let status = status_code.to_string();
        self.http_requests_total.with_label_values(&[method, endpoint, &status]).inc();
        self.http_request_duration
            .with_label_values(&[method, endpoint])
            .observe(duration.as_secs_f64());
    }
    
    /// Increment HTTP requests in flight
    pub fn increment_http_requests_in_flight(&self, method: &str, endpoint: &str) {
        self.http_requests_in_flight.with_label_values(&[method, endpoint]).inc();
    }
    
    /// Decrement HTTP requests in flight
    pub fn decrement_http_requests_in_flight(&self, method: &str, endpoint: &str) {
        self.http_requests_in_flight.with_label_values(&[method, endpoint]).dec();
    }
    
    /// Record database query metrics
    pub fn record_database_query(&self, operation: &str, table: &str, status: &str, duration: Duration) {
        self.database_queries_total.with_label_values(&[operation, table, status]).inc();
        self.database_query_duration
            .with_label_values(&[operation, table])
            .observe(duration.as_secs_f64());
    }
    
    /// Update database connections count
    pub fn update_database_connections(&self, count: f64) {
        self.database_connections_active.set(count);
    }
    
    /// Record cache operation metrics
    pub fn record_cache_operation(&self, operation: &str, cache_type: &str, status: &str) {
        self.cache_operations_total.with_label_values(&[operation, cache_type, status]).inc();
    }
    
    /// Update cache hit ratio
    pub fn update_cache_hit_ratio(&self, ratio: f64) {
        self.cache_hit_ratio.set(ratio);
    }
    
    /// Update cache size
    pub fn update_cache_size(&self, size: f64) {
        self.cache_size.set(size);
    }
    
    /// Update business metrics
    pub fn update_patients_count(&self, count: i64) {
        self.patients_total.set(count);
    }
    
    pub fn update_consultations_count(&self, count: i64) {
        self.consultations_total.set(count);
    }
    
    pub fn update_appointments_count(&self, count: i64) {
        self.appointments_total.set(count);
    }
    
    pub fn update_prescriptions_count(&self, count: i64) {
        self.prescriptions_total.set(count);
    }
    
    pub fn update_invoices_count(&self, count: i64) {
        self.invoices_total.set(count);
    }
    
    /// Update system metrics
    pub fn update_memory_usage(&self, usage: f64) {
        self.memory_usage.set(usage);
    }
    
    pub fn update_cpu_usage(&self, usage: f64) {
        self.cpu_usage.set(usage);
    }
    
    pub fn update_uptime(&self, uptime: f64) {
        self.uptime_seconds.inc_by(uptime);
    }
    
    /// Record audit event metrics
    pub fn record_audit_event(&self, event_type: &str, severity: &str, status: &str) {
        self.audit_events_total.with_label_values(&[event_type, severity, status]).inc();
    }
    
    /// Update compliance score
    pub fn update_compliance_score(&self, score: f64) {
        self.compliance_score.set(score);
    }
    
    /// Record data retention operation
    pub fn record_data_retention_operation(&self, operation: &str, status: &str) {
        self.data_retention_operations.with_label_values(&[operation, status]).inc();
    }
    
    /// Get metrics in Prometheus format
    pub fn get_metrics(&self) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let metric_families = self.registry.gather();
        let encoder = TextEncoder::new();
        let mut buffer = Vec::new();
        encoder.encode(&metric_families, &mut buffer)
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
        String::from_utf8(buffer)
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
    }
    
    /// Get metrics summary
    pub fn get_metrics_summary(&self) -> MetricsSummary {
        MetricsSummary {
            http_requests_total: 0, // Will be populated when metrics are actually recorded
            database_queries_total: 0,
            cache_operations_total: 0,
            patients_total: self.patients_total.get() as u64,
            consultations_total: self.consultations_total.get() as u64,
            appointments_total: self.appointments_total.get() as u64,
            prescriptions_total: self.prescriptions_total.get() as u64,
            invoices_total: self.invoices_total.get() as u64,
            compliance_score: self.compliance_score.get(),
            cache_hit_ratio: self.cache_hit_ratio.get(),
            memory_usage: self.memory_usage.get(),
            cpu_usage: self.cpu_usage.get(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSummary {
    pub http_requests_total: u64,
    pub database_queries_total: u64,
    pub cache_operations_total: u64,
    pub patients_total: u64,
    pub consultations_total: u64,
    pub appointments_total: u64,
    pub prescriptions_total: u64,
    pub invoices_total: u64,
    pub compliance_score: f64,
    pub cache_hit_ratio: f64,
    pub memory_usage: f64,
    pub cpu_usage: f64,
}

// Simplified metrics service without complex middleware
// Metrics can be recorded manually in handlers as needed
