use clinic_management_backend::{AppState, auth::AuthService};
use sqlx::PgPool;
use uuid::Uuid;
use std::env;

/// Shared test utilities for creating test data and app state
pub struct TestHelper;

impl TestHelper {
    /// Create a test database pool
    pub async fn create_test_db_pool() -> Option<PgPool> {
        let database_url = env::var("TEST_DATABASE_URL")
            .unwrap_or_else(|_| env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgresql://clinic_user:clinic_password@localhost:5432/clinic_management_test".to_string()));
        
        match sqlx::PgPool::connect(&database_url).await {
            Ok(pool) => Some(pool),
            Err(e) => {
                eprintln!("⚠️ Test database not available: {}. Some tests will be skipped.", e);
                None
            }
        }
    }

    /// Create test app state
    pub async fn create_test_app_state(db_pool: Option<PgPool>) -> AppState {
        let pool = db_pool.unwrap_or_else(|| {
            panic!("Database required for this test");
        });
        
        let jwt_secret = "test-secret-key-for-testing-only";
        let auth_service = AuthService::new(jwt_secret, 24, 7);
        
        // Initialize WebSocket manager for tests
        let websocket_manager = actix::Actor::start(clinic_management_backend::websocket::WebSocketManager::new);
        
        AppState {
            db_pool: pool,
            auth_service,
            redis_client: None, // Tests can work without Redis
            websocket_manager,
        }
    }

    /// Generate a test JWT token
    pub fn generate_test_token(auth_service: &AuthService, username: &str, role: &str) -> String {
        use clinic_management_backend::models::User;
        
        let test_user = User {
            id: Uuid::new_v4(),
            username: username.to_string(),
            password_hash: "hashed".to_string(),
            name: "Test User".to_string(),
            role: role.to_string(),
            department: Some("Test Dept".to_string()),
            permissions: serde_json::json!([]),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            email: Some(format!("{}@test.com", username)),
            phone: None,
            status: "active".to_string(),
        };

        auth_service.generate_access_token(&test_user).unwrap()
    }

    /// Clean up test data
    pub async fn cleanup_test_data(pool: &PgPool) {
        // Clean in reverse dependency order
        let _ = sqlx::query("DELETE FROM invoice_items").execute(pool).await;
        let _ = sqlx::query("DELETE FROM invoices").execute(pool).await;
        let _ = sqlx::query("DELETE FROM prescriptions").execute(pool).await;
        let _ = sqlx::query("DELETE FROM consultations").execute(pool).await;
        let _ = sqlx::query("DELETE FROM appointments").execute(pool).await;
        let _ = sqlx::query("DELETE FROM medicines").execute(pool).await;
        let _ = sqlx::query("DELETE FROM patients").execute(pool).await;
        let _ = sqlx::query("DELETE FROM mpesa_transactions").execute(pool).await;
        let _ = sqlx::query("DELETE FROM users WHERE username LIKE 'test_%'").execute(pool).await;
    }
}

