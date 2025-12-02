use actix_web::{web, HttpRequest, HttpResponse, Result, middleware::Next, dev::ServiceRequest, dev::ServiceResponse, Error};
use actix_web::body::{MessageBody, BoxBody};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use regex::Regex;
use crate::error::{ApiError, ValidationErrors, validate_email, validate_phone_number, validate_required_string, validate_string_length, validate_positive_number};
use crate::error::Validate;
use crate::models::*;
use std::sync::OnceLock;

// Global regex patterns for validation
static EMAIL_REGEX: OnceLock<Regex> = OnceLock::new();
static PHONE_REGEX: OnceLock<Regex> = OnceLock::new();
static SQL_INJECTION_REGEX: OnceLock<Regex> = OnceLock::new();
static XSS_REGEX: OnceLock<Regex> = OnceLock::new();

fn get_email_regex() -> &'static Regex {
    EMAIL_REGEX.get_or_init(|| {
        Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap()
    })
}

fn get_phone_regex() -> &'static Regex {
    PHONE_REGEX.get_or_init(|| {
        Regex::new(r"^\+?[1-9]\d{1,14}$").unwrap()
    })
}

fn get_sql_injection_regex() -> &'static Regex {
    SQL_INJECTION_REGEX.get_or_init(|| {
        Regex::new(r"(?i)(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|vbscript|onload|onerror|onclick)").unwrap()
    })
}

fn get_xss_regex() -> &'static Regex {
    XSS_REGEX.get_or_init(|| {
        Regex::new(r"(?i)(<script|</script|javascript:|vbscript:|onload=|onerror=|onclick=|<iframe|</iframe|<object|</object|<embed|</embed)").unwrap()
    })
}

// Input sanitization functions
pub fn sanitize_string(input: &str) -> String {
    let mut sanitized = input.to_string();
    
    // Remove null bytes
    sanitized = sanitized.replace('\0', "");
    
    // Trim whitespace
    sanitized = sanitized.trim().to_string();
    
    // Escape HTML entities
    sanitized = escape_html(&sanitized);
    
    // Remove potential XSS patterns
    let xss_regex = get_xss_regex();
    sanitized = xss_regex.replace_all(&sanitized, "").to_string();
    
    sanitized
}

pub fn sanitize_email(email: &str) -> Result<String, ApiError> {
    let sanitized = sanitize_string(email);
    
    if !get_email_regex().is_match(&sanitized) {
        return Err(ApiError::validation_error("Invalid email format".to_string()));
    }
    
    Ok(sanitized.to_lowercase())
}

pub fn sanitize_phone(phone: &str) -> Result<String, ApiError> {
    let sanitized = sanitize_string(phone);
    
    // Remove all non-digit characters except +
    let cleaned: String = sanitized.chars()
        .filter(|c| c.is_ascii_digit() || *c == '+')
        .collect();
    
    if !get_phone_regex().is_match(&cleaned) {
        return Err(ApiError::validation_error("Invalid phone number format".to_string()));
    }
    
    Ok(cleaned)
}

pub fn sanitize_name(name: &str) -> Result<String, ApiError> {
    let sanitized = sanitize_string(name);
    
    // Check for SQL injection patterns
    let sql_regex = get_sql_injection_regex();
    if sql_regex.is_match(&sanitized) {
        return Err(ApiError::validation_error("Invalid characters in name".to_string()));
    }
    
    // Check length
    if sanitized.len() < 1 || sanitized.len() > 100 {
        return Err(ApiError::validation_error("Name must be between 1 and 100 characters".to_string()));
    }
    
    Ok(sanitized)
}

pub fn sanitize_text(text: &str) -> Result<String, ApiError> {
    let sanitized = sanitize_string(text);
    
    // Check for SQL injection patterns
    let sql_regex = get_sql_injection_regex();
    if sql_regex.is_match(&sanitized) {
        return Err(ApiError::validation_error("Invalid characters in text".to_string()));
    }
    
    Ok(sanitized)
}

pub fn sanitize_uuid(uuid_str: &str) -> Result<String, ApiError> {
    let sanitized = sanitize_string(uuid_str);
    
    // Validate UUID format
    if uuid::Uuid::parse_str(&sanitized).is_err() {
        return Err(ApiError::validation_error("Invalid UUID format".to_string()));
    }
    
    Ok(sanitized)
}

pub fn sanitize_numeric_string(value: &str) -> Result<String, ApiError> {
    let sanitized = sanitize_string(value);
    
    // Check if it's a valid number
    if sanitized.parse::<f64>().is_err() {
        return Err(ApiError::validation_error("Invalid numeric value".to_string()));
    }
    
    Ok(sanitized)
}

// HTML escaping function
fn escape_html(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
        .replace('/', "&#x2F;")
}

// Validation middleware for different data types
pub async fn validate_patient_data(
    req: ServiceRequest,
    next: Next<impl MessageBody>,
) -> Result<ServiceResponse<BoxBody>, Error> {
    // Basic validation middleware - in a real implementation,
    // you would extract and validate the request body here
    
    Ok(next.call(req).await?.map_into_boxed_body())
}

pub async fn validate_user_data(
    req: ServiceRequest,
    next: Next<impl MessageBody>,
) -> Result<ServiceResponse<BoxBody>, Error> {
    // Basic validation middleware - in a real implementation,
    // you would extract and validate the request body here
    
    Ok(next.call(req).await?.map_into_boxed_body())
}

// Generic validation middleware
pub async fn validate_json_data<T>(
    req: ServiceRequest,
    next: Next<impl MessageBody>,
) -> Result<ServiceResponse<impl MessageBody>, Error>
where
    T: for<'de> Deserialize<'de> + Validate + Send + 'static,
{
    // This is a placeholder for JSON validation middleware
    // In a real implementation, you would extract the JSON body,
    // deserialize it to T, validate it, and sanitize the data
    
    Ok(next.call(req).await?.map_into_boxed_body())
}

// Query parameter validation
pub fn validate_query_params(params: &web::Query<HashMap<String, String>>) -> Result<(), ApiError> {
    for (key, value) in params.iter() {
        // Sanitize each parameter
        let sanitized_value = sanitize_string(value);
        
        // Check for SQL injection in parameter values
        let sql_regex = get_sql_injection_regex();
        if sql_regex.is_match(&sanitized_value) {
            return Err(ApiError::validation_error(
                format!("Invalid characters in parameter: {}", key)
            ));
        }
        
        // Check for XSS in parameter values
        let xss_regex = get_xss_regex();
        if xss_regex.is_match(&sanitized_value) {
            return Err(ApiError::validation_error(
                format!("Invalid characters in parameter: {}", key)
            ));
        }
    }
    
    Ok(())
}

// Path parameter validation
pub fn validate_path_params(params: &web::Path<HashMap<String, String>>) -> Result<(), ApiError> {
    for (key, value) in params.iter() {
        // Sanitize each parameter
        let sanitized_value = sanitize_string(value);
        
        // Check for SQL injection in parameter values
        let sql_regex = get_sql_injection_regex();
        if sql_regex.is_match(&sanitized_value) {
            return Err(ApiError::validation_error(
                format!("Invalid characters in path parameter: {}", key)
            ));
        }
        
        // Check for XSS in parameter values
        let xss_regex = get_xss_regex();
        if xss_regex.is_match(&sanitized_value) {
            return Err(ApiError::validation_error(
                format!("Invalid characters in path parameter: {}", key)
            ));
        }
    }
    
    Ok(())
}

// File upload validation
pub fn validate_file_upload(
    filename: &str,
    content_type: &str,
    file_size: usize,
    max_size: usize,
) -> Result<(), ApiError> {
    // Validate filename
    let sanitized_filename = sanitize_string(filename);
    if sanitized_filename != filename {
        return Err(ApiError::validation_error("Invalid filename".to_string()));
    }
    
    // Check file extension
    let allowed_extensions = ["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx", "txt"];
    if let Some(extension) = filename.split('.').last() {
        if !allowed_extensions.contains(&extension.to_lowercase().as_str()) {
            return Err(ApiError::validation_error("File type not allowed".to_string()));
        }
    }
    
    // Validate content type
    let allowed_types = [
        "image/jpeg", "image/png", "image/gif",
        "application/pdf", "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain"
    ];
    if !allowed_types.contains(&content_type) {
        return Err(ApiError::validation_error("Content type not allowed".to_string()));
    }
    
    // Check file size
    if file_size > max_size {
        return Err(ApiError::validation_error(
            format!("File size exceeds maximum allowed size of {} bytes", max_size)
        ));
    }
    
    Ok(())
}

// Rate limiting validation
pub fn validate_rate_limit(
    client_ip: &str,
    endpoint: &str,
    requests_per_minute: u32,
) -> Result<(), ApiError> {
    // This would integrate with a rate limiting system
    // For now, we'll implement a basic check
    
    // In a real implementation, you would:
    // 1. Check if the client IP has exceeded the rate limit for this endpoint
    // 2. Use Redis or in-memory storage to track request counts
    // 3. Return an error if the rate limit is exceeded
    
    Ok(())
}

// Authentication validation
pub fn validate_authentication(
    auth_header: Option<&str>,
) -> Result<String, ApiError> {
    match auth_header {
        Some(header) => {
            if !header.starts_with("Bearer ") {
                return Err(ApiError::unauthorized(Some("Invalid authorization header format".to_string())));
            }
            
            let token = &header[7..]; // Remove "Bearer " prefix
            let sanitized_token = sanitize_string(token);
            
            if sanitized_token != token {
                return Err(ApiError::unauthorized(Some("Invalid token format".to_string())));
            }
            
            Ok(sanitized_token)
        }
        None => Err(ApiError::unauthorized(Some("Authorization header required".to_string()))),
    }
}

// Input validation for specific data types
pub fn validate_patient_input(mut data: CreatePatient) -> Result<CreatePatient, ApiError> {
    
    // Sanitize and validate first name
    data.first_name = sanitize_name(&data.first_name)?;
    
    // Sanitize and validate last name
    data.last_name = sanitize_name(&data.last_name)?;
    
    // Sanitize and validate email if provided
    
    // Sanitize and validate phone
    data.phone = sanitize_phone(&data.phone)?;
    
    // Sanitize and validate address if provided
    if let Some(location) = &data.location {
        data.location = Some(sanitize_text(location)?);
    }
    
    // Sanitize and validate emergency contact if provided
    if let Some(emergency_contact) = &data.emergency_contact {
        data.emergency_contact = Some(sanitize_name(emergency_contact)?);
    }
    
    // Sanitize and validate emergency phone if provided
    if let Some(emergency_phone) = &data.emergency_phone {
        data.emergency_phone = Some(sanitize_phone(emergency_phone)?);
    }
    
    // Sanitize and validate medical history if provided
    if let Some(medical_history) = &data.medical_history {
        data.medical_history = Some(sanitize_text(medical_history)?);
    }
    
    // Sanitize and validate allergies if provided
    if let Some(allergies) = &data.allergies {
        if let Some(allergies_str) = allergies.as_str() {
            data.allergies = Some(serde_json::Value::String(sanitize_text(allergies_str)?));
        }
    }
    
    // Validate the sanitized data
    data.validate()
        .map_err(|errors| errors.to_api_error())?;
    
    Ok(data)
}

pub fn validate_user_input(mut data: CreateUser) -> Result<CreateUser, ApiError> {
    
    // Sanitize and validate username
    data.username = sanitize_name(&data.username)?;
    
    // Sanitize and validate email if provided
    
    // Sanitize and validate name
    data.name = sanitize_name(&data.name)?;
    
    // Sanitize and validate department if provided
    if let Some(department) = &data.department {
        data.department = Some(sanitize_name(department)?);
    }
    
    // Validate the sanitized data
    data.validate()
        .map_err(|errors| errors.to_api_error())?;
    
    Ok(data)
}

// Utility function to validate and sanitize JSON input
pub fn validate_and_sanitize_json<T>(
    json_data: &serde_json::Value,
) -> Result<T, ApiError>
where
    T: for<'de> Deserialize<'de> + Validate + Clone,
{
    // Deserialize the JSON
    let data: T = serde_json::from_value(json_data.clone())
        .map_err(|_| ApiError::validation_error("Invalid JSON format".to_string()))?;
    
    // Validate the data
    data.validate()
        .map_err(|errors| errors.to_api_error())?;
    
    Ok(data)
}

// Content Security Policy validation
pub fn validate_csp_header(csp_header: &str) -> Result<(), ApiError> {
    let sanitized_csp = sanitize_string(csp_header);
    
    // Check for dangerous CSP directives
    let dangerous_directives = ["unsafe-inline", "unsafe-eval", "data:", "javascript:"];
    for directive in dangerous_directives {
        if sanitized_csp.contains(directive) {
            return Err(ApiError::validation_error(
                format!("Dangerous CSP directive detected: {}", directive)
            ));
        }
    }
    
    Ok(())
}

// SQL injection prevention
pub fn prevent_sql_injection(query: &str) -> Result<String, ApiError> {
    let sanitized = sanitize_string(query);
    
    let sql_regex = get_sql_injection_regex();
    if sql_regex.is_match(&sanitized) {
        return Err(ApiError::validation_error("Potential SQL injection detected".to_string()));
    }
    
    Ok(sanitized)
}

// XSS prevention
pub fn prevent_xss(input: &str) -> Result<String, ApiError> {
    let sanitized = sanitize_string(input);
    
    let xss_regex = get_xss_regex();
    if xss_regex.is_match(&sanitized) {
        return Err(ApiError::validation_error("Potential XSS attack detected".to_string()));
    }
    
    Ok(sanitized)
}
