use actix_web::{HttpRequest, HttpResponse, Result, web, middleware::Next, dev::ServiceRequest, dev::ServiceResponse, Error};
use actix_web::http::header::{HeaderName, HeaderValue};
use actix_web::middleware::DefaultHeaders;
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;
use chrono::{Utc, Duration};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use std::sync::RwLock;
use std::collections::HashMap;

use crate::error::ApiError;

// Permission validation modules
pub mod permission_validator;
pub mod permission_middleware;

// Security configuration
#[derive(Debug, Clone)]
pub struct SecurityConfig {
    pub jwt_secret: String,
    pub jwt_expiration_hours: u64,
    pub refresh_token_expiration_days: u64,
    pub max_login_attempts: u32,
    pub lockout_duration_minutes: u64,
    pub password_min_length: usize,
    pub password_require_uppercase: bool,
    pub password_require_lowercase: bool,
    pub password_require_numbers: bool,
    pub password_require_special_chars: bool,
    pub session_timeout_minutes: u64,
    pub enable_rate_limiting: bool,
    pub rate_limit_requests_per_minute: u32,
    pub enable_cors: bool,
    pub allowed_origins: Vec<String>,
    pub enable_csrf_protection: bool,
    pub enable_security_headers: bool,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "your-super-secret-jwt-key-change-this-in-production".to_string()),
            jwt_expiration_hours: 24,
            refresh_token_expiration_days: 7,
            max_login_attempts: 5,
            lockout_duration_minutes: 15,
            password_min_length: 8,
            password_require_uppercase: true,
            password_require_lowercase: true,
            password_require_numbers: true,
            password_require_special_chars: true,
            session_timeout_minutes: 30,
            enable_rate_limiting: true,
            rate_limit_requests_per_minute: 100,
            enable_cors: true,
            allowed_origins: vec!["http://localhost:3000".to_string()],
            enable_csrf_protection: true,
            enable_security_headers: true,
        }
    }
}

// Rate limiting
#[derive(Debug, Clone)]
pub struct RateLimitEntry {
    pub requests: u32,
    pub window_start: u64,
}

#[derive(Debug, Clone)]
pub struct RateLimiter {
    pub entries: Arc<RwLock<HashMap<String, RateLimitEntry>>>,
    pub max_requests: u32,
    pub window_duration_seconds: u64,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_duration_seconds: u64) -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashMap::new())),
            max_requests,
            window_duration_seconds,
        }
    }

    pub fn is_allowed(&self, key: &str) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut entries = self.entries.write().unwrap();
        
        if let Some(entry) = entries.get_mut(key) {
            // Check if window has expired
            if now - entry.window_start >= self.window_duration_seconds {
                entry.requests = 1;
                entry.window_start = now;
                true
            } else if entry.requests < self.max_requests {
                entry.requests += 1;
                true
            } else {
                false
            }
        } else {
            // First request
            entries.insert(key.to_string(), RateLimitEntry {
                requests: 1,
                window_start: now,
            });
            true
        }
    }

    pub fn cleanup_expired(&self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut entries = self.entries.write().unwrap();
        entries.retain(|_, entry| now - entry.window_start < self.window_duration_seconds);
    }
}

// Login attempt tracking
#[derive(Debug, Clone)]
pub struct LoginAttempt {
    pub attempts: u32,
    pub last_attempt: u64,
    pub locked_until: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct LoginAttemptTracker {
    pub attempts: Arc<RwLock<HashMap<String, LoginAttempt>>>,
    pub max_attempts: u32,
    pub lockout_duration_seconds: u64,
}

impl LoginAttemptTracker {
    pub fn new(max_attempts: u32, lockout_duration_minutes: u64) -> Self {
        Self {
            attempts: Arc::new(RwLock::new(HashMap::new())),
            max_attempts,
            lockout_duration_seconds: lockout_duration_minutes * 60,
        }
    }

    pub fn record_failed_attempt(&self, identifier: &str) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut attempts = self.attempts.write().unwrap();
        
        if let Some(attempt) = attempts.get_mut(identifier) {
            // Check if still locked
            if let Some(locked_until) = attempt.locked_until {
                if now < locked_until {
                    return false; // Still locked
                }
            }

            attempt.attempts += 1;
            attempt.last_attempt = now;

            if attempt.attempts >= self.max_attempts {
                attempt.locked_until = Some(now + self.lockout_duration_seconds);
                false
            } else {
                true
            }
        } else {
            // First failed attempt
            attempts.insert(identifier.to_string(), LoginAttempt {
                attempts: 1,
                last_attempt: now,
                locked_until: None,
            });
            true
        }
    }

    pub fn record_successful_attempt(&self, identifier: &str) {
        let mut attempts = self.attempts.write().unwrap();
        attempts.remove(identifier);
    }

    pub fn is_locked(&self, identifier: &str) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let attempts = self.attempts.read().unwrap();
        
        if let Some(attempt) = attempts.get(identifier) {
            if let Some(locked_until) = attempt.locked_until {
                now < locked_until
            } else {
                false
            }
        } else {
            false
        }
    }

    pub fn get_remaining_lockout_time(&self, identifier: &str) -> Option<u64> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let attempts = self.attempts.read().unwrap();
        
        if let Some(attempt) = attempts.get(identifier) {
            if let Some(locked_until) = attempt.locked_until {
                if now < locked_until {
                    Some(locked_until - now)
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    }
}

// Enhanced JWT claims with security features
#[derive(Debug, Serialize, Deserialize)]
pub struct SecureClaims {
    pub sub: String, // User ID
    pub username: String,
    pub role: String,
    pub permissions: serde_json::Value,
    pub exp: u64,
    pub iat: u64,
    pub jti: String, // JWT ID for token revocation
    pub iss: String, // Issuer
    pub aud: String, // Audience
    pub nbf: u64,    // Not before
    pub session_id: String, // Session tracking
    pub ip_address: String, // IP address for security
    pub user_agent_hash: String, // User agent hash for device tracking
}

// Password security utilities
pub struct PasswordSecurity;

impl PasswordSecurity {
    pub fn validate_password_strength(password: &str, config: &SecurityConfig) -> Result<(), String> {
        if password.len() < config.password_min_length {
            return Err(format!("Password must be at least {} characters long", config.password_min_length));
        }

        if config.password_require_uppercase && !password.chars().any(|c| c.is_uppercase()) {
            return Err("Password must contain at least one uppercase letter".to_string());
        }

        if config.password_require_lowercase && !password.chars().any(|c| c.is_lowercase()) {
            return Err("Password must contain at least one lowercase letter".to_string());
        }

        if config.password_require_numbers && !password.chars().any(|c| c.is_numeric()) {
            return Err("Password must contain at least one number".to_string());
        }

        if config.password_require_special_chars && !password.chars().any(|c| "!@#$%^&*()_+-=[]{}|;:,.<>?".contains(c)) {
            return Err("Password must contain at least one special character".to_string());
        }

        // Check for common weak passwords
        let weak_passwords = [
            "password", "123456", "123456789", "qwerty", "abc123",
            "password123", "admin", "letmein", "welcome", "monkey"
        ];

        if weak_passwords.contains(&password.to_lowercase().as_str()) {
            return Err("Password is too common. Please choose a stronger password".to_string());
        }

        Ok(())
    }

    pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = argon2.hash_password(password.as_bytes(), &salt)?;
        Ok(password_hash.to_string())
    }

    pub fn verify_password(password: &str, hash: &str) -> Result<bool, argon2::password_hash::Error> {
        let parsed_hash = PasswordHash::new(hash)?;
        let argon2 = Argon2::default();
        
        match argon2.verify_password(password.as_bytes(), &parsed_hash) {
            Ok(_) => Ok(true),
            Err(argon2::password_hash::Error::Password) => Ok(false),
            Err(e) => Err(e),
        }
    }
}

// Input sanitization
pub struct InputSanitizer;

impl InputSanitizer {
    pub fn sanitize_string(input: &str) -> String {
        input
            .trim()
            .chars()
            .filter(|c| !c.is_control() || *c == '\n' || *c == '\r' || *c == '\t')
            .collect()
    }

    pub fn sanitize_html(input: &str) -> String {
        // Basic HTML sanitization - in production, use a proper HTML sanitizer
        input
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&#x27;")
            .replace('&', "&amp;")
    }

    pub fn sanitize_sql_input(input: &str) -> String {
        // Basic SQL injection prevention - in production, use parameterized queries
        input
            .replace('\'', "''")
            .replace(';', "")
            .replace("--", "")
            .replace("/*", "")
            .replace("*/", "")
    }

    pub fn validate_email(email: &str) -> bool {
        // Basic email validation - in production, use a proper email validation library
        let email_regex = regex::Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap();
        email_regex.is_match(email)
    }

    pub fn validate_phone(phone: &str) -> bool {
        // Basic phone validation
        let phone_regex = regex::Regex::new(r"^\+?[\d\s\-\(\)]{10,}$").unwrap();
        phone_regex.is_match(phone)
    }
}

// Security headers middleware
pub fn security_headers() -> DefaultHeaders {
    DefaultHeaders::new()
        .add((HeaderName::from_static("x-content-type-options"), HeaderValue::from_static("nosniff")))
        .add((HeaderName::from_static("x-frame-options"), HeaderValue::from_static("DENY")))
        .add((HeaderName::from_static("x-xss-protection"), HeaderValue::from_static("1; mode=block")))
        .add((HeaderName::from_static("referrer-policy"), HeaderValue::from_static("strict-origin-when-cross-origin")))
        .add((HeaderName::from_static("permissions-policy"), HeaderValue::from_static("geolocation=(), microphone=(), camera=()")))
        .add((HeaderName::from_static("strict-transport-security"), HeaderValue::from_static("max-age=31536000; includeSubDomains")))
}

// CORS configuration
pub fn cors_config() -> actix_cors::Cors {
    actix_cors::Cors::default()
        .allowed_origin("http://localhost:3000")
        .allowed_origin("https://localhost:3000")
        .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
        .allowed_headers(vec![
            actix_web::http::header::AUTHORIZATION,
            actix_web::http::header::ACCEPT,
            actix_web::http::header::CONTENT_TYPE,
        ])
        .max_age(3600)
}

// Rate limiting middleware
pub async fn rate_limit_middleware(
    req: ServiceRequest,
    next: Next<actix_web::body::BoxBody>,
    rate_limiter: Arc<RateLimiter>,
) -> Result<ServiceResponse<actix_web::body::BoxBody>, Error> {
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
                    "error": "RATE_LIMIT_EXCEEDED"
                }))
        ).map_into_boxed_body());
    }

    Ok(next.call(req).await?.map_into_boxed_body())
}

// Enhanced authentication middleware
pub async fn enhanced_auth_middleware(
    req: ServiceRequest,
    next: Next<actix_web::body::BoxBody>,
    config: Arc<SecurityConfig>,
) -> Result<ServiceResponse<actix_web::body::BoxBody>, Error> {
    // Skip authentication for certain paths
    let path = req.path();
    let skip_paths = ["/health", "/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/setup"];
    
    if skip_paths.iter().any(|&skip_path| path.starts_with(skip_path)) {
        return Ok(next.call(req).await?.map_into_boxed_body());
    }

    // Extract and validate token
    if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                let token = &auth_str[7..];
                
                // Validate token
                match validate_secure_token(token, &config) {
                    Ok(claims) => {
                        // Check token expiration
                        let now = Utc::now().timestamp() as u64;
                        if claims.exp < now {
                            return Ok(req.into_response(
                                HttpResponse::Unauthorized()
                                    .json(serde_json::json!({
                                        "success": false,
                                        "message": "Token has expired",
                                        "error": "TOKEN_EXPIRED"
                                    }))
                            ).map_into_boxed_body());
                        }

                        // Check not before
                        if claims.nbf > now {
                            return Ok(req.into_response(
                                HttpResponse::Unauthorized()
                                    .json(serde_json::json!({
                                        "success": false,
                                        "message": "Token not yet valid",
                                        "error": "TOKEN_NOT_VALID"
                                    }))
                            ));
                        }

                        // Add claims to request extensions for use in handlers
                        // Note: We can't add extensions in this middleware pattern, 
                        // so we'll skip this for now. Handlers should extract claims from token directly.
                        return Ok(next.call(req).await?.map_into_boxed_body());
                    }
                    Err(_) => {
                            return Ok(req.into_response(
                                HttpResponse::Unauthorized()
                                    .json(serde_json::json!({
                                        "success": false,
                                        "message": "Invalid token",
                                        "error": "INVALID_TOKEN"
                                    }))
                        ).map_into_boxed_body());
                    }
                }
            }
        }
    }

    Ok(req.into_response(
        HttpResponse::Unauthorized()
            .json(serde_json::json!({
                "success": false,
                "message": "Authorization header required",
                "error": "MISSING_AUTH_HEADER"
            }))
    ))
}

// Enhanced token validation
pub fn validate_secure_token(token: &str, config: &SecurityConfig) -> Result<SecureClaims, jsonwebtoken::errors::Error> {
    let key = DecodingKey::from_secret(config.jwt_secret.as_ref());
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    validation.validate_nbf = true;
    // validate_iss field removed in newer jsonwebtoken versions
    // validation.validate_iss = true;
    validation.validate_aud = true;
    validation.set_issuer(&["clinic-management"]);
    validation.set_audience(&["clinic-management-users"]);
    
    let token_data = decode::<SecureClaims>(token, &key, &validation)?;
    Ok(token_data.claims)
}

// Session management
#[derive(Debug, Clone)]
pub struct Session {
    pub id: String,
    pub user_id: String,
    pub created_at: u64,
    pub last_activity: u64,
    pub ip_address: String,
    pub user_agent: String,
    pub is_active: bool,
}

#[derive(Debug, Clone)]
pub struct SessionManager {
    pub sessions: Arc<RwLock<HashMap<String, Session>>>,
    pub timeout_duration_seconds: u64,
}

impl SessionManager {
    pub fn new(timeout_duration_minutes: u64) -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            timeout_duration_seconds: timeout_duration_minutes * 60,
        }
    }

    pub fn create_session(&self, user_id: &str, ip_address: &str, user_agent: &str) -> String {
        let session_id = Uuid::new_v4().to_string();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let session = Session {
            id: session_id.clone(),
            user_id: user_id.to_string(),
            created_at: now,
            last_activity: now,
            ip_address: ip_address.to_string(),
            user_agent: user_agent.to_string(),
            is_active: true,
        };

        let mut sessions = self.sessions.write().unwrap();
        sessions.insert(session_id.clone(), session);
        session_id
    }

    pub fn validate_session(&self, session_id: &str) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut sessions = self.sessions.write().unwrap();
        
        if let Some(session) = sessions.get_mut(session_id) {
            if session.is_active && (now - session.last_activity) < self.timeout_duration_seconds {
                session.last_activity = now;
                true
            } else {
                session.is_active = false;
                false
            }
        } else {
            false
        }
    }

    pub fn invalidate_session(&self, session_id: &str) {
        let mut sessions = self.sessions.write().unwrap();
        if let Some(session) = sessions.get_mut(session_id) {
            session.is_active = false;
        }
    }

    pub fn cleanup_expired_sessions(&self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut sessions = self.sessions.write().unwrap();
        sessions.retain(|_, session| {
            session.is_active && (now - session.last_activity) < self.timeout_duration_seconds
        });
    }
}

// Security utilities
pub struct SecurityUtils;

impl SecurityUtils {
    pub fn generate_secure_random_string(length: usize) -> String {
        use rand::Rng;
        const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let mut rng = rand::thread_rng();
        
        (0..length)
            .map(|_| {
                let idx = rng.gen_range(0..CHARSET.len());
                CHARSET[idx] as char
            })
            .collect()
    }

    pub fn hash_user_agent(user_agent: &str) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(user_agent.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    pub fn is_suspicious_request(req: &HttpRequest) -> bool {
        // Check for suspicious patterns
        let user_agent = req.headers()
            .get("User-Agent")
            .and_then(|h| h.to_str().ok())
            .unwrap_or("");

        // Check for common bot patterns
        let suspicious_patterns = [
            "bot", "crawler", "spider", "scraper", "curl", "wget", "python-requests"
        ];

        suspicious_patterns.iter().any(|pattern| 
            user_agent.to_lowercase().contains(pattern)
        )
    }
}