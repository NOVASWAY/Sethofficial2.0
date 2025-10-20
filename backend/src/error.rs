use actix_web::{HttpResponse, ResponseError};
use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiError {
    pub error_code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
    pub timestamp: String,
    pub request_id: Option<String>,
}

impl ApiError {
    pub fn new(error_code: String, message: String) -> Self {
        Self {
            error_code,
            message,
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

    // Common error constructors
    pub fn validation_error(message: String) -> Self {
        Self::new("VALIDATION_ERROR".to_string(), message)
    }

    pub fn not_found(resource: &str) -> Self {
        Self::new(
            "NOT_FOUND".to_string(),
            format!("{} not found", resource),
        )
    }

    pub fn unauthorized(message: Option<String>) -> Self {
        Self::new(
            "UNAUTHORIZED".to_string(),
            message.unwrap_or_else(|| "Unauthorized access".to_string()),
        )
    }

    pub fn forbidden(message: Option<String>) -> Self {
        Self::new(
            "FORBIDDEN".to_string(),
            message.unwrap_or_else(|| "Access forbidden".to_string()),
        )
    }

    pub fn internal_error(message: Option<String>) -> Self {
        Self::new(
            "INTERNAL_ERROR".to_string(),
            message.unwrap_or_else(|| "Internal server error".to_string()),
        )
    }

    pub fn database_error(message: String) -> Self {
        Self::new("DATABASE_ERROR".to_string(), message)
    }

    pub fn conflict(message: String) -> Self {
        Self::new("CONFLICT".to_string(), message)
    }

    pub fn bad_request(message: String) -> Self {
        Self::new("BAD_REQUEST".to_string(), message)
    }

    pub fn rate_limit_exceeded() -> Self {
        Self::new(
            "RATE_LIMIT_EXCEEDED".to_string(),
            "Rate limit exceeded. Please try again later.".to_string(),
        )
    }
}

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.error_code, self.message)
    }
}

impl ResponseError for ApiError {
    fn error_response(&self) -> HttpResponse {
        let status = match self.error_code.as_str() {
            "VALIDATION_ERROR" => actix_web::http::StatusCode::BAD_REQUEST,
            "NOT_FOUND" => actix_web::http::StatusCode::NOT_FOUND,
            "UNAUTHORIZED" => actix_web::http::StatusCode::UNAUTHORIZED,
            "FORBIDDEN" => actix_web::http::StatusCode::FORBIDDEN,
            "CONFLICT" => actix_web::http::StatusCode::CONFLICT,
            "RATE_LIMIT_EXCEEDED" => actix_web::http::StatusCode::TOO_MANY_REQUESTS,
            "DATABASE_ERROR" | "INTERNAL_ERROR" => actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
            _ => actix_web::http::StatusCode::BAD_REQUEST,
        };

        HttpResponse::build(status).json(self)
    }
}

// Convert common error types to ApiError
impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => ApiError::not_found("Resource"),
            sqlx::Error::Database(db_err) => {
                if db_err.constraint().is_some() {
                    ApiError::conflict("Database constraint violation".to_string())
                } else {
                    ApiError::database_error(format!("Database error: {}", db_err))
                }
            }
            _ => ApiError::database_error(format!("Database error: {}", err)),
        }
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(err: serde_json::Error) -> Self {
        ApiError::validation_error(format!("JSON parsing error: {}", err))
    }
}

impl From<uuid::Error> for ApiError {
    fn from(err: uuid::Error) -> Self {
        ApiError::validation_error(format!("Invalid UUID: {}", err))
    }
}

impl From<chrono::ParseError> for ApiError {
    fn from(err: chrono::ParseError) -> Self {
        ApiError::validation_error(format!("Date parsing error: {}", err))
    }
}

impl From<argon2::password_hash::Error> for ApiError {
    fn from(err: argon2::password_hash::Error) -> Self {
        ApiError::internal_error(Some(format!("Password hashing error: {}", err)))
    }
}

impl From<jsonwebtoken::errors::Error> for ApiError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        ApiError::unauthorized(Some(format!("JWT error: {}", err)))
    }
}

// Validation error types
#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
    pub value: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationErrors {
    pub errors: Vec<ValidationError>,
}

impl ValidationErrors {
    pub fn new() -> Self {
        Self {
            errors: Vec::new(),
        }
    }

    pub fn add_error(&mut self, field: String, message: String, value: Option<serde_json::Value>) {
        self.errors.push(ValidationError {
            field,
            message,
            value,
        });
    }

    pub fn is_empty(&self) -> bool {
        self.errors.is_empty()
    }

    pub fn to_api_error(self) -> ApiError {
        ApiError::validation_error("Validation failed".to_string())
            .with_details(serde_json::to_value(self).unwrap_or_default())
    }
}

// Validation traits and functions
pub trait Validate {
    fn validate(&self) -> Result<(), ValidationErrors>;
}

// Common validation functions
pub fn validate_email(email: &str) -> Result<(), String> {
    if email.is_empty() {
        return Err("Email is required".to_string());
    }
    
    if !email.contains('@') {
        return Err("Invalid email format".to_string());
    }
    
    let parts: Vec<&str> = email.split('@').collect();
    if parts.len() != 2 || parts[0].is_empty() || parts[1].is_empty() {
        return Err("Invalid email format".to_string());
    }
    
    if !parts[1].contains('.') {
        return Err("Invalid email format".to_string());
    }
    
    Ok(())
}

pub fn validate_phone_number(phone: &str) -> Result<(), String> {
    if phone.is_empty() {
        return Err("Phone number is required".to_string());
    }
    
    // Remove all non-digit characters
    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    
    if digits.len() < 10 || digits.len() > 15 {
        return Err("Phone number must be between 10 and 15 digits".to_string());
    }
    
    Ok(())
}

pub fn validate_uuid(uuid_str: &str) -> Result<Uuid, String> {
    Uuid::parse_str(uuid_str)
        .map_err(|_| "Invalid UUID format".to_string())
}

pub fn validate_required_string(value: &str, field_name: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err(format!("{} is required", field_name))
    } else {
        Ok(())
    }
}

pub fn validate_string_length(value: &str, min: usize, max: usize, field_name: &str) -> Result<(), String> {
    let len = value.len();
    if len < min {
        Err(format!("{} must be at least {} characters long", field_name, min))
    } else if len > max {
        Err(format!("{} must be no more than {} characters long", field_name, max))
    } else {
        Ok(())
    }
}

pub fn validate_positive_number(value: f64, field_name: &str) -> Result<(), String> {
    if value <= 0.0 {
        Err(format!("{} must be a positive number", field_name))
    } else {
        Ok(())
    }
}

pub fn validate_date_range(start_date: chrono::NaiveDate, end_date: chrono::NaiveDate) -> Result<(), String> {
    if start_date > end_date {
        Err("Start date cannot be after end date".to_string())
    } else {
        Ok(())
    }
}

// Helper macro for validation
#[macro_export]
macro_rules! validate_field {
    ($validator:expr, $field:expr, $value:expr) => {
        if let Err(err) = $validator {
            return Err(ApiError::validation_error(format!("{}: {}", $field, err)));
        }
    };
}

// Error logging and monitoring
pub fn log_error(error: &ApiError, context: Option<&str>) {
    let context_str = context.unwrap_or("Unknown context");
    tracing::error!(
        error_code = %error.error_code,
        message = %error.message,
        context = %context_str,
        timestamp = %error.timestamp,
        request_id = ?error.request_id,
        details = ?error.details,
        "API Error occurred"
    );
}

// Success response wrapper
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub message: Option<String>,
    pub timestamp: String,
    pub request_id: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
            request_id: None,
        }
    }

    pub fn success_with_message(data: T, message: String) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: Some(message),
            timestamp: chrono::Utc::now().to_rfc3339(),
            request_id: None,
        }
    }

    pub fn with_request_id(mut self, request_id: String) -> Self {
        self.request_id = Some(request_id);
        self
    }
}

// Pagination response
#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub pagination: PaginationInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginationInfo {
    pub page: u32,
    pub per_page: u32,
    pub total: u64,
    pub total_pages: u32,
    pub has_next: bool,
    pub has_prev: bool,
}

impl<T> PaginatedResponse<T> {
    pub fn new(data: Vec<T>, page: u32, per_page: u32, total: u64) -> Self {
        let total_pages = ((total as f64) / (per_page as f64)).ceil() as u32;
        let has_next = page < total_pages;
        let has_prev = page > 1;

        Self {
            data,
            pagination: PaginationInfo {
                page,
                per_page,
                total,
                total_pages,
                has_next,
                has_prev,
            },
        }
    }
}
