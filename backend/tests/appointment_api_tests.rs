use actix_web::{
    test::{self, TestRequest},
    web, App,
};
use serde_json::json;
use uuid::Uuid;

use clinic_management_backend::{AppState, simple_handlers};
use clinic_management_backend::auth::AuthService;
use clinic_management_backend::middleware::SecurityMiddleware;

async fn create_test_app_with_routes(db_pool: Option<sqlx::PgPool>) -> impl actix_web::dev::Service<
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
    
    let app_state = AppState {
        db_pool: db_pool.clone(),
        auth_service: auth_service.clone(),
    };

    let security_middleware = SecurityMiddleware::new(auth_service.clone());

    test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .service(
                web::scope("/api")
                    .wrap(security_middleware)
                    .route("/appointments", web::get().to(simple_handlers::get_appointments))
                    .route("/appointments", web::post().to(simple_handlers::create_appointment))
                    .route("/appointments/{id}", web::get().to(simple_handlers::get_appointment))
                    .route("/appointments/{id}", web::put().to(simple_handlers::update_appointment))
                    .route("/appointments/{id}", web::delete().to(simple_handlers::delete_appointment))
            )
    ).await
}

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
async fn test_get_appointments_unauthorized() {
    let app = create_test_app_with_routes(None).await;
    
    let req = TestRequest::get().uri("/api/appointments").to_request();
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
}

#[actix_web::test]
async fn test_get_appointments_with_token() {
    let app = create_test_app_with_routes(None).await;
    
    dotenvy::dotenv().ok();
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 7);
    let token = generate_test_token(&auth_service, "testuser", "clinician");
    
    let req = TestRequest::get()
        .uri("/api/appointments")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_ne!(resp.status().as_u16(), 401);
}

#[actix_web::test]
async fn test_create_appointment_unauthorized() {
    let app = create_test_app_with_routes(None).await;
    
    let appointment_data = json!({
        "patient_id": Uuid::new_v4(),
        "doctor_id": Uuid::new_v4(),
        "date": "2025-01-20",
        "time": "10:00:00",
        "duration": 30,
        "status": "scheduled"
    });
    
    let req = TestRequest::post()
        .uri("/api/appointments")
        .set_json(&appointment_data)
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
}

#[actix_web::test]
#[ignore] // Requires database
async fn test_create_appointment_with_auth() {
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
    let token = generate_test_token(&auth_service, "testuser", "clinician");
    
    let appointment_data = json!({
        "patient_id": Uuid::new_v4(),
        "doctor_id": Uuid::new_v4(),
        "date": "2025-01-20",
        "time": "10:00:00",
        "duration": 30,
        "status": "scheduled",
        "notes": "Test appointment"
    });
    
    let req = TestRequest::post()
        .uri("/api/appointments")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .set_json(&appointment_data)
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_ne!(resp.status().as_u16(), 401);
}

