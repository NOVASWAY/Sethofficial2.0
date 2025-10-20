use clinic_management_backend::{
    models::*,
    auth::AuthService,
    cache::{CacheService, CacheConfig, MemoryCache},
    security::{PasswordSecurity, SecurityConfig, InputSanitizer},
    error::{ApiError, ERROR_TYPES},
    validation::Validate,
};

use actix_web::test;
use serde_json::json;
use std::collections::HashMap;

// Test utilities
mod test_utils {
    use super::*;
    
    pub fn create_test_patient() -> CreatePatient {
        CreatePatient {
            first_name: "John".to_string(),
            last_name: "Doe".to_string(),
            date_of_birth: "1990-01-01".to_string(),
            gender: "Male".to_string(),
            phone: "1234567890".to_string(),
            location: Some("123 Main St".to_string()),
            patient_number: Some("P001".to_string()),
        }
    }
    
    pub fn create_test_user() -> CreateUser {
        CreateUser {
            username: "testuser".to_string(),
            password: "TestPassword123!".to_string(),
            name: "Test User".to_string(),
            role: "doctor".to_string(),
            department: Some("Cardiology".to_string()),
            permissions: Some(vec!["read".to_string(), "write".to_string()]),
        }
    }
    
    pub fn create_test_appointment() -> CreateAppointment {
        CreateAppointment {
            patient_id: uuid::Uuid::new_v4(),
            doctor_id: uuid::Uuid::new_v4(),
            appointment_date: "2024-01-15T10:00:00Z".to_string(),
            duration_minutes: 30,
            status: "scheduled".to_string(),
            notes: Some("Regular checkup".to_string()),
        }
    }
}

// Authentication tests
#[cfg(test)]
mod auth_tests {
    use super::*;
    
    #[test]
    fn test_password_hashing() {
        let auth_service = AuthService::new("test-secret", 24, 7);
        let password = "TestPassword123!";
        
        let hash = auth_service.hash_password(password).unwrap();
        assert_ne!(hash, password);
        assert!(hash.len() > 50); // Argon2 hashes are long
        
        let verification = auth_service.verify_password(password, &hash).unwrap();
        assert!(verification);
    }
    
    #[test]
    fn test_password_verification_wrong_password() {
        let auth_service = AuthService::new("test-secret", 24, 7);
        let password = "TestPassword123!";
        let wrong_password = "WrongPassword123!";
        
        let hash = auth_service.hash_password(password).unwrap();
        let verification = auth_service.verify_password(wrong_password, &hash).unwrap();
        assert!(!verification);
    }
    
    #[test]
    fn test_jwt_token_generation() {
        let auth_service = AuthService::new("test-secret", 24, 7);
        let user = User {
            id: uuid::Uuid::new_v4(),
            username: "testuser".to_string(),
            password_hash: "hashed_password".to_string(),
            role: "doctor".to_string(),
            name: "Test User".to_string(),
            department: Some("Cardiology".to_string()),
            permissions: json!(["read", "write"]),
            is_active: true,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        
        let token = auth_service.generate_access_token(&user).unwrap();
        assert!(!token.is_empty());
        assert!(token.contains('.'));
    }
    
    #[test]
    fn test_jwt_token_validation() {
        let auth_service = AuthService::new("test-secret", 24, 7);
        let user = User {
            id: uuid::Uuid::new_v4(),
            username: "testuser".to_string(),
            password_hash: "hashed_password".to_string(),
            role: "doctor".to_string(),
            name: "Test User".to_string(),
            department: Some("Cardiology".to_string()),
            permissions: json!(["read", "write"]),
            is_active: true,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        
        let token = auth_service.generate_access_token(&user).unwrap();
        let claims = auth_service.verify_access_token(&token).unwrap();
        
        assert_eq!(claims.sub, user.id.to_string());
        assert_eq!(claims.username, user.username);
        assert_eq!(claims.role, user.role);
    }
}

// Cache tests
#[cfg(test)]
mod cache_tests {
    use super::*;
    use tokio;
    
    #[tokio::test]
    async fn test_cache_set_and_get() {
        let config = CacheConfig::default();
        let cache: MemoryCache<String> = MemoryCache::new(config);
        
        let key = "test_key".to_string();
        let value = "test_value".to_string();
        
        cache.set(key.clone(), value.clone(), None).await.unwrap();
        let retrieved = cache.get(&key).await;
        
        assert_eq!(retrieved, Some(value));
    }
    
    #[tokio::test]
    async fn test_cache_expiration() {
        let config = CacheConfig {
            default_ttl_seconds: 1,
            ..Default::default()
        };
        let cache: MemoryCache<String> = MemoryCache::new(config);
        
        let key = "test_key".to_string();
        let value = "test_value".to_string();
        
        cache.set(key.clone(), value, None).await.unwrap();
        
        // Wait for expiration
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        
        let retrieved = cache.get(&key).await;
        assert_eq!(retrieved, None);
    }
    
    #[tokio::test]
    async fn test_cache_delete() {
        let config = CacheConfig::default();
        let cache: MemoryCache<String> = MemoryCache::new(config);
        
        let key = "test_key".to_string();
        let value = "test_value".to_string();
        
        cache.set(key.clone(), value, None).await.unwrap();
        let deleted = cache.delete(&key).await;
        
        assert!(deleted);
        
        let retrieved = cache.get(&key).await;
        assert_eq!(retrieved, None);
    }
    
    #[tokio::test]
    async fn test_cache_stats() {
        let config = CacheConfig::default();
        let cache: MemoryCache<String> = MemoryCache::new(config);
        
        let key = "test_key".to_string();
        let value = "test_value".to_string();
        
        // Set and get to generate stats
        cache.set(key.clone(), value.clone(), None).await.unwrap();
        cache.get(&key).await;
        cache.get("nonexistent").await;
        
        let stats = cache.get_stats().await;
        assert_eq!(stats.hits, 1);
        assert_eq!(stats.misses, 1);
        assert_eq!(stats.total_entries, 1);
    }
}

// Security tests
#[cfg(test)]
mod security_tests {
    use super::*;
    
    #[test]
    fn test_password_strength_validation() {
        let config = SecurityConfig::default();
        
        // Valid password
        let valid_password = "TestPassword123!";
        let result = PasswordSecurity::validate_password_strength(valid_password, &config);
        assert!(result.is_ok());
        
        // Too short
        let short_password = "Test1!";
        let result = PasswordSecurity::validate_password_strength(short_password, &config);
        assert!(result.is_err());
        
        // No uppercase
        let no_upper = "testpassword123!";
        let result = PasswordSecurity::validate_password_strength(no_upper, &config);
        assert!(result.is_err());
        
        // No lowercase
        let no_lower = "TESTPASSWORD123!";
        let result = PasswordSecurity::validate_password_strength(no_lower, &config);
        assert!(result.is_err());
        
        // No numbers
        let no_numbers = "TestPassword!";
        let result = PasswordSecurity::validate_password_strength(no_numbers, &config);
        assert!(result.is_err());
        
        // No special characters
        let no_special = "TestPassword123";
        let result = PasswordSecurity::validate_password_strength(no_special, &config);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_input_sanitization() {
        // String sanitization
        let input = "  Test String  \n\r\t";
        let sanitized = InputSanitizer::sanitize_string(input);
        assert_eq!(sanitized, "Test String");
        
        // HTML sanitization
        let html_input = "<script>alert('xss')</script>Hello";
        let sanitized_html = InputSanitizer::sanitize_html(html_input);
        assert!(sanitized_html.contains("&lt;script&gt;"));
        assert!(sanitized_html.contains("&gt;"));
        
        // SQL input sanitization
        let sql_input = "'; DROP TABLE users; --";
        let sanitized_sql = InputSanitizer::sanitize_sql_input(sql_input);
        assert!(!sanitized_sql.contains("DROP"));
        assert!(!sanitized_sql.contains("--"));
    }
    
    #[test]
    fn test_email_validation() {
        // Valid emails
        assert!(InputSanitizer::validate_email("test@example.com"));
        assert!(InputSanitizer::validate_email("user.name@domain.co.uk"));
        
        // Invalid emails
        assert!(!InputSanitizer::validate_email("invalid-email"));
        assert!(!InputSanitizer::validate_email("@domain.com"));
        assert!(!InputSanitizer::validate_email("user@"));
    }
    
    #[test]
    fn test_phone_validation() {
        // Valid phones
        assert!(InputSanitizer::validate_phone("1234567890"));
        assert!(InputSanitizer::validate_phone("+1234567890"));
        assert!(InputSanitizer::validate_phone("(123) 456-7890"));
        
        // Invalid phones
        assert!(!InputSanitizer::validate_phone("123"));
        assert!(!InputSanitizer::validate_phone("abc123"));
    }
}

// Validation tests
#[cfg(test)]
mod validation_tests {
    use super::*;
    
    #[test]
    fn test_patient_validation() {
        let valid_patient = test_utils::create_test_patient();
        let result = valid_patient.validate();
        assert!(result.is_ok());
        
        // Invalid patient - missing required fields
        let mut invalid_patient = test_utils::create_test_patient();
        invalid_patient.first_name = "".to_string();
        let result = invalid_patient.validate();
        assert!(result.is_err());
        
        // Invalid patient - invalid date format
        let mut invalid_patient = test_utils::create_test_patient();
        invalid_patient.date_of_birth = "invalid-date".to_string();
        let result = invalid_patient.validate();
        assert!(result.is_err());
        
        // Invalid patient - invalid gender
        let mut invalid_patient = test_utils::create_test_patient();
        invalid_patient.gender = "Invalid".to_string();
        let result = invalid_patient.validate();
        assert!(result.is_err());
    }
    
    #[test]
    fn test_user_validation() {
        let valid_user = test_utils::create_test_user();
        let result = valid_user.validate();
        assert!(result.is_ok());
        
        // Invalid user - missing required fields
        let mut invalid_user = test_utils::create_test_user();
        invalid_user.username = "".to_string();
        let result = invalid_user.validate();
        assert!(result.is_err());
        
        // Invalid user - weak password
        let mut invalid_user = test_utils::create_test_user();
        invalid_user.password = "weak".to_string();
        let result = invalid_user.validate();
        assert!(result.is_err());
    }
    
    #[test]
    fn test_appointment_validation() {
        let valid_appointment = test_utils::create_test_appointment();
        let result = valid_appointment.validate();
        assert!(result.is_ok());
        
        // Invalid appointment - invalid date format
        let mut invalid_appointment = test_utils::create_test_appointment();
        invalid_appointment.appointment_date = "invalid-date".to_string();
        let result = invalid_appointment.validate();
        assert!(result.is_err());
        
        // Invalid appointment - negative duration
        let mut invalid_appointment = test_utils::create_test_appointment();
        invalid_appointment.duration_minutes = -30;
        let result = invalid_appointment.validate();
        assert!(result.is_err());
    }
}

// Error handling tests
#[cfg(test)]
mod error_tests {
    use super::*;
    
    #[test]
    fn test_api_error_creation() {
        let error = ApiError::bad_request("Test error message".to_string());
        assert_eq!(error.status_code, 400);
        assert_eq!(error.message, "Test error message");
    }
    
    #[test]
    fn test_api_error_types() {
        let not_found = ApiError::not_found("Resource not found".to_string());
        assert_eq!(not_found.status_code, 404);
        
        let unauthorized = ApiError::unauthorized(Some("Unauthorized access".to_string()));
        assert_eq!(unauthorized.status_code, 401);
        
        let internal_error = ApiError::internal_server_error("Internal error".to_string());
        assert_eq!(internal_error.status_code, 500);
    }
    
    #[test]
    fn test_error_types_constants() {
        assert_eq!(ERROR_TYPES.VALIDATION, "VALIDATION_ERROR");
        assert_eq!(ERROR_TYPES.NETWORK, "NETWORK_ERROR");
        assert_eq!(ERROR_TYPES.SERVER, "SERVER_ERROR");
        assert_eq!(ERROR_TYPES.AUTHENTICATION, "AUTHENTICATION_ERROR");
        assert_eq!(ERROR_TYPES.AUTHORIZATION, "AUTHORIZATION_ERROR");
        assert_eq!(ERROR_TYPES.NOT_FOUND, "NOT_FOUND_ERROR");
    }
}

// Model tests
#[cfg(test)]
mod model_tests {
    use super::*;
    
    #[test]
    fn test_patient_model_creation() {
        let patient = test_utils::create_test_patient();
        assert_eq!(patient.first_name, "John");
        assert_eq!(patient.last_name, "Doe");
        assert_eq!(patient.gender, "Male");
        assert_eq!(patient.phone, "1234567890");
    }
    
    #[test]
    fn test_user_model_creation() {
        let user = test_utils::create_test_user();
        assert_eq!(user.username, "testuser");
        assert_eq!(user.name, "Test User");
        assert_eq!(user.role, "doctor");
        assert_eq!(user.department, Some("Cardiology".to_string()));
    }
    
    #[test]
    fn test_appointment_model_creation() {
        let appointment = test_utils::create_test_appointment();
        assert_eq!(appointment.duration_minutes, 30);
        assert_eq!(appointment.status, "scheduled");
        assert_eq!(appointment.notes, Some("Regular checkup".to_string()));
    }
    
    #[test]
    fn test_medicine_model_creation() {
        let medicine = CreateMedicine {
            name: "Paracetamol".to_string(),
            description: Some("Pain relief medication".to_string()),
            category: "Pain Relief".to_string(),
            dosage_form: "Tablet".to_string(),
            strength: "500mg".to_string(),
            manufacturer: "Generic Pharma".to_string(),
            batch_number: "BATCH001".to_string(),
            expiry_date: "2025-12-31".to_string(),
            stock_quantity: 100,
            reorder_level: 20,
            unit_price: 5.50,
            prescription_required: true,
        };
        
        assert_eq!(medicine.name, "Paracetamol");
        assert_eq!(medicine.category, "Pain Relief");
        assert_eq!(medicine.stock_quantity, 100);
        assert_eq!(medicine.reorder_level, 20);
    }
}

// Integration test utilities
#[cfg(test)]
mod integration_utils {
    use super::*;
    use actix_web::{web, App, test};
    use clinic_management_backend::main;
    
    pub async fn create_test_app() -> impl actix_web::dev::Service<
        actix_http::Request,
        Response = actix_web::dev::ServiceResponse<actix_web::body::BoxBody>,
        Error = actix_web::Error,
    > {
        test::init_service(App::new().configure(main::configure_routes)).await
    }
    
    pub fn create_test_headers() -> actix_web::http::header::HeaderMap {
        let mut headers = actix_web::http::header::HeaderMap::new();
        headers.insert(
            actix_web::http::header::CONTENT_TYPE,
            "application/json".parse().unwrap(),
        );
        headers
    }
    
    pub fn create_auth_headers(token: &str) -> actix_web::http::header::HeaderMap {
        let mut headers = create_test_headers();
        headers.insert(
            actix_web::http::header::AUTHORIZATION,
            format!("Bearer {}", token).parse().unwrap(),
        );
        headers
    }
}

// Performance tests
#[cfg(test)]
mod performance_tests {
    use super::*;
    use std::time::Instant;
    
    #[tokio::test]
    async fn test_cache_performance() {
        let config = CacheConfig::default();
        let cache: MemoryCache<String> = MemoryCache::new(config);
        
        let start = Instant::now();
        
        // Perform 1000 cache operations
        for i in 0..1000 {
            let key = format!("key_{}", i);
            let value = format!("value_{}", i);
            cache.set(key.clone(), value, None).await.unwrap();
        }
        
        let set_duration = start.elapsed();
        println!("Cache set operations took: {:?}", set_duration);
        
        let start = Instant::now();
        
        // Retrieve 1000 cache entries
        for i in 0..1000 {
            let key = format!("key_{}", i);
            cache.get(&key).await;
        }
        
        let get_duration = start.elapsed();
        println!("Cache get operations took: {:?}", get_duration);
        
        // Assert performance is reasonable (less than 100ms for 1000 operations)
        assert!(set_duration.as_millis() < 100);
        assert!(get_duration.as_millis() < 100);
    }
    
    #[test]
    fn test_password_hashing_performance() {
        let auth_service = AuthService::new("test-secret", 24, 7);
        let password = "TestPassword123!";
        
        let start = Instant::now();
        
        // Hash 100 passwords
        for _ in 0..100 {
            let _hash = auth_service.hash_password(password).unwrap();
        }
        
        let duration = start.elapsed();
        println!("Password hashing took: {:?}", duration);
        
        // Assert performance is reasonable (less than 1 second for 100 hashes)
        assert!(duration.as_secs() < 1);
    }
}

// Mock data generators for testing
#[cfg(test)]
mod mock_data {
    use super::*;
    
    pub fn generate_test_patients(count: usize) -> Vec<CreatePatient> {
        (0..count)
            .map(|i| CreatePatient {
                first_name: format!("Patient{}", i),
                last_name: "Test".to_string(),
                date_of_birth: "1990-01-01".to_string(),
                gender: if i % 2 == 0 { "Male" } else { "Female" }.to_string(),
                phone: format!("123456789{}", i),
                location: Some(format!("Address {}", i)),
                patient_number: Some(format!("P{:03}", i)),
            })
            .collect()
    }
    
    pub fn generate_test_users(count: usize) -> Vec<CreateUser> {
        let roles = vec!["doctor", "nurse", "receptionist", "admin"];
        let departments = vec!["Cardiology", "Neurology", "Pediatrics", "Emergency"];
        
        (0..count)
            .map(|i| CreateUser {
                username: format!("user{}", i),
                password: "TestPassword123!".to_string(),
                name: format!("User {}", i),
                role: roles[i % roles.len()].to_string(),
                department: Some(departments[i % departments.len()].to_string()),
                permissions: Some(vec!["read".to_string(), "write".to_string()]),
            })
            .collect()
    }
    
    pub fn generate_test_appointments(count: usize) -> Vec<CreateAppointment> {
        (0..count)
            .map(|i| CreateAppointment {
                patient_id: uuid::Uuid::new_v4(),
                doctor_id: uuid::Uuid::new_v4(),
                appointment_date: format!("2024-01-{:02}T10:00:00Z", (i % 28) + 1),
                duration_minutes: 30,
                status: "scheduled".to_string(),
                notes: Some(format!("Test appointment {}", i)),
            })
            .collect()
    }
}
