use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use rust_decimal::Decimal;
use std::str::FromStr;

// Utility functions for the application

/// Generate a unique patient number
pub fn generate_patient_number() -> String {
    let timestamp = chrono::Utc::now().timestamp();
    format!("P{:06}", timestamp % 1000000)
}

/// Generate a unique invoice number
pub fn generate_invoice_number() -> String {
    let timestamp = chrono::Utc::now().timestamp();
    format!("INV{:06}", timestamp % 1000000)
}

/// Calculate tax amount (16% VAT in Kenya)
pub fn calculate_tax(amount: Decimal) -> Decimal {
    amount * Decimal::from_str("0.16").unwrap()
}

/// Calculate total amount including tax
pub fn calculate_total_with_tax(subtotal: Decimal) -> Decimal {
    let tax = calculate_tax(subtotal);
    subtotal + tax
}

/// Validate phone number format (Kenyan format)
pub fn validate_kenyan_phone(phone: &str) -> bool {
    let cleaned = phone.replace(" ", "").replace("-", "");
    cleaned.starts_with("+254") && cleaned.len() == 13 ||
    cleaned.starts_with("254") && cleaned.len() == 12 ||
    cleaned.starts_with("0") && cleaned.len() == 10
}

/// Format phone number to standard Kenyan format
pub fn format_kenyan_phone(phone: &str) -> String {
    let cleaned = phone.replace(" ", "").replace("-", "");
    
    if cleaned.starts_with("+254") {
        cleaned
    } else if cleaned.starts_with("254") {
        format!("+{}", cleaned)
    } else if cleaned.starts_with("0") {
        format!("+254{}", &cleaned[1..])
    } else {
        format!("+254{}", cleaned)
    }
}

/// Validate email format
pub fn validate_email(email: &str) -> bool {
    let email_regex = regex::Regex::new(r"^[^\s@]+@[^\s@]+\.[^\s@]+$").unwrap();
    email_regex.is_match(email)
}

/// Generate a random string for tokens
pub fn generate_random_string(length: usize) -> String {
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

/// Pagination helper
#[derive(Debug, Serialize, Deserialize)]
pub struct PaginationParams {
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

impl PaginationParams {
    pub fn new(page: Option<u32>, limit: Option<u32>) -> Self {
        Self {
            page: page.or(Some(1)),
            limit: limit.or(Some(50)),
        }
    }

    pub fn offset(&self) -> u32 {
        let page = self.page.unwrap_or(1);
        let limit = self.limit.unwrap_or(50);
        (page - 1) * limit
    }

    pub fn limit(&self) -> u32 {
        self.limit.unwrap_or(50)
    }
}

/// Response wrapper for paginated data
#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub pagination: PaginationInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginationInfo {
    pub page: u32,
    pub limit: u32,
    pub total: u64,
    pub total_pages: u32,
}

impl<T> PaginatedResponse<T> {
    pub fn new(data: Vec<T>, page: u32, limit: u32, total: u64) -> Self {
        let total_pages = ((total as f64) / (limit as f64)).ceil() as u32;
        
        Self {
            data,
            pagination: PaginationInfo {
                page,
                limit,
                total,
                total_pages,
            },
        }
    }
}

/// Error response structure
#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
    pub details: Option<HashMap<String, serde_json::Value>>,
}

impl ErrorResponse {
    pub fn new(error: &str, message: &str) -> Self {
        Self {
            error: error.to_string(),
            message: message.to_string(),
            details: None,
        }
    }

    pub fn with_details(error: &str, message: &str, details: HashMap<String, serde_json::Value>) -> Self {
        Self {
            error: error.to_string(),
            message: message.to_string(),
            details: Some(details),
        }
    }
}

/// Success response structure
#[derive(Debug, Serialize, Deserialize)]
pub struct SuccessResponse<T> {
    pub success: bool,
    pub message: String,
    pub data: T,
}

impl<T> SuccessResponse<T> {
    pub fn new(message: &str, data: T) -> Self {
        Self {
            success: true,
            message: message.to_string(),
            data,
        }
    }
}

/// Date range helper
#[derive(Debug, Serialize, Deserialize)]
pub struct DateRange {
    pub start_date: chrono::NaiveDate,
    pub end_date: chrono::NaiveDate,
}

impl DateRange {
    pub fn from_strings(start: &str, end: &str) -> Result<Self, chrono::ParseError> {
        Ok(Self {
            start_date: chrono::NaiveDate::parse_from_str(start, "%Y-%m-%d")?,
            end_date: chrono::NaiveDate::parse_from_str(end, "%Y-%m-%d")?,
        })
    }

    pub fn this_month() -> Self {
        let now = chrono::Utc::now().date_naive();
        let start = now.with_day(1).unwrap();
        let end = now.with_day(now.days_in_month()).unwrap();
        
        Self { start_date: start, end_date: end }
    }

    pub fn this_week() -> Self {
        let now = chrono::Utc::now().date_naive();
        let start = now - chrono::Duration::days(now.weekday().num_days_from_monday() as i64);
        let end = start + chrono::Duration::days(6);
        
        Self { start_date: start, end_date: end }
    }

    pub fn last_30_days() -> Self {
        let now = chrono::Utc::now().date_naive();
        let start = now - chrono::Duration::days(30);
        
        Self { start_date: start, end_date: now }
    }
}

/// File upload helper
pub struct FileUpload {
    pub filename: String,
    pub content_type: String,
    pub size: u64,
    pub data: Vec<u8>,
}

impl FileUpload {
    pub fn is_image(&self) -> bool {
        self.content_type.starts_with("image/")
    }

    pub fn is_pdf(&self) -> bool {
        self.content_type == "application/pdf"
    }

    pub fn is_valid_size(&self, max_size: u64) -> bool {
        self.size <= max_size
    }
}

/// Logging helper
pub fn log_request(method: &str, path: &str, user_id: Option<uuid::Uuid>) {
    let user_info = match user_id {
        Some(id) => format!("user_id={}", id),
        None => "anonymous".to_string(),
    };
    
    log::info!("{} {} {}", method, path, user_info);
}

/// Performance timing helper
pub struct PerformanceTimer {
    start: std::time::Instant,
    operation: String,
}

impl PerformanceTimer {
    pub fn new(operation: &str) -> Self {
        Self {
            start: std::time::Instant::now(),
            operation: operation.to_string(),
        }
    }

    pub fn finish(self) {
        let duration = self.start.elapsed();
        log::info!("{} completed in {:?}", self.operation, duration);
    }
}

impl Drop for PerformanceTimer {
    fn drop(&mut self) {
        let duration = self.start.elapsed();
        log::debug!("{} took {:?}", self.operation, duration);
    }
}
