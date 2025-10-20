use actix_web::{
    dev::{ServiceRequest, ServiceResponse},
    body::MessageBody,
    Error, HttpMessage, Result,
};
use actix_web::middleware::Next;
use std::time::Instant;
use tracing::{info, warn, error, instrument};
use uuid::Uuid;

use crate::monitoring::{LogLevel, LogEntryBuilder, PerformanceMetrics};

/// Middleware for automatic request logging and metrics collection
pub struct MonitoringMiddleware;

impl MonitoringMiddleware {
    pub fn new() -> Self {
        Self
    }
}

/// Request context for monitoring
#[derive(Debug, Clone)]
pub struct RequestContext {
    pub request_id: String,
    pub start_time: Instant,
    pub method: String,
    pub path: String,
    pub user_id: Option<uuid::Uuid>,
    pub session_id: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

impl RequestContext {
    pub fn new(req: &ServiceRequest) -> Self {
        let request_id = Uuid::new_v4().to_string();
        let start_time = Instant::now();
        
        // Extract request information
        let method = req.method().to_string();
        let path = req.path().to_string();
        
        // Extract user information from headers or JWT token
        let user_id = extract_user_id_from_request(req);
        let session_id = extract_session_id_from_request(req);
        let ip_address = extract_ip_address_from_request(req);
        let user_agent = extract_user_agent_from_request(req);
        
        Self {
            request_id,
            start_time,
            method,
            path,
            user_id,
            session_id,
            ip_address,
            user_agent,
        }
    }
}

/// Extract user ID from request (from JWT token or session)
fn extract_user_id_from_request(req: &ServiceRequest) -> Option<uuid::Uuid> {
    // Try to extract from Authorization header
    if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                let token = &auth_str[7..];
                // TODO: Decode JWT token and extract user ID
                // For now, return None
                return None;
            }
        }
    }
    
    // TODO: Implement session-based user ID extraction
    // For now, return None
    
    None
}

/// Extract session ID from request
fn extract_session_id_from_request(req: &ServiceRequest) -> Option<String> {
    // TODO: Implement session-based session ID extraction
    // For now, return None
    
    // Try to extract from cookies
    if let Some(cookie) = req.cookie("session_id") {
        return Some(cookie.value().to_string());
    }
    
    None
}

/// Extract IP address from request
fn extract_ip_address_from_request(req: &ServiceRequest) -> Option<String> {
    // Try to get from X-Forwarded-For header (for load balancers)
    if let Some(forwarded_for) = req.headers().get("X-Forwarded-For") {
        if let Ok(forwarded_str) = forwarded_for.to_str() {
            // Take the first IP in the chain
            if let Some(first_ip) = forwarded_str.split(',').next() {
                return Some(first_ip.trim().to_string());
            }
        }
    }
    
    // Try to get from X-Real-IP header
    if let Some(real_ip) = req.headers().get("X-Real-IP") {
        if let Ok(real_ip_str) = real_ip.to_str() {
            return Some(real_ip_str.to_string());
        }
    }
    
    // Fall back to connection info
    if let Some(peer_addr) = req.connection_info().peer_addr() {
        return Some(peer_addr.to_string());
    }
    
    None
}

/// Extract user agent from request
fn extract_user_agent_from_request(req: &ServiceRequest) -> Option<String> {
    if let Some(user_agent) = req.headers().get("User-Agent") {
        if let Ok(user_agent_str) = user_agent.to_str() {
            return Some(user_agent_str.to_string());
        }
    }
    None
}

/// Monitoring middleware implementation
pub async fn monitoring_middleware(
    req: ServiceRequest,
    next: Next<impl MessageBody>,
) -> Result<ServiceResponse<impl MessageBody>, Error> {
    let context = RequestContext::new(&req);
    
    // Log request start
    info!(
        request_id = %context.request_id,
        method = %context.method,
        path = %context.path,
        user_id = ?context.user_id,
        session_id = ?context.session_id,
        ip_address = ?context.ip_address,
        "Request started"
    );
    
    // Record request start metrics
    // TODO: Get metrics service from app state
    // context.metrics_service.increment_http_requests_in_flight(&context.method, &context.path);
    
    // Process request
    let res = next.call(req).await;
    
    // Calculate request duration
    let duration = context.start_time.elapsed();
    let status_code = res.as_ref().map(|r| r.status().as_u16()).unwrap_or(500);
    
    // Log request completion
    let log_level = if status_code >= 500 {
        LogLevel::Error
    } else if status_code >= 400 {
        LogLevel::Warn
    } else {
        LogLevel::Info
    };
    
    let mut log_entry = LogEntryBuilder::new()
        .level(log_level)
        .message(format!("Request completed: {} {}", context.method, context.path))
        .module("middleware")
        .function("monitoring_middleware")
        .request_id(context.request_id.clone())
        .context("method", serde_json::Value::String(context.method.clone()))
        .context("path", serde_json::Value::String(context.path.clone()))
        .context("status_code", serde_json::Value::Number(status_code.into()))
        .context("duration_ms", serde_json::Value::Number(serde_json::Number::from(duration.as_millis() as u64)))
        .performance_metrics(PerformanceMetrics {
            duration_ms: Some(duration.as_millis() as f64),
            memory_usage_mb: None,
            cpu_usage_percent: None,
            database_queries: None,
            cache_hits: None,
            cache_misses: None,
        });
    
    if let Some(user_id) = context.user_id {
        log_entry = log_entry.user_id(user_id);
    }
    
    if let Some(session_id) = context.session_id {
        log_entry = log_entry.session_id(session_id);
    }
    
    if let Some(ip_address) = context.ip_address {
        log_entry = log_entry.context("ip_address", serde_json::Value::String(ip_address));
    }
    
    if let Some(user_agent) = context.user_agent {
        log_entry = log_entry.context("user_agent", serde_json::Value::String(user_agent));
    }
    
    let log_entry = log_entry.build();
    
    // TODO: Send log entry to monitoring service
    // monitoring_service.log(log_entry).await?;
    
    // Record request completion metrics
    // TODO: Get metrics service from app state
    // context.metrics_service.record_http_request(&context.method, &context.path, status_code, duration);
    // context.metrics_service.decrement_http_requests_in_flight(&context.method, &context.path);
    
    // Log request completion
    match status_code {
        200..=299 => {
            info!(
                request_id = %context.request_id,
                method = %context.method,
                path = %context.path,
                status_code = status_code,
                duration_ms = duration.as_millis(),
                "Request completed successfully"
            );
        }
        400..=499 => {
            warn!(
                request_id = %context.request_id,
                method = %context.method,
                path = %context.path,
                status_code = status_code,
                duration_ms = duration.as_millis(),
                "Request completed with client error"
            );
        }
        500..=599 => {
            error!(
                request_id = %context.request_id,
                method = %context.method,
                path = %context.path,
                status_code = status_code,
                duration_ms = duration.as_millis(),
                "Request completed with server error"
            );
        }
        _ => {
            info!(
                request_id = %context.request_id,
                method = %context.method,
                path = %context.path,
                status_code = status_code,
                duration_ms = duration.as_millis(),
                "Request completed"
            );
        }
    }
    
    res
}

/// Database query monitoring middleware
pub struct DatabaseMonitoringMiddleware;

impl DatabaseMonitoringMiddleware {
    pub fn new() -> Self {
        Self
    }
    
    /// Monitor a database operation
    pub async fn monitor_operation<F, T>(
        &self,
        operation: &str,
        table: &str,
        f: F,
    ) -> Result<T, sqlx::Error>
    where
        F: std::future::Future<Output = Result<T, sqlx::Error>>,
    {
        let start_time = Instant::now();
        
        let result = f.await;
        
        let duration = start_time.elapsed();
        let status = if result.is_ok() { "success" } else { "error" };
        
        // Record metrics
        // TODO: Record metrics when metrics service is available
        // self.metrics_service.record_database_query(operation, table, status, duration);
        
        // Log the operation
        let log_level = if result.is_ok() {
            LogLevel::Debug
        } else {
            LogLevel::Error
        };
        
        let log_entry = LogEntryBuilder::new()
            .level(log_level)
            .message(format!("Database operation: {} on {}", operation, table))
            .module("database")
            .function("monitor_operation")
            .context("operation", serde_json::Value::String(operation.to_string()))
            .context("table", serde_json::Value::String(table.to_string()))
            .context("status", serde_json::Value::String(status.to_string()))
            .performance_metrics(PerformanceMetrics {
                duration_ms: Some(duration.as_millis() as f64),
                database_queries: Some(1),
                ..Default::default()
            })
            .build();
        
        // TODO: Send log entry to monitoring service
        // monitoring_service.log(log_entry).await?;
        
        result
    }
}

/// Performance monitoring utilities
pub struct PerformanceMonitor {
    pub start_time: Instant,
    pub operation_name: String,
    pub context: std::collections::HashMap<String, serde_json::Value>,
}

impl PerformanceMonitor {
    pub fn new(operation_name: impl Into<String>) -> Self {
        Self {
            start_time: Instant::now(),
            operation_name: operation_name.into(),
            context: std::collections::HashMap::new(),
        }
    }
    
    pub fn add_context(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.context.insert(key.into(), value);
        self
    }
    
    pub fn finish(self) -> PerformanceMetrics {
        let duration = self.start_time.elapsed();
        
        PerformanceMetrics {
            duration_ms: Some(duration.as_millis() as f64),
            memory_usage_mb: None,
            cpu_usage_percent: None,
            database_queries: None,
            cache_hits: None,
            cache_misses: None,
        }
    }
}

impl Default for PerformanceMetrics {
    fn default() -> Self {
        Self {
            duration_ms: None,
            memory_usage_mb: None,
            cpu_usage_percent: None,
            database_queries: None,
            cache_hits: None,
            cache_misses: None,
        }
    }
}
