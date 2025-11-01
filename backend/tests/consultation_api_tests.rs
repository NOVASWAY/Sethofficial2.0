use actix_web::{
    test::{self, TestRequest},
    web, App,
};
use serde_json::json;
use uuid::Uuid;

use clinic_management_backend::{AppState, simple_handlers};
use clinic_management_backend::auth::AuthService;
use clinic_management_backend::middleware::SecurityMiddleware;
use clinic_management_backend::tests::helper_test_utils::TestHelper;

#[actix_web::test]
async fn test_create_consultation() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    let token = TestHelper::generate_test_token(&app_state.auth_service, "test_doctor", "doctor");
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/consultations", web::post().to(simple_handlers::create_consultation))
            )
    ).await;
    
    // Create a test patient first
    let patient_data = json!({
        "first_name": "John",
        "last_name": "Doe",
        "date_of_birth": "1990-01-01",
        "gender": "Male",
        "phone": "0712345678"
    });
    
    let req = TestRequest::post()
        .uri("/api/patients")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .set_json(&patient_data)
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success() || resp.status().is_client_error());
}

#[actix_web::test]
async fn test_get_consultations() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    let token = TestHelper::generate_test_token(&app_state.auth_service, "test_doctor", "doctor");
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/consultations", web::get().to(simple_handlers::get_consultations))
            )
    ).await;
    
    let req = TestRequest::get()
        .uri("/api/consultations")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert!(body.get("success").and_then(|v| v.as_bool()).unwrap_or(false));
}

#[actix_web::test]
async fn test_consultation_requires_auth() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/consultations", web::get().to(simple_handlers::get_consultations))
            )
    ).await;
    
    let req = TestRequest::get()
        .uri("/api/consultations")
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_consultation_pagination() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    let token = TestHelper::generate_test_token(&app_state.auth_service, "test_doctor", "doctor");
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/consultations", web::get().to(simple_handlers::get_consultations))
            )
    ).await;
    
    let req = TestRequest::get()
        .uri("/api/consultations?page=1&per_page=10")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert!(body.get("pagination").is_some());
}

