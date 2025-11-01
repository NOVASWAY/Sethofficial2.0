use actix_web::{
    test::{self, TestRequest},
    web, App,
};
use serde_json::json;

use clinic_management_backend::{AppState, simple_handlers};
use clinic_management_backend::auth::AuthService;
use clinic_management_backend::middleware::SecurityMiddleware;
use clinic_management_backend::tests::helper_test_utils::TestHelper;

#[actix_web::test]
async fn test_get_prescriptions() {
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
                    .route("/prescriptions", web::get().to(simple_handlers::get_prescriptions))
            )
    ).await;
    
    let req = TestRequest::get()
        .uri("/api/prescriptions")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert!(body.get("success").and_then(|v| v.as_bool()).unwrap_or(false));
}

#[actix_web::test]
async fn test_prescription_requires_auth() {
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
                    .route("/prescriptions", web::get().to(simple_handlers::get_prescriptions))
            )
    ).await;
    
    let req = TestRequest::get()
        .uri("/api/prescriptions")
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_prescription_filter_by_status() {
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
                    .route("/prescriptions", web::get().to(simple_handlers::get_prescriptions))
            )
    ).await;
    
    let req = TestRequest::get()
        .uri("/api/prescriptions?status=pending")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

