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
        db_pool,
        auth_service: auth_service.clone(),
    };

    let security_middleware = SecurityMiddleware::new(auth_service.clone());

    test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .service(
                web::scope("/api")
                    .wrap(security_middleware)
                    .route("/invoices", web::get().to(simple_handlers::get_invoices))
                    .route("/invoices", web::post().to(simple_handlers::create_invoice))
                    .route("/invoices/{id}", web::get().to(simple_handlers::get_invoice))
                    .route("/invoices/{id}/pay", web::post().to(simple_handlers::pay_invoice))
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
async fn test_get_invoices_unauthorized() {
    let app = create_test_app_with_routes(None).await;
    
    let req = TestRequest::get().uri("/api/invoices").to_request();
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
}

#[actix_web::test]
async fn test_create_invoice_unauthorized() {
    let app = create_test_app_with_routes(None).await;
    
    let invoice_data = json!({
        "patient_id": Uuid::new_v4(),
        "items": [],
        "total_amount": 1000
    });
    
    let req = TestRequest::post()
        .uri("/api/invoices")
        .set_json(&invoice_data)
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
}

#[actix_web::test]
async fn test_pay_invoice_unauthorized() {
    let app = create_test_app_with_routes(None).await;
    let invoice_id = Uuid::new_v4();
    
    let payment_data = json!({
        "payment_method": "cash",
        "amount_paid": 1000
    });
    
    let req = TestRequest::post()
        .uri(&format!("/api/invoices/{}/pay", invoice_id))
        .set_json(&payment_data)
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status().as_u16(), 401);
}

#[actix_web::test]
async fn test_pay_invoice_mpesa_requires_phone() {
    let app = create_test_app_with_routes(None).await;
    
    dotenvy::dotenv().ok();
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 7);
    let token = generate_test_token(&auth_service, "testuser", "receptionist");
    
    let invoice_id = Uuid::new_v4();
    
    // Try to pay with M-Pesa without phone number
    let payment_data = json!({
        "payment_method": "mpesa",
        "amount_paid": 1000
    });
    
    let req = TestRequest::post()
        .uri(&format!("/api/invoices/{}/pay", invoice_id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .set_json(&payment_data)
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    
    // Should fail validation (not auth error)
    assert_ne!(resp.status().as_u16(), 401);
    // Should be 400 Bad Request for missing phone
    assert_eq!(resp.status().as_u16(), 400);
}

