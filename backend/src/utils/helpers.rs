use uuid::Uuid;
use chrono::{Utc, NaiveDate};
use rust_decimal::Decimal;

pub fn generate_patient_number() -> String {
    format!("PAT-{}-{}", 
        Utc::now().format("%Y"),
        format!("{:04}", rand::random::<u16>())
    )
}

pub fn generate_consultation_number() -> String {
    format!("CONS-{}-{}", 
        Utc::now().format("%Y%m%d"),
        format!("{:04}", rand::random::<u16>())
    )
}

pub fn generate_invoice_number() -> String {
    format!("INV-{}-{}", 
        Utc::now().format("%Y%m%d"),
        format!("{:04}", rand::random::<u16>())
    )
}

pub fn generate_prescription_number() -> String {
    format!("PRES-{}-{}", 
        Utc::now().format("%Y%m%d"),
        format!("{:04}", rand::random::<u16>())
    )
}

pub fn calculate_age(date_of_birth: NaiveDate) -> i32 {
    let today = Utc::now().date_naive();
    let age = today.year() - date_of_birth.year();
    
    // Adjust if birthday hasn't occurred this year
    if today.month() < date_of_birth.month() || 
       (today.month() == date_of_birth.month() && today.day() < date_of_birth.day()) {
        age - 1
    } else {
        age
    }
}

pub fn format_currency(amount: Decimal) -> String {
    format!("KSh {:.2}", amount)
}

pub fn format_phone_number(phone: &str) -> String {
    // Convert to international format if needed
    if phone.starts_with("0") {
        format!("+254{}", &phone[1..])
    } else if !phone.starts_with("+254") {
        format!("+254{}", phone)
    } else {
        phone.to_string()
    }
}

pub fn sanitize_filename(filename: &str) -> String {
    filename
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

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

pub fn validate_uuid(uuid_str: &str) -> Result<Uuid, String> {
    Uuid::parse_str(uuid_str).map_err(|e| format!("Invalid UUID: {}", e))
}

pub fn is_valid_date_range(start_date: NaiveDate, end_date: NaiveDate) -> bool {
    start_date <= end_date
}

pub fn get_file_extension(filename: &str) -> Option<String> {
    std::path::Path::new(filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
}

pub fn is_image_file(filename: &str) -> bool {
    if let Some(ext) = get_file_extension(filename) {
        matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp")
    } else {
        false
    }
}

pub fn is_document_file(filename: &str) -> bool {
    if let Some(ext) = get_file_extension(filename) {
        matches!(ext.as_str(), "pdf" | "doc" | "docx" | "txt" | "rtf")
    } else {
        false
    }
}
