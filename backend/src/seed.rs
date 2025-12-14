use sqlx::{PgPool, Row};
use uuid::Uuid;
use crate::auth::AuthService;
use crate::models::{User, UserRole};
use crate::auth::get_role_permissions;

pub async fn seed_default_users(pool: &PgPool, auth_service: &AuthService) -> Result<(), Box<dyn std::error::Error>> {
    // Check if users already exist
    let user_count: i64 = sqlx::query("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?
        .get(0);

    if user_count > 0 {
        println!("Users already exist, skipping seed");
        return Ok(());
    }

    // Default users from DEMO_CREDENTIALS.md
    let default_users = vec![
        ("admin", "admin@clinic.com", "demo123", UserRole::Administrator, "System Admin", "IT"),
        ("receptionist", "receptionist@clinic.com", "demo123", UserRole::Receptionist, "Sarah Receptionist", "Front Desk"),
        ("clinician", "clinician@clinic.com", "demo123", UserRole::Clinician, "Dr. Smith", "General Practice"),
        ("nurse", "nurse@clinic.com", "demo123", UserRole::Nurse, "Nurse Joy", "Nursing"),
    ];

    for (username, email, password, role, name, department) in default_users {
        // Hash password securely
        let password_hash = auth_service.hash_password(password)?;
        
        // Get role permissions
        let permissions = serde_json::to_value(get_role_permissions(&role))?;
        
        // Insert user
        sqlx::query!(
            "INSERT INTO users (username, email, password_hash, role, name, department, permissions, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true)
             ON CONFLICT (username) DO NOTHING",
            username,
            email,
            password_hash,
            role as _,
            name,
            department,
            permissions
        )
        .execute(pool)
        .await?;
        
        println!("Created user: {} with role: {:?}", username, role);
    }
}

pub async fn seed_sample_data(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    // Sample patients
    let sample_patients = vec![
        ("P001", "John", "Doe", chrono::NaiveDate::from_ymd_opt(1980, 1, 1).unwrap(), "Male", "555-0101", "john@example.com", "123 Main St", "Jane Doe", "555-0102", "O+", "Penicillin", "Hypertension"),
        ("P002", "Jane", "Smith", chrono::NaiveDate::from_ymd_opt(1990, 5, 15).unwrap(), "Female", "555-0201", "jane@example.com", "456 Oak Ave", "John Smith", "555-0202", "A-", "None", "Asthma"),
    ];

    for (patient_number, first_name, last_name, date_of_birth, gender, phone, email, address, emergency_contact, emergency_phone, blood_type, allergies, medical_history) in sample_patients {
        sqlx::query!(
            "INSERT INTO patients (patient_number, first_name, last_name, date_of_birth, gender, phone, email, address, emergency_contact, emergency_phone, blood_type, allergies, medical_history)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (patient_number) DO NOTHING",
            patient_number,
            first_name,
            last_name,
            date_of_birth,
            gender,
            phone,
            email,
            address,
            emergency_contact,
            emergency_phone,
            blood_type,
            allergies,
            medical_history
        )
        .execute(pool)
        .await?;
    }

    // Sample medications
    let sample_medications = vec![
        ("Paracetamol", "Acetaminophen", "Analgesic", "PharmaCorp", "BATCH001", chrono::NaiveDate::from_ymd_opt(2025, 12, 31).unwrap(), 1000, rust_decimal::Decimal::from(10), 100, "Shelf A1", "Pain reliever", "Nausea", "Tablet", "500mg"),
        ("Amoxicillin", "Amoxicillin", "Antibiotic", "MediGone", "BATCH002", chrono::NaiveDate::from_ymd_opt(2024, 6, 30).unwrap(), 500, rust_decimal::Decimal::from(25), 50, "Shelf B2", "Antibiotic for infections", "Rash", "Capsule", "250mg"),
    ];

    for (name, generic_name, category, manufacturer, batch_number, expiry_date, quantity, unit_price, reorder_level, location, description, side_effects, dosage_form, strength) in sample_medications {
        sqlx::query!(
            "INSERT INTO medicines (name, generic_name, category, manufacturer, batch_number, expiry_date, quantity, unit_price, reorder_level, location, description, side_effects, dosage_form, strength)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (batch_number) DO NOTHING",
            name,
            generic_name,
            category,
            manufacturer,
            batch_number,
            expiry_date,
            quantity as i32,
            unit_price,
            reorder_level as i32,
            location,
            description,
            side_effects,
            dosage_form,
            strength
        )
        .execute(pool)
        .await?;
    }

    println!("Sample data seeded successfully");
    Ok(())
}
