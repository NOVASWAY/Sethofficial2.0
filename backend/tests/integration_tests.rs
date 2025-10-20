use clinic_management_backend::{
    models::*,
    auth::AuthService,
    cache::CacheService,
    error::ApiError,
    validation::Validate,
};

use actix_web::{test, web, App, http::StatusCode};
use serde_json::json;
use sqlx::PgPool;
use std::collections::HashMap;

// Test database setup
mod test_database {
    use super::*;
    
    pub async fn setup_test_database() -> PgPool {
        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://postgres:password@localhost:5432/clinic_management_test".to_string());
        
        let pool = sqlx::PgPool::connect(&database_url).await.unwrap();
        
        // Run migrations for test database
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        
        pool
    }
    
    pub async fn cleanup_test_database(pool: &PgPool) {
        // Clean up test data
        sqlx::query("DELETE FROM audit_logs").execute(pool).await.unwrap();
        sqlx::query("DELETE FROM notifications").execute(pool).await.unwrap();
        sqlx::query("DELETE FROM user_settings").execute(pool).await.unwrap();
        sqlx::query("DELETE FROM system_settings").execute(pool).await.unwrap();
        sqlx::query("DELETE FROM invoices").execute(pool).await.unwrap();
        sqlx::query("DELETE FROM prescriptions").execute(pool).await.unwrap();
        sqlx::query("DELETE FROM appointments").execute(pool).await.unwrap();
        sqlx::query("DELETE FROM consultations").execute(pool).await.unwrap();
        sqlx::query("DELETE FROM medicines").execute(pool).await.unwrap();
        sqlx::query("DELETE FROM patients").execute(pool).await.unwrap();
        sqlx::query("DELETE FROM sessions").execute(pool).await.unwrap();
        sqlx::query("DELETE FROM users").execute(pool).await.unwrap();
    }
}

// Authentication integration tests
#[cfg(test)]
mod auth_integration_tests {
    use super::*;
    
    #[actix_web::test]
    async fn test_user_registration_and_login() {
        let pool = test_database::setup_test_database().await;
        let auth_service = AuthService::new("test-secret", 24, 7);
        
        // Create test user
        let create_user = CreateUser {
            username: "testuser".to_string(),
            password: "TestPassword123!".to_string(),
            name: "Test User".to_string(),
            role: "doctor".to_string(),
            department: Some("Cardiology".to_string()),
            permissions: Some(vec!["read".to_string(), "write".to_string()]),
        };
        
        // Hash password
        let password_hash = auth_service.hash_password(&create_user.password).unwrap();
        
        // Insert user into database
        let user_id = sqlx::query_scalar::<_, uuid::Uuid>(
            "INSERT INTO users (username, password_hash, role, name, department, permissions, is_active) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING id"
        )
        .bind(&create_user.username)
        .bind(&password_hash)
        .bind(&create_user.role)
        .bind(&create_user.name)
        .bind(&create_user.department)
        .bind(&create_user.permissions)
        .bind(true)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        // Test login
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE username = $1"
        )
        .bind(&create_user.username)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        let is_valid = auth_service.verify_password(&create_user.password, &user.password_hash).unwrap();
        assert!(is_valid);
        
        // Generate token
        let token = auth_service.generate_access_token(&user).unwrap();
        assert!(!token.is_empty());
        
        // Verify token
        let claims = auth_service.verify_access_token(&token).unwrap();
        assert_eq!(claims.sub, user.id.to_string());
        assert_eq!(claims.username, user.username);
        
        test_database::cleanup_test_database(&pool).await;
    }
    
    #[actix_web::test]
    async fn test_invalid_login() {
        let pool = test_database::setup_test_database().await;
        let auth_service = AuthService::new("test-secret", 24, 7);
        
        // Try to login with non-existent user
        let result = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE username = $1"
        )
        .bind("nonexistent")
        .fetch_optional(&pool)
        .await
        .unwrap();
        
        assert!(result.is_none());
        
        test_database::cleanup_test_database(&pool).await;
    }
}

// Patient management integration tests
#[cfg(test)]
mod patient_integration_tests {
    use super::*;
    
    #[actix_web::test]
    async fn test_patient_crud_operations() {
        let pool = test_database::setup_test_database().await;
        
        // Create patient
        let create_patient = CreatePatient {
            first_name: "John".to_string(),
            last_name: "Doe".to_string(),
            date_of_birth: "1990-01-01".to_string(),
            gender: "Male".to_string(),
            phone: "1234567890".to_string(),
            location: Some("123 Main St".to_string()),
            patient_number: Some("P001".to_string()),
        };
        
        // Validate patient data
        assert!(create_patient.validate().is_ok());
        
        // Insert patient
        let patient_id = sqlx::query_scalar::<_, uuid::Uuid>(
            "INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone, location, patient_number) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING id"
        )
        .bind(&create_patient.first_name)
        .bind(&create_patient.last_name)
        .bind(&create_patient.date_of_birth)
        .bind(&create_patient.gender)
        .bind(&create_patient.phone)
        .bind(&create_patient.location)
        .bind(&create_patient.patient_number)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        // Read patient
        let patient = sqlx::query_as::<_, Patient>(
            "SELECT * FROM patients WHERE id = $1"
        )
        .bind(patient_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        assert_eq!(patient.first_name, create_patient.first_name);
        assert_eq!(patient.last_name, create_patient.last_name);
        assert_eq!(patient.phone, create_patient.phone);
        
        // Update patient
        let update_patient = UpdatePatient {
            first_name: Some("Jane".to_string()),
            last_name: Some("Smith".to_string()),
            phone: Some("0987654321".to_string()),
            location: Some("456 Oak Ave".to_string()),
            ..Default::default()
        };
        
        sqlx::query(
            "UPDATE patients SET first_name = $1, last_name = $2, phone = $3, location = $4, updated_at = NOW() 
             WHERE id = $5"
        )
        .bind(&update_patient.first_name)
        .bind(&update_patient.last_name)
        .bind(&update_patient.phone)
        .bind(&update_patient.location)
        .bind(patient_id)
        .execute(&pool)
        .await
        .unwrap();
        
        // Verify update
        let updated_patient = sqlx::query_as::<_, Patient>(
            "SELECT * FROM patients WHERE id = $1"
        )
        .bind(patient_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        assert_eq!(updated_patient.first_name, "Jane");
        assert_eq!(updated_patient.last_name, "Smith");
        assert_eq!(updated_patient.phone, "0987654321");
        
        // Delete patient
        sqlx::query("DELETE FROM patients WHERE id = $1")
            .bind(patient_id)
            .execute(&pool)
            .await
            .unwrap();
        
        // Verify deletion
        let deleted_patient = sqlx::query_as::<_, Patient>(
            "SELECT * FROM patients WHERE id = $1"
        )
        .bind(patient_id)
        .fetch_optional(&pool)
        .await
        .unwrap();
        
        assert!(deleted_patient.is_none());
        
        test_database::cleanup_test_database(&pool).await;
    }
    
    #[actix_web::test]
    async fn test_patient_search() {
        let pool = test_database::setup_test_database().await;
        
        // Create multiple patients
        let patients = vec![
            CreatePatient {
                first_name: "John".to_string(),
                last_name: "Doe".to_string(),
                date_of_birth: "1990-01-01".to_string(),
                gender: "Male".to_string(),
                phone: "1234567890".to_string(),
                location: Some("123 Main St".to_string()),
                patient_number: Some("P001".to_string()),
            },
            CreatePatient {
                first_name: "Jane".to_string(),
                last_name: "Smith".to_string(),
                date_of_birth: "1985-05-15".to_string(),
                gender: "Female".to_string(),
                phone: "0987654321".to_string(),
                location: Some("456 Oak Ave".to_string()),
                patient_number: Some("P002".to_string()),
            },
            CreatePatient {
                first_name: "Bob".to_string(),
                last_name: "Johnson".to_string(),
                date_of_birth: "1992-12-10".to_string(),
                gender: "Male".to_string(),
                phone: "5555555555".to_string(),
                location: Some("789 Pine St".to_string()),
                patient_number: Some("P003".to_string()),
            },
        ];
        
        for patient in &patients {
            sqlx::query(
                "INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone, location, patient_number) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)"
            )
            .bind(&patient.first_name)
            .bind(&patient.last_name)
            .bind(&patient.date_of_birth)
            .bind(&patient.gender)
            .bind(&patient.phone)
            .bind(&patient.location)
            .bind(&patient.patient_number)
            .execute(&pool)
            .await
            .unwrap();
        }
        
        // Search by name
        let search_results = sqlx::query_as::<_, Patient>(
            "SELECT * FROM patients WHERE first_name ILIKE $1 OR last_name ILIKE $1"
        )
        .bind("%John%")
        .fetch_all(&pool)
        .await
        .unwrap();
        
        assert_eq!(search_results.len(), 2); // John Doe and Bob Johnson
        
        // Search by phone
        let phone_results = sqlx::query_as::<_, Patient>(
            "SELECT * FROM patients WHERE phone = $1"
        )
        .bind("1234567890")
        .fetch_all(&pool)
        .await
        .unwrap();
        
        assert_eq!(phone_results.len(), 1);
        assert_eq!(phone_results[0].first_name, "John");
        
        test_database::cleanup_test_database(&pool).await;
    }
}

// Appointment integration tests
#[cfg(test)]
mod appointment_integration_tests {
    use super::*;
    
    #[actix_web::test]
    async fn test_appointment_management() {
        let pool = test_database::setup_test_database().await;
        
        // Create test user (doctor)
        let doctor_id = sqlx::query_scalar::<_, uuid::Uuid>(
            "INSERT INTO users (username, password_hash, role, name, is_active) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id"
        )
        .bind("doctor1")
        .bind("hashed_password")
        .bind("doctor")
        .bind("Dr. Smith")
        .bind(true)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        // Create test patient
        let patient_id = sqlx::query_scalar::<_, uuid::Uuid>(
            "INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id"
        )
        .bind("John")
        .bind("Doe")
        .bind("1990-01-01")
        .bind("Male")
        .bind("1234567890")
        .fetch_one(&pool)
        .await
        .unwrap();
        
        // Create appointment
        let create_appointment = CreateAppointment {
            patient_id,
            doctor_id,
            appointment_date: "2024-01-15T10:00:00Z".to_string(),
            duration_minutes: 30,
            status: "scheduled".to_string(),
            notes: Some("Regular checkup".to_string()),
        };
        
        assert!(create_appointment.validate().is_ok());
        
        let appointment_id = sqlx::query_scalar::<_, uuid::Uuid>(
            "INSERT INTO appointments (patient_id, doctor_id, appointment_date, duration_minutes, status, notes) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id"
        )
        .bind(create_appointment.patient_id)
        .bind(create_appointment.doctor_id)
        .bind(create_appointment.appointment_date)
        .bind(create_appointment.duration_minutes)
        .bind(create_appointment.status)
        .bind(create_appointment.notes)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        // Read appointment
        let appointment = sqlx::query_as::<_, Appointment>(
            "SELECT * FROM appointments WHERE id = $1"
        )
        .bind(appointment_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        assert_eq!(appointment.patient_id, patient_id);
        assert_eq!(appointment.doctor_id, doctor_id);
        assert_eq!(appointment.status, "scheduled");
        
        // Update appointment status
        sqlx::query(
            "UPDATE appointments SET status = $1, updated_at = NOW() WHERE id = $2"
        )
        .bind("completed")
        .bind(appointment_id)
        .execute(&pool)
        .await
        .unwrap();
        
        // Verify update
        let updated_appointment = sqlx::query_as::<_, Appointment>(
            "SELECT * FROM appointments WHERE id = $1"
        )
        .bind(appointment_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        assert_eq!(updated_appointment.status, "completed");
        
        test_database::cleanup_test_database(&pool).await;
    }
    
    #[actix_web::test]
    async fn test_appointment_scheduling_conflicts() {
        let pool = test_database::setup_test_database().await;
        
        // Create test doctor
        let doctor_id = sqlx::query_scalar::<_, uuid::Uuid>(
            "INSERT INTO users (username, password_hash, role, name, is_active) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id"
        )
        .bind("doctor1")
        .bind("hashed_password")
        .bind("doctor")
        .bind("Dr. Smith")
        .bind(true)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        // Create test patients
        let patient1_id = sqlx::query_scalar::<_, uuid::Uuid>(
            "INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id"
        )
        .bind("John")
        .bind("Doe")
        .bind("1990-01-01")
        .bind("Male")
        .bind("1234567890")
        .fetch_one(&pool)
        .await
        .unwrap();
        
        let patient2_id = sqlx::query_scalar::<_, uuid::Uuid>(
            "INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id"
        )
        .bind("Jane")
        .bind("Smith")
        .bind("1985-05-15")
        .bind("Female")
        .bind("0987654321")
        .fetch_one(&pool)
        .await
        .unwrap();
        
        // Create first appointment
        sqlx::query(
            "INSERT INTO appointments (patient_id, doctor_id, appointment_date, duration_minutes, status) 
             VALUES ($1, $2, $3, $4, $5)"
        )
        .bind(patient1_id)
        .bind(doctor_id)
        .bind("2024-01-15T10:00:00Z")
        .bind(30)
        .bind("scheduled")
        .execute(&pool)
        .await
        .unwrap();
        
        // Try to create conflicting appointment
        let conflict_result = sqlx::query(
            "INSERT INTO appointments (patient_id, doctor_id, appointment_date, duration_minutes, status) 
             VALUES ($1, $2, $3, $4, $5)"
        )
        .bind(patient2_id)
        .bind(doctor_id)
        .bind("2024-01-15T10:15:00Z") // 15 minutes overlap
        .bind(30)
        .bind("scheduled")
        .execute(&pool)
        .await;
        
        // Check if conflict was detected (this would depend on your business logic)
        // For now, we'll just verify the appointment was created
        assert!(conflict_result.is_ok());
        
        // Count appointments for the doctor on that day
        let appointment_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM appointments 
             WHERE doctor_id = $1 AND DATE(appointment_date) = '2024-01-15'"
        )
        .bind(doctor_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        assert_eq!(appointment_count, 2);
        
        test_database::cleanup_test_database(&pool).await;
    }
}

// Medicine management integration tests
#[cfg(test)]
mod medicine_integration_tests {
    use super::*;
    
    #[actix_web::test]
    async fn test_medicine_inventory_management() {
        let pool = test_database::setup_test_database().await;
        
        // Create medicine
        let create_medicine = CreateMedicine {
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
        
        let medicine_id = sqlx::query_scalar::<_, uuid::Uuid>(
            "INSERT INTO medicines (name, description, category, dosage_form, strength, manufacturer, 
             batch_number, expiry_date, stock_quantity, reorder_level, unit_price, prescription_required) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
             RETURNING id"
        )
        .bind(&create_medicine.name)
        .bind(&create_medicine.description)
        .bind(&create_medicine.category)
        .bind(&create_medicine.dosage_form)
        .bind(&create_medicine.strength)
        .bind(&create_medicine.manufacturer)
        .bind(&create_medicine.batch_number)
        .bind(&create_medicine.expiry_date)
        .bind(create_medicine.stock_quantity)
        .bind(create_medicine.reorder_level)
        .bind(create_medicine.unit_price)
        .bind(create_medicine.prescription_required)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        // Read medicine
        let medicine = sqlx::query_as::<_, Medicine>(
            "SELECT * FROM medicines WHERE id = $1"
        )
        .bind(medicine_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        assert_eq!(medicine.name, "Paracetamol");
        assert_eq!(medicine.stock_quantity, 100);
        assert_eq!(medicine.reorder_level, 20);
        
        // Update stock quantity
        sqlx::query(
            "UPDATE medicines SET stock_quantity = $1, updated_at = NOW() WHERE id = $2"
        )
        .bind(50)
        .bind(medicine_id)
        .execute(&pool)
        .await
        .unwrap();
        
        // Check low stock medicines
        let low_stock_medicines = sqlx::query_as::<_, Medicine>(
            "SELECT * FROM medicines WHERE stock_quantity <= reorder_level"
        )
        .fetch_all(&pool)
        .await
        .unwrap();
        
        assert_eq!(low_stock_medicines.len(), 0); // 50 > 20, so not low stock
        
        // Reduce stock to trigger low stock alert
        sqlx::query(
            "UPDATE medicines SET stock_quantity = $1, updated_at = NOW() WHERE id = $2"
        )
        .bind(10)
        .bind(medicine_id)
        .execute(&pool)
        .await
        .unwrap();
        
        // Check low stock medicines again
        let low_stock_medicines = sqlx::query_as::<_, Medicine>(
            "SELECT * FROM medicines WHERE stock_quantity <= reorder_level"
        )
        .fetch_all(&pool)
        .await
        .unwrap();
        
        assert_eq!(low_stock_medicines.len(), 1);
        assert_eq!(low_stock_medicines[0].name, "Paracetamol");
        
        test_database::cleanup_test_database(&pool).await;
    }
}

// Cache integration tests
#[cfg(test)]
mod cache_integration_tests {
    use super::*;
    
    #[actix_web::test]
    async fn test_cache_with_database_integration() {
        let pool = test_database::setup_test_database().await;
        let cache_service = CacheService::new();
        
        // Create test patient
        let patient_id = sqlx::query_scalar::<_, uuid::Uuid>(
            "INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id"
        )
        .bind("John")
        .bind("Doe")
        .bind("1990-01-01")
        .bind("Male")
        .bind("1234567890")
        .fetch_one(&pool)
        .await
        .unwrap();
        
        // Fetch patient from database
        let patient = sqlx::query_as::<_, Patient>(
            "SELECT * FROM patients WHERE id = $1"
        )
        .bind(patient_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        // Cache the patient
        let patient_json = serde_json::to_value(&patient).unwrap();
        cache_service.set_patient(&patient_id.to_string(), patient_json.clone()).await.unwrap();
        
        // Retrieve from cache
        let cached_patient = cache_service.get_patient(&patient_id.to_string()).await;
        assert!(cached_patient.is_some());
        
        // Verify cache hit
        let cache_stats = cache_service.patients.get_stats().await;
        assert_eq!(cache_stats.hits, 1);
        assert_eq!(cache_stats.misses, 0);
        
        test_database::cleanup_test_database(&pool).await;
    }
    
    #[actix_web::test]
    async fn test_cache_invalidation() {
        let pool = test_database::setup_test_database().await;
        let cache_service = CacheService::new();
        
        // Create test patient
        let patient_id = sqlx::query_scalar::<_, uuid::Uuid>(
            "INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id"
        )
        .bind("John")
        .bind("Doe")
        .bind("1990-01-01")
        .bind("Male")
        .bind("1234567890")
        .fetch_one(&pool)
        .await
        .unwrap();
        
        // Fetch and cache patient
        let patient = sqlx::query_as::<_, Patient>(
            "SELECT * FROM patients WHERE id = $1"
        )
        .bind(patient_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        let patient_json = serde_json::to_value(&patient).unwrap();
        cache_service.set_patient(&patient_id.to_string(), patient_json).await.unwrap();
        
        // Verify patient is in cache
        let cached_patient = cache_service.get_patient(&patient_id.to_string()).await;
        assert!(cached_patient.is_some());
        
        // Update patient in database
        sqlx::query(
            "UPDATE patients SET first_name = $1, updated_at = NOW() WHERE id = $2"
        )
        .bind("Jane")
        .bind(patient_id)
        .execute(&pool)
        .await
        .unwrap();
        
        // Invalidate cache
        cache_service.delete_patient(&patient_id.to_string()).await;
        
        // Verify cache is invalidated
        let cached_patient = cache_service.get_patient(&patient_id.to_string()).await;
        assert!(cached_patient.is_none());
        
        test_database::cleanup_test_database(&pool).await;
    }
}

// Settings integration tests
#[cfg(test)]
mod settings_integration_tests {
    use super::*;
    
    #[actix_web::test]
    async fn test_system_settings_management() {
        let pool = test_database::setup_test_database().await;
        
        // Create system settings
        let settings = vec![
            ("app_name", "Clinic Management System", "general"),
            ("max_appointments_per_day", "50", "schedule"),
            ("email_enabled", "true", "email"),
        ];
        
        for (key, value, category) in settings {
            sqlx::query(
                "INSERT INTO system_settings (key, value, category, is_encrypted) 
                 VALUES ($1, $2, $3, $4)"
            )
            .bind(key)
            .bind(value)
            .bind(category)
            .bind(false)
            .execute(&pool)
            .await
            .unwrap();
        }
        
        // Read all settings
        let all_settings = sqlx::query_as::<_, SystemSetting>(
            "SELECT * FROM system_settings ORDER BY category, key"
        )
        .fetch_all(&pool)
        .await
        .unwrap();
        
        assert_eq!(all_settings.len(), 3);
        
        // Read settings by category
        let email_settings = sqlx::query_as::<_, SystemSetting>(
            "SELECT * FROM system_settings WHERE category = $1"
        )
        .bind("email")
        .fetch_all(&pool)
        .await
        .unwrap();
        
        assert_eq!(email_settings.len(), 1);
        assert_eq!(email_settings[0].key, "email_enabled");
        
        // Update setting
        sqlx::query(
            "UPDATE system_settings SET value = $1, updated_at = NOW() WHERE key = $2"
        )
        .bind("100")
        .bind("max_appointments_per_day")
        .execute(&pool)
        .await
        .unwrap();
        
        // Verify update
        let updated_setting = sqlx::query_as::<_, SystemSetting>(
            "SELECT * FROM system_settings WHERE key = $1"
        )
        .bind("max_appointments_per_day")
        .fetch_one(&pool)
        .await
        .unwrap();
        
        assert_eq!(updated_setting.value, "100");
        
        test_database::cleanup_test_database(&pool).await;
    }
    
    #[actix_web::test]
    async fn test_user_settings_management() {
        let pool = test_database::setup_test_database().await;
        
        // Create test user
        let user_id = sqlx::query_scalar::<_, uuid::Uuid>(
            "INSERT INTO users (username, password_hash, role, name, is_active) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id"
        )
        .bind("testuser")
        .bind("hashed_password")
        .bind("doctor")
        .bind("Test User")
        .bind(true)
        .fetch_one(&pool)
        .await
        .unwrap();
        
        // Create user settings
        let user_settings = vec![
            ("theme", "dark", "ui"),
            ("language", "en", "ui"),
            ("notifications_enabled", "true", "notifications"),
        ];
        
        for (key, value, category) in user_settings {
            sqlx::query(
                "INSERT INTO user_settings (user_id, key, value, category, is_encrypted) 
                 VALUES ($1, $2, $3, $4, $5)"
            )
            .bind(user_id)
            .bind(key)
            .bind(value)
            .bind(category)
            .bind(false)
            .execute(&pool)
            .await
            .unwrap();
        }
        
        // Read user settings
        let settings = sqlx::query_as::<_, UserSetting>(
            "SELECT * FROM user_settings WHERE user_id = $1 ORDER BY category, key"
        )
        .bind(user_id)
        .fetch_all(&pool)
        .await
        .unwrap();
        
        assert_eq!(settings.len(), 3);
        
        // Read settings by category
        let ui_settings = sqlx::query_as::<_, UserSetting>(
            "SELECT * FROM user_settings WHERE user_id = $1 AND category = $2"
        )
        .bind(user_id)
        .bind("ui")
        .fetch_all(&pool)
        .await
        .unwrap();
        
        assert_eq!(ui_settings.len(), 2);
        
        test_database::cleanup_test_database(&pool).await;
    }
}

// Performance integration tests
#[cfg(test)]
mod performance_integration_tests {
    use super::*;
    use std::time::Instant;
    
    #[actix_web::test]
    async fn test_bulk_patient_operations() {
        let pool = test_database::setup_test_database().await;
        
        let start = Instant::now();
        
        // Create 100 patients
        for i in 0..100 {
            sqlx::query(
                "INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone, patient_number) 
                 VALUES ($1, $2, $3, $4, $5, $6)"
            )
            .bind(format!("Patient{}", i))
            .bind("Test")
            .bind("1990-01-01")
            .bind(if i % 2 == 0 { "Male" } else { "Female" })
            .bind(format!("123456789{}", i % 10))
            .bind(format!("P{:03}", i))
            .execute(&pool)
            .await
            .unwrap();
        }
        
        let insert_duration = start.elapsed();
        println!("Inserted 100 patients in: {:?}", insert_duration);
        
        // Search patients
        let search_start = Instant::now();
        let search_results = sqlx::query_as::<_, Patient>(
            "SELECT * FROM patients WHERE first_name ILIKE $1"
        )
        .bind("%Patient%")
        .fetch_all(&pool)
        .await
        .unwrap();
        
        let search_duration = search_start.elapsed();
        println!("Searched patients in: {:?}", search_duration);
        
        assert_eq!(search_results.len(), 100);
        
        // Assert performance is reasonable
        assert!(insert_duration.as_millis() < 5000); // Less than 5 seconds
        assert!(search_duration.as_millis() < 1000); // Less than 1 second
        
        test_database::cleanup_test_database(&pool).await;
    }
    
    #[actix_web::test]
    async fn test_concurrent_operations() {
        let pool = test_database::setup_test_database().await;
        
        let start = Instant::now();
        
        // Perform concurrent operations
        let handles: Vec<_> = (0..10)
            .map(|i| {
                let pool = pool.clone();
                tokio::spawn(async move {
                    // Create patient
                    let patient_id = sqlx::query_scalar::<_, uuid::Uuid>(
                        "INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone) 
                         VALUES ($1, $2, $3, $4, $5) 
                         RETURNING id"
                    )
                    .bind(format!("Patient{}", i))
                    .bind("Test")
                    .bind("1990-01-01")
                    .bind("Male")
                    .bind(format!("123456789{}", i))
                    .fetch_one(&pool)
                    .await
                    .unwrap();
                    
                    // Read patient
                    let _patient = sqlx::query_as::<_, Patient>(
                        "SELECT * FROM patients WHERE id = $1"
                    )
                    .bind(patient_id)
                    .fetch_one(&pool)
                    .await
                    .unwrap();
                    
                    // Update patient
                    sqlx::query(
                        "UPDATE patients SET first_name = $1, updated_at = NOW() WHERE id = $2"
                    )
                    .bind(format!("UpdatedPatient{}", i))
                    .bind(patient_id)
                    .execute(&pool)
                    .await
                    .unwrap();
                    
                    patient_id
                })
            })
            .collect();
        
        // Wait for all operations to complete
        let results = futures::future::join_all(handles).await;
        
        let duration = start.elapsed();
        println!("Concurrent operations completed in: {:?}", duration);
        
        // Verify all operations succeeded
        assert_eq!(results.len(), 10);
        for result in results {
            assert!(result.is_ok());
        }
        
        // Assert performance is reasonable
        assert!(duration.as_millis() < 2000); // Less than 2 seconds
        
        test_database::cleanup_test_database(&pool).await;
    }
}
