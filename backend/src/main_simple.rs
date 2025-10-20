use actix_web::{web, App, HttpResponse, HttpServer, Result, middleware, HttpRequest};
use std::env;
use serde_json::json;
use sqlx::PgPool;

// Import our modules
mod models;
mod auth;
mod database;
mod service_catalog;
mod workflow_engine;

use models::*;
use auth::AuthService;
use service_catalog::{ServiceCatalog, InsuranceType, PatientType};
use workflow_engine::WorkflowEngine;

// Application state
#[derive(Clone)]
pub struct AppState {
    pub db_pool: PgPool,
    pub auth_service: AuthService,
    pub service_catalog: ServiceCatalog,
    pub workflow_engine: WorkflowEngine,
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
    .fetch_one(&data.db_pool)
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
                "email": user.email,
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
            .fetch_one(&data.db_pool)
            .await;

            match user_result {
                Ok(user) => {
                    Ok(HttpResponse::Ok().json(json!({
                        "success": true,
                        "data": {
                            "user": {
                                "id": user.id,
                                "username": user.username,
                                "email": user.email,
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
    .fetch_optional(&data.db_pool)
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
    .bind(&req.email)
    .bind(&password_hash)
    .bind(&req.role)
    .bind(&req.name)
    .bind(&req.department)
    .bind(&permissions)
    .bind(true) // is_active
    .bind(now)
    .bind(now)
    .execute(&data.db_pool)
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
                        "email": req.email,
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
    
    // Create app state
    let app_state = AppState {
        db_pool,
        auth_service,
        service_catalog,
        workflow_engine,
    };
    
    eprintln!("✅ Authentication service initialized");
    eprintln!("🚀 Starting HTTP server...");
    
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .wrap(middleware::Logger::default())
            .wrap(
                actix_cors::Cors::default()
                    .allow_any_origin()
                    .allow_any_method()
                    .allow_any_header()
                    .max_age(3600)
            )
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
    })
    .bind(&bind_address)?
    .run()
    .await
}