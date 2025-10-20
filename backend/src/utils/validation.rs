use validator::{Validate, ValidationError};
use serde::{Deserialize, Serialize};

pub fn validate_phone(phone: &str) -> Result<(), ValidationError> {
    // Kenyan phone number validation
    let phone_regex = regex::Regex::new(r"^(\+254|0)[17]\d{8}$").unwrap();
    if phone_regex.is_match(phone) {
        Ok(())
    } else {
        Err(ValidationError::new("invalid_phone"))
    }
}

pub fn validate_email(email: &str) -> Result<(), ValidationError> {
    let email_regex = regex::Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap();
    if email_regex.is_match(email) {
        Ok(())
    } else {
        Err(ValidationError::new("invalid_email"))
    }
}

pub fn validate_password(password: &str) -> Result<(), ValidationError> {
    if password.len() >= 8 {
        Ok(())
    } else {
        Err(ValidationError::new("password_too_short"))
    }
}

pub fn validate_patient_number(patient_number: &str) -> Result<(), ValidationError> {
    // Patient number should be in format PAT-YYYY-XXXX or OP-XXXX
    let patient_regex = regex::Regex::new(r"^(PAT-\d{4}-\d{4}|OP-\d+)$").unwrap();
    if patient_regex.is_match(patient_number) {
        Ok(())
    } else {
        Err(ValidationError::new("invalid_patient_number"))
    }
}

pub fn validate_icd11_code(code: &str) -> Result<(), ValidationError> {
    // Basic ICD-11 code validation (starts with letter followed by numbers)
    let icd11_regex = regex::Regex::new(r"^[A-Z]\d{2}[A-Z0-9]?$").unwrap();
    if icd11_regex.is_match(code) {
        Ok(())
    } else {
        Err(ValidationError::new("invalid_icd11_code"))
    }
}
