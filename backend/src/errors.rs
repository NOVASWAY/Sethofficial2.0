use actix_web::{HttpResponse, ResponseError};
use serde::{Deserialize, Serialize};
use std::fmt;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),
    
    #[error("Validation error: {0}")]
    Validation(#[from] validator::ValidationErrors),
    
    #[error("Authentication error: {0}")]
    Authentication(String),
    
    #[error("Authorization error: {0}")]
    Authorization(String),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Conflict: {0}")]
    Conflict(String),
    
    #[error("Business rule violation: {0}")]
    BusinessRule(String),
    
    #[error("External API error: {0}")]
    ExternalApi(String),
    
    #[error("Internal server error: {0}")]
    Internal(String),
    
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
    
    #[error("CSRF token invalid")]
    CsrfTokenInvalid,
    
    #[error("Session expired")]
    SessionExpired,
    
    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
    pub code: String,
    pub details: Option<serde_json::Value>,
    pub timestamp: String,
    pub request_id: Option<String>,
}

impl ErrorResponse {
    pub fn new(error: &str, message: &str, code: &str) -> Self {
        Self {
            error: error.to_string(),
            message: message.to_string(),
            code: code.to_string(),
            details: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
            request_id: None,
        }
    }
    
    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }
    
    pub fn with_request_id(mut self, request_id: String) -> Self {
        self.request_id = Some(request_id);
        self
    }
}

impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        let (status, error_response) = match self {
            AppError::Database(_) => (
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                ErrorResponse::new(
                    "Database Error",
                    "A database error occurred. Please try again later.",
                    "DATABASE_ERROR"
                ),
            ),
            AppError::Redis(_) => (
                actix_web::http::StatusCode::SERVICE_UNAVAILABLE,
                ErrorResponse::new(
                    "Cache Error",
                    "A cache service error occurred. Please try again later.",
                    "CACHE_ERROR"
                ),
            ),
            AppError::Validation(validation_errors) => {
                let mut details = serde_json::Map::new();
                for (field, errors) in validation_errors.field_errors() {
                    let error_messages: Vec<String> = errors
                        .iter()
                        .map(|e| e.message.as_ref().map(|m| m.to_string()).unwrap_or_else(|| format!("{:?}", e.code)))
                        .collect();
                    details.insert(field.to_string(), serde_json::Value::Array(
                        error_messages.into_iter().map(serde_json::Value::String).collect()
                    ));
                }
                
                (
                    actix_web::http::StatusCode::BAD_REQUEST,
                    ErrorResponse::new(
                        "Validation Error",
                        "The request data is invalid.",
                        "VALIDATION_ERROR"
                    ).with_details(serde_json::Value::Object(details))
                )
            },
            AppError::Authentication(msg) => (
                actix_web::http::StatusCode::UNAUTHORIZED,
                ErrorResponse::new(
                    "Authentication Error",
                    msg,
                    "AUTHENTICATION_ERROR"
                ),
            ),
            AppError::Authorization(msg) => (
                actix_web::http::StatusCode::FORBIDDEN,
                ErrorResponse::new(
                    "Authorization Error",
                    msg,
                    "AUTHORIZATION_ERROR"
                ),
            ),
            AppError::NotFound(msg) => (
                actix_web::http::StatusCode::NOT_FOUND,
                ErrorResponse::new(
                    "Not Found",
                    msg,
                    "NOT_FOUND"
                ),
            ),
            AppError::Conflict(msg) => (
                actix_web::http::StatusCode::CONFLICT,
                ErrorResponse::new(
                    "Conflict",
                    msg,
                    "CONFLICT"
                ),
            ),
            AppError::BusinessRule(msg) => (
                actix_web::http::StatusCode::UNPROCESSABLE_ENTITY,
                ErrorResponse::new(
                    "Business Rule Violation",
                    msg,
                    "BUSINESS_RULE_VIOLATION"
                ),
            ),
            AppError::ExternalApi(msg) => (
                actix_web::http::StatusCode::BAD_GATEWAY,
                ErrorResponse::new(
                    "External Service Error",
                    msg,
                    "EXTERNAL_API_ERROR"
                ),
            ),
            AppError::Internal(msg) => (
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                ErrorResponse::new(
                    "Internal Server Error",
                    msg,
                    "INTERNAL_ERROR"
                ),
            ),
            AppError::RateLimitExceeded => (
                actix_web::http::StatusCode::TOO_MANY_REQUESTS,
                ErrorResponse::new(
                    "Rate Limit Exceeded",
                    "Too many requests. Please try again later.",
                    "RATE_LIMIT_EXCEEDED"
                ),
            ),
            AppError::CsrfTokenInvalid => (
                actix_web::http::StatusCode::FORBIDDEN,
                ErrorResponse::new(
                    "CSRF Token Invalid",
                    "The CSRF token is invalid or missing.",
                    "CSRF_TOKEN_INVALID"
                ),
            ),
            AppError::SessionExpired => (
                actix_web::http::StatusCode::UNAUTHORIZED,
                ErrorResponse::new(
                    "Session Expired",
                    "Your session has expired. Please log in again.",
                    "SESSION_EXPIRED"
                ),
            ),
            AppError::InvalidInput(msg) => (
                actix_web::http::StatusCode::BAD_REQUEST,
                ErrorResponse::new(
                    "Invalid Input",
                    msg,
                    "INVALID_INPUT"
                ),
            ),
        };

        HttpResponse::build(status).json(error_response)
    }
}

// Business rule validation errors
#[derive(Debug, Serialize, Deserialize)]
pub struct BusinessRuleError {
    pub rule: String,
    pub message: String,
    pub context: Option<serde_json::Value>,
}

impl BusinessRuleError {
    pub fn new(rule: &str, message: &str) -> Self {
        Self {
            rule: rule.to_string(),
            message: message.to_string(),
            context: None,
        }
    }
    
    pub fn with_context(mut self, context: serde_json::Value) -> Self {
        self.context = Some(context);
        self
    }
}

// Appointment conflict error
pub fn appointment_conflict_error(
    existing_appointment: &str,
    requested_time: &str,
) -> AppError {
    AppError::BusinessRule(format!(
        "Appointment conflict: {} is already scheduled at {}",
        existing_appointment, requested_time
    ))
}

// Inventory insufficient error
pub fn insufficient_inventory_error(
    medication: &str,
    requested: i32,
    available: i32,
) -> AppError {
    AppError::BusinessRule(format!(
        "Insufficient inventory: {} requested {} but only {} available",
        medication, requested, available
    ))
}

// Expired medication error
pub fn expired_medication_error(medication: &str, expiry_date: &str) -> AppError {
    AppError::BusinessRule(format!(
        "Medication expired: {} expired on {}",
        medication, expiry_date
    ))
}

// Invalid prescription error
pub fn invalid_prescription_error(reason: &str) -> AppError {
    AppError::BusinessRule(format!("Invalid prescription: {}", reason))
}

// Payment processing error
pub fn payment_processing_error(reason: &str) -> AppError {
    AppError::ExternalApi(format!("Payment processing failed: {}", reason))
}

// SHA verification error
pub fn sha_verification_error(reason: &str) -> AppError {
    AppError::ExternalApi(format!("SHA verification failed: {}", reason))
}

// Logging helper
pub fn log_error(error: &AppError, request_id: Option<&str>) {
    let log_message = match request_id {
        Some(id) => format!("Request ID: {} - Error: {}", id, error),
        None => format!("Error: {}", error),
    };
    
    match error {
        AppError::Database(_) | AppError::Redis(_) | AppError::Internal(_) => {
            log::error!("{}", log_message);
        }
        AppError::Validation(_) | AppError::InvalidInput(_) => {
            log::warn!("{}", log_message);
        }
        AppError::Authentication(_) | AppError::Authorization(_) => {
            log::warn!("{}", log_message);
        }
        AppError::BusinessRule(_) => {
            log::info!("{}", log_message);
        }
        _ => {
            log::error!("{}", log_message);
        }
    }
}

// Error context for better debugging
#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorContext {
    pub user_id: Option<String>,
    pub action: String,
    pub resource: String,
    pub timestamp: String,
    pub request_id: Option<String>,
}

impl ErrorContext {
    pub fn new(action: &str, resource: &str) -> Self {
        Self {
            user_id: None,
            action: action.to_string(),
            resource: resource.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            request_id: None,
        }
    }
    
    pub fn with_user_id(mut self, user_id: String) -> Self {
        self.user_id = Some(user_id);
        self
    }
    
    pub fn with_request_id(mut self, request_id: String) -> Self {
        self.request_id = Some(request_id);
        self
    }
}
