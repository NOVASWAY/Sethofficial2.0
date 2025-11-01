use clinic_management_backend::{AppState, auth::AuthService, models::User};
use sqlx::PgPool;
use std::env;

/// Test utilities for setting up test environment
pub mod test_utils {
    use super::*;

    /// Set up a test database pool
    pub async fn setup_test_db() -> PgPool {
        let database_url = env::var("TEST_DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://postgres:password@localhost:5432/clinic_management_test".to_string());
        
        let pool = sqlx::PgPool::connect(&database_url)
            .await
            .expect("Failed to connect to test database");
        
        // Run migrations
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("Failed to run migrations");
        
        pool
    }

    /// Create test app state
    pub async fn create_test_app_state() -> AppState {
        let db_pool = setup_test_db().await;
        let jwt_secret = "test-secret-key-for-testing-only";
        let auth_service = AuthService::new(jwt_secret, 24, 7);
        
        AppState {
            db_pool,
            auth_service,
        }
    }

    /// Clean up test data
    pub async fn cleanup_test_data(pool: &PgPool) {
        // Clean in reverse dependency order
        sqlx::query("DELETE FROM invoice_items").execute(pool).await.ok();
        sqlx::query("DELETE FROM invoices").execute(pool).await.ok();
        sqlx::query("DELETE FROM prescriptions").execute(pool).await.ok();
        sqlx::query("DELETE FROM consultations").execute(pool).await.ok();
        sqlx::query("DELETE FROM appointments").execute(pool).await.ok();
        sqlx::query("DELETE FROM medicines").execute(pool).await.ok();
        sqlx::query("DELETE FROM patients").execute(pool).await.ok();
        sqlx::query("DELETE FROM users WHERE username LIKE 'test_%'").execute(pool).await.ok();
    }

    /// Create a test user in the database
    pub async fn create_test_user(
        pool: &PgPool,
        auth_service: &AuthService,
        username: &str,
        password: &str,
        role: &str,
    ) -> uuid::Uuid {
        let password_hash = auth_service.hash_password(password)
            .expect("Failed to hash password");
        
        let user_id = uuid::Uuid::new_v4();
        sqlx::query!(
            "INSERT INTO users (id, username, email, password_hash, role, name, department, permissions, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id",
            user_id,
            username,
            format!("{}@test.com", username),
            password_hash,
            role,
            "Test User",
            "Test Department",
            serde_json::json!(["patients", "appointments"]),
            true,
            chrono::Utc::now(),
            chrono::Utc::now(),
        )
        .fetch_one(pool)
        .await
        .expect("Failed to create test user");
        
        user_id
    }

    /// Get a JWT token for a user
    pub async fn get_test_token(
        pool: &PgPool,
        auth_service: &AuthService,
        username: &str,
        password: &str,
    ) -> String {
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE username = $1"
        )
        .bind(username)
        .fetch_optional(pool)
        .await
        .expect("Failed to fetch user")
        .expect("User not found");
        
        // Verify password
        let is_valid = auth_service.verify_password(password, &user.password_hash)
            .expect("Failed to verify password");
        
        assert!(is_valid, "Password verification failed");
        
        // Generate token
        auth_service.generate_access_token(&user)
            .expect("Failed to generate token")
    }
}

