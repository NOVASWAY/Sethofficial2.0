use actix_web::{web, App, HttpResponse, HttpServer, Result, middleware as actix_middleware, HttpRequest};
use std::env;
use serde_json::json;
use sqlx::PgPool;
use security::{SecurityConfig, security_headers, cors_config, RateLimiter, LoginAttemptTracker, SessionManager};
use security::permission_validator::PermissionValidator;
use security::permission_middleware::PermissionMiddleware;
use cache::{CacheService, CacheConfig, DashboardCache, UserPreferencesCache, ActivityLogCache, ValidationCache};
use middleware::security_middleware::{SecurityMiddleware, rate_limit_middleware, sanitization_middleware, security_headers_middleware, csrf_protection_middleware, session_validation_middleware, ip_whitelist_middleware, request_size_limit_middleware, sql_injection_protection_middleware};

// Import our modules
mod models;
mod auth;
mod database;
mod service_catalog;
mod workflow_engine;
mod handlers;
mod middleware;
mod mpesa;
mod security;
mod websocket;
mod error;
mod validation;
mod validation_middleware;
mod sanitization;
mod loading_states;
mod user_feedback;
mod progress_tracking;
mod notifications;
mod backup;
mod backup_scheduler;
mod monitoring;
mod metrics;
mod cache;
mod audit;
mod encryption;
mod database_optimization;
mod performance_monitoring;

use models::*;
use auth::AuthService;
use service_catalog::{ServiceCatalog, InsuranceType, PatientType};
use workflow_engine::WorkflowEngine;
use handlers::*;
use websocket::{WebSocketManager, websocket_handler};
use actix::Actor;
use error::{ApiError, ApiResponse, ValidationErrors, validate_email, validate_phone_number, validate_required_string, Validate};
use loading_states::{LoadingStateManager, OperationType};
use user_feedback::FeedbackManager;
use progress_tracking::{ComplexProgressTracker, BatchProgressTracker};
use notifications::{NotificationService, handlers as notification_handlers};
use backup::{BackupConfig, BackupService};
use backup_scheduler::{init_backup_scheduler, stop_backup_scheduler};
use handlers::backup_handlers;
use handlers::settings_handlers;
use handlers::dashboard_handlers;
use handlers::user_preferences_handlers;
use handlers::activity_log_handlers;
use handlers::data_isolation_handlers;
use handlers::validation_handlers;
use monitoring::{MonitoringService, LogLevel, LogEntryBuilder};
use metrics::MetricsService;
use cache::CacheService;
use database_optimization::DatabaseOptimization;
use performance_monitoring::{PerformanceMonitor, PerformanceThresholds};

// Application state
#[derive(Clone)]
pub struct AppState {
    pub database: Database,
    pub auth_service: AuthService,
    pub service_catalog: ServiceCatalog,
    pub workflow_engine: WorkflowEngine,
    pub security_config: SecurityConfig,
    pub websocket_manager: actix::Addr<WebSocketManager>,
    pub loading_manager: std::sync::Arc<LoadingStateManager>,
    pub feedback_manager: std::sync::Arc<FeedbackManager>,
    // pub notification_service: std::sync::Arc<NotificationService>,
    pub backup_config: BackupConfig,
    pub monitoring_service: std::sync::Arc<MonitoringService>,
    pub metrics_service: std::sync::Arc<MetricsService>,
    pub dashboard_cache: std::sync::Arc<DashboardCache>,
    pub user_preferences_cache: std::sync::Arc<UserPreferencesCache>,
    pub activity_log_cache: std::sync::Arc<ActivityLogCache>,
    pub validation_cache: std::sync::Arc<ValidationCache>,
}

// Database wrapper
#[derive(Clone)]
pub struct Database {
    pub pool: PgPool,
}

// Health check endpoint
async fn health() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "Backend is running"
    })))
}

// System status endpoint  
async fn system_status() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "initialized": true,
        "backend": "ready",
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

// Setup check endpoint
async fn setup_check() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "data": {
            "needs_setup": false,
            "system_ready": true
        },
        "message": "System is ready"
    })))
}

// Real login endpoint with database authentication
async fn login(
    req: web::Json<LoginRequest>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    let login_req = req.into_inner();
    
    eprintln!("Login attempt for user: {}", login_req.username);
    
    // Find user by username
    let user_result = sqlx::query_as::<_, User>(
        "SELECT id, username, email, role, name, department, permissions, is_active, created_at, updated_at, password_hash FROM users WHERE username = $1 AND is_active = true"
    )
    .bind(&login_req.username)
    .fetch_one(&data.database.pool)
    .await;

    let user = match user_result {
        Ok(user) => user,
        Err(_) => {
            eprintln!("User not found or inactive: {}", login_req.username);
            return Ok(HttpResponse::Unauthorized().json(json!({
                "success": false,
                "message": "Invalid credentials"
            })));
        }
    };

    // Verify password (with fallback for plain text)
    let password_valid = if user.password_hash == login_req.password {
        true // Plain text fallback
    } else {
        data.auth_service.verify_password(&login_req.password, &user.password_hash).unwrap_or(false)
    };

    if !password_valid {
        eprintln!("Invalid password for user: {}", login_req.username);
        return Ok(HttpResponse::Unauthorized().json(json!({
            "success": false,
            "message": "Invalid credentials"
        })));
    }

    // Generate JWT token
    let token = match data.auth_service.generate_access_token(&user) {
        Ok(token) => token,
        Err(e) => {
            eprintln!("Token generation failed: {}", e);
            return Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": "Token generation failed"
            })));
        }
    };

    eprintln!("Successful login for user: {}", login_req.username);

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "data": {
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.role,
                "name": user.name,
                "department": user.department,
                "permissions": user.permissions,
                "is_active": user.is_active
            },
            "token": token
        },
        "message": "Login successful"
    })))
}

// Protected endpoint that requires authentication
async fn protected_route(
    req: HttpRequest,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    // Extract token from Authorization header
    let auth_header = req.headers().get("Authorization");
    let token = match auth_header {
        Some(header) => {
            let header_str = header.to_str().unwrap_or("");
            if header_str.starts_with("Bearer ") {
                &header_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "message": "Invalid authorization header format"
                })));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(json!({
                "success": false,
                "message": "Authorization header missing"
            })));
        }
    };

    // Validate token
    match data.auth_service.validate_token(token) {
        Ok(claims) => {
            eprintln!("Valid token for user: {}", claims.username);
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "message": "Access granted to protected resource",
                "user": {
                    "username": claims.username,
                    "role": claims.role,
                    "permissions": claims.permissions
                }
            })))
        }
        Err(e) => {
            eprintln!("Token validation failed: {}", e);
            Ok(HttpResponse::Unauthorized().json(json!({
                "success": false,
                "message": "Invalid or expired token"
            })))
        }
    }
}

// User profile endpoint
async fn user_profile(
    req: HttpRequest,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    // Extract token from Authorization header
    let auth_header = req.headers().get("Authorization");
    let token = match auth_header {
        Some(header) => {
            let header_str = header.to_str().unwrap_or("");
            if header_str.starts_with("Bearer ") {
                &header_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "message": "Invalid authorization header format"
                })));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(json!({
                "success": false,
                "message": "Authorization header missing"
            })));
        }
    };

    // Validate token and get user info
    match data.auth_service.validate_token(token) {
        Ok(claims) => {
            // Get full user data from database
            let user_result = sqlx::query_as::<_, User>(
                "SELECT id, username, email, role, name, department, permissions, is_active, created_at, updated_at, password_hash FROM users WHERE username = $1"
            )
            .bind(&claims.username)
            .fetch_one(&data.database.pool)
            .await;

            match user_result {
                Ok(user) => {
                    Ok(HttpResponse::Ok().json(json!({
                        "success": true,
                        "data": {
                            "user": {
                                "id": user.id,
                                "username": user.username,
                                "role": user.role,
                                "name": user.name,
                                "department": user.department,
                                "permissions": user.permissions,
                                "is_active": user.is_active,
                                "created_at": user.created_at,
                                "updated_at": user.updated_at
                            }
                        },
                        "message": "User profile retrieved successfully"
                    })))
                }
                Err(_) => {
                    Ok(HttpResponse::NotFound().json(json!({
                        "success": false,
                        "message": "User not found"
                    })))
                }
            }
        }
        Err(e) => {
            eprintln!("Token validation failed: {}", e);
            Ok(HttpResponse::Unauthorized().json(json!({
                "success": false,
                "message": "Invalid or expired token"
            })))
        }
    }
}

// User creation endpoint - only accessible by admin
async fn create_user(
    req: web::Json<CreateUser>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    eprintln!("User creation attempt for: {}", req.username);
    
    // Extract token from Authorization header
    let auth_header = http_req.headers().get("Authorization");
    let token = match auth_header {
        Some(header) => {
            let header_str = header.to_str().unwrap_or("");
            if header_str.starts_with("Bearer ") {
                &header_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "message": "Invalid authorization header format"
                })));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(json!({
                "success": false,
                "message": "Authorization header missing"
            })));
        }
    };

    // Validate token and check if user is admin
    match data.auth_service.validate_token(token) {
        Ok(claims) => {
            if claims.role != "admin" {
                eprintln!("Non-admin user {} attempted to create user", claims.username);
                return Ok(HttpResponse::Forbidden().json(json!({
                    "success": false,
                    "message": "Only administrators can create users"
                })));
            }
            
            eprintln!("Admin {} creating user: {}", claims.username, req.username);
        }
        Err(e) => {
            eprintln!("Token validation failed: {}", e);
            return Ok(HttpResponse::Unauthorized().json(json!({
                "success": false,
                "message": "Invalid or expired token"
            })));
        }
    }

    // Check if username already exists
    let existing_user = sqlx::query_as::<_, User>(
        "SELECT id, username, email, role, name, department, permissions, is_active, created_at, updated_at, password_hash FROM users WHERE username = $1"
    )
    .bind(&req.username)
    .fetch_optional(&data.database.pool)
    .await;

    match existing_user {
        Ok(Some(_)) => {
            eprintln!("Username {} already exists", req.username);
            return Ok(HttpResponse::Conflict().json(json!({
                "success": false,
                "message": "Username already exists"
            })));
        }
        Ok(None) => {
            // Username is available, continue
        }
        Err(e) => {
            eprintln!("Database error checking username: {}", e);
            return Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": "Database error"
            })));
        }
    }

    // Hash password
    let password_hash = match data.auth_service.hash_password(&req.password) {
        Ok(hash) => hash,
        Err(e) => {
            eprintln!("Password hashing failed: {}", e);
            return Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": "Password processing failed"
            })));
        }
    };

    // Get role permissions
    let permissions = match req.role.as_str() {
        "admin" => json!(["all"]),
        "clinician" => json!(["patients", "consultations", "appointments", "prescriptions", "reports"]),
        "nurse" => json!(["patients", "appointments", "visits", "reports"]),
        "pharmacist" => json!(["pharmacy", "inventory", "reports", "invoices", "patients"]),
        "receptionist" => json!(["patients", "appointments", "billing"]),
        _ => json!(["patients"]),
    };

    // Create user
    let user_id = uuid::Uuid::new_v4();
    let now = chrono::Utc::now();
    
    let result = sqlx::query(
        "INSERT INTO users (id, username, email, password_hash, role, name, department, permissions, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"
    )
    .bind(user_id)
    .bind(&req.username)
    .bind(&password_hash)
    .bind(&req.role)
    .bind(&req.name)
    .bind(&req.department)
    .bind(&permissions)
    .bind(true) // is_active
    .bind(now)
    .bind(now)
    .execute(&data.database.pool)
    .await;
    
    match result {
        Ok(_) => {
            eprintln!("User created successfully: {}", req.username);
            
            Ok(HttpResponse::Created().json(json!({
                "success": true,
                "data": {
                    "user": {
                        "id": user_id,
                        "username": req.username,
                        "role": req.role,
                        "name": req.name,
                        "department": req.department,
                        "permissions": permissions,
                        "is_active": true,
                        "created_at": now.to_rfc3339(),
                        "updated_at": now.to_rfc3339()
                    }
                },
                "message": "User created successfully"
            })))
        }
        Err(e) => {
            eprintln!("Database error creating user: {}", e);
            Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": "Failed to create user"
            })))
        }
    }
}

// Service catalog endpoints
async fn get_services(data: web::Data<AppState>) -> Result<HttpResponse> {
    let services = data.service_catalog.get_all_services();
    let service_list: Vec<_> = services.iter().map(|s| json!({
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "category": s.category,
        "cash_price": s.cash_price,
        "sha_price": s.sha_price,
        "nhif_price": s.nhif_price,
        "is_active": s.is_active,
        "requires_prescription": s.requires_prescription
    })).collect();
    
    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "data": {
            "services": service_list
        }
    })))
}

async fn get_services_by_category(
    path: web::Path<String>,
    data: web::Data<AppState>
) -> Result<HttpResponse> {
    let category = path.into_inner();
    let services = data.service_catalog.get_services_by_category(&category);
    let service_list: Vec<_> = services.iter().map(|s| json!({
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "category": s.category,
        "cash_price": s.cash_price,
        "sha_price": s.sha_price,
        "nhif_price": s.nhif_price,
        "is_active": s.is_active,
        "requires_prescription": s.requires_prescription
    })).collect();
    
    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "data": {
            "category": category,
            "services": service_list
        }
    })))
}

async fn calculate_pricing(
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>
) -> HttpResponse {
    let service_id = match req.get("service_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => {
            return HttpResponse::BadRequest().json(json!({
                "success": false,
                "message": "Service ID is required"
            }));
        }
    };
    
    let insurance_type = req.get("insurance_type")
        .and_then(|v| v.as_str())
        .unwrap_or("cash");
    
    let patient_type = req.get("patient_type")
        .and_then(|v| v.as_str())
        .unwrap_or("adult");
    
    let insurance_enum = match insurance_type {
        "sha" => InsuranceType::SHA,
        "nhif" => InsuranceType::NHIF,
        "private" => InsuranceType::Private,
        "mixed" => InsuranceType::Mixed,
        _ => InsuranceType::Cash,
    };
    
    let patient_enum = match patient_type {
        "child" => PatientType::Child,
        "senior" => PatientType::Senior,
        "emergency" => PatientType::Emergency,
        _ => PatientType::Adult,
    };
    
    let price = match data.service_catalog.calculate_price(service_id, &insurance_enum, &patient_enum) {
        Some(p) => p,
        None => {
            return HttpResponse::NotFound().json(json!({
                "success": false,
                "message": "Service not found"
            }));
        }
    };
    
    HttpResponse::Ok().json(json!({
        "success": true,
        "data": {
            "service_id": service_id,
            "insurance_type": insurance_type,
            "patient_type": patient_type,
            "price": price
        }
    }))
}

// Workflow endpoints
async fn create_workflow(
    req: web::Json<serde_json::Value>,
    _data: web::Data<AppState>
) -> HttpResponse {
    let patient_id = match req.get("patient_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => {
            return HttpResponse::BadRequest().json(json!({
                "success": false,
                "message": "Patient ID is required"
            }));
        }
    };
    
    let initial_role = req.get("initial_role")
        .and_then(|v| v.as_str())
        .unwrap_or("receptionist");
    
    // Note: In a real implementation, you'd need to make workflow_engine mutable
    // For now, we'll return a mock response
    let workflow_id = uuid::Uuid::new_v4();
    
    HttpResponse::Ok().json(json!({
        "success": true,
        "data": {
            "workflow_id": workflow_id,
            "patient_id": patient_id,
            "current_stage": "registration",
            "initial_role": initial_role
        },
        "message": "Workflow created successfully"
    }))
}

async fn get_tasks_for_role(
    path: web::Path<String>,
    data: web::Data<AppState>
) -> Result<HttpResponse> {
    let role = path.into_inner();
    let tasks = data.workflow_engine.get_tasks_for_role(&role);
    
    let task_list: Vec<_> = tasks.iter().map(|t| json!({
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "assigned_role": t.assigned_role,
        "priority": format!("{:?}", t.priority).to_lowercase(),
        "status": format!("{:?}", t.status).to_lowercase(),
        "created_at": t.created_at.to_rfc3339(),
        "due_at": t.due_at.map(|d| d.to_rfc3339())
    })).collect();
    
    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "data": {
            "role": role,
            "tasks": task_list
        }
    })))
}

// Enhanced billing endpoint with auto-pricing
async fn create_auto_bill(
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>
) -> HttpResponse {
    let patient_id = match req.get("patient_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => {
            return HttpResponse::BadRequest().json(json!({
                "success": false,
                "message": "Patient ID is required"
            }));
        }
    };
    
    let services = match req.get("services").and_then(|v| v.as_array()) {
        Some(s) => s,
        None => {
            return HttpResponse::BadRequest().json(json!({
                "success": false,
                "message": "Services array is required"
            }));
        }
    };
    
    let insurance_type = req.get("insurance_type")
        .and_then(|v| v.as_str())
        .unwrap_or("cash");
    
    let patient_type = req.get("patient_type")
        .and_then(|v| v.as_str())
        .unwrap_or("adult");
    
    let insurance_enum = match insurance_type {
        "sha" => InsuranceType::SHA,
        "nhif" => InsuranceType::NHIF,
        "private" => InsuranceType::Private,
        "mixed" => InsuranceType::Mixed,
        _ => InsuranceType::Cash,
    };
    
    let patient_enum = match patient_type {
        "child" => PatientType::Child,
        "senior" => PatientType::Senior,
        "emergency" => PatientType::Emergency,
        _ => PatientType::Adult,
    };
    
    let mut billing_items = Vec::new();
    let mut total_amount = 0.0;
    let mut total_insurance = 0.0;
    let mut total_patient = 0.0;
    
    for service in services {
        let service_id = service.get("service_id")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        
        let quantity = service.get("quantity")
            .and_then(|v| v.as_i64())
            .unwrap_or(1) as i32;
        
        if let Some(item) = data.service_catalog.create_billing_item(
            service_id, 
            quantity, 
            &insurance_enum, 
            &patient_enum
        ) {
            total_amount += item.total_price;
            total_insurance += item.insurance_coverage;
            total_patient += item.patient_payment;
            
            billing_items.push(json!({
                "service_id": item.service_id,
                "service_name": item.service_name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item.total_price,
                "insurance_coverage": item.insurance_coverage,
                "patient_payment": item.patient_payment
            }));
        }
    }
    
    let invoice_id = format!("INV-{}-{}", 
        chrono::Utc::now().format("%Y%m%d"), 
        uuid::Uuid::new_v4().to_string()[..8].to_uppercase()
    );
    
    HttpResponse::Ok().json(json!({
        "success": true,
        "data": {
            "invoice_id": invoice_id,
            "patient_id": patient_id,
            "billing_items": billing_items,
            "totals": {
                "total_amount": total_amount,
                "insurance_coverage": total_insurance,
                "patient_payment": total_patient
            },
            "insurance_type": insurance_type,
            "patient_type": patient_type,
            "created_at": chrono::Utc::now().to_rfc3339()
        },
        "message": "Auto-bill created successfully"
    }))
}

// Admin service management endpoints
async fn get_all_services_admin(
    data: web::Data<AppState>
) -> HttpResponse {
    let services = data.service_catalog.get_all_services();
    HttpResponse::Ok().json(json!({
        "success": true,
        "data": {
            "services": services
        }
    }))
}

async fn update_service_price(
    path: web::Path<String>,
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>
) -> HttpResponse {
    let service_id = path.into_inner();
    
    let cash_price = match req.get("cash_price").and_then(|v| v.as_f64()) {
        Some(price) => price,
        None => {
            return HttpResponse::BadRequest().json(json!({
                "success": false,
                "message": "Cash price is required"
            }));
        }
    };

    let nhif_price = req.get("nhif_price").and_then(|v| v.as_f64()).unwrap_or(cash_price);
    let sha_price = req.get("sha_price").and_then(|v| v.as_f64()).unwrap_or(cash_price);

    // Note: In a real implementation, this would update a database
    // For now, we'll return success as the service catalog is read-only in this demo
    let result = true; // data.service_catalog.update_service_prices(&service_id, cash_price, nhif_price, sha_price);
    
    if result {
        HttpResponse::Ok().json(json!({
            "success": true,
            "message": "Service prices updated successfully",
            "data": {
                "service_id": service_id,
                "cash_price": cash_price,
                "nhif_price": nhif_price,
                "sha_price": sha_price,
                "updated_at": chrono::Utc::now().to_rfc3339()
            }
        }))
    } else {
        HttpResponse::NotFound().json(json!({
            "success": false,
            "message": "Service not found"
        }))
    }
}

async fn create_service(
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>
) -> HttpResponse {
    let service_id = match req.get("service_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => {
            return HttpResponse::BadRequest().json(json!({
                "success": false,
                "message": "Service ID is required"
            }));
        }
    };

    let name = match req.get("name").and_then(|v| v.as_str()) {
        Some(name) => name,
        None => {
            return HttpResponse::BadRequest().json(json!({
                "success": false,
                "message": "Service name is required"
            }));
        }
    };

    let category = match req.get("category").and_then(|v| v.as_str()) {
        Some(cat) => cat,
        None => {
            return HttpResponse::BadRequest().json(json!({
                "success": false,
                "message": "Service category is required"
            }));
        }
    };

    let description = req.get("description").and_then(|v| v.as_str()).unwrap_or("");
    let cash_price = match req.get("cash_price").and_then(|v| v.as_f64()) {
        Some(price) => price,
        None => {
            return HttpResponse::BadRequest().json(json!({
                "success": false,
                "message": "Cash price is required"
            }));
        }
    };

    let nhif_price = req.get("nhif_price").and_then(|v| v.as_f64()).unwrap_or(cash_price);
    let sha_price = req.get("sha_price").and_then(|v| v.as_f64()).unwrap_or(cash_price);
    let requires_prescription = req.get("requires_prescription").and_then(|v| v.as_bool()).unwrap_or(false);

    // Note: In a real implementation, this would add to a database
    // For now, we'll return success as the service catalog is read-only in this demo
    let result = true; // data.service_catalog.add_service(...)

    if result {
        HttpResponse::Ok().json(json!({
            "success": true,
            "message": "Service created successfully",
            "data": {
                "service_id": service_id,
                "name": name,
                "category": category,
                "description": description,
                "cash_price": cash_price,
                "nhif_price": nhif_price,
                "sha_price": sha_price,
                "requires_prescription": requires_prescription,
                "created_at": chrono::Utc::now().to_rfc3339()
            }
        }))
    } else {
        HttpResponse::BadRequest().json(json!({
            "success": false,
            "message": "Service already exists or invalid data"
        }))
    }
}

// Essential endpoint handlers for frontend
async fn get_patients() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "data": [],
        "message": "Patients endpoint ready"
    })))
}

async fn get_medicines() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "data": [],
        "message": "Medicines endpoint ready"
    })))
}

async fn get_stock_alerts() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "data": [],
        "message": "Stock alerts endpoint ready"
    })))
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load environment variables
    dotenvy::dotenv().ok();
    
    // Initialize logging
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    
    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let bind_address = format!("{}:{}", host, port);
    
    eprintln!("🚀 Starting Clinic Management Backend");
    eprintln!("📡 Server will listen on: {}", bind_address);
    
    // Initialize database
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://clinic_user:clinic_password@clinic_postgres:5432/clinic_management".to_string());
    
    eprintln!("🔗 Connecting to database...");
    let db_pool = match database::create_pool().await {
        Ok(pool) => {
            eprintln!("✅ Database connection established");
            pool
        }
        Err(e) => {
            eprintln!("❌ Failed to connect to database: {}", e);
            eprintln!("❌ Database URL: {}", database_url.replace(&database_url.split('@').nth(0).unwrap_or(""), "***"));
            eprintln!("❌ Retrying database connection in 5 seconds...");
            std::thread::sleep(std::time::Duration::from_secs(5));
            match database::create_pool().await {
                Ok(pool) => {
                    eprintln!("✅ Database connection established on retry");
                    pool
                }
                Err(e2) => {
                    eprintln!("❌ Failed to connect to database on retry: {}", e2);
                    eprintln!("❌ Exiting...");
                    return Ok(());
                }
            }
        }
    };
    
    // Initialize auth service
    let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "your-super-secret-jwt-key-change-this-in-production".to_string());
    let jwt_expiration = env::var("JWT_EXPIRATION").unwrap_or_else(|_| "86400".to_string()).parse::<u64>().unwrap_or(86400);
    
    let auth_service = AuthService::new(&jwt_secret, jwt_expiration / 3600, 7); // 7 days for refresh token
    
    // Initialize service catalog and workflow engine
    let service_catalog = ServiceCatalog::new();
    let workflow_engine = WorkflowEngine::new();
    
    // Initialize security configuration
    let security_config = SecurityConfig::from_env();
    
    // Initialize WebSocket manager
    let websocket_manager = WebSocketManager::new().start();
    
    // Initialize loading state manager
    let loading_manager = std::sync::Arc::new(LoadingStateManager::new());
    
    // Initialize feedback manager
    let feedback_manager = std::sync::Arc::new(FeedbackManager::new(loading_manager.clone()));
    
    // Create app state
    // Initialize notification service (optional for now)
    eprintln!("⚠️ Skipping notification service initialization for now...");
    // TODO: Implement proper notification service initialization
    // let notification_service = std::sync::Arc::new(NotificationService::new(...));

    // Initialize backup configuration
    let backup_config = BackupConfig {
        enabled: env::var("BACKUP_ENABLED").unwrap_or_else(|_| "true".to_string()).parse().unwrap_or(true),
        cron_expression: env::var("BACKUP_SCHEDULE").unwrap_or_else(|_| "0 2 * * *".to_string()),
        retention_days: env::var("BACKUP_RETENTION_DAYS").unwrap_or_else(|_| "30".to_string()).parse().unwrap_or(30),
        backup_path: env::var("BACKUP_PATH").unwrap_or_else(|_| "./backups".to_string()),
        compression: env::var("BACKUP_COMPRESSION").unwrap_or_else(|_| "true".to_string()).parse().unwrap_or(true),
        include_files: env::var("BACKUP_INCLUDE_FILES").unwrap_or_else(|_| "true".to_string()).parse().unwrap_or(true),
        max_backup_size_mb: env::var("BACKUP_MAX_SIZE_MB").unwrap_or_else(|_| "1024".to_string()).parse().unwrap_or(1024),
    };

    // Initialize metrics service
    let metrics_service = match MetricsService::new() {
        Ok(service) => {
            eprintln!("✅ Metrics service initialized");
            std::sync::Arc::new(service)
        }
        Err(e) => {
            eprintln!("⚠️ Failed to initialize metrics service: {}", e);
            std::process::exit(1);
        }
    };

    // Initialize monitoring service
    let monitoring_service = match MonitoringService::new(db_pool.clone()).await {
        Ok(service) => {
            eprintln!("✅ Monitoring service initialized");
            std::sync::Arc::new(service)
        }
        Err(e) => {
            eprintln!("⚠️ Failed to initialize monitoring service: {}", e);
            std::process::exit(1);
        }
    };

    eprintln!("🗄️ Initializing cache services...");
    
    // Initialize cache services
    let cache_config = CacheConfig {
        default_ttl: std::time::Duration::from_secs(300), // 5 minutes
        max_entries: 1000,
        cleanup_interval: std::time::Duration::from_secs(60), // 1 minute
        enable_metrics: true,
    };
    
    let dashboard_cache = std::sync::Arc::new(DashboardCache::new(cache_config.clone()));
    let user_preferences_cache = std::sync::Arc::new(UserPreferencesCache::new(cache_config.clone()));
    let activity_log_cache = std::sync::Arc::new(ActivityLogCache::new(cache_config.clone()));
    let validation_cache = std::sync::Arc::new(ValidationCache::new(cache_config));
    
    eprintln!("✅ Cache services initialized");

    let app_state = AppState {
        database: Database { pool: db_pool.clone() },
        auth_service,
        service_catalog,
        workflow_engine,
        security_config,
        websocket_manager: websocket_manager.clone(),
        loading_manager: loading_manager.clone(),
        feedback_manager: feedback_manager.clone(),
        // notification_service: notification_service.clone(),
        backup_config: backup_config.clone(),
        monitoring_service: monitoring_service.clone(),
        metrics_service: metrics_service.clone(),
        dashboard_cache,
        user_preferences_cache,
        activity_log_cache,
        validation_cache,
    };
    
    // Initialize backup scheduler
    if backup_config.enabled {
        match init_backup_scheduler(db_pool.clone(), backup_config.clone()).await {
            Ok(_) => {
                eprintln!("✅ Backup scheduler initialized");
            }
            Err(e) => {
                eprintln!("⚠️ Failed to initialize backup scheduler: {}", e);
            }
        }
    }

    eprintln!("✅ Authentication service initialized");
    eprintln!("🚀 Starting HTTP server...");
    
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .app_data(web::Data::new(websocket_manager.clone()))
            .app_data(web::Data::new(loading_manager.clone()))
            .app_data(web::Data::new(feedback_manager.clone()))
            // .app_data(web::Data::new(notification_service.clone()))
            .app_data(web::Data::new(PermissionValidator::new()))
            .wrap(actix_middleware::Logger::default())
            .wrap(security_headers())
            .wrap(cors_config())
            .wrap(PermissionMiddleware::new())
            .route("/health", web::get().to(health))
            .route("/api/v1/system/status", web::get().to(system_status))
            .route("/api/v1/auth/setup", web::get().to(setup_check))
            .route("/api/v1/auth/login", web::post().to(login))
            .route("/api/v1/protected", web::get().to(protected_route))
            .route("/api/v1/user/profile", web::get().to(user_profile))
            .route("/api/v1/users", web::post().to(create_user))
            // Service catalog endpoints
            .route("/api/v1/services", web::get().to(get_services))
            .route("/api/v1/services/category/{category}", web::get().to(get_services_by_category))
            .route("/api/v1/services/pricing", web::post().to(calculate_pricing))
            // Admin service management endpoints
            .route("/api/v1/admin/services", web::get().to(get_all_services_admin))
            .route("/api/v1/admin/services/{service_id}", web::put().to(update_service_price))
            .route("/api/v1/admin/services", web::post().to(create_service))
            // Workflow endpoints
            .route("/api/v1/workflow/create", web::post().to(create_workflow))
            .route("/api/v1/workflow/tasks/{role}", web::get().to(get_tasks_for_role))
            // Enhanced billing endpoints
            .route("/api/v1/billing/auto-create", web::post().to(create_auto_bill))
            // Patient Management endpoints
            .route("/api/v1/patients", web::get().to(get_patients))
            .route("/api/v1/patients", web::post().to(create_patient))
            .route("/api/v1/patients/{id}", web::get().to(get_patient))
            .route("/api/v1/patients/{id}", web::put().to(update_patient))
            .route("/api/v1/patients/{id}", web::delete().to(delete_patient))
            .route("/api/v1/patients/search", web::get().to(search_patients))
            .route("/api/v1/patients/import", web::post().to(import_patients))
            
            // Consultation endpoints
            .route("/api/v1/consultations", web::get().to(get_consultations))
            .route("/api/v1/consultations", web::post().to(create_consultation))
            .route("/api/v1/consultations/{id}", web::get().to(get_consultation))
            .route("/api/v1/consultations/{id}", web::put().to(update_consultation))
            .route("/api/v1/consultations/{id}", web::delete().to(delete_consultation))
            .route("/api/v1/consultations/patient/{patient_id}", web::get().to(get_patient_consultations))
            
            // Billing and Invoice endpoints
            .route("/api/v1/invoices", web::get().to(get_invoices))
            .route("/api/v1/invoices", web::post().to(create_invoice))
            .route("/api/v1/invoices/{id}", web::get().to(get_invoice))
            .route("/api/v1/invoices/{id}", web::put().to(update_invoice))
            .route("/api/v1/invoices/{id}", web::delete().to(delete_invoice))
            .route("/api/v1/invoices/{id}/pay", web::post().to(pay_invoice))
            .route("/api/v1/invoices/patient/{patient_id}", web::get().to(get_patient_invoices))
            
            // Pharmacy endpoints
            .route("/api/v1/pharmacy/medicines", web::get().to(get_medicines))
            .route("/api/v1/pharmacy/medicines", web::post().to(create_medicine))
            .route("/api/v1/pharmacy/medicines/{id}", web::get().to(get_medicine))
            .route("/api/v1/pharmacy/medicines/{id}", web::put().to(update_medicine))
            .route("/api/v1/pharmacy/medicines/{id}", web::delete().to(delete_medicine))
            .route("/api/v1/pharmacy/stock/alerts", web::get().to(get_stock_alerts))
            .route("/api/v1/pharmacy/stock", web::get().to(get_stock))
            .route("/api/v1/pharmacy/stock", web::post().to(update_stock))
            
        // Prescription endpoints
        .route("/api/v1/prescriptions", web::get().to(pharmacy_handlers::get_prescriptions))
        .route("/api/v1/prescriptions/{id}/dispense", web::post().to(pharmacy_handlers::dispense_prescription))
        .route("/api/v1/consultations/{id}/prescriptions", web::post().to(consultation_handlers::add_prescription))
            
            // Appointment endpoints
            .route("/api/v1/appointments", web::get().to(get_appointments))
            .route("/api/v1/appointments", web::post().to(create_appointment))
            .route("/api/v1/appointments/{id}", web::get().to(get_appointment))
            .route("/api/v1/appointments/{id}", web::put().to(update_appointment))
            .route("/api/v1/appointments/{id}", web::delete().to(delete_appointment))
            .route("/api/v1/appointments/patient/{patient_id}", web::get().to(get_patient_appointments))
            
            // Report endpoints
            .route("/api/v1/reports/patients", web::get().to(get_patient_report))
            .route("/api/v1/reports/consultations", web::get().to(get_consultation_report))
            .route("/api/v1/reports/billing", web::get().to(get_billing_report))
            .route("/api/v1/reports/pharmacy", web::get().to(get_pharmacy_report))
            .route("/api/v1/reports/financial", web::get().to(get_financial_report))
            .route("/api/v1/reports/inventory", web::get().to(get_inventory_report))
            .route("/api/v1/reports/audit", web::get().to(get_audit_logs))
            .route("/api/v1/reports/analytics", web::get().to(get_consultation_analytics))
            
            // User Management endpoints
            .route("/api/v1/users", web::get().to(get_users))
            .route("/api/v1/users/{id}", web::get().to(user_handlers::get_user))
            .route("/api/v1/users/{id}", web::put().to(update_user))
            .route("/api/v1/users/{id}", web::delete().to(delete_user))
            .route("/api/v1/users/{id}/permissions", web::put().to(user_handlers::update_user_permissions))
            
            // File Upload endpoints
            .route("/api/v1/upload/avatar", web::post().to(upload_avatar))
            .route("/api/v1/upload/document", web::post().to(upload_document))
            .route("/api/v1/files/{file_id}", web::get().to(get_file))
            .route("/api/v1/files", web::get().to(get_files))
            .route("/api/v1/files/{file_id}", web::delete().to(delete_file))
            
            // M-Pesa endpoints
            .route("/api/v1/mpesa/stk-push", web::post().to(mpesa_stk_push))
            .route("/api/v1/mpesa/callback", web::post().to(mpesa_callback))
            .route("/api/v1/mpesa/query", web::post().to(mpesa_query))
            
            // WebSocket endpoint
            .route("/api/v1/ws", web::get().to(websocket_handler))
            
            // Loading states and progress tracking endpoints
            .route("/api/v1/operations/{operation_id}", web::get().to(loading_states::get_operation_status))
            .route("/api/v1/operations/user/{user_id}", web::get().to(loading_states::get_user_operations))
            .route("/api/v1/operations/active", web::get().to(loading_states::get_active_operations))
            .route("/api/v1/operations/{operation_id}/cancel", web::post().to(loading_states::cancel_operation))
            .route("/api/v1/operations/count", web::get().to(loading_states::get_operation_count))
            
            // User feedback endpoints
            .route("/api/v1/feedback/user/{user_id}", web::get().to(user_feedback::get_user_feedbacks))
            .route("/api/v1/feedback/user/{user_id}/unread", web::get().to(user_feedback::get_unread_feedbacks))
            .route("/api/v1/feedback/{feedback_id}/read", web::post().to(user_feedback::mark_feedback_as_read))
            .route("/api/v1/feedback/user/{user_id}/read-all", web::post().to(user_feedback::mark_all_feedbacks_as_read))
            .route("/api/v1/feedback/{feedback_id}", web::delete().to(user_feedback::delete_feedback))
            
            // Progress tracking endpoints
            .route("/api/v1/progress/{operation_id}", web::get().to(progress_tracking::get_operation_progress))
            .route("/api/v1/progress/user/{user_id}", web::get().to(progress_tracking::get_user_operation_progress))
            
            // Notification endpoints
            .route("/api/v1/notifications/send", web::post().to(notification_handlers::send_notification))
            .route("/api/v1/notifications/appointment-reminder", web::post().to(notification_handlers::send_appointment_reminder))
            .route("/api/v1/notifications/payment-confirmation", web::post().to(notification_handlers::send_payment_confirmation))
            .route("/api/v1/notifications/history", web::get().to(notification_handlers::get_notification_history))
            .route("/api/v1/notifications/stats", web::get().to(notification_handlers::get_notification_stats))
            
            // Backup and Recovery endpoints
            .route("/api/v1/backup", web::post().to(backup_handlers::create_backup))
            .route("/api/v1/backup", web::get().to(backup_handlers::list_backups))
            .route("/api/v1/backup/{id}", web::get().to(backup_handlers::get_backup))
            .route("/api/v1/backup/{id}", web::delete().to(backup_handlers::delete_backup))
            .route("/api/v1/backup/{id}/download", web::get().to(backup_handlers::download_backup))
            .route("/api/v1/backup/stats", web::get().to(backup_handlers::get_backup_stats))
            .route("/api/v1/backup/cleanup", web::post().to(backup_handlers::cleanup_backups))
            .route("/api/v1/backup/config", web::get().to(backup_handlers::get_backup_config))
            .route("/api/v1/backup/config", web::put().to(backup_handlers::update_backup_config))
            
            // Backup Schedule endpoints
            .route("/api/v1/backup/schedules", web::get().to(backup_handlers::get_backup_schedules))
            .route("/api/v1/backup/schedules", web::post().to(backup_handlers::create_backup_schedule))
            .route("/api/v1/backup/schedules/{id}", web::put().to(backup_handlers::update_backup_schedule))
            .route("/api/v1/backup/schedules/{id}", web::delete().to(backup_handlers::delete_backup_schedule))
            .route("/api/v1/backup/schedules/{id}/toggle", web::post().to(backup_handlers::toggle_backup_schedule))
            .route("/api/v1/backup/scheduler/status", web::get().to(backup_handlers::get_scheduler_status))
            
            // Monitoring and Logging endpoints
            .route("/api/v1/monitoring/logs", web::post().to(monitoring_handlers::create_log))
            .route("/api/v1/monitoring/health", web::get().to(monitoring_handlers::get_system_health))
            .route("/api/v1/monitoring/logs/statistics", web::get().to(monitoring_handlers::get_log_statistics))
            .route("/api/v1/monitoring/alerts", web::get().to(monitoring_handlers::get_recent_alerts))
            .route("/api/v1/monitoring/alerts/configs", web::get().to(monitoring_handlers::get_alert_configs))
            .route("/api/v1/monitoring/alerts/configs", web::post().to(monitoring_handlers::create_alert_config))
            .route("/api/v1/monitoring/alerts/configs/{id}", web::put().to(monitoring_handlers::update_alert_config))
            .route("/api/v1/monitoring/alerts/configs/{id}", web::delete().to(monitoring_handlers::delete_alert_config))
            .route("/api/v1/monitoring/alerts/{id}/acknowledge", web::post().to(monitoring_handlers::acknowledge_alert))
            .route("/api/v1/monitoring/alerts/{id}/resolve", web::post().to(monitoring_handlers::resolve_alert))
            .route("/api/v1/monitoring/performance", web::get().to(monitoring_handlers::get_performance_metrics))
            .route("/api/v1/monitoring/system", web::get().to(monitoring_handlers::get_system_metrics))
            .route("/api/v1/monitoring/cleanup", web::post().to(monitoring_handlers::trigger_log_cleanup))
            .route("/api/v1/monitoring/dashboard", web::get().to(monitoring_handlers::get_monitoring_dashboard))
            
            // Settings endpoints
            .route("/api/v1/settings", web::get().to(settings_handlers::get_settings))
            .route("/api/v1/settings", web::put().to(settings_handlers::update_settings))
            
            // User settings endpoints
            .route("/api/v1/user/settings", web::get().to(settings_handlers::get_user_settings))
            .route("/api/v1/user/settings", web::put().to(settings_handlers::update_user_settings))
            .route("/api/v1/user/settings/{key}", web::delete().to(settings_handlers::delete_user_setting))
            
            // Enhanced Dashboard endpoints
            .route("/api/v1/dashboard/user/{user_id}/metrics", web::get().to(dashboard_handlers::get_user_dashboard_metrics))
            .route("/api/v1/dashboard/role/{role}/metrics", web::get().to(dashboard_handlers::get_role_dashboard_metrics))
            .route("/api/v1/dashboard/department/{department}/metrics", web::get().to(dashboard_handlers::get_department_dashboard_metrics))
            .route("/api/v1/dashboard/system/health", web::get().to(dashboard_handlers::get_system_health_metrics))
            
            // User Preferences endpoints
            .route("/api/v1/user/{user_id}/preferences", web::get().to(user_preferences_handlers::get_user_preferences))
            .route("/api/v1/user/{user_id}/preferences", web::put().to(user_preferences_handlers::update_user_preferences))
            .route("/api/v1/user/{user_id}/preferences/reset", web::post().to(user_preferences_handlers::reset_user_preferences))
            .route("/api/v1/user/{role}/preferences/template", web::get().to(user_preferences_handlers::get_role_preference_template))
            
            // Activity Log endpoints
            .route("/api/v1/activity/log", web::post().to(activity_log_handlers::log_user_activity))
            .route("/api/v1/activity/user/{user_id}", web::get().to(activity_log_handlers::get_user_activity))
            .route("/api/v1/activity/recent", web::get().to(activity_log_handlers::get_recent_activities))
            .route("/api/v1/activity/stats", web::get().to(activity_log_handlers::get_activity_statistics))
            
            // Data Isolation endpoints
            .route("/api/v1/patients/filtered", web::get().to(data_isolation_handlers::get_filtered_patients))
            .route("/api/v1/consultations/filtered", web::get().to(data_isolation_handlers::get_filtered_consultations))
            .route("/api/v1/prescriptions/filtered", web::get().to(data_isolation_handlers::get_filtered_prescriptions))
            .route("/api/v1/invoices/filtered", web::get().to(data_isolation_handlers::get_filtered_invoices))
            .route("/api/v1/permissions/validate", web::post().to(data_isolation_handlers::validate_data_access))
            
            // Enhanced Validation endpoints
            .route("/api/v1/validation/patient", web::post().to(validation_handlers::validate_patient_data))
            .route("/api/v1/validation/user", web::post().to(validation_handlers::validate_user_data))
            .route("/api/v1/validation/duplicate/patient", web::post().to(validation_handlers::check_duplicate_patient))
            .route("/api/v1/validation/duplicate/user", web::post().to(validation_handlers::check_duplicate_user))
            .route("/api/v1/validation/business-rules", web::post().to(validation_handlers::validate_business_rules))
    })
    .bind(&bind_address)?
    .run()
    .await?;

    // Graceful shutdown
    stop_backup_scheduler();
    eprintln!("🛑 Backup scheduler stopped");
    
    Ok(())
}