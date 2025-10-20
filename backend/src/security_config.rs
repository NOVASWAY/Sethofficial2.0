use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfiguration {
    // JWT Configuration
    pub jwt_secret: String,
    pub jwt_expiration_hours: u64,
    pub refresh_token_expiration_days: u64,
    
    // Password Security
    pub password_min_length: usize,
    pub password_require_uppercase: bool,
    pub password_require_lowercase: bool,
    pub password_require_numbers: bool,
    pub password_require_special_chars: bool,
    pub password_history_count: usize,
    pub password_max_age_days: u64,
    
    // Login Security
    pub max_login_attempts: u32,
    pub lockout_duration_minutes: u64,
    pub session_timeout_minutes: u64,
    pub max_concurrent_sessions: u32,
    
    // Rate Limiting
    pub enable_rate_limiting: bool,
    pub rate_limit_requests_per_minute: u32,
    pub rate_limit_burst_size: u32,
    
    // CORS Configuration
    pub enable_cors: bool,
    pub allowed_origins: Vec<String>,
    pub allowed_methods: Vec<String>,
    pub allowed_headers: Vec<String>,
    pub max_age: u64,
    
    // Security Headers
    pub enable_security_headers: bool,
    pub enable_hsts: bool,
    pub hsts_max_age: u64,
    pub enable_csp: bool,
    pub csp_policy: String,
    
    // CSRF Protection
    pub enable_csrf_protection: bool,
    pub csrf_token_length: usize,
    pub csrf_token_expiration_minutes: u64,
    
    // Input Validation
    pub max_request_size_bytes: usize,
    pub max_query_length: usize,
    pub enable_sql_injection_protection: bool,
    pub enable_xss_protection: bool,
    
    // IP Security
    pub enable_ip_whitelist: bool,
    pub allowed_ips: Vec<String>,
    pub blocked_ips: Vec<String>,
    pub enable_geo_blocking: bool,
    pub blocked_countries: Vec<String>,
    
    // Audit and Monitoring
    pub enable_audit_logging: bool,
    pub enable_security_monitoring: bool,
    pub failed_attempts_alert_threshold: u32,
    pub suspicious_requests_alert_threshold: u32,
    
    // Encryption
    pub enable_data_encryption: bool,
    pub encryption_algorithm: String,
    pub key_rotation_days: u64,
    
    // Backup Security
    pub enable_encrypted_backups: bool,
    pub backup_encryption_key: String,
    pub backup_retention_days: u64,
    
    // API Security
    pub enable_api_key_authentication: bool,
    pub api_key_length: usize,
    pub api_key_expiration_days: u64,
    pub enable_request_signing: bool,
    
    // File Upload Security
    pub max_file_size_bytes: usize,
    pub allowed_file_types: Vec<String>,
    pub scan_uploaded_files: bool,
    pub quarantine_suspicious_files: bool,
}

impl Default for SecurityConfiguration {
    fn default() -> Self {
        Self {
            // JWT Configuration
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "your-super-secret-jwt-key-change-this-in-production".to_string()),
            jwt_expiration_hours: 24,
            refresh_token_expiration_days: 7,
            
            // Password Security
            password_min_length: 8,
            password_require_uppercase: true,
            password_require_lowercase: true,
            password_require_numbers: true,
            password_require_special_chars: true,
            password_history_count: 5,
            password_max_age_days: 90,
            
            // Login Security
            max_login_attempts: 5,
            lockout_duration_minutes: 15,
            session_timeout_minutes: 30,
            max_concurrent_sessions: 3,
            
            // Rate Limiting
            enable_rate_limiting: true,
            rate_limit_requests_per_minute: 100,
            rate_limit_burst_size: 200,
            
            // CORS Configuration
            enable_cors: true,
            allowed_origins: vec![
                "http://localhost:3000".to_string(),
                "https://localhost:3000".to_string(),
            ],
            allowed_methods: vec![
                "GET".to_string(),
                "POST".to_string(),
                "PUT".to_string(),
                "DELETE".to_string(),
                "OPTIONS".to_string(),
            ],
            allowed_headers: vec![
                "Authorization".to_string(),
                "Content-Type".to_string(),
                "Accept".to_string(),
                "X-Requested-With".to_string(),
                "X-CSRF-Token".to_string(),
            ],
            max_age: 3600,
            
            // Security Headers
            enable_security_headers: true,
            enable_hsts: true,
            hsts_max_age: 31536000, // 1 year
            enable_csp: true,
            csp_policy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';".to_string(),
            
            // CSRF Protection
            enable_csrf_protection: true,
            csrf_token_length: 32,
            csrf_token_expiration_minutes: 60,
            
            // Input Validation
            max_request_size_bytes: 10 * 1024 * 1024, // 10MB
            max_query_length: 2048,
            enable_sql_injection_protection: true,
            enable_xss_protection: true,
            
            // IP Security
            enable_ip_whitelist: false,
            allowed_ips: vec![],
            blocked_ips: vec![],
            enable_geo_blocking: false,
            blocked_countries: vec![],
            
            // Audit and Monitoring
            enable_audit_logging: true,
            enable_security_monitoring: true,
            failed_attempts_alert_threshold: 10,
            suspicious_requests_alert_threshold: 5,
            
            // Encryption
            enable_data_encryption: true,
            encryption_algorithm: "AES-256-GCM".to_string(),
            key_rotation_days: 90,
            
            // Backup Security
            enable_encrypted_backups: true,
            backup_encryption_key: env::var("BACKUP_ENCRYPTION_KEY")
                .unwrap_or_else(|_| "your-backup-encryption-key".to_string()),
            backup_retention_days: 30,
            
            // API Security
            enable_api_key_authentication: false,
            api_key_length: 32,
            api_key_expiration_days: 365,
            enable_request_signing: false,
            
            // File Upload Security
            max_file_size_bytes: 5 * 1024 * 1024, // 5MB
            allowed_file_types: vec![
                "image/jpeg".to_string(),
                "image/png".to_string(),
                "image/gif".to_string(),
                "application/pdf".to_string(),
                "text/plain".to_string(),
            ],
            scan_uploaded_files: true,
            quarantine_suspicious_files: true,
        }
    }
}

impl SecurityConfiguration {
    pub fn from_env() -> Self {
        Self {
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "your-super-secret-jwt-key-change-this-in-production".to_string()),
            jwt_expiration_hours: env::var("JWT_EXPIRATION_HOURS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(24),
            refresh_token_expiration_days: env::var("REFRESH_TOKEN_EXPIRATION_DAYS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(7),
            
            password_min_length: env::var("PASSWORD_MIN_LENGTH")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(8),
            password_require_uppercase: env::var("PASSWORD_REQUIRE_UPPERCASE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            password_require_lowercase: env::var("PASSWORD_REQUIRE_LOWERCASE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            password_require_numbers: env::var("PASSWORD_REQUIRE_NUMBERS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            password_require_special_chars: env::var("PASSWORD_REQUIRE_SPECIAL_CHARS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            password_history_count: env::var("PASSWORD_HISTORY_COUNT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(5),
            password_max_age_days: env::var("PASSWORD_MAX_AGE_DAYS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(90),
            
            max_login_attempts: env::var("MAX_LOGIN_ATTEMPTS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(5),
            lockout_duration_minutes: env::var("LOCKOUT_DURATION_MINUTES")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(15),
            session_timeout_minutes: env::var("SESSION_TIMEOUT_MINUTES")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(30),
            max_concurrent_sessions: env::var("MAX_CONCURRENT_SESSIONS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(3),
            
            enable_rate_limiting: env::var("ENABLE_RATE_LIMITING")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            rate_limit_requests_per_minute: env::var("RATE_LIMIT_REQUESTS_PER_MINUTE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(100),
            rate_limit_burst_size: env::var("RATE_LIMIT_BURST_SIZE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(200),
            
            enable_cors: env::var("ENABLE_CORS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            allowed_origins: env::var("ALLOWED_ORIGINS")
                .ok()
                .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
                .unwrap_or_else(|| vec![
                    "http://localhost:3000".to_string(),
                    "https://localhost:3000".to_string(),
                ]),
            allowed_methods: env::var("ALLOWED_METHODS")
                .ok()
                .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
                .unwrap_or_else(|| vec![
                    "GET".to_string(),
                    "POST".to_string(),
                    "PUT".to_string(),
                    "DELETE".to_string(),
                    "OPTIONS".to_string(),
                ]),
            allowed_headers: env::var("ALLOWED_HEADERS")
                .ok()
                .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
                .unwrap_or_else(|| vec![
                    "Authorization".to_string(),
                    "Content-Type".to_string(),
                    "Accept".to_string(),
                    "X-Requested-With".to_string(),
                    "X-CSRF-Token".to_string(),
                ]),
            max_age: env::var("CORS_MAX_AGE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(3600),
            
            enable_security_headers: env::var("ENABLE_SECURITY_HEADERS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            enable_hsts: env::var("ENABLE_HSTS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            hsts_max_age: env::var("HSTS_MAX_AGE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(31536000),
            enable_csp: env::var("ENABLE_CSP")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            csp_policy: env::var("CSP_POLICY")
                .unwrap_or_else(|_| "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';".to_string()),
            
            enable_csrf_protection: env::var("ENABLE_CSRF_PROTECTION")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            csrf_token_length: env::var("CSRF_TOKEN_LENGTH")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(32),
            csrf_token_expiration_minutes: env::var("CSRF_TOKEN_EXPIRATION_MINUTES")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(60),
            
            max_request_size_bytes: env::var("MAX_REQUEST_SIZE_BYTES")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(10 * 1024 * 1024),
            max_query_length: env::var("MAX_QUERY_LENGTH")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(2048),
            enable_sql_injection_protection: env::var("ENABLE_SQL_INJECTION_PROTECTION")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            enable_xss_protection: env::var("ENABLE_XSS_PROTECTION")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            
            enable_ip_whitelist: env::var("ENABLE_IP_WHITELIST")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(false),
            allowed_ips: env::var("ALLOWED_IPS")
                .ok()
                .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
                .unwrap_or_default(),
            blocked_ips: env::var("BLOCKED_IPS")
                .ok()
                .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
                .unwrap_or_default(),
            enable_geo_blocking: env::var("ENABLE_GEO_BLOCKING")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(false),
            blocked_countries: env::var("BLOCKED_COUNTRIES")
                .ok()
                .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
                .unwrap_or_default(),
            
            enable_audit_logging: env::var("ENABLE_AUDIT_LOGGING")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            enable_security_monitoring: env::var("ENABLE_SECURITY_MONITORING")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            failed_attempts_alert_threshold: env::var("FAILED_ATTEMPTS_ALERT_THRESHOLD")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(10),
            suspicious_requests_alert_threshold: env::var("SUSPICIOUS_REQUESTS_ALERT_THRESHOLD")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(5),
            
            enable_data_encryption: env::var("ENABLE_DATA_ENCRYPTION")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            encryption_algorithm: env::var("ENCRYPTION_ALGORITHM")
                .unwrap_or_else(|_| "AES-256-GCM".to_string()),
            key_rotation_days: env::var("KEY_ROTATION_DAYS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(90),
            
            enable_encrypted_backups: env::var("ENABLE_ENCRYPTED_BACKUPS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            backup_encryption_key: env::var("BACKUP_ENCRYPTION_KEY")
                .unwrap_or_else(|_| "your-backup-encryption-key".to_string()),
            backup_retention_days: env::var("BACKUP_RETENTION_DAYS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(30),
            
            enable_api_key_authentication: env::var("ENABLE_API_KEY_AUTHENTICATION")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(false),
            api_key_length: env::var("API_KEY_LENGTH")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(32),
            api_key_expiration_days: env::var("API_KEY_EXPIRATION_DAYS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(365),
            enable_request_signing: env::var("ENABLE_REQUEST_SIGNING")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(false),
            
            max_file_size_bytes: env::var("MAX_FILE_SIZE_BYTES")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(5 * 1024 * 1024),
            allowed_file_types: env::var("ALLOWED_FILE_TYPES")
                .ok()
                .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
                .unwrap_or_else(|| vec![
                    "image/jpeg".to_string(),
                    "image/png".to_string(),
                    "image/gif".to_string(),
                    "application/pdf".to_string(),
                    "text/plain".to_string(),
                ]),
            scan_uploaded_files: env::var("SCAN_UPLOADED_FILES")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
            quarantine_suspicious_files: env::var("QUARANTINE_SUSPICIOUS_FILES")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
        }
    }
}

// Security validation functions
impl SecurityConfiguration {
    pub fn validate(&self) -> Result<(), String> {
        // Validate JWT secret
        if self.jwt_secret.len() < 32 {
            return Err("JWT secret must be at least 32 characters long".to_string());
        }

        // Validate password requirements
        if self.password_min_length < 6 {
            return Err("Password minimum length must be at least 6 characters".to_string());
        }

        // Validate rate limiting
        if self.rate_limit_requests_per_minute == 0 {
            return Err("Rate limit requests per minute must be greater than 0".to_string());
        }

        // Validate session timeout
        if self.session_timeout_minutes == 0 {
            return Err("Session timeout must be greater than 0".to_string());
        }

        // Validate CORS origins
        for origin in &self.allowed_origins {
            if !origin.starts_with("http://") && !origin.starts_with("https://") {
                return Err(format!("Invalid CORS origin: {}", origin));
            }
        }

        // Validate file size limits
        if self.max_file_size_bytes == 0 {
            return Err("Maximum file size must be greater than 0".to_string());
        }

        if self.max_request_size_bytes == 0 {
            return Err("Maximum request size must be greater than 0".to_string());
        }

        Ok(())
    }

    pub fn is_production_ready(&self) -> bool {
        // Check if configuration is suitable for production
        self.jwt_secret.len() >= 64 &&
        self.jwt_secret != "your-super-secret-jwt-key-change-this-in-production" &&
        self.backup_encryption_key != "your-backup-encryption-key" &&
        self.enable_security_headers &&
        self.enable_csrf_protection &&
        self.enable_rate_limiting &&
        self.enable_audit_logging &&
        self.enable_data_encryption &&
        self.enable_encrypted_backups
    }

    pub fn get_security_score(&self) -> u8 {
        let mut score = 0u8;

        // JWT Security (20 points)
        if self.jwt_secret.len() >= 64 { score += 10; }
        if self.jwt_expiration_hours <= 24 { score += 5; }
        if self.refresh_token_expiration_days <= 7 { score += 5; }

        // Password Security (20 points)
        if self.password_min_length >= 8 { score += 5; }
        if self.password_require_uppercase { score += 3; }
        if self.password_require_lowercase { score += 3; }
        if self.password_require_numbers { score += 3; }
        if self.password_require_special_chars { score += 3; }
        if self.password_max_age_days <= 90 { score += 3; }

        // Login Security (15 points)
        if self.max_login_attempts <= 5 { score += 5; }
        if self.lockout_duration_minutes >= 15 { score += 5; }
        if self.session_timeout_minutes <= 60 { score += 5; }

        // Rate Limiting (10 points)
        if self.enable_rate_limiting { score += 10; }

        // Security Headers (10 points)
        if self.enable_security_headers { score += 5; }
        if self.enable_hsts { score += 3; }
        if self.enable_csp { score += 2; }

        // CSRF Protection (10 points)
        if self.enable_csrf_protection { score += 10; }

        // Input Validation (10 points)
        if self.enable_sql_injection_protection { score += 5; }
        if self.enable_xss_protection { score += 5; }

        // Audit and Monitoring (5 points)
        if self.enable_audit_logging { score += 3; }
        if self.enable_security_monitoring { score += 2; }

        score
    }
}
