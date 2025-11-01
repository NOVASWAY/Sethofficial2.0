use actix_web::{
    test::{self, TestRequest},
    web, App,
};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use clinic_management_backend::{AppState, simple_handlers};
use clinic_management_backend::auth::AuthService;
use clinic_management_backend::middleware::SecurityMiddleware;
use clinic_management_backend::models::Patient;

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
            match sqlx::PgPool::connect(&database_url).await {
                Ok(pool) => pool,
                Err(_) => {
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
    
    // Initialize WebSocket manager for tests
    let websocket_manager = actix::Actor::start(clinic_management_backend::websocket::WebSocketManager::new);
    
    let app_state = AppState {
        db_pool,
        auth_service: auth_service.clone(),
        redis_client: None, // Tests can work without Redis
        websocket_manager,
    };

    let security_middleware = SecurityMiddleware::new(auth_service.clone());

    test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .route("/health", web::get().to(|| async { 
                actix_web::HttpResponse::Ok().json(json!({ "status": "ok" })) 
            }))
            .service(
                web::scope("/api")
                    .wrap(security_middleware)
                    .route("/patients", web::get().to(simple_handlers::get_patients))
                    .route("/patients", web::post().to(simple_handlers::create_patient))
                    .route("/patients/{id}", web::get().to(simple_handlers::get_patient))
                    .route("/patients/{id}", web::put().to(simple_handlers::update_patient))
                    .route("/patients/{id}", web::delete().to(simple_handlers::delete_patient))
            )
    ).await
}

/// Generate a test JWT token
fn generate_test_token(auth_service: &AuthService, username: &str, role: &str) -> String {
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
        email: Some("test@example.com".to_string()),
        phone: None,
        status: "active".to_string(),
    };

    auth_service.generate_access_token(&test_user).unwrap()
}

#[actix_web::test]
async fn test_get_patients_unauthorized() {
    let app = create_test_app_with_routes(None).await;
    
    let req = TestRequest::get().uri("/api/patients").to_request();
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
}

#[actix_web::test]
async fn test_get_patients_with_token() {
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
async fn test_create_patient_unauthorized() {
    let app = create_test_app_with_routes(None).await;
    
    let patient_data = json!({
        "first_name": "John",
        "last_name": "Doe",
        "date_of_birth": "1990-01-01",
        "gender": "Male",
        "phone_number": "1234567890"
    });
    
    let req = TestRequest::post()
        .uri("/api/patients")
        .set_json(&patient_data)
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
}

#[actix_web::test]
#[ignore] // Requires database
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
    
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 7);
    let token = generate_test_token(&auth_service, "testuser", "receptionist");
    
    let patient_data = json!({
        "first_name": "John",
        "last_name": "Doe",
        "date_of_birth": "1990-01-01",
        "gender": "Male",
        "phone_number": "+254712345678",
        "address": "123 Test St"
    });
    
    let req = TestRequest::post()
        .uri("/api/patients")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .set_json(&patient_data)
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_ne!(resp.status().as_u16(), 401);
    
    if resp.status().is_success() {
        let body: serde_json::Value = test::read_body_json(resp).await;
        assert!(body["success"].as_bool().unwrap_or(false) || body.get("id").is_some());
    }
}

#[actix_web::test]
async fn test_get_patient_by_id_unauthorized() {
    let app = create_test_app_with_routes(None).await;
    let patient_id = Uuid::new_v4();
    
    let req = TestRequest::get()
        .uri(&format!("/api/patients/{}", patient_id))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
}

#[actix_web::test]
async fn test_update_patient_unauthorized() {
    let app = create_test_app_with_routes(None).await;
    let patient_id = Uuid::new_v4();
    
    let update_data = json!({
        "first_name": "Jane",
        "last_name": "Doe"
    });
    
    let req = TestRequest::put()
        .uri(&format!("/api/patients/{}", patient_id))
        .set_json(&update_data)
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
}

#[actix_web::test]
async fn test_delete_patient_unauthorized() {
    let app = create_test_app_with_routes(None).await;
    let patient_id = Uuid::new_v4();
    
    let req = TestRequest::delete()
        .uri(&format!("/api/patients/{}", patient_id))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
}

