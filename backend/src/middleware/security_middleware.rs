use actix_web::{
    dev::{ServiceRequest, ServiceResponse},
    body::BoxBody,
    Error, HttpRequest, HttpResponse, Result,
    middleware::Next,
    web::{Data, self},
    http::header::{HeaderName, HeaderValue},
};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use serde_json;

use crate::{
    security::{
        SecurityConfig, 
        RateLimiter, 
        LoginAttemptTracker, 
        SessionManager,
        SecurityUtils,
        InputSanitizer,
    },
    error::ApiError,
};

// Security middleware state
#[derive(Clone)]
pub struct SecurityMiddleware {
    pub rate_limiter: Arc<RateLimiter>,
    pub login_attempt_tracker: Arc<LoginAttemptTracker>,
    pub session_manager: Arc<SessionManager>,
    pub config: Arc<SecurityConfig>,
}

impl SecurityMiddleware {
    pub fn new(config: SecurityConfig) -> Self {
        Self {
            rate_limiter: Arc::new(RateLimiter::new(
                config.rate_limit_requests_per_minute,
                60, // 1 minute window
            )),
            login_attempt_tracker: Arc::new(LoginAttemptTracker::new(
                config.max_login_attempts,
                config.lockout_duration_minutes,
            )),
            session_manager: Arc::new(SessionManager::new(
                config.session_timeout_minutes,
            )),
            config: Arc::new(config),
        }
    }
}

// Rate limiting middleware
pub async fn rate_limit_middleware(
    req: ServiceRequest,
    next: Next<BoxBody>,
    rate_limiter: Arc<RateLimiter>,
) -> Result<ServiceResponse<BoxBody>, Error> {
    let client_ip = req
        .connection_info()
        .remote_addr()
        .unwrap_or("unknown")
        .to_string();

    if !rate_limiter.is_allowed(&client_ip) {
        return Ok(req.into_response(
            HttpResponse::TooManyRequests()
                .json(serde_json::json!({
                    "success": false,
                    "message": "Rate limit exceeded. Please try again later.",
                    "error": "RATE_LIMIT_EXCEEDED",
                    "retry_after": 60
                }))
        ).map_into_boxed_body());
    }

    Ok(next.call(req).await?.map_into_boxed_body())
}

// Request sanitization middleware
pub async fn sanitization_middleware(
    req: ServiceRequest,
    next: Next<BoxBody>,
) -> Result<ServiceResponse<BoxBody>, Error> {
    // Sanitize query parameters
    let query = req.query_string();
    if !query.is_empty() {
        let sanitized_query = InputSanitizer::sanitize_string(query);
        if sanitized_query != query {
            return Ok(req.into_response(
                HttpResponse::BadRequest()
                    .json(serde_json::json!({
                        "success": false,
                        "message": "Invalid characters in request",
                        "error": "INVALID_INPUT"
                    }))
            ));
        }
    }

    // Check for suspicious patterns in headers
    if SecurityUtils::is_suspicious_request(&req.request()) {
        return Ok(req.into_response(
            HttpResponse::Forbidden()
                .json(serde_json::json!({
                    "success": false,
                    "message": "Access denied",
                    "error": "SUSPICIOUS_REQUEST"
                }))
        ));
    }

    Ok(next.call(req).await?.map_into_boxed_body())
}

// Security headers middleware
pub async fn security_headers_middleware(
    req: ServiceRequest,
    next: Next<BoxBody>,
) -> Result<ServiceResponse<BoxBody>, Error> {
    // Get scheme before moving req
    let is_https = req.connection_info().scheme() == "https";
    let mut res = next.call(req).await?;
    
    // Add security headers
    res.headers_mut().insert(
        HeaderName::from_static("x-content-type-options"),
        HeaderValue::from_static("nosniff"),
    );
    res.headers_mut().insert(
        HeaderName::from_static("x-frame-options"),
        HeaderValue::from_static("DENY"),
    );
    res.headers_mut().insert(
        HeaderName::from_static("x-xss-protection"),
        HeaderValue::from_static("1; mode=block"),
    );
    res.headers_mut().insert(
        HeaderName::from_static("referrer-policy"),
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    res.headers_mut().insert(
        HeaderName::from_static("permissions-policy"),
        HeaderValue::from_static("geolocation=(), microphone=(), camera=()"),
    );
    
    // Add HSTS header for HTTPS
    if is_https {
        res.headers_mut().insert(
            HeaderName::from_static("strict-transport-security"),
            HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        );
    }

    Ok(res.map_into_boxed_body())
}

// Request logging middleware for security monitoring
pub async fn security_logging_middleware(
    req: ServiceRequest,
    next: Next<BoxBody>,
) -> Result<ServiceResponse<BoxBody>, Error> {
    let start_time = SystemTime::now();
    let client_ip = req
        .connection_info()
        .remote_addr()
        .unwrap_or("unknown")
        .to_string();
    
    let user_agent = req
        .headers()
        .get("User-Agent")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("")
        .to_string();

    let method = req.method().to_string();
    let path = req.path().to_string();
    let query = req.query_string().to_string();

    // Log request
    log::info!(
        "Security Log: {} {} {} from {} - User-Agent: {}",
        method,
        path,
        query,
        client_ip,
        user_agent
    );

    let res = next.call(req).await?;
    
    // Log response
    let duration = start_time.elapsed().unwrap_or_default();
    log::info!(
        "Security Log: {} {} {} - Status: {} - Duration: {:?}",
        method,
        path,
        query,
        res.status(),
        duration
    );

    Ok(res.map_into_boxed_body())
}

// CSRF protection middleware
pub async fn csrf_protection_middleware(
    req: ServiceRequest,
    next: Next<BoxBody>,
    csrf_service: web::Data<crate::csrf::CsrfService>,
) -> Result<ServiceResponse<BoxBody>, Error> {
    // Skip CSRF check for GET, HEAD, OPTIONS requests
    if matches!(req.method(), &actix_web::http::Method::GET | &actix_web::http::Method::HEAD | &actix_web::http::Method::OPTIONS) {
        return Ok(next.call(req).await?.map_into_boxed_body());
    }

    // Skip CSRF check for certain paths
    let path = req.path();
    let skip_paths = [
        "/health", 
        "/status",
        "/api/test/database",
        "/api/auth/login", 
        "/api/auth/register",
        "/api/auth/password-reset/request",
        "/api/auth/password-reset/verify",
        "/api/auth/password-reset",
        "/api/auth/verify-email",
        "/api/auth/resend-verification",
        "/api/mpesa/callback",
        "/api/csrf/token", // Allow token generation
    ];
    
    if skip_paths.iter().any(|&skip_path| path.starts_with(skip_path)) {
        return Ok(next.call(req).await?.map_into_boxed_body());
    }

    // Check for CSRF token in header
    let csrf_token = req
        .headers()
        .get("X-CSRF-Token")
        .and_then(|h| h.to_str().ok());

    if csrf_token.is_none() {
        return Ok(req.into_response(
            HttpResponse::Forbidden()
                .json(serde_json::json!({
                    "success": false,
                    "message": "CSRF token required. Include 'X-CSRF-Token' header.",
                    "error": "CSRF_TOKEN_MISSING"
                }))
        ).map_into_boxed_body());
    }

    // Extract user ID and session ID from request
    let (user_id, session_id) = crate::csrf::CsrfService::extract_context_from_request(req.request());
    
    // Validate the CSRF token
    match csrf_service.validate_token(csrf_token.unwrap(), user_id, session_id).await {
        Ok(true) => {
            // Token is valid, proceed
            Ok(next.call(req).await?.map_into_boxed_body())
        }
        Ok(false) => {
            // Token is invalid or expired
            Ok(req.into_response(
                HttpResponse::Forbidden()
                    .json(serde_json::json!({
                        "success": false,
                        "message": "CSRF token is invalid or expired",
                        "error": "CSRF_TOKEN_INVALID"
                    }))
            ).map_into_boxed_body())
        }
        Err(e) => {
            // Error during validation
            log::error!("CSRF validation error: {}", e);
            Ok(req.into_response(
                HttpResponse::InternalServerError()
                    .json(serde_json::json!({
                        "success": false,
                        "message": "Error validating CSRF token",
                        "error": "CSRF_VALIDATION_ERROR"
                    }))
            ).map_into_boxed_body())
        }
    }
}

// Session validation middleware
pub async fn session_validation_middleware(
    req: ServiceRequest,
    next: Next<BoxBody>,
    session_manager: Arc<SessionManager>,
) -> Result<ServiceResponse<BoxBody>, Error> {
    // Skip session validation for certain paths
    let path = req.path();
    let skip_paths = ["/health", "/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/setup"];
    
    if skip_paths.iter().any(|&skip_path| path.starts_with(skip_path)) {
        return Ok(next.call(req).await?.map_into_boxed_body());
    }

    // Extract session ID from token or header
    let session_id = req
        .headers()
        .get("X-Session-ID")
        .and_then(|h| h.to_str().ok());

    if let Some(session_id) = session_id {
        if !session_manager.validate_session(session_id) {
            return Ok(req.into_response(
                HttpResponse::Unauthorized()
                    .json(serde_json::json!({
                        "success": false,
                        "message": "Session expired or invalid",
                        "error": "SESSION_INVALID"
                    }))
            ));
        }
    }

    Ok(next.call(req).await?.map_into_boxed_body())
}

// IP whitelist middleware
pub async fn ip_whitelist_middleware(
    req: ServiceRequest,
    next: Next<BoxBody>,
    allowed_ips: Vec<String>,
) -> Result<ServiceResponse<BoxBody>, Error> {
    let client_ip = req
        .connection_info()
        .remote_addr()
        .unwrap_or("unknown")
        .to_string();

    // Allow localhost and private IPs
    if client_ip.starts_with("127.0.0.1") || 
       client_ip.starts_with("::1") || 
       client_ip.starts_with("192.168.") ||
       client_ip.starts_with("10.") ||
       client_ip.starts_with("172.") {
        return Ok(next.call(req).await?.map_into_boxed_body());
    }

    // Check against whitelist
    if allowed_ips.contains(&client_ip) {
        return Ok(next.call(req).await?.map_into_boxed_body());
    }

    // For admin endpoints, enforce IP whitelist
    if req.path().starts_with("/api/v1/admin") {
        return Ok(req.into_response(
            HttpResponse::Forbidden()
                .json(serde_json::json!({
                    "success": false,
                    "message": "Access denied from this IP address",
                    "error": "IP_NOT_ALLOWED"
                }))
        ).map_into_boxed_body());
    }

    Ok(next.call(req).await?.map_into_boxed_body())
}

// Request size limiting middleware
pub async fn request_size_limit_middleware(
    req: ServiceRequest,
    next: Next<BoxBody>,
    max_size: usize,
) -> Result<ServiceResponse<BoxBody>, Error> {
    // Check Content-Length header
    if let Some(content_length) = req.headers().get("Content-Length") {
        if let Ok(length_str) = content_length.to_str() {
            if let Ok(length) = length_str.parse::<usize>() {
                if length > max_size {
                    return Ok(req.into_response(
                        HttpResponse::PayloadTooLarge()
                            .json(serde_json::json!({
                                "success": false,
                                "message": "Request payload too large",
                                "error": "PAYLOAD_TOO_LARGE",
                                "max_size": max_size
                            }))
                    ).map_into_boxed_body());
                }
            }
        }
    }

    Ok(next.call(req).await?.map_into_boxed_body())
}

// SQL injection protection middleware
pub async fn sql_injection_protection_middleware(
    req: ServiceRequest,
    next: Next<BoxBody>,
) -> Result<ServiceResponse<BoxBody>, Error> {
    // Check query parameters for SQL injection patterns
    let query = req.query_string();
    if !query.is_empty() {
        let suspicious_patterns = [
            "'", "\"", ";", "--", "/*", "*/", "xp_", "sp_", "exec", "execute",
            "union", "select", "insert", "update", "delete", "drop", "create",
            "alter", "truncate", "grant", "revoke"
        ];

        let query_lower = query.to_lowercase();
        for pattern in &suspicious_patterns {
            if query_lower.contains(pattern) {
                return Ok(req.into_response(
                    HttpResponse::BadRequest()
                        .json(serde_json::json!({
                            "success": false,
                            "message": "Suspicious request detected",
                            "error": "SUSPICIOUS_QUERY"
                        }))
                ));
            }
        }
    }

    Ok(next.call(req).await?.map_into_boxed_body())
}

// Cleanup expired data middleware (runs periodically)
pub async fn cleanup_middleware(
    security_middleware: Arc<SecurityMiddleware>,
) -> Result<(), Box<dyn std::error::Error>> {
    // Cleanup expired rate limit entries
    security_middleware.rate_limiter.cleanup_expired();
    
    // Cleanup expired sessions
    security_middleware.session_manager.cleanup_expired_sessions();
    
    log::info!("Security cleanup completed");
    Ok(())
}

// Security monitoring and alerting
pub struct SecurityMonitor {
    pub failed_attempts_threshold: u32,
    pub suspicious_requests_threshold: u32,
    pub failed_attempts_count: std::sync::atomic::AtomicU32,
    pub suspicious_requests_count: std::sync::atomic::AtomicU32,
}

impl SecurityMonitor {
    pub fn new() -> Self {
        Self {
            failed_attempts_threshold: 10,
            suspicious_requests_threshold: 5,
            failed_attempts_count: std::sync::atomic::AtomicU32::new(0),
            suspicious_requests_count: std::sync::atomic::AtomicU32::new(0),
        }
    }

    pub fn record_failed_attempt(&self) {
        let count = self.failed_attempts_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        if count >= self.failed_attempts_threshold {
            log::warn!("High number of failed authentication attempts detected: {}", count + 1);
            // In a real implementation, you would send an alert here
        }
    }

    pub fn record_suspicious_request(&self) {
        let count = self.suspicious_requests_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        if count >= self.suspicious_requests_threshold {
            log::warn!("High number of suspicious requests detected: {}", count + 1);
            // In a real implementation, you would send an alert here
        }
    }

    pub fn reset_counters(&self) {
        self.failed_attempts_count.store(0, std::sync::atomic::Ordering::Relaxed);
        self.suspicious_requests_count.store(0, std::sync::atomic::Ordering::Relaxed);
    }
}
