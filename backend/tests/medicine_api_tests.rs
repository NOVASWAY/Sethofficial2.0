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
async fn test_get_medicines() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    let token = TestHelper::generate_test_token(&app_state.auth_service, "test_pharmacist", "pharmacist");
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/medicines", web::get().to(simple_handlers::get_medicines))
            )
    ).await;
    
    let req = TestRequest::get()
        .uri("/api/medicines")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert!(body.get("success").and_then(|v| v.as_bool()).unwrap_or(false));
    assert!(body.get("data").and_then(|v| v.as_array()).is_some());
}

#[actix_web::test]
async fn test_get_medicines_search() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    let token = TestHelper::generate_test_token(&app_state.auth_service, "test_pharmacist", "pharmacist");
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/medicines", web::get().to(simple_handlers::get_medicines))
            )
    ).await;
    
    let req = TestRequest::get()
        .uri("/api/medicines?search=paracetamol")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_get_low_stock_medicines() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    let token = TestHelper::generate_test_token(&app_state.auth_service, "test_pharmacist", "pharmacist");
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/inventory/low-stock", web::get().to(simple_handlers::get_low_stock))
            )
    ).await;
    
    let req = TestRequest::get()
        .uri("/api/inventory/low-stock")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_adjust_stock() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    let token = TestHelper::generate_test_token(&app_state.auth_service, "test_pharmacist", "pharmacist");
    
    // First create a medicine
    let medicine_data = json!({
        "name": "Test Medicine",
        "dosage_form": "Tablet",
        "strength": "500mg",
        "current_stock": 100,
        "minimum_stock": 50,
        "unit_price": 10.0
    });
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/medicines", web::post().to(simple_handlers::add_medicine))
                    .route("/inventory/adjust/{id}", web::post().to(simple_handlers::adjust_stock))
            )
    ).await;
    
    // Create medicine
    let create_req = TestRequest::post()
        .uri("/api/medicines")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .set_json(&medicine_data)
        .to_request();
    
    let create_resp = test::call_service(&app, create_req).await;
    
    if create_resp.status().is_success() {
        let body: serde_json::Value = test::read_body_json(create_resp).await;
        if let Some(medicine_id) = body.get("data").and_then(|d| d.get("id")).and_then(|id| id.as_str()) {
            // Adjust stock
            let adjustment_data = json!({
                "adjustment_type": "increase",
                "quantity": 20,
                "reason": "restock",
                "notes": "Test adjustment"
            });
            
            let adjust_req = TestRequest::post()
                .uri(&format!("/api/inventory/adjust/{}", medicine_id))
                .insert_header(("Authorization", format!("Bearer {}", token)))
                .set_json(&adjustment_data)
                .to_request();
            
            let adjust_resp = test::call_service(&app, adjust_req).await;
            assert!(adjust_resp.status().is_success());
        }
    }
}

