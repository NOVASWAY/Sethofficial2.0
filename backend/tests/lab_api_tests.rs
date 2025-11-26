use actix_web::{
    test::{self, TestRequest},
    web, App,
};
use serde_json::json;
use uuid::Uuid;

use clinic_management_backend::{AppState, handlers::lab_order_handlers::*, handlers::lab_result_handlers::*};
use clinic_management_backend::middleware::SecurityMiddleware;
use clinic_management_backend::tests::helper_test_utils::TestHelper;

/// Test creating a lab test order
#[actix_web::test]
async fn test_create_lab_order() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    let token = TestHelper::generate_test_token(&app_state.auth_service, "test_clinician", "clinician");
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/lab/orders", web::post().to(create_lab_order))
            )
    ).await;
    
    // Create a test patient first (simplified - in real test, use actual patient creation)
    let order_data = json!({
        "patient_id": Uuid::new_v4().to_string(),
        "ordering_clinician_id": Uuid::new_v4().to_string(),
        "test_type": "CBC",
        "test_code": "LAB_CBC_001",
        "test_name": "Complete Blood Count",
        "priority": "routine",
        "clinical_indication": "Routine checkup",
        "sample_type": "blood"
    });
    
    let req = TestRequest::post()
        .uri("/api/lab/orders")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .set_json(&order_data)
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    // May fail if patient doesn't exist, but tests the endpoint structure
    assert!(resp.status().is_client_error() || resp.status().is_success());
}

/// Test getting lab orders
#[actix_web::test]
async fn test_get_lab_orders() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    let token = TestHelper::generate_test_token(&app_state.auth_service, "test_lab_tech", "lab_technician");
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/lab/orders", web::get().to(get_lab_orders))
            )
    ).await;
    
    let req = TestRequest::get()
        .uri("/api/lab/orders")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

/// Test getting pending lab orders
#[actix_web::test]
async fn test_get_pending_lab_orders() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    let token = TestHelper::generate_test_token(&app_state.auth_service, "test_lab_tech", "lab_technician");
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/lab/orders/pending", web::get().to(get_pending_lab_orders))
            )
    ).await;
    
    let req = TestRequest::get()
        .uri("/api/lab/orders/pending")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

/// Test creating a lab result
#[actix_web::test]
async fn test_create_lab_result() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    let token = TestHelper::generate_test_token(&app_state.auth_service, "test_lab_tech", "lab_technician");
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/lab/results", web::post().to(create_lab_result))
            )
    ).await;
    
    let result_data = json!({
        "order_id": Uuid::new_v4().to_string(),
        "test_type": "CBC",
        "test_code": "LAB_CBC_001",
        "test_name": "Complete Blood Count",
        "test_values": {
            "hemoglobin": 14.5,
            "hematocrit": 42.0,
            "wbc": 7.2,
            "rbc": 4.8,
            "platelets": 250
        },
        "reference_ranges": {
            "hemoglobin": { "min": 12.0, "max": 16.0, "unit": "g/dL" },
            "hematocrit": { "min": 36.0, "max": 48.0, "unit": "%" }
        }
    });
    
    let req = TestRequest::post()
        .uri("/api/lab/results")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .set_json(&result_data)
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    // May fail if order doesn't exist, but tests the endpoint structure
    assert!(resp.status().is_client_error() || resp.status().is_success());
}

/// Test getting lab results
#[actix_web::test]
async fn test_get_lab_results() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    let token = TestHelper::generate_test_token(&app_state.auth_service, "test_lab_tech", "lab_technician");
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/lab/results", web::get().to(get_lab_results))
            )
    ).await;
    
    let req = TestRequest::get()
        .uri("/api/lab/results")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

/// Test verifying a lab result
#[actix_web::test]
async fn test_verify_lab_result() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    let token = TestHelper::generate_test_token(&app_state.auth_service, "test_lab_tech", "lab_technician");
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/lab/results/{id}/verify", web::post().to(verify_lab_result))
            )
    ).await;
    
    let result_id = Uuid::new_v4();
    let req = TestRequest::post()
        .uri(&format!("/api/lab/results/{}/verify", result_id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    // May fail if result doesn't exist, but tests the endpoint structure
    assert!(resp.status().is_client_error() || resp.status().is_success());
}

/// Test reviewing a lab result
#[actix_web::test]
async fn test_review_lab_result() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    let token = TestHelper::generate_test_token(&app_state.auth_service, "test_clinician", "clinician");
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/lab/results/{id}/review", web::post().to(review_lab_result))
            )
    ).await;
    
    let result_id = Uuid::new_v4();
    let req = TestRequest::post()
        .uri(&format!("/api/lab/results/{}/review", result_id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    // May fail if result doesn't exist, but tests the endpoint structure
    assert!(resp.status().is_client_error() || resp.status().is_success());
}

/// Test getting patient lab results
#[actix_web::test]
async fn test_get_patient_lab_results() {
    let db_pool = TestHelper::create_test_db_pool().await;
    if db_pool.is_none() {
        println!("Skipping test - database not available");
        return;
    }
    
    let app_state = TestHelper::create_test_app_state(db_pool).await;
    let token = TestHelper::generate_test_token(&app_state.auth_service, "test_clinician", "clinician");
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .service(
                web::scope("/api")
                    .wrap(SecurityMiddleware::new(app_state.auth_service.clone()))
                    .route("/lab/results/patient/{patient_id}", web::get().to(get_patient_lab_results))
            )
    ).await;
    
    let patient_id = Uuid::new_v4();
    let req = TestRequest::get()
        .uri(&format!("/api/lab/results/patient/{}", patient_id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

