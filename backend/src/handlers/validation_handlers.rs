use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use std::collections::HashMap;

use crate::models::{ApiResponse, CreatePatient, UpdatePatient, CreateUser, UpdateUser};
use crate::auth::verify_jwt_token;
// Note: These validation functions need to be implemented in the validation module
// For now, we'll create simple validation functions here

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationWarning>,
    pub suggestions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
    pub code: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationWarning {
    pub field: String,
    pub message: String,
    pub severity: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DuplicateCheckResult {
    pub has_duplicates: bool,
    pub duplicates: Vec<DuplicateRecord>,
    pub confidence: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DuplicateRecord {
    pub id: Uuid,
    pub match_type: String,
    pub match_fields: Vec<String>,
    pub match_score: f64,
    pub record_data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BusinessRuleValidation {
    pub rule_name: String,
    pub is_valid: bool,
    pub message: String,
    pub severity: String,
}

// Validate patient data
pub async fn validate_patient_data(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    patient_data: web::Json<CreatePatient>,
) -> Result<HttpResponse> {
    // Verify JWT token
    let token = match req.headers().get("Authorization") {
        Some(header) => {
            let auth_str = header.to_str().unwrap_or("");
            if auth_str.starts_with("Bearer ") {
                &auth_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: Some("Invalid authorization header".to_string()),
                    error: Some("Invalid token format".to_string()),
                }));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Authorization header missing".to_string()),
                error: Some("No token provided".to_string()),
            }));
        }
    };

    let _claims = match verify_jwt_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid token".to_string()),
                error: Some("Token verification failed".to_string()),
            }));
        }
    };

    // Perform validation
    let validation_result = match validate_patient_data_internal(&patient_data) {
        Ok(_) => {
            // Additional business rule validations
            let business_rules = validate_patient_business_rules(&pool, &patient_data).await;
            
            ValidationResult {
                is_valid: business_rules.iter().all(|rule| rule.is_valid),
                errors: vec![],
                warnings: business_rules.iter()
                    .filter(|rule| !rule.is_valid && rule.severity == "warning")
                    .map(|rule| ValidationWarning {
                        field: rule.rule_name.clone(),
                        message: rule.message.clone(),
                        severity: rule.severity.clone(),
                    })
                    .collect(),
                suggestions: generate_patient_suggestions(&patient_data),
            }
        }
        Err(validation_errors) => {
            let errors = validation_errors
                .iter()
                .map(|(field, message)| ValidationError {
                    field: field.clone(),
                    message: message.clone(),
                    code: "VALIDATION_ERROR".to_string(),
                })
                .collect();

            ValidationResult {
                is_valid: false,
                errors,
                warnings: vec![],
                suggestions: vec![],
            }
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(validation_result),
        message: Some("Patient data validation completed".to_string()),
        error: None,
    }))
}

// Validate user data
pub async fn validate_user_data(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    user_data: web::Json<CreateUser>,
) -> Result<HttpResponse> {
    // Verify JWT token
    let token = match req.headers().get("Authorization") {
        Some(header) => {
            let auth_str = header.to_str().unwrap_or("");
            if auth_str.starts_with("Bearer ") {
                &auth_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: Some("Invalid authorization header".to_string()),
                    error: Some("Invalid token format".to_string()),
                }));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Authorization header missing".to_string()),
                error: Some("No token provided".to_string()),
            }));
        }
    };

    let _claims = match verify_jwt_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid token".to_string()),
                error: Some("Token verification failed".to_string()),
            }));
        }
    };

    // Perform validation
    let validation_result = match validate_user_data_internal(&user_data) {
        Ok(_) => {
            // Additional business rule validations
            let business_rules = validate_user_business_rules(&pool, &user_data).await;
            
            ValidationResult {
                is_valid: business_rules.iter().all(|rule| rule.is_valid),
                errors: vec![],
                warnings: business_rules.iter()
                    .filter(|rule| !rule.is_valid && rule.severity == "warning")
                    .map(|rule| ValidationWarning {
                        field: rule.rule_name.clone(),
                        message: rule.message.clone(),
                        severity: rule.severity.clone(),
                    })
                    .collect(),
                suggestions: generate_user_suggestions(&user_data),
            }
        }
        Err(validation_errors) => {
            let errors = validation_errors
                .iter()
                .map(|(field, message)| ValidationError {
                    field: field.clone(),
                    message: message.clone(),
                    code: "VALIDATION_ERROR".to_string(),
                })
                .collect();

            ValidationResult {
                is_valid: false,
                errors,
                warnings: vec![],
                suggestions: vec![],
            }
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(validation_result),
        message: Some("User data validation completed".to_string()),
        error: None,
    }))
}

// Check for duplicate patients
pub async fn check_duplicate_patient(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    patient_data: web::Json<CreatePatient>,
) -> Result<HttpResponse> {
    // Verify JWT token
    let token = match req.headers().get("Authorization") {
        Some(header) => {
            let auth_str = header.to_str().unwrap_or("");
            if auth_str.starts_with("Bearer ") {
                &auth_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: Some("Invalid authorization header".to_string()),
                    error: Some("Invalid token format".to_string()),
                }));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Authorization header missing".to_string()),
                error: Some("No token provided".to_string()),
            }));
        }
    };

    let _claims = match verify_jwt_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid token".to_string()),
                error: Some("Token verification failed".to_string()),
            }));
        }
    };

    // Check for duplicates
    let duplicate_result = match check_patient_duplicates(&pool, &patient_data).await {
        Ok(result) => result,
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to check for duplicates".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(duplicate_result),
        message: Some("Duplicate check completed".to_string()),
        error: None,
    }))
}

// Check for duplicate users
pub async fn check_duplicate_user(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    user_data: web::Json<CreateUser>,
) -> Result<HttpResponse> {
    // Verify JWT token
    let token = match req.headers().get("Authorization") {
        Some(header) => {
            let auth_str = header.to_str().unwrap_or("");
            if auth_str.starts_with("Bearer ") {
                &auth_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: Some("Invalid authorization header".to_string()),
                    error: Some("Invalid token format".to_string()),
                }));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Authorization header missing".to_string()),
                error: Some("No token provided".to_string()),
            }));
        }
    };

    let _claims = match verify_jwt_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid token".to_string()),
                error: Some("Token verification failed".to_string()),
            }));
        }
    };

    // Check for duplicates
    let duplicate_result = match check_user_duplicates(&pool, &user_data).await {
        Ok(result) => result,
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to check for duplicates".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(duplicate_result),
        message: Some("Duplicate check completed".to_string()),
        error: None,
    }))
}

// Validate business rules
pub async fn validate_business_rules(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    rule_data: web::Json<HashMap<String, serde_json::Value>>,
) -> Result<HttpResponse> {
    // Verify JWT token
    let token = match req.headers().get("Authorization") {
        Some(header) => {
            let auth_str = header.to_str().unwrap_or("");
            if auth_str.starts_with("Bearer ") {
                &auth_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: Some("Invalid authorization header".to_string()),
                    error: Some("Invalid token format".to_string()),
                }));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Authorization header missing".to_string()),
                error: Some("No token provided".to_string()),
            }));
        }
    };

    let _claims = match verify_jwt_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid token".to_string()),
                error: Some("Token verification failed".to_string()),
            }));
        }
    };

    // Validate business rules
    let business_rules = validate_general_business_rules(&pool, &rule_data).await;

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(business_rules),
        message: Some("Business rules validation completed".to_string()),
        error: None,
    }))
}

// Helper function to validate patient business rules
async fn validate_patient_business_rules(
    pool: &PgPool,
    patient_data: &CreatePatient,
) -> Vec<BusinessRuleValidation> {
    let mut rules = Vec::new();

    // Check if patient is under 18 and has guardian information
    let dob_naive = patient_data.date_of_birth.date_naive();
    let age = chrono::Utc::now().date_naive().signed_duration_since(dob_naive);
    if age.num_days() < 6570 { // Less than 18 years
        rules.push(BusinessRuleValidation {
            rule_name: "guardian_required".to_string(),
            is_valid: patient_data.location.is_some(), // Simplified check
            message: "Guardian information required for patients under 18".to_string(),
            severity: "warning".to_string(),
        });
    }

    // Check for insurance number format
    if let Some(insurance) = &patient_data.insurance_number {
        if insurance.len() < 8 {
            rules.push(BusinessRuleValidation {
                rule_name: "insurance_format".to_string(),
                is_valid: false,
                message: "Insurance number should be at least 8 characters long".to_string(),
                severity: "warning".to_string(),
            });
        }
    }

    // Check phone number format
    if patient_data.phone.len() < 10 {
        rules.push(BusinessRuleValidation {
            rule_name: "phone_format".to_string(),
            is_valid: false,
            message: "Phone number should be at least 10 digits long".to_string(),
            severity: "error".to_string(),
        });
    }

    rules
}

// Helper function to validate user business rules
async fn validate_user_business_rules(
    pool: &PgPool,
    user_data: &CreateUser,
) -> Vec<BusinessRuleValidation> {
    let mut rules = Vec::new();

    // Check username uniqueness
    let existing_user = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM users WHERE username = $1"
    )
    .bind(&user_data.username)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    if existing_user > 0 {
        rules.push(BusinessRuleValidation {
            rule_name: "username_unique".to_string(),
            is_valid: false,
            message: "Username already exists".to_string(),
            severity: "error".to_string(),
        });
    }

    // Check role validity
    let valid_roles = ["admin", "clinician", "nurse", "pharmacist", "receptionist"];
    if !valid_roles.contains(&user_data.role.as_str()) {
        rules.push(BusinessRuleValidation {
            rule_name: "role_valid".to_string(),
            is_valid: false,
            message: "Invalid role specified".to_string(),
            severity: "error".to_string(),
        });
    }

    // Check department validity
    let valid_departments = ["general", "cardiology", "pediatrics", "surgery", "pharmacy", "administration"];
    if let Some(department) = &user_data.department {
        if !valid_departments.contains(&department.as_str()) {
            rules.push(BusinessRuleValidation {
                rule_name: "department_valid".to_string(),
                is_valid: false,
                message: "Invalid department specified".to_string(),
                severity: "warning".to_string(),
            });
        }
    }

    rules
}

// Helper function to generate patient suggestions
fn generate_patient_suggestions(patient_data: &CreatePatient) -> Vec<String> {
    let mut suggestions = Vec::new();

    // Suggest adding location if missing
    if patient_data.location.is_none() {
        suggestions.push("Consider adding patient location for better record keeping".to_string());
    }

    // Suggest adding insurance information
    if patient_data.insurance_number.is_none() {
        suggestions.push("Consider adding insurance information for billing purposes".to_string());
    }

    // Suggest phone number format
    if !patient_data.phone.starts_with("+254") && patient_data.phone.len() == 10 {
        suggestions.push("Consider adding country code (+254) to phone number".to_string());
    }

    suggestions
}

// Helper function to generate user suggestions
fn generate_user_suggestions(user_data: &CreateUser) -> Vec<String> {
    let mut suggestions = Vec::new();

    // Suggest adding department
    if user_data.department.is_none() {
        suggestions.push("Consider specifying a department for better organization".to_string());
    }

    // Suggest strong password
    if user_data.password.len() < 8 {
        suggestions.push("Consider using a stronger password (at least 8 characters)".to_string());
    }

    suggestions
}

// Helper function to check patient duplicates
async fn check_patient_duplicates(
    pool: &PgPool,
    patient_data: &CreatePatient,
) -> Result<DuplicateCheckResult, sqlx::Error> {
    let mut duplicates = Vec::new();

    // Check for exact name matches
    let name_matches = sqlx::query!(
        "SELECT id, first_name, last_name, phone, date_of_birth 
         FROM patients 
         WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)",
        patient_data.first_name,
        patient_data.last_name
    )
    .fetch_all(pool)
    .await?;

    for record in name_matches {
        duplicates.push(DuplicateRecord {
            id: record.id,
            match_type: "exact_name".to_string(),
            match_fields: vec!["first_name".to_string(), "last_name".to_string()],
            match_score: 1.0,
            record_data: serde_json::json!({
                "first_name": record.first_name,
                "last_name": record.last_name,
                "phone_number": record.phone,
                "date_of_birth": record.date_of_birth
            }),
        });
    }

    // Check for phone number matches
    let phone_matches = sqlx::query!(
        "SELECT id, first_name, last_name, phone, date_of_birth 
         FROM patients 
         WHERE phone = $1",
        patient_data.phone
    )
    .fetch_all(pool)
    .await?;

    for record in phone_matches {
        // Avoid duplicate entries
        if !duplicates.iter().any(|d| d.id == record.id) {
            duplicates.push(DuplicateRecord {
                id: record.id,
                match_type: "phone_number".to_string(),
                match_fields: vec!["phone_number".to_string()],
                match_score: 0.9,
                record_data: serde_json::json!({
                    "first_name": record.first_name,
                    "last_name": record.last_name,
                    "phone_number": record.phone,
                    "date_of_birth": record.date_of_birth
                }),
            });
        }
    }

    // Check for insurance number matches
    if let Some(insurance) = &patient_data.insurance_number {
        let insurance_matches = sqlx::query!(
            "SELECT id, first_name, last_name, phone, date_of_birth 
             FROM patients 
             WHERE insurance_number = $1",
            insurance
        )
        .fetch_all(pool)
        .await?;

        for record in insurance_matches {
            // Avoid duplicate entries
            if !duplicates.iter().any(|d| d.id == record.id) {
                duplicates.push(DuplicateRecord {
                    id: record.id,
                    match_type: "insurance_number".to_string(),
                    match_fields: vec!["insurance_number".to_string()],
                    match_score: 0.95,
                    record_data: serde_json::json!({
                        "first_name": record.first_name,
                        "last_name": record.last_name,
                        "phone_number": record.phone,
                        "date_of_birth": record.date_of_birth
                    }),
                });
            }
        }
    }

    let has_duplicates = !duplicates.is_empty();
    let confidence = if has_duplicates {
        duplicates.iter().map(|d| d.match_score).fold(0.0, f64::max)
    } else {
        0.0
    };

    Ok(DuplicateCheckResult {
        has_duplicates,
        duplicates,
        confidence,
    })
}

// Helper function to check user duplicates
async fn check_user_duplicates(
    pool: &PgPool,
    user_data: &CreateUser,
) -> Result<DuplicateCheckResult, sqlx::Error> {
    let mut duplicates = Vec::new();

    // Check for username matches
    let username_matches = sqlx::query!(
        "SELECT id, username, role, department 
         FROM users 
         WHERE username = $1",
        user_data.username
    )
    .fetch_all(pool)
    .await?;

    for record in username_matches {
        duplicates.push(DuplicateRecord {
            id: record.id,
            match_type: "username".to_string(),
            match_fields: vec!["username".to_string()],
            match_score: 1.0,
            record_data: serde_json::json!({
                "username": record.username,
                "role": record.role,
                "department": record.department
            }),
        });
    }

    let has_duplicates = !duplicates.is_empty();
    let confidence = if has_duplicates {
        duplicates.iter().map(|d| d.match_score).fold(0.0, f64::max)
    } else {
        0.0
    };

    Ok(DuplicateCheckResult {
        has_duplicates,
        duplicates,
        confidence,
    })
}

// Helper function to validate general business rules
async fn validate_general_business_rules(
    pool: &PgPool,
    rule_data: &HashMap<String, serde_json::Value>,
) -> Vec<BusinessRuleValidation> {
    let mut rules = Vec::new();

    // Example business rules
    if let Some(entity_type) = rule_data.get("entity_type") {
        if let Some(entity_type_str) = entity_type.as_str() {
            match entity_type_str {
                "appointment" => {
                    // Check if appointment time is in the future
                    if let Some(appointment_time) = rule_data.get("appointment_time") {
                        if let Some(time_str) = appointment_time.as_str() {
                            if let Ok(appointment_time) = chrono::NaiveDateTime::parse_from_str(time_str, "%Y-%m-%d %H:%M:%S") {
                                if appointment_time < chrono::Utc::now().naive_utc() {
                                    rules.push(BusinessRuleValidation {
                                        rule_name: "appointment_future".to_string(),
                                        is_valid: false,
                                        message: "Appointment time must be in the future".to_string(),
                                        severity: "error".to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
                "prescription" => {
                    // Check if prescription has valid dosage
                    if let Some(dosage) = rule_data.get("dosage") {
                        if let Some(dosage_str) = dosage.as_str() {
                            if dosage_str.is_empty() {
                                rules.push(BusinessRuleValidation {
                                    rule_name: "dosage_required".to_string(),
                                    is_valid: false,
                                    message: "Dosage is required for prescriptions".to_string(),
                                    severity: "error".to_string(),
                                });
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    }

    rules
}

// Simple validation functions (to be replaced with proper validation module)
fn validate_patient_data_internal(patient_data: &CreatePatient) -> Result<(), Vec<(String, String)>> {
    let mut errors = Vec::new();
    
    if patient_data.first_name.is_empty() {
        errors.push(("first_name".to_string(), "First name is required".to_string()));
    }
    
    if patient_data.last_name.is_empty() {
        errors.push(("last_name".to_string(), "Last name is required".to_string()));
    }
    
    if patient_data.phone.is_empty() {
        errors.push(("phone".to_string(), "Phone number is required".to_string()));
    }
    
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

fn validate_user_data_internal(user_data: &CreateUser) -> Result<(), Vec<(String, String)>> {
    let mut errors = Vec::new();
    
    if user_data.username.is_empty() {
        errors.push(("username".to_string(), "Username is required".to_string()));
    }
    
    if user_data.password.is_empty() {
        errors.push(("password".to_string(), "Password is required".to_string()));
    }
    
    if user_data.role.is_empty() {
        errors.push(("role".to_string(), "Role is required".to_string()));
    }
    
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}
