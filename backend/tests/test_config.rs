use std::env;
use std::time::Duration;

/// Test configuration for the clinic management system
#[derive(Debug, Clone)]
pub struct TestConfig {
    pub database_url: String,
    pub test_database_url: String,
    pub jwt_secret: String,
    pub test_timeout: Duration,
    pub max_concurrent_tests: usize,
    pub enable_integration_tests: bool,
    pub enable_e2e_tests: bool,
    pub enable_performance_tests: bool,
    pub log_level: String,
    pub test_data_cleanup: bool,
}

impl Default for TestConfig {
    fn default() -> Self {
        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgresql://postgres:password@localhost:5432/clinic_management".to_string()),
            test_database_url: env::var("TEST_DATABASE_URL")
                .unwrap_or_else(|_| "postgresql://postgres:password@localhost:5432/clinic_management_test".to_string()),
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "test-secret-key-for-testing-only".to_string()),
            test_timeout: Duration::from_secs(30),
            max_concurrent_tests: 10,
            enable_integration_tests: env::var("ENABLE_INTEGRATION_TESTS")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
            enable_e2e_tests: env::var("ENABLE_E2E_TESTS")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
            enable_performance_tests: env::var("ENABLE_PERFORMANCE_TESTS")
                .unwrap_or_else(|_| "false".to_string())
                .parse()
                .unwrap_or(false),
            log_level: env::var("TEST_LOG_LEVEL")
                .unwrap_or_else(|_| "info".to_string()),
            test_data_cleanup: env::var("TEST_DATA_CLEANUP")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
        }
    }
}

impl TestConfig {
    /// Create a new test configuration
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Create test configuration from environment variables
    pub fn from_env() -> Self {
        Self::default()
    }
    
    /// Check if integration tests should run
    pub fn should_run_integration_tests(&self) -> bool {
        self.enable_integration_tests
    }
    
    /// Check if E2E tests should run
    pub fn should_run_e2e_tests(&self) -> bool {
        self.enable_e2e_tests
    }
    
    /// Check if performance tests should run
    pub fn should_run_performance_tests(&self) -> bool {
        self.enable_performance_tests
    }
    
    /// Get database URL for testing
    pub fn get_test_database_url(&self) -> &str {
        &self.test_database_url
    }
    
    /// Get JWT secret for testing
    pub fn get_jwt_secret(&self) -> &str {
        &self.jwt_secret
    }
    
    /// Get test timeout
    pub fn get_test_timeout(&self) -> Duration {
        self.test_timeout
    }
    
    /// Get maximum concurrent tests
    pub fn get_max_concurrent_tests(&self) -> usize {
        self.max_concurrent_tests
    }
    
    /// Get log level
    pub fn get_log_level(&self) -> &str {
        &self.log_level
    }
    
    /// Check if test data should be cleaned up
    pub fn should_cleanup_test_data(&self) -> bool {
        self.test_data_cleanup
    }
}

/// Test environment setup utilities
pub mod test_setup {
    use super::*;
    use sqlx::PgPool;
    use tracing::{info, warn, error};
    
    /// Initialize test environment
    pub async fn init_test_environment() -> Result<TestConfig, Box<dyn std::error::Error>> {
        let config = TestConfig::from_env();
        
        // Initialize logging
        init_test_logging(&config)?;
        
        // Setup test database
        setup_test_database(&config).await?;
        
        info!("Test environment initialized successfully");
        Ok(config)
    }
    
    /// Initialize test logging
    fn init_test_logging(config: &TestConfig) -> Result<(), Box<dyn std::error::Error>> {
        let log_level = match config.log_level.as_str() {
            "trace" => tracing::Level::TRACE,
            "debug" => tracing::Level::DEBUG,
            "info" => tracing::Level::INFO,
            "warn" => tracing::Level::WARN,
            "error" => tracing::Level::ERROR,
            _ => tracing::Level::INFO,
        };
        
        tracing_subscriber::fmt()
            .with_max_level(log_level)
            .with_test_writer()
            .init();
        
        Ok(())
    }
    
    /// Setup test database
    async fn setup_test_database(config: &TestConfig) -> Result<(), Box<dyn std::error::Error>> {
        info!("Setting up test database: {}", config.test_database_url);
        
        // Create test database connection
        let pool = PgPool::connect(&config.test_database_url).await?;
        
        // Run migrations
        sqlx::migrate!("./migrations").run(&pool).await?;
        
        info!("Test database setup completed");
        Ok(())
    }
    
    /// Cleanup test database
    pub async fn cleanup_test_database(config: &TestConfig) -> Result<(), Box<dyn std::error::Error>> {
        if !config.should_cleanup_test_data() {
            info!("Skipping test database cleanup");
            return Ok(());
        }
        
        info!("Cleaning up test database");
        
        let pool = PgPool::connect(&config.test_database_url).await?;
        
        // Clean up test data in reverse order of dependencies
        let cleanup_queries = vec![
            "DELETE FROM audit_logs",
            "DELETE FROM notifications",
            "DELETE FROM user_settings",
            "DELETE FROM system_settings",
            "DELETE FROM invoices",
            "DELETE FROM prescriptions",
            "DELETE FROM appointments",
            "DELETE FROM consultations",
            "DELETE FROM medicines",
            "DELETE FROM patients",
            "DELETE FROM sessions",
            "DELETE FROM users",
        ];
        
        for query in cleanup_queries {
            match sqlx::query(query).execute(&pool).await {
                Ok(_) => info!("Cleaned up: {}", query),
                Err(e) => warn!("Failed to clean up {}: {}", query, e),
            }
        }
        
        info!("Test database cleanup completed");
        Ok(())
    }
    
    /// Create test database pool
    pub async fn create_test_pool(config: &TestConfig) -> Result<PgPool, Box<dyn std::error::Error>> {
        let pool = PgPool::connect(&config.test_database_url).await?;
        Ok(pool)
    }
}

/// Test data generators
pub mod test_data {
    use super::*;
    use uuid::Uuid;
    
    /// Generate test patient data
    pub fn generate_test_patients(count: usize) -> Vec<CreatePatient> {
        (0..count)
            .map(|i| CreatePatient {
                first_name: format!("TestPatient{}", i),
                last_name: "Test".to_string(),
                date_of_birth: "1990-01-01".to_string(),
                gender: if i % 2 == 0 { "Male" } else { "Female" }.to_string(),
                phone: format!("123456789{}", i % 10),
                location: Some(format!("Test Address {}", i)),
                patient_number: Some(format!("P{:03}", i)),
            })
            .collect()
    }
    
    /// Generate test user data
    pub fn generate_test_users(count: usize) -> Vec<CreateUser> {
        let roles = vec!["doctor", "nurse", "receptionist", "admin"];
        let departments = vec!["Cardiology", "Neurology", "Pediatrics", "Emergency"];
        
        (0..count)
            .map(|i| CreateUser {
                username: format!("testuser{}", i),
                password: "TestPassword123!".to_string(),
                name: format!("Test User {}", i),
                role: roles[i % roles.len()].to_string(),
                department: Some(departments[i % departments.len()].to_string()),
                permissions: Some(vec!["read".to_string(), "write".to_string()]),
            })
            .collect()
    }
    
    /// Generate test appointment data
    pub fn generate_test_appointments(count: usize, patient_ids: Vec<Uuid>, doctor_ids: Vec<Uuid>) -> Vec<CreateAppointment> {
        (0..count)
            .map(|i| CreateAppointment {
                patient_id: patient_ids[i % patient_ids.len()],
                doctor_id: doctor_ids[i % doctor_ids.len()],
                appointment_date: format!("2024-01-{:02}T10:00:00Z", (i % 28) + 1),
                duration_minutes: 30,
                status: "scheduled".to_string(),
                notes: Some(format!("Test appointment {}", i)),
            })
            .collect()
    }
    
    /// Generate test medicine data
    pub fn generate_test_medicines(count: usize) -> Vec<CreateMedicine> {
        let categories = vec!["Pain Relief", "Antibiotics", "Vitamins", "Cardiology"];
        let dosage_forms = vec!["Tablet", "Capsule", "Syrup", "Injection"];
        let manufacturers = vec!["Generic Pharma", "MedCorp", "HealthPlus", "PharmaMax"];
        
        (0..count)
            .map(|i| CreateMedicine {
                name: format!("TestMedicine{}", i),
                description: Some(format!("Test medicine description {}", i)),
                category: categories[i % categories.len()].to_string(),
                dosage_form: dosage_forms[i % dosage_forms.len()].to_string(),
                strength: format!("{}mg", 100 + (i * 50)),
                manufacturer: manufacturers[i % manufacturers.len()].to_string(),
                batch_number: format!("BATCH{:03}", i),
                expiry_date: "2025-12-31".to_string(),
                stock_quantity: 100 - (i * 5),
                reorder_level: 20,
                unit_price: 5.0 + (i as f64 * 0.5),
                prescription_required: i % 2 == 0,
            })
            .collect()
    }
    
    /// Generate test system settings
    pub fn generate_test_system_settings() -> Vec<(String, String, String)> {
        vec![
            ("app_name".to_string(), "Clinic Management System".to_string(), "general".to_string()),
            ("max_appointments_per_day".to_string(), "50".to_string(), "schedule".to_string()),
            ("email_enabled".to_string(), "true".to_string(), "email".to_string()),
            ("sms_enabled".to_string(), "false".to_string(), "sms".to_string()),
            ("backup_enabled".to_string(), "true".to_string(), "backup".to_string()),
        ]
    }
    
    /// Generate test user settings
    pub fn generate_test_user_settings(user_id: Uuid) -> Vec<(String, String, String)> {
        vec![
            ("theme".to_string(), "dark".to_string(), "ui".to_string()),
            ("language".to_string(), "en".to_string(), "ui".to_string()),
            ("notifications_enabled".to_string(), "true".to_string(), "notifications".to_string()),
            ("email_notifications".to_string(), "true".to_string(), "notifications".to_string()),
            ("sms_notifications".to_string(), "false".to_string(), "notifications".to_string()),
        ]
    }
}

/// Test assertions utilities
pub mod test_assertions {
    use super::*;
    use actix_web::http::StatusCode;
    use serde_json::Value;
    
    /// Assert API response is successful
    pub fn assert_successful_response(status: StatusCode, body: &Value) {
        assert!(status.is_success(), "Expected successful status, got: {}", status);
        assert!(body["success"].as_bool().unwrap_or(false), "Expected success: true in response");
    }
    
    /// Assert API response is an error
    pub fn assert_error_response(status: StatusCode, body: &Value) {
        assert!(!status.is_success(), "Expected error status, got: {}", status);
        assert!(!body["success"].as_bool().unwrap_or(true), "Expected success: false in response");
    }
    
    /// Assert response contains expected data
    pub fn assert_response_contains_data(body: &Value, expected_keys: &[&str]) {
        assert!(body["data"].is_object() || body["data"].is_array(), "Expected data field in response");
        
        if let Some(data_obj) = body["data"].as_object() {
            for key in expected_keys {
                assert!(data_obj.contains_key(*key), "Expected key '{}' in response data", key);
            }
        }
    }
    
    /// Assert pagination structure
    pub fn assert_pagination_structure(body: &Value) {
        let data = &body["data"];
        assert!(data["pagination"].is_object(), "Expected pagination object in response");
        
        let pagination = &data["pagination"];
        assert!(pagination["page"].is_number(), "Expected page number in pagination");
        assert!(pagination["limit"].is_number(), "Expected limit number in pagination");
        assert!(pagination["total"].is_number(), "Expected total number in pagination");
        assert!(pagination["pages"].is_number(), "Expected pages number in pagination");
    }
    
    /// Assert patient data structure
    pub fn assert_patient_structure(patient: &Value) {
        let required_fields = ["id", "first_name", "last_name", "date_of_birth", "gender", "phone"];
        for field in &required_fields {
            assert!(patient[field].is_string(), "Expected {} field in patient data", field);
        }
    }
    
    /// Assert user data structure
    pub fn assert_user_structure(user: &Value) {
        let required_fields = ["id", "username", "role", "name"];
        for field in &required_fields {
            assert!(user[field].is_string(), "Expected {} field in user data", field);
        }
    }
    
    /// Assert appointment data structure
    pub fn assert_appointment_structure(appointment: &Value) {
        let required_fields = ["id", "patient_id", "doctor_id", "appointment_date", "status"];
        for field in &required_fields {
            assert!(appointment[field].is_string(), "Expected {} field in appointment data", field);
        }
        assert!(appointment["duration_minutes"].is_number(), "Expected duration_minutes number in appointment data");
    }
    
    /// Assert medicine data structure
    pub fn assert_medicine_structure(medicine: &Value) {
        let required_fields = ["id", "name", "category", "dosage_form", "strength", "manufacturer"];
        for field in &required_fields {
            assert!(medicine[field].is_string(), "Expected {} field in medicine data", field);
        }
        assert!(medicine["stock_quantity"].is_number(), "Expected stock_quantity number in medicine data");
        assert!(medicine["unit_price"].is_number(), "Expected unit_price number in medicine data");
    }
}

/// Test performance utilities
pub mod test_performance {
    use super::*;
    use std::time::Instant;
    
    /// Measure execution time of a function
    pub async fn measure_execution_time<F, R>(f: F) -> (R, Duration)
    where
        F: std::future::Future<Output = R>,
    {
        let start = Instant::now();
        let result = f.await;
        let duration = start.elapsed();
        (result, duration)
    }
    
    /// Assert execution time is within acceptable limits
    pub fn assert_execution_time(duration: Duration, max_duration: Duration) {
        assert!(
            duration <= max_duration,
            "Execution time {:?} exceeded maximum allowed time {:?}",
            duration,
            max_duration
        );
    }
    
    /// Benchmark multiple executions
    pub async fn benchmark_execution<F, R>(f: F, iterations: usize) -> (Vec<Duration>, Duration, Duration)
    where
        F: Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = R> + Send>>,
    {
        let mut durations = Vec::new();
        let start = Instant::now();
        
        for _ in 0..iterations {
            let (_, duration) = measure_execution_time(f()).await;
            durations.push(duration);
        }
        
        let total_duration = start.elapsed();
        let avg_duration = total_duration / iterations as u32;
        
        (durations, total_duration, avg_duration)
    }
}
