use sqlx::PgPool;
use uuid::Uuid;
use argon2::{Argon2, PasswordHasher};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use chrono::Utc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://clinic_user:clinic_password@localhost:5432/clinic_management".to_string());
    
    let pool = PgPool::connect(&database_url).await?;
    
    // Hash password "demo123" for all demo users
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(b"demo123", &salt)?.to_string();
    
    println!("Generated password hash for 'demo123': {}", password_hash);
    
    // Seed demo users
    let users = vec![
        (
            Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap(),
            "admin",
            "admin@demo.sethmedical.com",
            "Demo Administrator",
            "admin",
            "Administration",
            r#"["all"]"#,
        ),
        (
            Uuid::parse_str("550e8400-e29b-41d4-a716-446655440002").unwrap(),
            "receptionist",
            "receptionist@demo.sethmedical.com",
            "Demo Receptionist",
            "receptionist",
            "Reception",
            r#"["patients:read", "patients:write", "appointments:read", "appointments:write"]"#,
        ),
        (
            Uuid::parse_str("550e8400-e29b-41d4-a716-446655440003").unwrap(),
            "clinician",
            "clinician@demo.sethmedical.com",
            "Demo Doctor",
            "clinician",
            "Medical",
            r#"["patients:read", "consultations:read", "consultations:write", "prescriptions:write"]"#,
        ),
        (
            Uuid::parse_str("550e8400-e29b-41d4-a716-446655440004").unwrap(),
            "nurse",
            "nurse@demo.sethmedical.com",
            "Demo Nurse",
            "nurse",
            "Nursing",
            r#"["patients:read", "consultations:read", "consultations:write"]"#,
        ),
    ];
    
    for (id, username, email, name, role, department, permissions) in users {
        sqlx::query!(
            r#"
            INSERT INTO users (id, username, email, password_hash, role, name, department, permissions, is_active, email_verified, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, true, true, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                username = EXCLUDED.username,
                email = EXCLUDED.email,
                password_hash = EXCLUDED.password_hash,
                updated_at = NOW()
            "#,
            id,
            username,
            email,
            password_hash,
            role,
            name,
            department,
            permissions
        )
        .execute(&pool)
        .await?;
        
        println!("✓ Seeded user: {} ({})", username, role);
    }
    
    // Seed sample patients
    let patients = vec![
        (
            Uuid::parse_str("650e8400-e29b-41d4-a716-446655440001").unwrap(),
            "P001",
            "John",
            "Doe",
            "1990-01-15",
            "Male",
            "+254712345678",
            "john.doe@email.com",
        ),
        (
            Uuid::parse_str("650e8400-e29b-41d4-a716-446655440002").unwrap(),
            "P002",
            "Jane",
            "Smith",
            "1985-05-20",
            "Female",
            "+254712345679",
            "jane.smith@email.com",
        ),
        (
            Uuid::parse_str("650e8400-e29b-41d4-a716-446655440003").unwrap(),
            "P003",
            "Robert",
            "Johnson",
            "1988-03-10",
            "Male",
            "+254712345680",
            "robert.johnson@email.com",
        ),
    ];
    
    for (id, patient_number, first_name, last_name, date_of_birth, gender, phone, email) in patients {
        sqlx::query!(
            r#"
            INSERT INTO patients (id, patient_number, first_name, last_name, date_of_birth, gender, phone, email, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
            "#,
            id,
            patient_number,
            first_name,
            last_name,
            date_of_birth,
            gender,
            phone,
            email
        )
        .execute(&pool)
        .await?;
        
        println!("✓ Seeded patient: {} {}", first_name, last_name);
    }
    
    // Verify
    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&pool)
        .await?;
    
    let patient_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM patients")
        .fetch_one(&pool)
        .await?;
    
    println!("\n✅ Seeding complete!");
    println!("   Users: {}", user_count);
    println!("   Patients: {}", patient_count);
    println!("\n📝 Demo Credentials:");
    println!("   Username: admin | Password: demo123");
    println!("   Username: receptionist | Password: demo123");
    println!("   Username: clinician | Password: demo123");
    println!("   Username: nurse | Password: demo123");
    
    Ok(())
}

