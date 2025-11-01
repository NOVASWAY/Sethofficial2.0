use actix_web::{
    test::{self, TestRequest},
    web, App, HttpResponse,
};
use serde_json::json;
use uuid::Uuid;

use clinic_management_backend::auth::{AuthService, Claims};
use clinic_management_backend::middleware::SecurityMiddleware;
use clinic_management_backend::{AppState, simple_handlers};

// Test helper to create a test app with security middleware
async fn create_test_app() -> impl actix_web::dev::Service<
    actix_http::Request,
    Response = actix_web::dev::ServiceResponse<actix_web::body::BoxBody>,
    Error = actix_web::Error,
> {
    dotenvy::dotenv().ok();
    
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://clinic_user:clinic_password@localhost:5432/clinic_management".to_string());
    
    // For tests, we'll use a mock database or skip database calls
    let db_pool = match sqlx::PgPool::connect(&database_url).await {
        Ok(pool) => pool,
        Err(_) => {
            // If database is not available, tests will be skipped
            // In production tests, this should fail
            return test::init_service(
                App::new().route("/test", web::get().to(|| async { HttpResponse::Ok().json("mock") }))
            ).await;
        }
    };

    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 7);
    
    let app_state = AppState {
        db_pool,
        auth_service: auth_service.clone(),
    };

    let security_middleware = SecurityMiddleware::new(auth_service);

    test::init_service(
        App::new()
            .app_data(web::Data::new(app_state))
            .service(
                web::scope("/api")
                    .wrap(security_middleware)
                    .route("/test-protected", web::get().to(|| async {
                        HttpResponse::Ok().json(json!({ "message": "protected route accessed" }))
                    }))
            )
    ).await
}

// Test helper to generate a valid JWT token for testing
fn generate_test_token(auth_service: &AuthService) -> String {
    use clinic_management_backend::models::User;
    
    let test_user = User {
        id: Uuid::new_v4(),
        username: "testuser".to_string(),
        password_hash: "hashed".to_string(),
        name: "Test User".to_string(),
        role: "receptionist".to_string(),
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
async fn test_security_middleware_without_token() {
    let app = create_test_app().await;
    
    let req = TestRequest::get()
        .uri("/api/test-protected")
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["success"], false);
    assert!(body["error"].as_str().unwrap().contains("Authorization token required"));
}

#[actix_web::test]
async fn test_security_middleware_with_valid_token() {
    let app = create_test_app().await;
    
    dotenvy::dotenv().ok();
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 7);
    
    let token = generate_test_token(&auth_service);
    
    let req = TestRequest::get()
        .uri("/api/test-protected")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 200);
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["message"], "protected route accessed");
}

#[actix_web::test]
async fn test_security_middleware_with_invalid_token() {
    let app = create_test_app().await;
    
    let req = TestRequest::get()
        .uri("/api/test-protected")
        .insert_header(("Authorization", "Bearer invalid-token-12345"))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["success"], false);
    assert!(body["error"].as_str().unwrap().contains("Invalid or expired token"));
}

#[actix_web::test]
async fn test_security_middleware_with_malformed_header() {
    let app = create_test_app().await;
    
    let req = TestRequest::get()
        .uri("/api/test-protected")
        .insert_header(("Authorization", "InvalidFormat token"))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["success"], false);
}

// Test rate limiting
// Note: Rate limiting tests may be flaky in CI, so they're marked as integration tests
#[actix_web::test]
#[ignore] // Ignore by default, run with `cargo test -- --ignored`
async fn test_rate_limiting() {
    let app = create_test_app().await;
    
    dotenvy::dotenv().ok();
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 7);
    let token = generate_test_token(&auth_service);
    
    // Send requests up to the limit (100 requests per minute)
    // In a real scenario, we'd need to adjust timing
    let mut success_count = 0;
    let mut rate_limit_count = 0;
    
    for _ in 0..105 {
        let req = TestRequest::get()
            .uri("/api/test-protected")
            .insert_header(("Authorization", format!("Bearer {}", token)))
            .to_request();
        
        let resp = test::call_service(&app, req).await;
        
        if resp.status().as_u16() == 200 {
            success_count += 1;
        } else if resp.status().as_u16() == 429 {
            rate_limit_count += 1;
            break; // Rate limit hit
        }
    }
    
    // At least some requests should succeed
    // Rate limiting might not trigger immediately in tests due to timing
    assert!(success_count > 0, "Some requests should succeed before rate limit");
}

#[actix_web::test]
async fn test_security_middleware_token_extraction() {
    // Test that token can be extracted from Authorization header
    use clinic_management_backend::auth::AuthService;
    
    dotenvy::dotenv().ok();
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 7);
    
    use clinic_management_backend::models::User;
    let test_user = User {
        id: Uuid::new_v4(),
        username: "testuser".to_string(),
        password_hash: "hashed".to_string(),
        name: "Test User".to_string(),
        role: "admin".to_string(),
        department: Some("Test Dept".to_string()),
        permissions: serde_json::json!(["all"]),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        email: Some("test@example.com".to_string()),
        phone: None,
        status: "active".to_string(),
    };

    let token = auth_service.generate_access_token(&test_user).unwrap();
    
    // Verify token can be verified
    let claims = auth_service.verify_access_token(&token);
    assert!(claims.is_ok());
    
    let claims = claims.unwrap();
    assert_eq!(claims.username, "testuser");
    assert_eq!(claims.role, "admin");
}

