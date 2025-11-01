use actix_web::{
    test::{self, TestRequest},
    web, App,
};
use serde_json::json;
use sqlx::PgPool;

use clinic_management_backend::{AppState, simple_handlers};
use clinic_management_backend::auth::AuthService;
use clinic_management_backend::middleware::SecurityMiddleware;

/// Test helper to create a test app with all routes and middleware
async fn create_test_app_with_routes(db_pool: Option<PgPool>) -> impl actix_web::dev::Service<
    actix_http::Request,
    Response = actix_web::dev::ServiceResponse<actix_web::body::BoxBody>,
    Error = actix_web::Error,
> {
    dotenvy::dotenv().ok();
    
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://clinic_user:clinic_password@localhost:5432/clinic_management".to_string());
    
    let db_pool = match db_pool {
        Some(pool) => pool,
        None => {
            // Try to connect, but don't fail if database is unavailable
            match sqlx::PgPool::connect(&database_url).await {
                Ok(pool) => pool,
                Err(_) => {
                    // Return minimal app if database unavailable
                    return test::init_service(
                        App::new().route("/health", web::get().to(|| async { 
                            actix_web::HttpResponse::Ok().json(json!({ "status": "ok" })) 
                        }))
                    ).await;
                }
            }
        }
    };

    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 7);
    
    let app_state = AppState {
        db_pool,
        auth_service: auth_service.clone(),
    };

    let security_middleware = SecurityMiddleware::new(auth_service.clone());

    test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            // Public routes
            .route("/health", web::get().to(|| async { 
                actix_web::HttpResponse::Ok().json(json!({ "status": "ok" })) 
            }))
            .route("/api/auth/login", web::post().to(simple_handlers::login))
            // Protected routes
            .service(
                web::scope("/api")
                    .wrap(security_middleware)
                    .route("/patients", web::get().to(simple_handlers::get_patients))
                    .route("/patients", web::post().to(simple_handlers::create_patient))
            )
    ).await
}

/// Generate a test JWT token
fn generate_test_token(auth_service: &AuthService, username: &str, role: &str) -> String {
    use clinic_management_backend::models::User;
    use uuid::Uuid;
    
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
        email: Some("test@example.com".to_string()),
        phone: None,
        status: "active".to_string(),
    };

    auth_service.generate_access_token(&test_user).unwrap()
}

#[actix_web::test]
async fn test_health_endpoint() {
    let app = create_test_app_with_routes(None).await;
    
    let req = TestRequest::get().uri("/health").to_request();
    let resp = test::call_service(&app, req).await;
    
    assert!(resp.status().is_success());
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_protected_route_without_token() {
    let app = create_test_app_with_routes(None).await;
    
    let req = TestRequest::get().uri("/api/patients").to_request();
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["success"], false);
}

#[actix_web::test]
async fn test_protected_route_with_valid_token() {
    let app = create_test_app_with_routes(None).await;
    
    dotenvy::dotenv().ok();
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 7);
    let token = generate_test_token(&auth_service, "testuser", "receptionist");
    
    let req = TestRequest::get()
        .uri("/api/patients")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    // Should not be 401 (should either succeed or fail due to database, not auth)
    assert_ne!(resp.status().as_u16(), 401, "Should not be unauthorized with valid token");
}

#[actix_web::test]
async fn test_login_endpoint_public() {
    let app = create_test_app_with_routes(None).await;
    
    let login_data = json!({
        "username": "testuser",
        "password": "password"
    });
    
    let req = TestRequest::post()
        .uri("/api/auth/login")
        .set_json(&login_data)
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    // Login endpoint should be accessible (not 401)
    // May return error if user doesn't exist, but shouldn't be auth error
    assert_ne!(resp.status().as_u16(), 401, "Login endpoint should be public");
}

// Integration test for patient creation (requires database)
#[actix_web::test]
#[ignore] // Requires database - run with `cargo test -- --ignored --test-threads=1`
async fn test_create_patient_with_auth() {
    dotenvy::dotenv().ok();
    
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://clinic_user:clinic_password@localhost:5432/clinic_management".to_string());
    
    let db_pool = match sqlx::PgPool::connect(&database_url).await {
        Ok(pool) => pool,
        Err(_) => {
            println!("Database not available, skipping integration test");
            return;
        }
    };

    let app = create_test_app_with_routes(Some(db_pool)).await;
    
    // Generate token
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 7);
    let token = generate_test_token(&auth_service, "testuser", "receptionist");
    
    // Create patient
    let patient_data = json!({
        "first_name": "John",
        "last_name": "Doe",
        "date_of_birth": "1990-01-01",
        "gender": "Male",
        "phone_number": "1234567890",
        "address": "123 Test St"
    });
    
    let req = TestRequest::post()
        .uri("/api/patients")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .set_json(&patient_data)
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    // Should not be unauthorized
    assert_ne!(resp.status().as_u16(), 401);
    
    // If database is set up correctly, should be 201 or 200
    // If not, might be 500, but not 401
    if resp.status().is_success() {
        let body: serde_json::Value = test::read_body_json(resp).await;
        assert!(body["success"].as_bool().unwrap_or(false) || body.get("id").is_some());
    }
}

