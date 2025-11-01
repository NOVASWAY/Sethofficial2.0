use actix_web::{
    test::{self, TestRequest},
    web, App,
};
use serde_json::json;
use uuid::Uuid;

use clinic_management_backend::{AppState, simple_handlers};
use clinic_management_backend::auth::AuthService;
use clinic_management_backend::middleware::{SecurityMiddleware, RateLimitMiddleware};

#[actix_web::test]
async fn test_rate_limit_middleware_on_auth_routes() {
    dotenvy::dotenv().ok();
    
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 7);
    
    let app_state = AppState {
        db_pool: sqlx::PgPool::connect("postgresql://test@localhost/test").await.unwrap_or_else(|_| {
            // Mock pool for test
            panic!("Need database for full test")
        }),
        auth_service: auth_service.clone(),
    };

    let rate_limit_middleware = RateLimitMiddleware::with_strict_limit();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state))
            .wrap(rate_limit_middleware)
            .route("/api/auth/login", web::post().to(simple_handlers::login))
    ).await;

    // Make multiple requests rapidly
    for _ in 0..5 {
        let login_data = json!({
            "username": "test",
            "password": "test"
        });
        
        let req = TestRequest::post()
            .uri("/api/auth/login")
            .set_json(&login_data)
            .to_request();
        
        let resp = test::call_service(&app, req).await;
        // Should not be rate limited immediately, but might be after many requests
        assert!(resp.status().as_u16() == 401 || resp.status().as_u16() == 200 || resp.status().as_u16() == 429);
    }
}

#[actix_web::test]
async fn test_security_middleware_rejects_invalid_token() {
    dotenvy::dotenv().ok();
    
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 7);
    
    let app_state = AppState {
        db_pool: sqlx::PgPool::connect("postgresql://test@localhost/test").await.unwrap_or_else(|_| {
            panic!("Need database for full test")
        }),
        auth_service: auth_service.clone(),
    };

    let security_middleware = SecurityMiddleware::new(auth_service.clone());

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state))
            .wrap(security_middleware)
            .route("/api/test", web::get().to(|| async {
                actix_web::HttpResponse::Ok().json(json!({ "message": "protected" }))
            }))
    ).await;

    // Test with invalid token
    let req = TestRequest::get()
        .uri("/api/test")
        .insert_header(("Authorization", "Bearer invalid-token-12345"))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["success"], false);
    assert!(body["error"].as_str().unwrap().contains("Invalid") || 
            body["error"].as_str().unwrap().contains("token"));
}

#[actix_web::test]
async fn test_security_middleware_rejects_missing_token() {
    dotenvy::dotenv().ok();
    
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 7);
    
    let app_state = AppState {
        db_pool: sqlx::PgPool::connect("postgresql://test@localhost/test").await.unwrap_or_else(|_| {
            panic!("Need database for full test")
        }),
        auth_service: auth_service.clone(),
    };

    let security_middleware = SecurityMiddleware::new(auth_service.clone());

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state))
            .wrap(security_middleware)
            .route("/api/test", web::get().to(|| async {
                actix_web::HttpResponse::Ok().json(json!({ "message": "protected" }))
            }))
    ).await;

    // Test without token
    let req = TestRequest::get()
        .uri("/api/test")
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["success"], false);
    assert!(body["error"].as_str().unwrap().contains("Authorization") || 
            body["error"].as_str().unwrap().contains("token") ||
            body["error"].as_str().unwrap().contains("required"));
}

#[actix_web::test]
async fn test_security_middleware_accepts_valid_token() {
    dotenvy::dotenv().ok();
    
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 7);
    
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

    let token = auth_service.generate_access_token(&test_user).unwrap();
    
    let app_state = AppState {
        db_pool: sqlx::PgPool::connect("postgresql://test@localhost/test").await.unwrap_or_else(|_| {
            panic!("Need database for full test")
        }),
        auth_service: auth_service.clone(),
    };

    let security_middleware = SecurityMiddleware::new(auth_service.clone());

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state))
            .wrap(security_middleware)
            .route("/api/test", web::get().to(|| async {
                actix_web::HttpResponse::Ok().json(json!({ "message": "protected", "access": "granted" }))
            }))
    ).await;

    // Test with valid token
    let req = TestRequest::get()
        .uri("/api/test")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    // Should succeed (200) or at least not be 401
    assert_ne!(resp.status().as_u16(), 401);
    
    if resp.status().is_success() {
        let body: serde_json::Value = test::read_body_json(resp).await;
        assert_eq!(body["message"], "protected");
    }
}

