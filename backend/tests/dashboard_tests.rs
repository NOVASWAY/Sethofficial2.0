use actix_web::{test, web, App};
use serde_json::json;
use uuid::Uuid;
use chrono::Utc;

use clinic_management_backend::{
    models::{ApiResponse, User, CreateUser},
    auth::AuthService,
    security::permission_validator::PermissionValidator,
    cache::{CacheService, CacheConfig},
    handlers::{
        dashboard_handlers,
        user_preferences_handlers,
        activity_log_handlers,
        data_isolation_handlers,
        validation_handlers,
    },
};

// Test helper functions
async fn create_test_user() -> User {
    User {
        id: Uuid::new_v4(),
        username: "test_user".to_string(),
        role: "clinician".to_string(),
        department: Some("clinical".to_string()),
        permissions: json!({}),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

async fn create_test_auth_service() -> AuthService {
    AuthService::new("test_secret", 24, 7)
}

async fn create_test_cache() -> CacheService<serde_json::Value> {
    let config = CacheConfig {
        default_ttl: std::time::Duration::from_secs(60),
        max_entries: 100,
        cleanup_interval: std::time::Duration::from_secs(30),
        enable_metrics: true,
    };
    CacheService::new(config)
}

// Dashboard API Tests
#[actix_web::test]
async fn test_get_user_dashboard_metrics() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/dashboard/user/{user_id}/metrics", web::get().to(dashboard_handlers::get_user_dashboard_metrics))
    ).await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/dashboard/user/{}/metrics", user.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_get_role_dashboard_metrics() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/dashboard/role/{role}/metrics", web::get().to(dashboard_handlers::get_role_dashboard_metrics))
    ).await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/dashboard/role/{}/metrics", user.role))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_get_department_dashboard_metrics() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/dashboard/department/{department}/metrics", web::get().to(dashboard_handlers::get_department_dashboard_metrics))
    ).await;

    let department = user.department.as_ref().unwrap();
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/dashboard/department/{}/metrics", department))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_get_system_health_metrics() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/dashboard/system/health", web::get().to(dashboard_handlers::get_system_health_metrics))
    ).await;

    let req = test::TestRequest::get()
        .uri("/api/v1/dashboard/system/health")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

// User Preferences API Tests
#[actix_web::test]
async fn test_get_user_preferences() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/user/{user_id}/preferences", web::get().to(user_preferences_handlers::get_user_preferences))
    ).await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/user/{}/preferences", user.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_update_user_preferences() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/user/{user_id}/preferences", web::put().to(user_preferences_handlers::update_user_preferences))
    ).await;

    let preferences = json!({
        "layout_config": {"grid": []},
        "custom_metrics": [],
        "favorite_modules": ["patients", "consultations"],
        "refresh_interval": 300,
        "auto_refresh": true,
        "theme": "dark",
        "language": "en",
        "timezone": "UTC"
    });

    let req = test::TestRequest::put()
        .uri(&format!("/api/v1/user/{}/preferences", user.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(&preferences)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_reset_user_preferences() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/user/{user_id}/preferences/reset", web::post().to(user_preferences_handlers::reset_user_preferences))
    ).await;

    let req = test::TestRequest::post()
        .uri(&format!("/api/v1/user/{}/preferences/reset", user.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_get_role_preference_template() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/user/{role}/preferences/template", web::get().to(user_preferences_handlers::get_role_preference_template))
    ).await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/user/{}/preferences/template", user.role))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

// Activity Log API Tests
#[actix_web::test]
async fn test_log_user_activity() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/activity/log", web::post().to(activity_log_handlers::log_user_activity))
    ).await;

    let activity_data = json!({
        "action": "view_dashboard",
        "module": "dashboard",
        "entity_type": "dashboard",
        "details": {
            "user_id": user.id,
            "role": user.role,
            "department": user.department
        }
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/activity/log")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(&activity_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_get_user_activity() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/activity/user/{user_id}", web::get().to(activity_log_handlers::get_user_activity))
    ).await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/activity/user/{}?limit=10&page=1", user.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_get_recent_activities() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/activity/recent", web::get().to(activity_log_handlers::get_recent_activities))
    ).await;

    let req = test::TestRequest::get()
        .uri("/api/v1/activity/recent?limit=20&days=7")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_get_activity_statistics() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/activity/stats", web::get().to(activity_log_handlers::get_activity_statistics))
    ).await;

    let req = test::TestRequest::get()
        .uri("/api/v1/activity/stats?days=30")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

// Data Isolation API Tests
#[actix_web::test]
async fn test_get_filtered_patients() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/patients/filtered", web::get().to(data_isolation_handlers::get_filtered_patients))
    ).await;

    let req = test::TestRequest::get()
        .uri("/api/v1/patients/filtered?page=1&limit=20")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_get_filtered_consultations() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/consultations/filtered", web::get().to(data_isolation_handlers::get_filtered_consultations))
    ).await;

    let req = test::TestRequest::get()
        .uri("/api/v1/consultations/filtered?page=1&limit=20")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_get_filtered_prescriptions() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/prescriptions/filtered", web::get().to(data_isolation_handlers::get_filtered_prescriptions))
    ).await;

    let req = test::TestRequest::get()
        .uri("/api/v1/prescriptions/filtered?page=1&limit=20")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_get_filtered_invoices() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/invoices/filtered", web::get().to(data_isolation_handlers::get_filtered_invoices))
    ).await;

    let req = test::TestRequest::get()
        .uri("/api/v1/invoices/filtered?page=1&limit=20")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_validate_data_access() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/permissions/validate", web::post().to(data_isolation_handlers::validate_data_access))
    ).await;

    let access_data = json!({
        "entity_type": "patient",
        "entity_id": Uuid::new_v4(),
        "action": "read"
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/permissions/validate")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(&access_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

// Validation API Tests
#[actix_web::test]
async fn test_validate_patient_data() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/validation/patient", web::post().to(validation_handlers::validate_patient_data))
    ).await;

    let patient_data = json!({
        "first_name": "John",
        "last_name": "Doe",
        "phone": "+254712345678",
        "date_of_birth": "1990-01-01",
        "location": "Nairobi, Kenya"
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/validation/patient")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(&patient_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_validate_user_data() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/validation/user", web::post().to(validation_handlers::validate_user_data))
    ).await;

    let user_data = json!({
        "username": "new_user",
        "password": "secure_password123",
        "role": "nurse",
        "department": "clinical"
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/validation/user")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(&user_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_check_duplicate_patient() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/validation/duplicate/patient", web::post().to(validation_handlers::check_duplicate_patient))
    ).await;

    let patient_data = json!({
        "first_name": "John",
        "last_name": "Doe",
        "phone": "+254712345678",
        "date_of_birth": "1990-01-01"
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/validation/duplicate/patient")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(&patient_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_check_duplicate_user() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/validation/duplicate/user", web::post().to(validation_handlers::check_duplicate_user))
    ).await;

    let user_data = json!({
        "username": "existing_user",
        "role": "clinician"
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/validation/duplicate/user")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(&user_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_validate_business_rules() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/validation/business-rules", web::post().to(validation_handlers::validate_business_rules))
    ).await;

    let rule_data = json!({
        "rule_type": "consultation_limit",
        "data": {
            "patient_id": Uuid::new_v4(),
            "consultation_count": 5,
            "max_consultations": 10
        }
    });

    let req = test::TestRequest::post()
        .uri("/api/v1/validation/business-rules")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(&rule_data)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

// Permission Validation Tests
#[actix_web::test]
async fn test_permission_validator_admin_access() {
    let validator = PermissionValidator::new();
    let user = User {
        id: Uuid::new_v4(),
        username: "admin".to_string(),
        role: "admin".to_string(),
        department: Some("admin".to_string()),
        permissions: json!({}),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    assert!(validator.can_access_resource(&user, "patients", "read"));
    assert!(validator.can_access_resource(&user, "patients", "write"));
    assert!(validator.can_access_resource(&user, "patients", "delete"));
    assert!(validator.can_access_resource(&user, "users", "read"));
    assert!(validator.can_access_resource(&user, "users", "write"));
}

#[actix_web::test]
async fn test_permission_validator_clinician_access() {
    let validator = PermissionValidator::new();
    let user = User {
        id: Uuid::new_v4(),
        username: "clinician".to_string(),
        role: "clinician".to_string(),
        department: Some("clinical".to_string()),
        permissions: json!({}),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    assert!(validator.can_access_resource(&user, "patients", "read"));
    assert!(validator.can_access_resource(&user, "patients", "write"));
    assert!(!validator.can_access_resource(&user, "patients", "delete"));
    assert!(!validator.can_access_resource(&user, "users", "read"));
}

#[actix_web::test]
async fn test_permission_validator_department_restrictions() {
    let validator = PermissionValidator::new();
    let user = User {
        id: Uuid::new_v4(),
        username: "clinician".to_string(),
        role: "clinician".to_string(),
        department: Some("pharmacy".to_string()), // Wrong department
        permissions: json!({}),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    assert!(!validator.can_access_resource(&user, "patients", "read"));
}

// Cache Service Tests
#[actix_web::test]
async fn test_cache_basic_operations() {
    let cache = create_test_cache().await;
    
    // Test set and get
    cache.set("key1".to_string(), json!("value1"), None).await.unwrap();
    assert_eq!(cache.get("key1").await, Some(json!("value1")));
    
    // Test non-existent key
    assert_eq!(cache.get("nonexistent").await, None);
    
    // Test remove
    assert_eq!(cache.remove("key1").await, Some(json!("value1")));
    assert_eq!(cache.get("key1").await, None);
}

#[actix_web::test]
async fn test_cache_expiration() {
    let config = CacheConfig {
        default_ttl: std::time::Duration::from_millis(100),
        max_entries: 100,
        cleanup_interval: std::time::Duration::from_millis(50),
        enable_metrics: true,
    };
    let cache = CacheService::new(config);
    
    cache.set("key1".to_string(), json!("value1"), None).await.unwrap();
    assert_eq!(cache.get("key1").await, Some(json!("value1")));
    
    // Wait for expiration
    tokio::time::sleep(std::time::Duration::from_millis(150)).await;
    assert_eq!(cache.get("key1").await, None);
}

#[actix_web::test]
async fn test_cache_metrics() {
    let cache = create_test_cache().await;
    
    // Generate some cache activity
    cache.set("key1".to_string(), json!("value1"), None).await.unwrap();
    cache.get("key1").await; // hit
    cache.get("nonexistent").await; // miss
    
    let metrics = cache.get_metrics().await;
    assert_eq!(metrics.hits, 1);
    assert_eq!(metrics.misses, 1);
    assert_eq!(metrics.entries, 1);
}

#[actix_web::test]
async fn test_cache_get_or_set() {
    let cache = create_test_cache().await;
    
    // First call should generate value
    let result1 = cache.get_or_set(
        "key1".to_string(),
        || async { Ok(json!("generated_value")) },
        None
    ).await.unwrap();
    assert_eq!(result1, json!("generated_value"));
    
    // Second call should get from cache
    let result2 = cache.get_or_set(
        "key1".to_string(),
        || async { Ok(json!("new_value")) },
        None
    ).await.unwrap();
    assert_eq!(result2, json!("generated_value")); // Should be cached value
}

// Integration Tests
#[actix_web::test]
async fn test_dashboard_workflow() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/dashboard/user/{user_id}/metrics", web::get().to(dashboard_handlers::get_user_dashboard_metrics))
            .route("/api/v1/user/{user_id}/preferences", web::get().to(user_preferences_handlers::get_user_preferences))
            .route("/api/v1/activity/log", web::post().to(activity_log_handlers::log_user_activity))
    ).await;

    // 1. Get dashboard metrics
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/dashboard/user/{}/metrics", user.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    // 2. Get user preferences
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/user/{}/preferences", user.id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    // 3. Log activity
    let activity_data = json!({
        "action": "view_dashboard",
        "module": "dashboard",
        "entity_type": "dashboard"
    });
    let req = test::TestRequest::post()
        .uri("/api/v1/activity/log")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(&activity_data)
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}

#[actix_web::test]
async fn test_data_isolation_workflow() {
    let user = create_test_user().await;
    let auth_service = create_test_auth_service().await;
    let token = auth_service.generate_access_token(&user).unwrap();
    
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(create_test_cache().await))
            .route("/api/v1/patients/filtered", web::get().to(data_isolation_handlers::get_filtered_patients))
            .route("/api/v1/consultations/filtered", web::get().to(data_isolation_handlers::get_filtered_consultations))
            .route("/api/v1/permissions/validate", web::post().to(data_isolation_handlers::validate_data_access))
    ).await;

    // 1. Get filtered patients
    let req = test::TestRequest::get()
        .uri("/api/v1/patients/filtered?page=1&limit=10")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    // 2. Get filtered consultations
    let req = test::TestRequest::get()
        .uri("/api/v1/consultations/filtered?page=1&limit=10")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    // 3. Validate data access
    let access_data = json!({
        "entity_type": "patient",
        "entity_id": Uuid::new_v4(),
        "action": "read"
    });
    let req = test::TestRequest::post()
        .uri("/api/v1/permissions/validate")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .insert_header(("Content-Type", "application/json"))
        .set_json(&access_data)
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}
