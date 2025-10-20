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

    // No default users - system starts empty
    let default_users = vec![];

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

    println!("Default users seeded successfully");
    Ok(())
}

pub async fn seed_sample_data(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    // No sample patients - system starts empty
    let sample_patients = vec![];

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

    // No sample medications - system starts empty
    let sample_medications = vec![];

    for (name, generic_name, category, manufacturer, batch_number, expiry_date, quantity, unit_price, reorder_level, location, description, side_effects, dosage_form, strength) in sample_medications {
        sqlx::query!(
            "INSERT INTO medications (name, generic_name, category, manufacturer, batch_number, expiry_date, quantity, unit_price, reorder_level, location, description, side_effects, dosage_form, strength)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (batch_number) DO NOTHING",
            name,
            generic_name,
            category,
            manufacturer,
            batch_number,
            expiry_date,
            quantity,
            unit_price,
            reorder_level,
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
