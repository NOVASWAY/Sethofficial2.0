use actix_web::{test, web, App, HttpResponse, http::StatusCode};
use serde_json::json;
use clinic_management_backend::{AppState, auth::AuthService, simple_handlers, middleware};

mod test_helpers;
use test_helpers::test_utils::*;

#[actix_rt::test]
async fn test_health_endpoint() {
    let app = test::init_service(
        App::new().route("/health", web::get().to(|| async {
            HttpResponse::Ok().json(json!({
                "status": "ok",
                "message": "Backend is running"
            }))
        }))
    ).await;

    let req = test::TestRequest::get().uri("/health").to_request();
    let resp = test::call_service(&app, req).await;

    assert!(resp.status().is_success());
}

#[actix_rt::test]
async fn test_login_success() {
    let app_state = create_test_app_state().await;
    
    // Create test user
    let username = format!("test_user_{}", uuid::Uuid::new_v4());
    let password = "TestPassword123!";
    create_test_user(&app_state.db_pool, &app_state.auth_service, &username, password, "clinician").await;
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .route("/api/auth/login", web::post().to(simple_handlers::login))
    ).await;

    let login_data = json!({
        "username": username,
        "password": password
    });

    let req = test::TestRequest::post()
        .uri("/api/auth/login")
        .set_json(&login_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status(), StatusCode::OK);
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["success"], true);
    assert!(body["data"]["access_token"].is_string());
    assert!(body["data"]["refresh_token"].is_string());
    
    cleanup_test_data(&app_state.db_pool).await;
}

#[actix_rt::test]
async fn test_login_invalid_credentials() {
    let app_state = create_test_app_state().await;
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .route("/api/auth/login", web::post().to(simple_handlers::login))
    ).await;

    let login_data = json!({
        "username": "nonexistent_user",
        "password": "wrongpassword"
    });

    let req = test::TestRequest::post()
        .uri("/api/auth/login")
        .set_json(&login_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["success"], false);
    assert!(body["error"].is_string());
}

#[actix_rt::test]
async fn test_login_missing_fields() {
    let app_state = create_test_app_state().await;
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .route("/api/auth/login", web::post().to(simple_handlers::login))
    ).await;

    let login_data = json!({
        "username": "test_user"
        // Missing password
    });

    let req = test::TestRequest::post()
        .uri("/api/auth/login")
        .set_json(&login_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    
    assert!(resp.status().is_client_error());
}

#[actix_rt::test]
async fn test_get_me_with_valid_token() {
    let app_state = create_test_app_state().await;
    
    // Create test user and get token
    let username = format!("test_user_{}", uuid::Uuid::new_v4());
    let password = "TestPassword123!";
    create_test_user(&app_state.db_pool, &app_state.auth_service, &username, password, "clinician").await;
    let token = get_test_token(&app_state.db_pool, &app_state.auth_service, &username, password).await;
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .wrap(middleware::SecurityMiddleware::new(app_state.auth_service.clone()))
            .route("/api/auth/me", web::get().to(simple_handlers::get_me))
    ).await;

    let req = test::TestRequest::get()
        .uri("/api/auth/me")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status(), StatusCode::OK);
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["success"], true);
    assert_eq!(body["data"]["username"], username);
    
    cleanup_test_data(&app_state.db_pool).await;
}

#[actix_rt::test]
async fn test_get_me_without_token() {
    let app_state = create_test_app_state().await;
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .wrap(middleware::SecurityMiddleware::new(app_state.auth_service.clone()))
            .route("/api/auth/me", web::get().to(simple_handlers::get_me))
    ).await;

    let req = test::TestRequest::get()
        .uri("/api/auth/me")
        .to_request();

    let resp = test::call_service(&app, req).await;
    
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    
    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["success"], false);
}

