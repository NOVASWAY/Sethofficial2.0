use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use regex::Regex;
use crate::error::ApiError;
use std::sync::OnceLock;

// Global regex patterns for sanitization
static HTML_TAG_REGEX: OnceLock<Regex> = OnceLock::new();
static SCRIPT_REGEX: OnceLock<Regex> = OnceLock::new();
static SQL_KEYWORD_REGEX: OnceLock<Regex> = OnceLock::new();
static PATH_TRAVERSAL_REGEX: OnceLock<Regex> = OnceLock::new();
static COMMAND_INJECTION_REGEX: OnceLock<Regex> = OnceLock::new();

fn get_html_tag_regex() -> &'static Regex {
    HTML_TAG_REGEX.get_or_init(|| {
        Regex::new(r"<[^>]*>").unwrap()
    })
}

fn get_script_regex() -> &'static Regex {
    SCRIPT_REGEX.get_or_init(|| {
        Regex::new(r"(?i)<script[^>]*>.*?</script>").unwrap()
    })
}

fn get_sql_keyword_regex() -> &'static Regex {
    SQL_KEYWORD_REGEX.get_or_init(|| {
        Regex::new(r"(?i)\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|vbscript|onload|onerror|onclick)\b").unwrap()
    })
}

fn get_path_traversal_regex() -> &'static Regex {
    PATH_TRAVERSAL_REGEX.get_or_init(|| {
        Regex::new(r"\.\./|\.\.\\|\.\.%2f|\.\.%5c").unwrap()
    })
}

fn get_command_injection_regex() -> &'static Regex {
    COMMAND_INJECTION_REGEX.get_or_init(|| {
        Regex::new(r"[;&|`$(){}[\]\\]").unwrap()
    })
}

// Main sanitization service
pub struct SanitizationService {
    max_string_length: usize,
    allowed_html_tags: Vec<String>,
    blocked_patterns: Vec<Regex>,
}

impl SanitizationService {
    pub fn new() -> Self {
        Self {
            max_string_length: 10000,
            allowed_html_tags: vec![
                "p".to_string(),
                "br".to_string(),
                "strong".to_string(),
                "em".to_string(),
                "u".to_string(),
            ],
            blocked_patterns: vec![
                get_script_regex().clone(),
                get_sql_keyword_regex().clone(),
                get_path_traversal_regex().clone(),
                get_command_injection_regex().clone(),
            ],
        }
    }

    pub fn sanitize_string(&self, input: &str) -> Result<String, ApiError> {
        if input.len() > self.max_string_length {
            return Err(ApiError::validation_error(
                format!("Input exceeds maximum length of {} characters", self.max_string_length)
            ));
        }

        let mut sanitized = input.to_string();

        // Remove null bytes
        sanitized = sanitized.replace('\0', "");

        // Trim whitespace
        sanitized = sanitized.trim().to_string();

        // Check for blocked patterns
        for pattern in &self.blocked_patterns {
            if pattern.is_match(&sanitized) {
                return Err(ApiError::validation_error("Input contains blocked patterns".to_string()));
            }
        }

        // Escape HTML entities
        sanitized = self.escape_html(&sanitized);

        // Remove dangerous HTML tags
        sanitized = self.remove_dangerous_html(&sanitized);

        Ok(sanitized)
    }

    pub fn sanitize_email(&self, email: &str) -> Result<String, ApiError> {
        let sanitized = self.sanitize_string(email)?;
        
        // Additional email-specific validation
        if !self.is_valid_email(&sanitized) {
            return Err(ApiError::validation_error("Invalid email format".to_string()));
        }

        Ok(sanitized.to_lowercase())
    }

    pub fn sanitize_phone(&self, phone: &str) -> Result<String, ApiError> {
        let sanitized = self.sanitize_string(phone)?;
        
        // Remove all non-digit characters except +
        let cleaned: String = sanitized.chars()
            .filter(|c| c.is_ascii_digit() || *c == '+')
            .collect();

        if !self.is_valid_phone(&cleaned) {
            return Err(ApiError::validation_error("Invalid phone number format".to_string()));
        }

        Ok(cleaned)
    }

    pub fn sanitize_name(&self, name: &str) -> Result<String, ApiError> {
        let sanitized = self.sanitize_string(name)?;
        
        // Names should only contain letters, spaces, hyphens, and apostrophes
        if !self.is_valid_name(&sanitized) {
            return Err(ApiError::validation_error("Invalid name format".to_string()));
        }

        Ok(sanitized)
    }

    pub fn sanitize_text(&self, text: &str) -> Result<String, ApiError> {
        let sanitized = self.sanitize_string(text)?;
        
        // Text can contain more characters but still needs to be safe
        Ok(sanitized)
    }

    pub fn sanitize_url(&self, url: &str) -> Result<String, ApiError> {
        let sanitized = self.sanitize_string(url)?;
        
        if !self.is_valid_url(&sanitized) {
            return Err(ApiError::validation_error("Invalid URL format".to_string()));
        }

        Ok(sanitized)
    }

    pub fn sanitize_filename(&self, filename: &str) -> Result<String, ApiError> {
        let sanitized = self.sanitize_string(filename)?;
        
        // Check for path traversal
        if get_path_traversal_regex().is_match(&sanitized) {
            return Err(ApiError::validation_error("Invalid filename: path traversal detected".to_string()));
        }

        // Check for dangerous characters
        if sanitized.contains('/') || sanitized.contains('\\') || sanitized.contains(':') {
            return Err(ApiError::validation_error("Invalid filename: dangerous characters detected".to_string()));
        }

        Ok(sanitized)
    }

    pub fn sanitize_json(&self, json: &str) -> Result<String, ApiError> {
        let sanitized = self.sanitize_string(json)?;
        
        // Validate JSON structure
        if serde_json::from_str::<serde_json::Value>(&sanitized).is_err() {
            return Err(ApiError::validation_error("Invalid JSON format".to_string()));
        }

        Ok(sanitized)
    }

    pub fn sanitize_sql_query(&self, query: &str) -> Result<String, ApiError> {
        let sanitized = self.sanitize_string(query)?;
        
        // Check for SQL injection patterns
        if get_sql_keyword_regex().is_match(&sanitized) {
            return Err(ApiError::validation_error("Potential SQL injection detected".to_string()));
        }

        Ok(sanitized)
    }

    // Validation helper methods
    fn is_valid_email(&self, email: &str) -> bool {
        let email_regex = Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap();
        email_regex.is_match(email)
    }

    fn is_valid_phone(&self, phone: &str) -> bool {
        let phone_regex = Regex::new(r"^\+?[1-9]\d{1,14}$").unwrap();
        phone_regex.is_match(phone)
    }

    fn is_valid_name(&self, name: &str) -> bool {
        let name_regex = Regex::new(r"^[a-zA-Z\s\-']+$").unwrap();
        name_regex.is_match(name) && name.len() >= 1 && name.len() <= 100
    }

    fn is_valid_url(&self, url: &str) -> bool {
        let url_regex = Regex::new(r"^https?://[^\s/$.?#].[^\s]*$").unwrap();
        url_regex.is_match(url)
    }

    fn escape_html(&self, input: &str) -> String {
        input
            .replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&#x27;")
            .replace('/', "&#x2F;")
    }

    fn remove_dangerous_html(&self, input: &str) -> String {
        let html_regex = get_html_tag_regex();
        let mut result = input.to_string();
        
        // Remove all HTML tags except allowed ones
        for tag in &self.allowed_html_tags {
            let tag_regex = Regex::new(&format!(r"<{}(?:\s[^>]*)?>", tag)).unwrap();
            result = tag_regex.replace_all(&result, "").to_string();
        }
        
        // Remove any remaining HTML tags
        result = html_regex.replace_all(&result, "").to_string();
        
        result
    }
}

// Input validation for different data types
pub struct InputValidator {
    sanitizer: SanitizationService,
}

impl InputValidator {
    pub fn new() -> Self {
        Self {
            sanitizer: SanitizationService::new(),
        }
    }

    pub fn validate_patient_data(&self, data: &mut serde_json::Value) -> Result<(), ApiError> {
        // Validate and sanitize patient fields
        if let Some(first_name) = data.get_mut("first_name") {
            if let Some(name_str) = first_name.as_str() {
                let sanitized = self.sanitizer.sanitize_name(name_str)?;
                *first_name = serde_json::Value::String(sanitized);
            }
        }

        if let Some(last_name) = data.get_mut("last_name") {
            if let Some(name_str) = last_name.as_str() {
                let sanitized = self.sanitizer.sanitize_name(name_str)?;
                *last_name = serde_json::Value::String(sanitized);
            }
        }

        if let Some(email) = data.get_mut("email") {
            if let Some(email_str) = email.as_str() {
                let sanitized = self.sanitizer.sanitize_email(email_str)?;
                *email = serde_json::Value::String(sanitized);
            }
        }

        if let Some(phone) = data.get_mut("phone") {
            if let Some(phone_str) = phone.as_str() {
                let sanitized = self.sanitizer.sanitize_phone(phone_str)?;
                *phone = serde_json::Value::String(sanitized);
            }
        }

        if let Some(address) = data.get_mut("address") {
            if let Some(address_str) = address.as_str() {
                let sanitized = self.sanitizer.sanitize_text(address_str)?;
                *address = serde_json::Value::String(sanitized);
            }
        }

        if let Some(medical_history) = data.get_mut("medical_history") {
            if let Some(history_str) = medical_history.as_str() {
                let sanitized = self.sanitizer.sanitize_text(history_str)?;
                *medical_history = serde_json::Value::String(sanitized);
            }
        }

        if let Some(allergies) = data.get_mut("allergies") {
            if let Some(allergies_str) = allergies.as_str() {
                let sanitized = self.sanitizer.sanitize_text(allergies_str)?;
                *allergies = serde_json::Value::String(sanitized);
            }
        }

        Ok(())
    }

    pub fn validate_user_data(&self, data: &mut serde_json::Value) -> Result<(), ApiError> {
        // Validate and sanitize user fields
        if let Some(username) = data.get_mut("username") {
            if let Some(username_str) = username.as_str() {
                let sanitized = self.sanitizer.sanitize_name(username_str)?;
                *username = serde_json::Value::String(sanitized);
            }
        }

        if let Some(email) = data.get_mut("email") {
            if let Some(email_str) = email.as_str() {
                let sanitized = self.sanitizer.sanitize_email(email_str)?;
                *email = serde_json::Value::String(sanitized);
            }
        }

        if let Some(name) = data.get_mut("name") {
            if let Some(name_str) = name.as_str() {
                let sanitized = self.sanitizer.sanitize_name(name_str)?;
                *name = serde_json::Value::String(sanitized);
            }
        }

        if let Some(department) = data.get_mut("department") {
            if let Some(dept_str) = department.as_str() {
                let sanitized = self.sanitizer.sanitize_name(dept_str)?;
                *department = serde_json::Value::String(sanitized);
            }
        }

        Ok(())
    }

    pub fn validate_consultation_data(&self, data: &mut serde_json::Value) -> Result<(), ApiError> {
        // Validate and sanitize consultation fields
        if let Some(chief_complaint) = data.get_mut("chief_complaint") {
            if let Some(complaint_str) = chief_complaint.as_str() {
                let sanitized = self.sanitizer.sanitize_text(complaint_str)?;
                *chief_complaint = serde_json::Value::String(sanitized);
            }
        }

        if let Some(diagnosis) = data.get_mut("diagnosis") {
            if let Some(diagnosis_str) = diagnosis.as_str() {
                let sanitized = self.sanitizer.sanitize_text(diagnosis_str)?;
                *diagnosis = serde_json::Value::String(sanitized);
            }
        }

        if let Some(treatment_plan) = data.get_mut("treatment_plan") {
            if let Some(plan_str) = treatment_plan.as_str() {
                let sanitized = self.sanitizer.sanitize_text(plan_str)?;
                *treatment_plan = serde_json::Value::String(sanitized);
            }
        }

        if let Some(notes) = data.get_mut("notes") {
            if let Some(notes_str) = notes.as_str() {
                let sanitized = self.sanitizer.sanitize_text(notes_str)?;
                *notes = serde_json::Value::String(sanitized);
            }
        }

        Ok(())
    }

    pub fn validate_medicine_data(&self, data: &mut serde_json::Value) -> Result<(), ApiError> {
        // Validate and sanitize medicine fields
        if let Some(name) = data.get_mut("name") {
            if let Some(name_str) = name.as_str() {
                let sanitized = self.sanitizer.sanitize_text(name_str)?;
                *name = serde_json::Value::String(sanitized);
            }
        }

        if let Some(generic_name) = data.get_mut("generic_name") {
            if let Some(generic_str) = generic_name.as_str() {
                let sanitized = self.sanitizer.sanitize_text(generic_str)?;
                *generic_name = serde_json::Value::String(sanitized);
            }
        }

        if let Some(dosage_form) = data.get_mut("dosage_form") {
            if let Some(dosage_str) = dosage_form.as_str() {
                let sanitized = self.sanitizer.sanitize_text(dosage_str)?;
                *dosage_form = serde_json::Value::String(sanitized);
            }
        }

        if let Some(strength) = data.get_mut("strength") {
            if let Some(strength_str) = strength.as_str() {
                let sanitized = self.sanitizer.sanitize_text(strength_str)?;
                *strength = serde_json::Value::String(sanitized);
            }
        }

        if let Some(manufacturer) = data.get_mut("manufacturer") {
            if let Some(manufacturer_str) = manufacturer.as_str() {
                let sanitized = self.sanitizer.sanitize_text(manufacturer_str)?;
                *manufacturer = serde_json::Value::String(sanitized);
            }
        }

        Ok(())
    }

    pub fn validate_invoice_data(&self, data: &mut serde_json::Value) -> Result<(), ApiError> {
        // Validate and sanitize invoice fields
        if let Some(notes) = data.get_mut("notes") {
            if let Some(notes_str) = notes.as_str() {
                let sanitized = self.sanitizer.sanitize_text(notes_str)?;
                *notes = serde_json::Value::String(sanitized);
            }
        }

        // Validate items array
        if let Some(items) = data.get_mut("items") {
            if let Some(items_array) = items.as_array_mut() {
                for item in items_array {
                    if let Some(description) = item.get_mut("description") {
                        if let Some(desc_str) = description.as_str() {
                            let sanitized = self.sanitizer.sanitize_text(desc_str)?;
                            *description = serde_json::Value::String(sanitized);
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

// File validation
pub struct FileValidator {
    max_file_size: usize,
    allowed_extensions: Vec<String>,
    allowed_mime_types: Vec<String>,
}

impl FileValidator {
    pub fn new() -> Self {
        Self {
            max_file_size: 10 * 1024 * 1024, // 10MB
            allowed_extensions: vec![
                "jpg".to_string(),
                "jpeg".to_string(),
                "png".to_string(),
                "gif".to_string(),
                "pdf".to_string(),
                "doc".to_string(),
                "docx".to_string(),
                "txt".to_string(),
            ],
            allowed_mime_types: vec![
                "image/jpeg".to_string(),
                "image/png".to_string(),
                "image/gif".to_string(),
                "application/pdf".to_string(),
                "application/msword".to_string(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document".to_string(),
                "text/plain".to_string(),
            ],
        }
    }

    pub fn validate_file(&self, filename: &str, content_type: &str, file_size: usize) -> Result<(), ApiError> {
        // Check file size
        if file_size > self.max_file_size {
            return Err(ApiError::validation_error(
                format!("File size exceeds maximum allowed size of {} bytes", self.max_file_size)
            ));
        }

        // Check file extension
        if let Some(extension) = filename.split('.').last() {
            if !self.allowed_extensions.contains(&extension.to_lowercase()) {
                return Err(ApiError::validation_error("File type not allowed".to_string()));
            }
        } else {
            return Err(ApiError::validation_error("File must have an extension".to_string()));
        }

        // Check MIME type
        if !self.allowed_mime_types.contains(&content_type.to_string()) {
            return Err(ApiError::validation_error("Content type not allowed".to_string()));
        }

        // Check for path traversal in filename
        if filename.contains("..") || filename.contains("/") || filename.contains("\\") {
            return Err(ApiError::validation_error("Invalid filename: path traversal detected".to_string()));
        }

        Ok(())
    }
}

// Query parameter validation
pub fn validate_query_parameters(params: &HashMap<String, String>) -> Result<HashMap<String, String>, ApiError> {
    let sanitizer = SanitizationService::new();
    let mut validated_params = HashMap::new();

    for (key, value) in params {
        let sanitized_key = sanitizer.sanitize_string(key)?;
        let sanitized_value = sanitizer.sanitize_string(value)?;
        validated_params.insert(sanitized_key, sanitized_value);
    }

    Ok(validated_params)
}

// Path parameter validation
pub fn validate_path_parameters(params: &HashMap<String, String>) -> Result<HashMap<String, String>, ApiError> {
    let sanitizer = SanitizationService::new();
    let mut validated_params = HashMap::new();

    for (key, value) in params {
        let sanitized_key = sanitizer.sanitize_string(key)?;
        let sanitized_value = sanitizer.sanitize_string(value)?;
        validated_params.insert(sanitized_key, sanitized_value);
    }

    Ok(validated_params)
}
