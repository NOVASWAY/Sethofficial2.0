use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use chrono::{Utc, NaiveDate, NaiveTime};
use rand::Rng;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use sqlx::Row;

use crate::{AppState, models::{User, Patient, Consultation, Appointment, Invoice, Medicine, Prescription}, jwt_utils::verify_jwt_from_request};
use crate::mpesa::{MpesaService, StkPushRequestPayload, create_mpesa_transaction, update_mpesa_transaction, get_mpesa_transaction_by_checkout_id, get_mpesa_transactions_by_invoice};
use crate::mfa::MfaService;
use crate::services;
use crate::websocket;

// Cache helper functions
async fn get_from_cache<T>(redis_client: &Option<std::sync::Arc<crate::redis_client::RedisClient>>, key: &str) -> Option<T>
where
    T: for<'de> serde::Deserialize<'de>,
{
    if let Some(redis) = redis_client {
        if let Ok(Some(cached_json)) = redis.cache_get(key).await {
            if let Ok(parsed) = serde_json::from_str::<T>(&cached_json) {
                return Some(parsed);
            }
        }
    }
    None
}

async fn set_in_cache<T>(redis_client: &Option<std::sync::Arc<crate::redis_client::RedisClient>>, key: &str, value: &T, ttl: Duration)
where
    T: serde::Serialize,
{
    if let Some(redis) = redis_client {
        if let Ok(json_str) = serde_json::to_string(value) {
            let _ = redis.cache_set(key, &json_str, ttl).await;
        }
    }
}

async fn invalidate_cache(redis_client: &Option<std::sync::Arc<crate::redis_client::RedisClient>>, pattern: &str) {
    // For simplicity, we'll use pattern-based invalidation
    // In production, you might want to use Redis KEYS command with caution (or SCAN)
    if let Some(redis) = redis_client {
        let _ = redis.cache_delete(pattern).await;
    }
}

// Basic user endpoints
pub async fn get_users(state: web::Data<AppState>) -> Result<HttpResponse> {
    match sqlx::query_as::<_, User>("SELECT * FROM users LIMIT 10")
        .fetch_all(&state.db_pool)
        .await
    {
        Ok(users) => Ok(HttpResponse::Ok().json(json!({
            "success": true,
            "data": users,
            "count": users.len()
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch users: {}", e)
        })))
    }
}

pub async fn get_user_by_id(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let user_id = path.into_inner();
    
    match sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db_pool)
        .await
    {
        Ok(Some(user)) => Ok(HttpResponse::Ok().json(json!({
            "success": true,
            "data": user
        }))),
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "User not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch user: {}", e)
        })))
    }
}

pub async fn create_user(
    user_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>,
    req: HttpRequest,
) -> Result<HttpResponse> {
    // Authentication and authorization check - only admins can create users
    let claims = crate::middleware::security::get_claims_from_request(&req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("Authentication required"))?;
    
    if claims.role != "admin" {
        return Ok(HttpResponse::Forbidden().json(json!({
            "success": false,
            "error": "Only administrators can create users"
        })));
    }

    // Basic validation
    let username = match user_data.get("username").and_then(|v| v.as_str()) {
        Some(u) => u,
        None => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Username is required"
        })))
    };

    let password = match user_data.get("password").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Password is required"
        })))
    };

    let email = match user_data.get("email").and_then(|v| v.as_str()) {
        Some(e) => e,
        None => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Email is required"
        })))
    };

    let role = user_data.get("role").and_then(|v| v.as_str()).unwrap_or("user");
    let name = user_data.get("name").and_then(|v| v.as_str()).unwrap_or(username);
    let department = user_data.get("department").and_then(|v| v.as_str()).unwrap_or("general");

    // Hash password using AuthService
    let password_hash = match state.auth_service.hash_password(password) {
        Ok(hash) => hash,
        Err(e) => return Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to hash password: {}", e)
        })))
    };

    // Insert user
    match sqlx::query!(
        "INSERT INTO users (id, username, email, password_hash, role, name, department, permissions, is_active, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        Uuid::new_v4(),
        username,
        email,
        password_hash,
        role,
        name,
        department,
        json!(["read"]), // Default permissions
        true,
        chrono::Utc::now(),
        chrono::Utc::now()
    )
    .execute(&state.db_pool)
    .await
    {
        Ok(_) => Ok(HttpResponse::Created().json(json!({
            "success": true,
            "message": "User created successfully"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to create user: {}", e)
        })))
    }
}

pub async fn login(
    login_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let username = match login_data.get("username").and_then(|v| v.as_str()) {
        Some(u) => u,
        None => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Username is required"
        })))
    };

    let password = match login_data.get("password").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Password is required"
        })))
    };

    // Find user
    match sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = $1")
        .bind(username)
        .fetch_optional(&state.db_pool)
        .await
    {
        Ok(Some(user)) => {
            // Verify password
            match state.auth_service.verify_password(password, &user.password_hash) {
                Ok(true) => {
                    // Check if MFA is enabled for this user
                    let mfa_enabled: Option<bool> = sqlx::query_scalar(
                        "SELECT mfa_enabled FROM users WHERE id = $1"
                    )
                    .bind(user.id)
                    .fetch_optional(&state.db_pool)
                    .await
                    .unwrap_or(None);

                    // If MFA is enabled, create MFA session instead of generating token
                    if mfa_enabled.unwrap_or(false) {
                        let mfa_service = MfaService::new(state.db_pool.clone());
                        match mfa_service.create_mfa_session(user.id, None, None).await {
                            Ok(mfa_session_token) => {
                                return Ok(HttpResponse::Ok().json(json!({
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
                                        "mfa_required": true,
                                        "mfa_session_token": mfa_session_token
                                    },
                                    "message": "MFA verification required"
                                })))
                            },
                            Err(e) => {
                                return Ok(HttpResponse::InternalServerError().json(json!({
                                    "success": false,
                                    "error": format!("Failed to create MFA session: {}", e)
                                })))
                            }
                        }
                    }

                    // Generate JWT tokens
                    match state.auth_service.generate_access_token(&user) {
                        Ok(access_token) => {
                            // Generate refresh token
                            match state.auth_service.generate_refresh_token(user.id) {
                                Ok(refresh_token) => Ok(HttpResponse::Ok().json(json!({
                                    "success": true,
                                    "data": {
                                        "token": access_token,
                                        "refresh_token": refresh_token,
                                        "user": {
                                            "id": user.id,
                                            "username": user.username,
                                            "role": user.role,
                                            "name": user.name,
                                            "department": user.department,
                                            "permissions": user.permissions,
                                            "is_active": user.is_active
                                        }
                                    },
                                    "message": "Login successful"
                                }))),
                                Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
                                    "success": false,
                                    "error": format!("Failed to generate refresh token: {}", e)
                                })))
                            }
                        },
                        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
                            "success": false,
                            "error": format!("Failed to generate token: {}", e)
                        })))
                    }
                },
                Ok(false) => Ok(HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "error": "Invalid credentials"
                }))),
                Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": format!("Password verification failed: {}", e)
                })))
            }
        },
        Ok(None) => Ok(HttpResponse::Unauthorized().json(json!({
            "success": false,
            "error": "Invalid credentials"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Database error: {}", e)
        })))
    }
}

// Protected endpoint example
pub async fn get_profile(req: HttpRequest, state: web::Data<AppState>) -> Result<HttpResponse> {
    // Verify JWT token and extract claims
    match verify_jwt_from_request(&req, &state.auth_service) {
        Ok(claims) => {
            // Get full user details from database
            match sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
                .bind(claims.user_id)
                .fetch_optional(&state.db_pool)
                .await
            {
                Ok(Some(user)) => Ok(HttpResponse::Ok().json(json!({
                    "success": true,
                    "data": {
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
                }))),
                Ok(None) => Ok(HttpResponse::NotFound().json(json!({
                    "success": false,
                    "error": "User not found"
                }))),
                Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": format!("Database error: {}", e)
                })))
            }
        }
        Err(response) => Ok(response)
    }
}

// Get current user info (/api/auth/me)
pub async fn get_me(req: HttpRequest, state: web::Data<AppState>) -> Result<HttpResponse> {
    get_profile(req, state).await
}

// Logout endpoint
pub async fn logout(req: HttpRequest, state: web::Data<AppState>) -> Result<HttpResponse> {
    // Verify JWT token to get user info
    match verify_jwt_from_request(&req, &state.auth_service) {
        Ok(claims) => {
            // In a full implementation, you would:
            // 1. Add token to a blacklist (Redis)
            // 2. Invalidate refresh token
            // 3. Log the logout event
            
            // For now, just return success
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "message": "Logged out successfully"
            })))
        }
        Err(response) => Ok(response)
    }
}

// Refresh token endpoint
pub async fn refresh_token(
    refresh_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let refresh_token = match refresh_data.get("refresh_token").and_then(|v| v.as_str()) {
        Some(token) => token,
        None => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Refresh token is required"
        })))
    };

    // Verify refresh token
    match state.auth_service.verify_refresh_token(refresh_token) {
        Ok(claims) => {
            // Extract user ID from claims
            let user_id = match Uuid::parse_str(&claims.sub) {
                Ok(id) => id,
                Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
                    "success": false,
                    "error": "Invalid refresh token format"
                })))
            };

            // Get user from database
            match sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1 AND is_active = true")
                .bind(user_id)
                .fetch_optional(&state.db_pool)
                .await
            {
                Ok(Some(user)) => {
                    // Generate new tokens
                    match state.auth_service.generate_access_token(&user) {
                        Ok(access_token) => {
                            match state.auth_service.generate_refresh_token(user.id) {
                                Ok(new_refresh_token) => Ok(HttpResponse::Ok().json(json!({
                                    "success": true,
                                    "access_token": access_token,
                                    "refresh_token": new_refresh_token,
                                    "user": {
                                        "id": user.id,
                                        "username": user.username,
                                        "role": user.role,
                                        "name": user.name,
                                        "department": user.department
                                    }
                                }))),
                                Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
                                    "success": false,
                                    "error": format!("Failed to generate refresh token: {}", e)
                                })))
                            }
                        },
                        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
                            "success": false,
                            "error": format!("Failed to generate access token: {}", e)
                        })))
                    }
                },
                Ok(None) => Ok(HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "error": "User not found or inactive"
                }))),
                Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": format!("Database error: {}", e)
                })))
            }
        },
        Err(e) => Ok(HttpResponse::Unauthorized().json(json!({
            "success": false,
            "error": format!("Invalid or expired refresh token: {}", e)
        })))
    }
}

// ===========================================
// PATIENT MANAGEMENT HANDLERS
// ===========================================

// Generate patient number: PAT-YYYY-XXXX
fn generate_patient_number() -> String {
    let year = Utc::now().format("%Y").to_string();
    let mut rng = rand::thread_rng();
    let random = rng.gen_range(0..10000);
    format!("PAT-{}-{:04}", year, random)
}

// GET /api/patients - List patients with pagination and search
pub async fn get_patients(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let per_page = query.get("per_page").and_then(|v| v.as_i64()).unwrap_or(20);
    let search = query.get("search").and_then(|v| v.as_str());
    let offset = (page - 1) * per_page;

    // Build cache key
    let cache_key = if let Some(search_term) = search {
        format!("patients:search:{}:page:{}:per_page:{}", search_term, page, per_page)
    } else {
        format!("patients:list:page:{}:per_page:{}", page, per_page)
    };

    // Try to get from cache first (only for non-search queries to avoid stale search results)
    if search.is_none() {
        if let Some(cached_response) = get_from_cache::<serde_json::Value>(&state.redis_client, &cache_key).await {
            return Ok(HttpResponse::Ok().json(cached_response));
        }
    }

    let patients_result = if let Some(search_term) = search {
        sqlx::query_as::<_, Patient>(
            "SELECT * FROM patients 
             WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR patient_number ILIKE $1 OR phone ILIKE $1 
             ORDER BY created_at DESC LIMIT $2 OFFSET $3"
        )
        .bind(format!("%{}%", search_term))
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db_pool)
        .await
    } else {
        sqlx::query_as::<_, Patient>(
            "SELECT * FROM patients ORDER BY created_at DESC LIMIT $1 OFFSET $2"
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db_pool)
        .await
    };

    match patients_result {
        Ok(patients) => {
            // Get total count
            let count_result = if let Some(search_term) = search {
                sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM patients 
                     WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR patient_number ILIKE $1 OR phone ILIKE $1"
                )
                .bind(format!("%{}%", search_term))
                .fetch_one(&state.db_pool)
                .await
            } else {
                sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM patients")
                    .fetch_one(&state.db_pool)
                    .await
            };

            let total = count_result.unwrap_or(0);
            let total_pages = ((total as f64) / (per_page as f64)).ceil() as i64;

            let response_data = json!({
                "success": true,
                "data": patients,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "total_pages": total_pages
                }
            });

            // Cache the response (only non-search queries, 5 minutes TTL)
            if search.is_none() {
                set_in_cache(&state.redis_client, &cache_key, &response_data, Duration::from_secs(300)).await;
            }

            Ok(HttpResponse::Ok().json(response_data))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch patients: {}", e)
        })))
    }
}

// GET /api/patients/search - Search patients (alias)
pub async fn search_patients(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    get_patients(query, state).await
}

// GET /api/patients/{id} - Get patient by ID
pub async fn get_patient(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();

    match sqlx::query_as::<_, Patient>("SELECT * FROM patients WHERE id = $1")
        .bind(patient_id)
        .fetch_optional(&state.db_pool)
        .await
    {
        Ok(Some(patient)) => Ok(HttpResponse::Ok().json(json!({
            "success": true,
            "data": patient
        }))),
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Patient not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch patient: {}", e)
        })))
    }
}

// POST /api/patients - Create new patient
pub async fn create_patient(
    patient_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    // Extract and validate required fields
    let first_name = match patient_data.get("first_name").and_then(|v| v.as_str()) {
        Some(name) if !name.is_empty() => name,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "first_name is required"
        })))
    };

    let last_name = match patient_data.get("last_name").and_then(|v| v.as_str()) {
        Some(name) if !name.is_empty() => name,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "last_name is required"
        })))
    };

    // Get age (primary field) or date_of_birth (for backward compatibility)
    let age = patient_data.get("age")
        .and_then(|v| v.as_i64())
        .or_else(|| patient_data.get("age").and_then(|v| v.as_str()).and_then(|s| s.parse::<i64>().ok()))
        .map(|a| a as i32);
    
    // If age is not provided, try to get date_of_birth for backward compatibility
    let date_of_birth = if age.is_none() {
        patient_data.get("date_of_birth")
            .and_then(|v| v.as_str())
            .and_then(|dob_str| NaiveDate::parse_from_str(dob_str, "%Y-%m-%d").ok())
    } else {
        None
    };

    // Require either age or date_of_birth
    if age.is_none() && date_of_birth.is_none() {
        return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "age is required (or date_of_birth for backward compatibility)"
        })))
    }

    let gender = match patient_data.get("gender").and_then(|v| v.as_str()) {
        Some(g) if !g.is_empty() => g,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "gender is required"
        })))
    };

    let phone = match patient_data.get("phone").and_then(|v| v.as_str()) {
        Some(p) if !p.is_empty() => p,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "phone is required"
        })))
    };

    // Optional fields
    let location = patient_data.get("location").and_then(|v| v.as_str());
    let emergency_contact = patient_data.get("emergency_contact").and_then(|v| v.as_str());
    let emergency_phone = patient_data.get("emergency_phone").and_then(|v| v.as_str());
    let blood_type = patient_data.get("blood_type").and_then(|v| v.as_str());
    let medical_history = patient_data.get("medical_history").and_then(|v| v.as_str());
    let insurance_type = patient_data.get("insurance_type").and_then(|v| v.as_str());
    let insurance_number = patient_data.get("insurance_number").and_then(|v| v.as_str());
    let allergies = patient_data.get("allergies").map(|v| serde_json::to_value(v).unwrap_or(serde_json::json!([])));

    // Generate patient number (use provided one if available, otherwise generate)
    let patient_number = patient_data.get("patient_number")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| generate_patient_number());
    let patient_id = Uuid::new_v4();
    let now = Utc::now();

    match sqlx::query_as::<_, Patient>(
        r#"
        INSERT INTO patients (
            id, patient_number, first_name, last_name, age, date_of_birth, gender, phone,
            location, emergency_contact, emergency_phone, blood_type, medical_history,
            allergies, insurance_type, insurance_number, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
        "#
    )
    .bind(patient_id)
    .bind(&patient_number)
    .bind(first_name)
    .bind(last_name)
    .bind(age)
    .bind(date_of_birth.map(|d| d.and_hms_opt(0, 0, 0).unwrap().and_utc()))
    .bind(gender)
    .bind(phone)
    .bind(location)
    .bind(emergency_contact)
    .bind(emergency_phone)
    .bind(blood_type)
    .bind(medical_history)
    .bind(allergies)
    .bind(insurance_type)
    .bind(insurance_number)
    .bind(now)
    .bind(now)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(patient) => {
            // Invalidate patient list cache
            invalidate_cache(&state.redis_client, "patients:list:").await;
            
            // Broadcast patient update via WebSocket
            let _ = websocket::broadcast_patient_update(
                state.websocket_manager.clone(),
                patient.clone(),
                "created"
            ).await;
            
            Ok(HttpResponse::Created().json(json!({
                "success": true,
                "message": "Patient created successfully",
                "data": patient
            })))
        },
        Err(sqlx::Error::Database(db_err)) if db_err.constraint() == Some("patients_patient_number_key") => {
            Ok(HttpResponse::Conflict().json(json!({
                "success": false,
                "error": "Patient number already exists"
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to create patient: {}", e)
        })))
    }
}

// PUT /api/patients/{id} - Update patient
pub async fn update_patient(
    path: web::Path<Uuid>,
    patient_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();

    // Check if patient exists
    match sqlx::query_as::<_, Patient>("SELECT * FROM patients WHERE id = $1")
        .bind(patient_id)
        .fetch_optional(&state.db_pool)
        .await
    {
        Ok(Some(_)) => {},
        Ok(None) => return Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Patient not found"
        }))),
        Err(e) => return Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch patient: {}", e)
        })))
    };

    // Update patient with COALESCE to handle None values
    let updated_patient = match sqlx::query_as::<_, Patient>(
        r#"
        UPDATE patients SET
            first_name = COALESCE($2, first_name),
            last_name = COALESCE($3, last_name),
            date_of_birth = COALESCE($4, date_of_birth),
            gender = COALESCE($5, gender),
            phone = COALESCE($6, phone),
            location = COALESCE($7, location),
            emergency_contact = COALESCE($8, emergency_contact),
            emergency_phone = COALESCE($9, emergency_phone),
            blood_type = COALESCE($10, blood_type),
            medical_history = COALESCE($11, medical_history),
            allergies = COALESCE($12, allergies),
            insurance_type = COALESCE($13, insurance_type),
            insurance_number = COALESCE($14, insurance_number),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#
    )
    .bind(patient_id)
    .bind(patient_data.get("first_name").and_then(|v| v.as_str()))
    .bind(patient_data.get("last_name").and_then(|v| v.as_str()))
    .bind(
        patient_data.get("date_of_birth")
            .and_then(|v| v.as_str())
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
    )
    .bind(patient_data.get("gender").and_then(|v| v.as_str()))
    .bind(patient_data.get("phone").and_then(|v| v.as_str()))
    .bind(patient_data.get("location").and_then(|v| v.as_str()))
    .bind(patient_data.get("emergency_contact").and_then(|v| v.as_str()))
    .bind(patient_data.get("emergency_phone").and_then(|v| v.as_str()))
    .bind(patient_data.get("blood_type").and_then(|v| v.as_str()))
    .bind(patient_data.get("medical_history").and_then(|v| v.as_str()))
    .bind(patient_data.get("allergies").map(|v| serde_json::to_value(v).unwrap_or(serde_json::json!([]))))
    .bind(patient_data.get("insurance_type").and_then(|v| v.as_str()))
    .bind(patient_data.get("insurance_number").and_then(|v| v.as_str()))
    .fetch_optional(&state.db_pool)
    .await
    {
        Ok(Some(patient)) => patient,
        Ok(None) => return Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Patient not found"
        }))),
        Err(e) => return Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to update patient: {}", e)
        })))
    };

    // Invalidate patient list cache and specific patient cache
    invalidate_cache(&state.redis_client, "patients:list:").await;
    invalidate_cache(&state.redis_client, &format!("patient:{}", patient_id)).await;

    // Broadcast patient update via WebSocket
    let _ = websocket::broadcast_patient_update(
        state.websocket_manager.clone(),
        updated_patient.clone(),
        "updated"
    ).await;

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "message": "Patient updated successfully",
        "data": updated_patient
    })))
}

// DELETE /api/patients/{id} - Delete patient
pub async fn delete_patient(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();

    // Check if patient exists and get patient data for broadcast
    match sqlx::query_as::<_, Patient>("SELECT * FROM patients WHERE id = $1")
        .bind(patient_id)
        .fetch_optional(&state.db_pool)
        .await
    {
        Ok(Some(patient)) => {
            match sqlx::query("DELETE FROM patients WHERE id = $1")
                .bind(patient_id)
                .execute(&state.db_pool)
                .await
            {
                Ok(_) => {
                    // Invalidate patient list cache and specific patient cache
                    invalidate_cache(&state.redis_client, "patients:list:").await;
                    invalidate_cache(&state.redis_client, &format!("patient:{}", patient_id)).await;
                    
                    // Broadcast patient deletion via WebSocket
                    let _ = websocket::broadcast_patient_update(
                        state.websocket_manager.clone(),
                        patient,
                        "deleted"
                    ).await;
                    
                    Ok(HttpResponse::Ok().json(json!({
                        "success": true,
                        "message": "Patient deleted successfully"
                    })))
                },
                Err(sqlx::Error::Database(db_err)) if db_err.message().contains("foreign key") => {
                    Ok(HttpResponse::BadRequest().json(json!({
                        "success": false,
                        "error": "Cannot delete patient with existing records (consultations, appointments, etc.)"
                    })))
                },
                Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": format!("Failed to delete patient: {}", e)
                })))
            }
        },
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Patient not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to check patient: {}", e)
        })))
    }
}

// POST /api/patients/import - Import patients from CSV/JSON
pub async fn import_patients(
    import_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let patients_array = match import_data.get("patients").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "data": null,
            "error": "patients array is required",
            "message": "Invalid request"
        })))
    };

    let mut imported = 0;
    let mut errors = Vec::new();

    for (index, patient_data) in patients_array.iter().enumerate() {
        // Prepare patient data with defaults for missing required fields
        let mut processed_patient = patient_data.clone();
        
        // Ensure required fields have defaults if missing
        if !processed_patient.get("first_name").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false) {
            errors.push(format!("Row {}: first_name is required", index + 1));
            continue;
        }
        
        if !processed_patient.get("last_name").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false) {
            errors.push(format!("Row {}: last_name is required", index + 1));
            continue;
        }
        
        // Default age if missing - convert date_of_birth to age if date_of_birth is provided
        if processed_patient.get("age").is_none() {
            // Check if date_of_birth is provided (for backward compatibility)
            if let Some(dob_str) = processed_patient.get("date_of_birth").and_then(|v| v.as_str()) {
                // Calculate age from date_of_birth
                if let Ok(dob) = chrono::NaiveDate::parse_from_str(dob_str, "%Y-%m-%d") {
                    let age = chrono::Utc::now().year() - dob.year();
                    processed_patient["age"] = json!(age);
                } else {
                    // Invalid date, use default age
                    processed_patient["age"] = json!(0);
                }
            } else {
                // No age or date_of_birth provided, use default
                processed_patient["age"] = json!(0);
            }
        }
        
        // Default gender if missing
        if !processed_patient.get("gender").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false) {
            processed_patient["gender"] = json!("Unknown");
        }
        
        // Default phone if missing or "Not provided"
        let phone = processed_patient.get("phone").and_then(|v| v.as_str()).unwrap_or("");
        if phone.is_empty() || phone == "Not provided" {
            processed_patient["phone"] = json!("0000000000"); // Placeholder phone
        }
        
        // Remove patient_number if provided (will be generated or use existing from import)
        // But we'll allow it to be preserved if it's in a specific format
        if let Some(pn) = processed_patient.get("patient_number") {
            // Keep the patient_number if it's provided in import
            // Otherwise, create_patient will generate a new one
        }
        
        // Remove status field (not used by create_patient)
        processed_patient.as_object_mut().and_then(|obj| obj.remove("status"));
        
        // Call create_patient for each patient
        match create_patient(web::Json(processed_patient), state.clone()).await {
            Ok(_) => imported += 1,
            Err(e) => {
                let error_msg = format!("Row {}: Failed to import - {}", index + 1, e);
                errors.push(error_msg);
            }
        }
    }

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "data": {
            "imported": imported,
            "failed": errors.len(),
            "errors": if errors.len() > 10 {
                errors.iter().take(10).cloned().collect::<Vec<_>>()
            } else {
                errors
            }
        },
        "message": format!("Imported {} out of {} patients", imported, patients_array.len())
    })))
}

// ===========================================
// CONSULTATION MANAGEMENT HANDLERS
// ===========================================

// GET /api/consultations - List consultations with pagination and filters
pub async fn get_consultations(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let per_page = query.get("per_page").and_then(|v| v.as_i64()).unwrap_or(20);
    let patient_id = query.get("patient_id").and_then(|v| v.as_str());
    let doctor_id = query.get("doctor_id").and_then(|v| v.as_str());
    let date = query.get("date").and_then(|v| v.as_str());
    let offset = (page - 1) * per_page;

    // Build query based on filters
    let consultations_result = if let Some(patient_id_str) = patient_id {
        if let Ok(patient_uuid) = Uuid::parse_str(patient_id_str) {
            sqlx::query_as::<_, Consultation>(
                "SELECT * FROM consultations 
                 WHERE patient_id = $1 
                 ORDER BY date DESC, time DESC LIMIT $2 OFFSET $3"
            )
            .bind(patient_uuid)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db_pool)
            .await
        } else {
            return Ok(HttpResponse::BadRequest().json(json!({
                "success": false,
                "error": "Invalid patient_id format"
            })));
        }
    } else if let Some(doctor_id_str) = doctor_id {
        if let Ok(doctor_uuid) = Uuid::parse_str(doctor_id_str) {
            sqlx::query_as::<_, Consultation>(
                "SELECT * FROM consultations 
                 WHERE doctor_id = $1 
                 ORDER BY date DESC, time DESC LIMIT $2 OFFSET $3"
            )
            .bind(doctor_uuid)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db_pool)
            .await
        } else {
            return Ok(HttpResponse::BadRequest().json(json!({
                "success": false,
                "error": "Invalid doctor_id format"
            })));
        }
    } else if let Some(date_str) = date {
        if let Ok(consultation_date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            sqlx::query_as::<_, Consultation>(
                "SELECT * FROM consultations 
                 WHERE date = $1 
                 ORDER BY time DESC LIMIT $2 OFFSET $3"
            )
            .bind(consultation_date)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db_pool)
            .await
        } else {
            return Ok(HttpResponse::BadRequest().json(json!({
                "success": false,
                "error": "Invalid date format. Use YYYY-MM-DD"
            })));
        }
    } else {
        sqlx::query_as::<_, Consultation>(
            "SELECT * FROM consultations 
             ORDER BY date DESC, time DESC LIMIT $1 OFFSET $2"
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db_pool)
        .await
    };

    match consultations_result {
        Ok(consultations) => {
            // Get total count
            let count_result = if let Some(patient_id_str) = patient_id {
                if let Ok(patient_uuid) = Uuid::parse_str(patient_id_str) {
                    sqlx::query_scalar::<_, i64>(
                        "SELECT COUNT(*) FROM consultations WHERE patient_id = $1"
                    )
                    .bind(patient_uuid)
                    .fetch_one(&state.db_pool)
                    .await
                } else {
                    Ok(0)
                }
            } else if let Some(doctor_id_str) = doctor_id {
                if let Ok(doctor_uuid) = Uuid::parse_str(doctor_id_str) {
                    sqlx::query_scalar::<_, i64>(
                        "SELECT COUNT(*) FROM consultations WHERE doctor_id = $1"
                    )
                    .bind(doctor_uuid)
                    .fetch_one(&state.db_pool)
                    .await
                } else {
                    Ok(0)
                }
            } else if let Some(date_str) = date {
                if let Ok(consultation_date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                    sqlx::query_scalar::<_, i64>(
                        "SELECT COUNT(*) FROM consultations WHERE date = $1"
                    )
                    .bind(consultation_date)
                    .fetch_one(&state.db_pool)
                    .await
                } else {
                    Ok(0)
                }
            } else {
                sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM consultations")
                    .fetch_one(&state.db_pool)
                    .await
            };

            let total = count_result.unwrap_or(0);
            let total_pages = ((total as f64) / (per_page as f64)).ceil() as i64;

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": consultations,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "total_pages": total_pages
                }
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch consultations: {}", e)
        })))
    }
}

// GET /api/consultations/patient/{patientId} - Get consultations for a specific patient
pub async fn get_patient_consultations(
    path: web::Path<Uuid>,
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();
    
    // Use the same handler but with patient_id from path
    let mut query_params = serde_json::json!({});
    query_params["patient_id"] = json!(patient_id.to_string());
    query_params["page"] = query.get("page").cloned().unwrap_or(json!(1));
    query_params["per_page"] = query.get("per_page").cloned().unwrap_or(json!(20));
    
    get_consultations(web::Query(query_params), state).await
}

// GET /api/consultations/{id} - Get consultation by ID
pub async fn get_consultation(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let consultation_id = path.into_inner();

    match sqlx::query_as::<_, Consultation>("SELECT * FROM consultations WHERE id = $1")
        .bind(consultation_id)
        .fetch_optional(&state.db_pool)
        .await
    {
        Ok(Some(consultation)) => Ok(HttpResponse::Ok().json(json!({
            "success": true,
            "data": consultation
        }))),
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Consultation not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch consultation: {}", e)
        })))
    }
}

// POST /api/consultations - Create new consultation
pub async fn create_consultation(
    consultation_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    // Extract and validate required fields
    let patient_id_str = match consultation_data.get("patient_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "patient_id is required"
        })))
    };

    let patient_id = match Uuid::parse_str(patient_id_str) {
        Ok(id) => id,
        Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Invalid patient_id format"
        })))
    };

    let doctor_id_str = match consultation_data.get("doctor_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "doctor_id is required"
        })))
    };

    let doctor_id = match Uuid::parse_str(doctor_id_str) {
        Ok(id) => id,
        Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Invalid doctor_id format"
        })))
    };

    let date_str = match consultation_data.get("date").and_then(|v| v.as_str()) {
        Some(d) => d,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "date is required (format: YYYY-MM-DD)"
        })))
    };

    let date = match NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Invalid date format. Use YYYY-MM-DD"
        })))
    };

    let time_str = match consultation_data.get("time").and_then(|v| v.as_str()) {
        Some(t) => t,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "time is required (format: HH:MM:SS)"
        })))
    };

    let time = match chrono::NaiveTime::parse_from_str(time_str, "%H:%M:%S") {
        Ok(t) => t,
        Err(_) => {
            // Try HH:MM format
            match chrono::NaiveTime::parse_from_str(time_str, "%H:%M") {
                Ok(t) => t,
                Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
                    "success": false,
                    "error": "Invalid time format. Use HH:MM or HH:MM:SS"
                })))
            }
        }
    };

    let chief_complaint = match consultation_data.get("chief_complaint").and_then(|v| v.as_str()) {
        Some(cc) if !cc.is_empty() => cc,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "chief_complaint is required"
        })))
    };

    // Optional fields
    let diagnosis = consultation_data.get("diagnosis").and_then(|v| v.as_str());
    let treatment_plan = consultation_data.get("treatment_plan").and_then(|v| v.as_str());
    let notes = consultation_data.get("notes").and_then(|v| v.as_str());
    let status = consultation_data.get("status").and_then(|v| v.as_str()).unwrap_or("scheduled");

    let consultation_id = Uuid::new_v4();
    let now = Utc::now();

    match sqlx::query_as::<_, Consultation>(
        r#"
        INSERT INTO consultations (
            id, patient_id, doctor_id, date, time, chief_complaint,
            diagnosis, treatment_plan, notes, status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
        "#
    )
    .bind(consultation_id)
    .bind(patient_id)
    .bind(doctor_id)
    .bind(date)
    .bind(time)
    .bind(chief_complaint)
    .bind(diagnosis)
    .bind(treatment_plan)
    .bind(notes)
    .bind(status)
    .bind(now)
    .bind(now)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(consultation) => Ok(HttpResponse::Created().json(json!({
            "success": true,
            "message": "Consultation created successfully",
            "data": consultation
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to create consultation: {}", e)
        })))
    }
}

// PUT /api/consultations/{id} - Update consultation
pub async fn update_consultation(
    path: web::Path<Uuid>,
    consultation_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let consultation_id = path.into_inner();

    // Check if consultation exists
    match sqlx::query_as::<_, Consultation>("SELECT * FROM consultations WHERE id = $1")
        .bind(consultation_id)
        .fetch_optional(&state.db_pool)
        .await
    {
        Ok(Some(_)) => {},
        Ok(None) => return Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Consultation not found"
        }))),
        Err(e) => return Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch consultation: {}", e)
        })))
    };

    // Parse optional fields
    let date = consultation_data.get("date")
        .and_then(|v| v.as_str())
        .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    
    let time = consultation_data.get("time")
        .and_then(|v| v.as_str())
        .and_then(|s| {
            chrono::NaiveTime::parse_from_str(s, "%H:%M:%S").ok()
                .or_else(|| chrono::NaiveTime::parse_from_str(s, "%H:%M").ok())
        });

    let updated_consultation = match sqlx::query_as::<_, Consultation>(
        r#"
        UPDATE consultations SET
            patient_id = COALESCE($2, patient_id),
            doctor_id = COALESCE($3, doctor_id),
            date = COALESCE($4, date),
            time = COALESCE($5, time),
            chief_complaint = COALESCE($6, chief_complaint),
            diagnosis = COALESCE($7, diagnosis),
            treatment_plan = COALESCE($8, treatment_plan),
            notes = COALESCE($9, notes),
            status = COALESCE($10, status),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#
    )
    .bind(consultation_id)
    .bind(
        consultation_data.get("patient_id")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok())
    )
    .bind(
        consultation_data.get("doctor_id")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok())
    )
    .bind(date)
    .bind(time)
    .bind(consultation_data.get("chief_complaint").and_then(|v| v.as_str()))
    .bind(consultation_data.get("diagnosis").and_then(|v| v.as_str()))
    .bind(consultation_data.get("treatment_plan").and_then(|v| v.as_str()))
    .bind(consultation_data.get("notes").and_then(|v| v.as_str()))
    .bind(consultation_data.get("status").and_then(|v| v.as_str()))
    .fetch_optional(&state.db_pool)
    .await
    {
        Ok(Some(consultation)) => consultation,
        Ok(None) => return Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Consultation not found"
        }))),
        Err(e) => return Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to update consultation: {}", e)
        })))
    };

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "message": "Consultation updated successfully",
        "data": updated_consultation
    })))
}

// DELETE /api/consultations/{id} - Delete consultation
pub async fn delete_consultation(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let consultation_id = path.into_inner();

    // Check if consultation exists
    match sqlx::query_as::<_, Consultation>("SELECT * FROM consultations WHERE id = $1")
        .bind(consultation_id)
        .fetch_optional(&state.db_pool)
        .await
    {
        Ok(Some(_)) => {
            match sqlx::query("DELETE FROM consultations WHERE id = $1")
                .bind(consultation_id)
                .execute(&state.db_pool)
                .await
            {
                Ok(_) => Ok(HttpResponse::Ok().json(json!({
                    "success": true,
                    "message": "Consultation deleted successfully"
                }))),
                Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": format!("Failed to delete consultation: {}", e)
                })))
            }
        },
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Consultation not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to check consultation: {}", e)
        })))
    }
}

// ===========================================
// APPOINTMENT MANAGEMENT HANDLERS
// ===========================================

// Check for appointment conflicts (overlapping appointments for same doctor)
async fn check_appointment_conflict(
    doctor_id: Uuid,
    date: NaiveDate,
    time: NaiveTime,
    duration: i32,
    exclude_id: Option<Uuid>,
    db_pool: &sqlx::PgPool,
) -> Result<Option<String>, sqlx::Error> {
    // Check for overlapping appointments using time range comparison
    // An appointment conflicts if:
    // 1. Same doctor
    // 2. Same date
    // 3. Times overlap (start_new < end_existing AND end_new > start_existing)
    
    let conflict_query = if let Some(exclude) = exclude_id {
        sqlx::query_scalar::<_, Option<String>>(
            r#"
            SELECT pt.first_name || ' ' || pt.last_name || ' at ' || a.time::text
            FROM appointments a
            JOIN patients pt ON a.patient_id = pt.id
            WHERE a.doctor_id = $1
              AND a.date = $2
              AND a.id != $5
              AND a.status NOT IN ('cancelled', 'completed')
              AND (
                (EXTRACT(EPOCH FROM (a.time::time)) / 60) < (EXTRACT(EPOCH FROM ($3::time)) / 60) + $4
                AND
                (EXTRACT(EPOCH FROM (a.time::time)) / 60) + a.duration > (EXTRACT(EPOCH FROM ($3::time)) / 60)
              )
            LIMIT 1
            "#
        )
        .bind(doctor_id)
        .bind(date)
        .bind(time)
        .bind(duration)
        .bind(exclude)
        .fetch_optional(db_pool)
        .await
    } else {
        sqlx::query_scalar::<_, Option<String>>(
            r#"
            SELECT pt.first_name || ' ' || pt.last_name || ' at ' || a.time::text
            FROM appointments a
            JOIN patients pt ON a.patient_id = pt.id
            WHERE a.doctor_id = $1
              AND a.date = $2
              AND a.status NOT IN ('cancelled', 'completed')
              AND (
                (EXTRACT(EPOCH FROM (a.time::time)) / 60) < (EXTRACT(EPOCH FROM ($3::time)) / 60) + $4
                AND
                (EXTRACT(EPOCH FROM (a.time::time)) / 60) + a.duration > (EXTRACT(EPOCH FROM ($3::time)) / 60)
              )
            LIMIT 1
            "#
        )
        .bind(doctor_id)
        .bind(date)
        .bind(time)
        .bind(duration)
        .fetch_optional(db_pool)
        .await
    };

    conflict_query.map(|opt| opt.flatten())
}

// GET /api/appointments - List appointments with pagination and filters
pub async fn get_appointments(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let per_page = query.get("per_page").and_then(|v| v.as_i64()).unwrap_or(20);
    let patient_id = query.get("patient_id").and_then(|v| v.as_str());
    let doctor_id = query.get("doctor_id").and_then(|v| v.as_str());
    let date = query.get("date").and_then(|v| v.as_str());
    let status = query.get("status").and_then(|v| v.as_str());
    let offset = (page - 1) * per_page;

    // Build cache key (only cache simple list queries without filters)
    let cache_key = if patient_id.is_none() && doctor_id.is_none() && date.is_none() && status.is_none() {
        Some(format!("appointments:list:page:{}:per_page:{}", page, per_page))
    } else {
        None
    };

    // Try to get from cache for simple queries
    if let Some(ref key) = cache_key {
        if let Some(cached_response) = get_from_cache::<serde_json::Value>(&state.redis_client, key).await {
            return Ok(HttpResponse::Ok().json(cached_response));
        }
    }

    // Build query with proper column aliasing for Appointment model
    let appointments_result = if let Some(patient_id_str) = patient_id {
        if let Ok(patient_uuid) = Uuid::parse_str(patient_id_str) {
            sqlx::query(
                "SELECT id, patient_id, doctor_id, date as appointment_date, time as appointment_time, 
                 duration, status, notes, created_at, updated_at
                 FROM appointments 
                 WHERE patient_id = $1 
                 ORDER BY date DESC, time DESC LIMIT $2 OFFSET $3"
            )
            .bind(patient_uuid)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db_pool)
            .await
        } else {
            return Ok(HttpResponse::BadRequest().json(json!({
                "success": false,
                "error": "Invalid patient_id format"
            })));
        }
    } else if let Some(doctor_id_str) = doctor_id {
        if let Ok(doctor_uuid) = Uuid::parse_str(doctor_id_str) {
            sqlx::query(
                "SELECT id, patient_id, doctor_id, date as appointment_date, time as appointment_time, 
                 duration, status, notes, created_at, updated_at
                 FROM appointments 
                 WHERE doctor_id = $1 
                 ORDER BY date DESC, time DESC LIMIT $2 OFFSET $3"
            )
            .bind(doctor_uuid)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db_pool)
            .await
        } else {
            return Ok(HttpResponse::BadRequest().json(json!({
                "success": false,
                "error": "Invalid doctor_id format"
            })));
        }
    } else if let Some(date_str) = date {
        if let Ok(appointment_date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            sqlx::query(
                "SELECT id, patient_id, doctor_id, date as appointment_date, time as appointment_time, 
                 duration, status, notes, created_at, updated_at
                 FROM appointments 
                 WHERE date = $1 
                 ORDER BY time ASC LIMIT $2 OFFSET $3"
            )
            .bind(appointment_date)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db_pool)
            .await
        } else {
            return Ok(HttpResponse::BadRequest().json(json!({
                "success": false,
                "error": "Invalid date format. Use YYYY-MM-DD"
            })));
        }
    } else {
        // Apply status filter if provided
        if let Some(status_filter) = status {
            sqlx::query(
                "SELECT id, patient_id, doctor_id, date as appointment_date, time as appointment_time, 
                 duration, status, notes, created_at, updated_at
                 FROM appointments 
                 WHERE status = $3
                 ORDER BY date DESC, time DESC LIMIT $1 OFFSET $2"
            )
            .bind(per_page)
            .bind(offset)
            .bind(status_filter)
            .fetch_all(&state.db_pool)
            .await
        } else {
            sqlx::query(
                "SELECT id, patient_id, doctor_id, date as appointment_date, time as appointment_time, 
                 duration, status, notes, created_at, updated_at
                 FROM appointments 
                 ORDER BY date DESC, time DESC LIMIT $1 OFFSET $2"
            )
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db_pool)
            .await
        }
    };

    match appointments_result {
        Ok(rows) => {
            let appointments: Vec<serde_json::Value> = rows.iter().map(|row| {
                json!({
                    "id": row.get::<Uuid, &str>("id"),
                    "patient_id": row.get::<Uuid, &str>("patient_id"),
                    "doctor_id": row.get::<Uuid, &str>("doctor_id"),
                    "appointment_date": row.get::<NaiveDate, &str>("appointment_date"),
                    "appointment_time": row.get::<NaiveTime, _>("appointment_time"),
                    "duration": row.get::<Option<i32>, _>("duration").unwrap_or(30),
                    "status": row.get::<String, &str>("status"),
                    "notes": row.get::<Option<String>, &str>("notes"),
                    "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
                })
            }).collect();

            // Get total count (simplified for now)
            let count_result = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM appointments")
                .fetch_one(&state.db_pool)
                .await;

            let total = count_result.unwrap_or(0);
            let total_pages = ((total as f64) / (per_page as f64)).ceil() as i64;

            let response_data = json!({
                "success": true,
                "data": appointments,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "total_pages": total_pages
                }
            });

            // Cache the response for simple queries (3 minutes TTL)
            if let Some(ref key) = cache_key {
                set_in_cache(&state.redis_client, key, &response_data, Duration::from_secs(180)).await;
            }

            Ok(HttpResponse::Ok().json(response_data))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch appointments: {}", e)
        })))
    }
}

// GET /api/appointments/date/{date} - Get appointments for a specific date
pub async fn get_appointments_by_date(
    path: web::Path<String>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let date_str = path.into_inner();
    
    let date = match NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Invalid date format. Use YYYY-MM-DD"
        })))
    };

    match sqlx::query(
        "SELECT id, patient_id, doctor_id, date as appointment_date, time as appointment_time, 
         duration, status, notes, created_at, updated_at
         FROM appointments 
         WHERE date = $1 
         ORDER BY time ASC"
    )
    .bind(date)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(rows) => {
            let appointments: Vec<serde_json::Value> = rows.iter().map(|row| {
                json!({
                    "id": row.get::<Uuid, &str>("id"),
                    "patient_id": row.get::<Uuid, &str>("patient_id"),
                    "doctor_id": row.get::<Uuid, &str>("doctor_id"),
                    "appointment_date": row.get::<NaiveDate, &str>("appointment_date"),
                    "appointment_time": row.get::<NaiveTime, _>("appointment_time"),
                    "duration": row.get::<Option<i32>, _>("duration").unwrap_or(30),
                    "status": row.get::<String, &str>("status"),
                    "notes": row.get::<Option<String>, &str>("notes"),
                    "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
                })
            }).collect();

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": appointments,
                "date": date_str
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch appointments: {}", e)
        })))
    }
}

// GET /api/appointments/{id} - Get appointment by ID
pub async fn get_appointment(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let appointment_id = path.into_inner();

    match sqlx::query(
        "SELECT id, patient_id, doctor_id, date as appointment_date, time as appointment_time, 
         duration, status, notes, created_at, updated_at
         FROM appointments WHERE id = $1"
    )
    .bind(appointment_id)
    .fetch_optional(&state.db_pool)
    .await
    {
        Ok(Some(row)) => {
            let appointment = json!({
                "id": row.get::<Uuid, &str>("id"),
                "patient_id": row.get::<Uuid, &str>("patient_id"),
                "doctor_id": row.get::<Uuid, &str>("doctor_id"),
                "appointment_date": row.get::<NaiveDate, &str>("appointment_date"),
                "appointment_time": row.get::<NaiveTime, _>("appointment_time"),
                "duration": row.get::<Option<i32>, _>("duration").unwrap_or(30),
                "status": row.get::<String, &str>("status"),
                "notes": row.get::<Option<String>, &str>("notes"),
                "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
            });

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": appointment
            })))
        },
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Appointment not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch appointment: {}", e)
        })))
    }
}

// POST /api/appointments - Create new appointment with conflict detection
pub async fn create_appointment(
    appointment_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    // Extract and validate required fields
    let patient_id_str = match appointment_data.get("patient_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "patient_id is required"
        })))
    };

    let patient_id = match Uuid::parse_str(patient_id_str) {
        Ok(id) => id,
        Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Invalid patient_id format"
        })))
    };

    let doctor_id_str = match appointment_data.get("doctor_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "doctor_id is required"
        })))
    };

    let doctor_id = match Uuid::parse_str(doctor_id_str) {
        Ok(id) => id,
        Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Invalid doctor_id format"
        })))
    };

    let date_str = match appointment_data.get("date").and_then(|v| v.as_str()) {
        Some(d) => d,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "date is required (format: YYYY-MM-DD)"
        })))
    };

    let date = match NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Invalid date format. Use YYYY-MM-DD"
        })))
    };

    let time_str = match appointment_data.get("time").and_then(|v| v.as_str()) {
        Some(t) => t,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "time is required (format: HH:MM:SS)"
        })))
    };

    let time = match NaiveTime::parse_from_str(time_str, "%H:%M:%S") {
        Ok(t) => t,
        Err(_) => {
            match NaiveTime::parse_from_str(time_str, "%H:%M") {
                Ok(t) => t,
                Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
                    "success": false,
                    "error": "Invalid time format. Use HH:MM or HH:MM:SS"
                })))
            }
        }
    };

    let duration = appointment_data.get("duration")
        .and_then(|v| v.as_i64())
        .unwrap_or(30) as i32;

    let notes = appointment_data.get("notes").and_then(|v| v.as_str());
    let status = appointment_data.get("status").and_then(|v| v.as_str()).unwrap_or("scheduled");

    // Check for conflicts
    match check_appointment_conflict(doctor_id, date, time, duration, None, &state.db_pool).await {
        Ok(Some(conflict_info)) => {
            return Ok(HttpResponse::Conflict().json(json!({
                "success": false,
                "error": format!("Appointment conflict: Doctor has an appointment with {}", conflict_info),
                "conflict": true
            })));
        },
        Ok(None) => {}, // No conflict, continue
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to check conflicts: {}", e)
            })));
        }
    }

    let appointment_id = Uuid::new_v4();
    let now = Utc::now();

    match sqlx::query(
        r#"
        INSERT INTO appointments (
            id, patient_id, doctor_id, date, time, duration, status, notes, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, patient_id, doctor_id, date as appointment_date, time as appointment_time, 
                   duration, status, notes, created_at, updated_at
        "#
    )
    .bind(appointment_id)
    .bind(patient_id)
    .bind(doctor_id)
    .bind(date)
    .bind(time)
    .bind(duration)
    .bind(status)
    .bind(notes)
    .bind(now)
    .bind(now)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(row) => {
            let appointment = json!({
                "id": row.get::<Uuid, &str>("id"),
                "patient_id": row.get::<Uuid, &str>("patient_id"),
                "doctor_id": row.get::<Uuid, &str>("doctor_id"),
                "appointment_date": row.get::<NaiveDate, &str>("appointment_date"),
                "appointment_time": row.get::<NaiveTime, _>("appointment_time"),
                "duration": row.get::<Option<i32>, _>("duration").unwrap_or(30),
                "status": row.get::<String, &str>("status"),
                "notes": row.get::<Option<String>, &str>("notes"),
                "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
            });

            // Invalidate appointment list cache
            invalidate_cache(&state.redis_client, "appointments:list:").await;

            // Broadcast appointment update via WebSocket (using JSON directly)
            let _ = websocket::broadcast_appointment_update_json(
                state.websocket_manager.clone(),
                appointment.clone(),
                "created"
            ).await;

            Ok(HttpResponse::Created().json(json!({
                "success": true,
                "message": "Appointment created successfully",
                "data": appointment
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to create appointment: {}", e)
        })))
    }
}

// PUT /api/appointments/{id} - Update appointment with conflict detection
pub async fn update_appointment(
    path: web::Path<Uuid>,
    appointment_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let appointment_id = path.into_inner();

    // Check if appointment exists
    match sqlx::query("SELECT * FROM appointments WHERE id = $1")
        .bind(appointment_id)
        .fetch_optional(&state.db_pool)
        .await
    {
        Ok(Some(_)) => {},
        Ok(None) => return Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Appointment not found"
        }))),
        Err(e) => return Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch appointment: {}", e)
        })))
    };

    // Extract fields to update
    let doctor_id = appointment_data.get("doctor_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    
    let date = appointment_data.get("date")
        .and_then(|v| v.as_str())
        .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    
    let time = appointment_data.get("time")
        .and_then(|v| v.as_str())
        .and_then(|s| {
            NaiveTime::parse_from_str(s, "%H:%M:%S").ok()
                .or_else(|| NaiveTime::parse_from_str(s, "%H:%M").ok())
        });
    
    let duration = appointment_data.get("duration")
        .and_then(|v| v.as_i64())
        .map(|d| d as i32);

    // If time/date/doctor changed, check for conflicts
    if let (Some(doc_id), Some(appt_date), Some(appt_time), Some(appt_duration)) = (doctor_id, date, time, duration) {
        match check_appointment_conflict(doc_id, appt_date, appt_time, appt_duration, Some(appointment_id), &state.db_pool).await {
            Ok(Some(conflict_info)) => {
                return Ok(HttpResponse::Conflict().json(json!({
                    "success": false,
                    "error": format!("Appointment conflict: Doctor has an appointment with {}", conflict_info),
                    "conflict": true
                })));
            },
            Ok(None) => {}, // No conflict, continue
            Err(e) => {
                return Ok(HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": format!("Failed to check conflicts: {}", e)
                })));
            }
        }
    }

    // Update appointment
    match sqlx::query(
        r#"
        UPDATE appointments SET
            patient_id = COALESCE($2, patient_id),
            doctor_id = COALESCE($3, doctor_id),
            date = COALESCE($4, date),
            time = COALESCE($5, time),
            duration = COALESCE($6, duration),
            status = COALESCE($7, status),
            notes = COALESCE($8, notes),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, patient_id, doctor_id, date as appointment_date, time as appointment_time, 
                   duration, status, notes, created_at, updated_at
        "#
    )
    .bind(appointment_id)
    .bind(
        appointment_data.get("patient_id")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok())
    )
    .bind(doctor_id)
    .bind(date)
    .bind(time)
    .bind(duration)
    .bind(appointment_data.get("status").and_then(|v| v.as_str()))
    .bind(appointment_data.get("notes").and_then(|v| v.as_str()))
    .fetch_optional(&state.db_pool)
    .await
    {
        Ok(Some(row)) => {
            let appointment = json!({
                "id": row.get::<Uuid, &str>("id"),
                "patient_id": row.get::<Uuid, &str>("patient_id"),
                "doctor_id": row.get::<Uuid, &str>("doctor_id"),
                "appointment_date": row.get::<NaiveDate, &str>("appointment_date"),
                "appointment_time": row.get::<NaiveTime, _>("appointment_time"),
                "duration": row.get::<Option<i32>, _>("duration").unwrap_or(30),
                "status": row.get::<String, &str>("status"),
                "notes": row.get::<Option<String>, &str>("notes"),
                "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
            });

            // Invalidate appointment list cache
            invalidate_cache(&state.redis_client, "appointments:list:").await;

            // Broadcast appointment update via WebSocket (using JSON directly)
            let _ = websocket::broadcast_appointment_update_json(
                state.websocket_manager.clone(),
                appointment.clone(),
                "updated"
            ).await;

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "message": "Appointment updated successfully",
                "data": appointment
            })))
        },
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Appointment not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to update appointment: {}", e)
        })))
    }
}

// DELETE /api/appointments/{id} - Delete appointment
pub async fn delete_appointment(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let appointment_id = path.into_inner();

    // Check if appointment exists - get data for broadcast
    match sqlx::query(
        "SELECT id, patient_id, doctor_id, date as appointment_date, time as appointment_time, 
         duration, status, notes, created_at, updated_at
         FROM appointments WHERE id = $1"
    )
    .bind(appointment_id)
    .fetch_optional(&state.db_pool)
    .await
    {
        Ok(Some(row)) => {
            let appointment_json = json!({
                "id": row.get::<Uuid, &str>("id"),
                "patient_id": row.get::<Uuid, &str>("patient_id"),
                "doctor_id": row.get::<Uuid, &str>("doctor_id"),
                "appointment_date": row.get::<NaiveDate, &str>("appointment_date"),
                "appointment_time": row.get::<NaiveTime, _>("appointment_time"),
                "status": row.get::<String, &str>("status"),
                "notes": row.get::<Option<String>, &str>("notes"),
            });

            match sqlx::query("DELETE FROM appointments WHERE id = $1")
                .bind(appointment_id)
                .execute(&state.db_pool)
                .await
            {
                Ok(_) => {
                    // Invalidate appointment list cache
                    invalidate_cache(&state.redis_client, "appointments:list:").await;
                    
                    // Broadcast appointment deletion via WebSocket
                    let _ = websocket::broadcast_appointment_update_json(
                        state.websocket_manager.clone(),
                        appointment_json,
                        "deleted"
                    ).await;
                    
                    Ok(HttpResponse::Ok().json(json!({
                        "success": true,
                        "message": "Appointment deleted successfully"
                    })))
                },
                Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": format!("Failed to delete appointment: {}", e)
                })))
            }
        },
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Appointment not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to check appointment: {}", e)
        })))
    }
}

// ===========================================
// BILLING & INVOICE MANAGEMENT HANDLERS
// ===========================================

// Helper function to generate invoice number
fn generate_invoice_number() -> String {
    let now = Utc::now();
    let random_num = rand::thread_rng().gen_range(0..10000);
    format!("INV-{}-{:04}", now.format("%Y%m%d"), random_num)
}

// GET /api/invoices - List invoices with pagination and filters
pub async fn get_invoices(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let per_page = query.get("per_page").and_then(|v| v.as_i64()).unwrap_or(20);
    let patient_id = query.get("patient_id").and_then(|v| v.as_str());
    let payment_status = query.get("payment_status").and_then(|v| v.as_str());
    let date_from = query.get("date_from").and_then(|v| v.as_str());
    let date_to = query.get("date_to").and_then(|v| v.as_str());
    let offset = (page - 1) * per_page;

    // Build optimized query with proper WHERE clauses (uses indexes)
    // Use conditional query building based on filters for optimal performance
    let invoices_result = if let Some(pid_str) = patient_id {
        if let Ok(pid) = Uuid::parse_str(pid_str) {
            // Filter by patient_id - uses idx_invoices_patient_id
            sqlx::query(
                "SELECT i.id, i.patient_id, i.invoice_number, i.date, i.items, 
                        i.subtotal, i.tax_amount, i.total_amount, i.payment_status, 
                        i.payment_method, i.created_at, i.updated_at,
                        p.first_name, p.last_name, p.phone
                 FROM invoices i
                 LEFT JOIN patients p ON i.patient_id = p.id
                 WHERE i.patient_id = $1
                 ORDER BY i.created_at DESC
                 LIMIT $2 OFFSET $3"
            )
            .bind(pid)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db_pool)
            .await
        } else {
            return Ok(HttpResponse::BadRequest().json(json!({
                "success": false,
                "error": "Invalid patient_id format"
            })));
        }
    } else if let Some(status) = payment_status {
        // Filter by payment_status - uses idx_invoices_payment_status
        sqlx::query(
            "SELECT i.id, i.patient_id, i.invoice_number, i.date, i.items, 
                    i.subtotal, i.tax_amount, i.total_amount, i.payment_status, 
                    i.payment_method, i.created_at, i.updated_at,
                    p.first_name, p.last_name, p.phone
             FROM invoices i
             LEFT JOIN patients p ON i.patient_id = p.id
             WHERE i.payment_status = $1
             ORDER BY i.created_at DESC
             LIMIT $2 OFFSET $3"
        )
        .bind(status)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db_pool)
        .await
    } else if let Some(df_str) = date_from {
        if let Ok(df) = NaiveDate::parse_from_str(df_str, "%Y-%m-%d") {
            // Filter by date_from - uses idx_invoices_date
            let query_str = if let Some(dt_str) = date_to {
                if let Ok(dt) = NaiveDate::parse_from_str(dt_str, "%Y-%m-%d") {
                    // Date range query
                    "SELECT i.id, i.patient_id, i.invoice_number, i.date, i.items, 
                            i.subtotal, i.tax_amount, i.total_amount, i.payment_status, 
                            i.payment_method, i.created_at, i.updated_at,
                            p.first_name, p.last_name, p.phone
                     FROM invoices i
                     LEFT JOIN patients p ON i.patient_id = p.id
                     WHERE i.date >= $1 AND i.date <= $2
                     ORDER BY i.created_at DESC
                     LIMIT $3 OFFSET $4"
                } else {
                    return Ok(HttpResponse::BadRequest().json(json!({
                        "success": false,
                        "error": "Invalid date_to format"
                    })));
                }
            } else {
                "SELECT i.id, i.patient_id, i.invoice_number, i.date, i.items, 
                        i.subtotal, i.tax_amount, i.total_amount, i.payment_status, 
                        i.payment_method, i.created_at, i.updated_at,
                        p.first_name, p.last_name, p.phone
                 FROM invoices i
                 LEFT JOIN patients p ON i.patient_id = p.id
                 WHERE i.date >= $1
                 ORDER BY i.created_at DESC
                 LIMIT $2 OFFSET $3"
            };
            
            if let Some(dt_str) = date_to {
                if let Ok(dt) = NaiveDate::parse_from_str(dt_str, "%Y-%m-%d") {
                    sqlx::query(query_str)
                        .bind(df)
                        .bind(dt)
                        .bind(per_page)
                        .bind(offset)
                        .fetch_all(&state.db_pool)
                        .await
                } else {
                    return Ok(HttpResponse::BadRequest().json(json!({
                        "success": false,
                        "error": "Invalid date_to format"
                    })));
                }
            } else {
                sqlx::query(query_str)
                    .bind(df)
                    .bind(per_page)
                    .bind(offset)
                    .fetch_all(&state.db_pool)
                    .await
            }
        } else {
            return Ok(HttpResponse::BadRequest().json(json!({
                "success": false,
                "error": "Invalid date_from format"
            })));
        }
    } else if let Some(dt_str) = date_to {
        if let Ok(dt) = NaiveDate::parse_from_str(dt_str, "%Y-%m-%d") {
            // Filter by date_to only - uses idx_invoices_date
            sqlx::query(
                "SELECT i.id, i.patient_id, i.invoice_number, i.date, i.items, 
                        i.subtotal, i.tax_amount, i.total_amount, i.payment_status, 
                        i.payment_method, i.created_at, i.updated_at,
                        p.first_name, p.last_name, p.phone
                 FROM invoices i
                 LEFT JOIN patients p ON i.patient_id = p.id
                 WHERE i.date <= $1
                 ORDER BY i.created_at DESC
                 LIMIT $2 OFFSET $3"
            )
            .bind(dt)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db_pool)
            .await
        } else {
            return Ok(HttpResponse::BadRequest().json(json!({
                "success": false,
                "error": "Invalid date_to format"
            })));
        }
    } else {
        // No filters - simple query using idx_invoices_created_at
        sqlx::query(
            "SELECT i.id, i.patient_id, i.invoice_number, i.date, i.items, 
                    i.subtotal, i.tax_amount, i.total_amount, i.payment_status, 
                    i.payment_method, i.created_at, i.updated_at,
                    p.first_name, p.last_name, p.phone
             FROM invoices i
             LEFT JOIN patients p ON i.patient_id = p.id
             ORDER BY i.created_at DESC
             LIMIT $1 OFFSET $2"
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db_pool)
        .await
    };

    match invoices_result {
        Ok(rows) => {
            let invoices: Vec<serde_json::Value> = rows.iter().map(|row| {
                json!({
                    "id": row.try_get::<Uuid, _>("id").unwrap_or_default(),
                    "patient_id": row.try_get::<Uuid, _>("patient_id").unwrap_or_default(),
                    "invoice_number": row.try_get::<String, _>("invoice_number").unwrap_or_default(),
                    "date": row.try_get::<NaiveDate, _>("date").unwrap_or_default(),
                    "items": row.try_get::<serde_json::Value, _>("items").unwrap_or(serde_json::json!(null)),
                    "subtotal": row.try_get::<f64, _>("subtotal").unwrap_or(0.0),
                    "tax_amount": row.try_get::<f64, _>("tax_amount").unwrap_or(0.0),
                    "total_amount": row.try_get::<f64, _>("total_amount").unwrap_or(0.0),
                    "payment_status": row.try_get::<String, _>("payment_status").unwrap_or_default(),
                    "payment_method": row.try_get::<Option<String>, _>("payment_method").ok().flatten(),
                    "patient_name": format!("{} {}", 
                        row.try_get::<Option<String>, _>("first_name").ok().flatten().unwrap_or_default(),
                        row.try_get::<Option<String>, _>("last_name").ok().flatten().unwrap_or_default()
                    ),
                    "patient_phone": row.try_get::<Option<String>, _>("phone").ok().flatten().unwrap_or_default(),
                    "created_at": row.try_get::<chrono::DateTime<Utc>, _>("created_at").unwrap_or_default(),
                    "updated_at": row.try_get::<chrono::DateTime<Utc>, _>("updated_at").unwrap_or_default()
                })
            }).collect();

            // Get total count with same filters (optimized)
            let count_result = if let Some(pid_str) = patient_id {
                if let Ok(pid) = Uuid::parse_str(pid_str) {
                    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM invoices WHERE patient_id = $1")
                        .bind(pid)
                        .fetch_one(&state.db_pool)
                        .await
                } else {
                    Ok(0)
                }
            } else if let Some(status) = payment_status {
                sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM invoices WHERE payment_status = $1")
                    .bind(status)
                    .fetch_one(&state.db_pool)
                    .await
            } else if let Some(df_str) = date_from {
                if let Ok(df) = NaiveDate::parse_from_str(df_str, "%Y-%m-%d") {
                    if let Some(dt_str) = date_to {
                        if let Ok(dt) = NaiveDate::parse_from_str(dt_str, "%Y-%m-%d") {
                            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM invoices WHERE date >= $1 AND date <= $2")
                                .bind(df)
                                .bind(dt)
                                .fetch_one(&state.db_pool)
                                .await
                        } else {
                            Ok(0)
                        }
                    } else {
                        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM invoices WHERE date >= $1")
                            .bind(df)
                            .fetch_one(&state.db_pool)
                            .await
                    }
                } else {
                    Ok(0)
                }
            } else if let Some(dt_str) = date_to {
                if let Ok(dt) = NaiveDate::parse_from_str(dt_str, "%Y-%m-%d") {
                    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM invoices WHERE date <= $1")
                        .bind(dt)
                        .fetch_one(&state.db_pool)
                        .await
                } else {
                    Ok(0)
                }
            } else {
                sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM invoices")
                    .fetch_one(&state.db_pool)
                    .await
            };

            let total = count_result.unwrap_or(0);
            let total_pages = ((total as f64) / (per_page as f64)).ceil() as i64;

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": invoices,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "total_pages": total_pages
                }
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch invoices: {}", e)
        })))
    }
}

// GET /api/invoices/{id} - Get invoice by ID
pub async fn get_invoice(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let invoice_id = path.into_inner();

    match sqlx::query(
        "SELECT i.id, i.patient_id, i.invoice_number, i.date, i.items, 
                i.subtotal, i.tax_amount, i.total_amount, i.payment_status, 
                i.payment_method, i.created_at, i.updated_at,
                p.first_name, p.last_name, p.phone, p.patient_number
         FROM invoices i
         LEFT JOIN patients p ON i.patient_id = p.id
         WHERE i.id = $1"
    )
    .bind(invoice_id)
    .fetch_optional(&state.db_pool)
    .await
    {
        Ok(Some(row)) => {
            let invoice = json!({
                "id": row.get::<Uuid, &str>("id"),
                "patient_id": row.get::<Uuid, &str>("patient_id"),
                "invoice_number": row.get::<String, &str>("invoice_number"),
                "date": row.get::<NaiveDate, &str>("date"),
                "items": row.get::<serde_json::Value, &str>("items"),
                "subtotal": row.get::<f64, &str>("subtotal"),
                "tax_amount": row.get::<f64, &str>("tax_amount"),
                "total_amount": row.get::<f64, &str>("total_amount"),
                "payment_status": row.get::<String, &str>("payment_status"),
                "payment_method": row.get::<Option<String>, &str>("payment_method"),
                "patient": {
                    "id": row.get::<Uuid, &str>("patient_id"),
                    "name": format!("{} {}", 
                        row.get::<Option<String>, &str>("first_name").unwrap_or_default(),
                        row.get::<Option<String>, &str>("last_name").unwrap_or_default()
                    ),
                    "phone": row.get::<Option<String>, &str>("phone").unwrap_or_default(),
                    "patient_number": row.get::<Option<String>, &str>("patient_number").unwrap_or_default()
                },
                "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
            });

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": invoice
            })))
        },
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Invoice not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch invoice: {}", e)
        })))
    }
}

// POST /api/invoices - Create new invoice
pub async fn create_invoice(
    invoice_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    // Extract and validate required fields
    let patient_id_str = match invoice_data.get("patient_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "patient_id is required"
        })))
    };

    let patient_id = match Uuid::parse_str(patient_id_str) {
        Ok(id) => id,
        Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Invalid patient_id format"
        })))
    };

    let date_str = match invoice_data.get("date").and_then(|v| v.as_str()) {
        Some(d) => d,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "date is required (format: YYYY-MM-DD)"
        })))
    };

    let date = match NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Invalid date format. Use YYYY-MM-DD"
        })))
    };

    // Extract items
    let items_array = match invoice_data.get("items") {
        Some(v) if v.is_array() => v.as_array().unwrap(),
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "items array is required"
        })))
    };

    if items_array.is_empty() {
        return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "At least one item is required"
        })));
    }

    // Calculate totals
    let mut items_json = Vec::new();
    let mut subtotal = 0.0;

    for item in items_array {
        let description = item.get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("Item");
        let quantity = item.get("quantity")
            .and_then(|v| v.as_i64())
            .unwrap_or(1) as i32;
        let unit_price = item.get("unit_price")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        
        let total = quantity as f64 * unit_price;
        subtotal += total;

        let mut item_json = json!({
            "description": description,
            "quantity": quantity,
            "unit_price": unit_price,
            "total": total
        });
        
        // Add diagnosis if provided
        if let Some(diagnosis_code) = item.get("diagnosis_code").and_then(|v| v.as_str()) {
            item_json["diagnosis_code"] = json!(diagnosis_code);
        }
        if let Some(diagnosis_description) = item.get("diagnosis_description").and_then(|v| v.as_str()) {
            item_json["diagnosis_description"] = json!(diagnosis_description);
        }
        
        items_json.push(item_json);
    }

    // Calculate tax (16% VAT in Kenya)
    let tax_rate = invoice_data.get("tax_rate")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.16);
    let tax_amount = subtotal * tax_rate;
    let total_amount = subtotal + tax_amount;

    let invoice_number = generate_invoice_number();
    let invoice_id = Uuid::new_v4();
    let now = Utc::now();

    // Optional fields
    let consultation_id = invoice_data.get("consultation_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());

    match sqlx::query(
        r#"
        INSERT INTO invoices (
            id, patient_id, invoice_number, date, items, subtotal, 
            tax_amount, total_amount, payment_status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, patient_id, invoice_number, date, items, subtotal, 
                   tax_amount, total_amount, payment_status, payment_method, 
                   created_at, updated_at
        "#
    )
    .bind(invoice_id)
    .bind(patient_id)
    .bind(&invoice_number)
    .bind(date)
    .bind(serde_json::to_value(&items_json).unwrap())
    .bind(subtotal)
    .bind(tax_amount)
    .bind(total_amount)
    .bind("pending")
    .bind(now)
    .bind(now)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(row) => {
            let invoice = json!({
                "id": row.get::<Uuid, &str>("id"),
                "patient_id": row.get::<Uuid, &str>("patient_id"),
                "invoice_number": row.get::<String, &str>("invoice_number"),
                "date": row.get::<NaiveDate, &str>("date"),
                "items": row.get::<serde_json::Value, &str>("items"),
                "subtotal": row.get::<f64, &str>("subtotal"),
                "tax_amount": row.get::<f64, &str>("tax_amount"),
                "total_amount": row.get::<f64, &str>("total_amount"),
                "payment_status": row.get::<String, &str>("payment_status"),
                "payment_method": row.get::<Option<String>, &str>("payment_method"),
                "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
            });

            // Broadcast invoice update via WebSocket
            if let Ok(invoice_model) = serde_json::from_value::<Invoice>(invoice.clone()) {
                let _ = websocket::broadcast_billing_update(
                    state.websocket_manager.clone(),
                    invoice_model,
                    "created"
                ).await;
            }

            Ok(HttpResponse::Created().json(json!({
                "success": true,
                "message": "Invoice created successfully",
                "data": invoice
            })))
        },
        Err(sqlx::Error::Database(db_err)) if db_err.constraint() == Some("invoices_invoice_number_key") => {
            // Retry with new invoice number
            let retry_number = generate_invoice_number();
            // For now, return error - in production, retry logic would be here
            Ok(HttpResponse::Conflict().json(json!({
                "success": false,
                "error": "Invoice number already exists. Please try again."
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to create invoice: {}", e)
        })))
    }
}

// PUT /api/invoices/{id} - Update invoice
pub async fn update_invoice(
    path: web::Path<Uuid>,
    invoice_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let invoice_id = path.into_inner();

    // Check if invoice exists
    match sqlx::query("SELECT payment_status FROM invoices WHERE id = $1")
        .bind(invoice_id)
        .fetch_optional(&state.db_pool)
        .await
    {
        Ok(Some(row)) => {
            let current_status: String = row.get("payment_status");
            // Don't allow updates to paid invoices
            if current_status == "paid" {
                return Ok(HttpResponse::BadRequest().json(json!({
                    "success": false,
                    "error": "Cannot update a paid invoice"
                })));
            }
        },
        Ok(None) => return Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Invoice not found"
        }))),
        Err(e) => return Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch invoice: {}", e)
        })))
    };

    // Update only allowed fields (items, date, notes - not payment info)
    // Payment should be done through the /pay endpoint
    let date = invoice_data.get("date")
        .and_then(|v| v.as_str())
        .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    // If items are provided, recalculate totals
    let (new_items, new_subtotal, new_tax, new_total) = if invoice_data.get("items").is_some() {
        let items_array = invoice_data.get("items").and_then(|v| v.as_array()).unwrap();
        let mut items_json = Vec::new();
        let mut subtotal = 0.0;

        for item in items_array {
            let description = item.get("description").and_then(|v| v.as_str()).unwrap_or("Item");
            let quantity = item.get("quantity").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
            let unit_price = item.get("unit_price").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let total = quantity as f64 * unit_price;
            subtotal += total;

            items_json.push(json!({
                "description": description,
                "quantity": quantity,
                "unit_price": unit_price,
                "total": total
            }));
        }

        let tax_rate = invoice_data.get("tax_rate").and_then(|v| v.as_f64()).unwrap_or(0.16);
        let tax_amount = subtotal * tax_rate;
        let total_amount = subtotal + tax_amount;

        (Some(serde_json::to_value(&items_json).unwrap()), Some(subtotal), Some(tax_amount), Some(total_amount))
    } else {
        (None, None, None, None)
    };

    // Build update query
    match sqlx::query(
        r#"
        UPDATE invoices SET
            date = COALESCE($2, date),
            items = COALESCE($3, items),
            subtotal = COALESCE($4, subtotal),
            tax_amount = COALESCE($5, tax_amount),
            total_amount = COALESCE($6, total_amount),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, patient_id, invoice_number, date, items, subtotal, 
                   tax_amount, total_amount, payment_status, payment_method, 
                   created_at, updated_at
        "#
    )
    .bind(invoice_id)
    .bind(date)
    .bind(new_items)
    .bind(new_subtotal)
    .bind(new_tax)
    .bind(new_total)
    .fetch_optional(&state.db_pool)
    .await
    {
        Ok(Some(row)) => {
            let invoice = json!({
                "id": row.get::<Uuid, &str>("id"),
                "patient_id": row.get::<Uuid, &str>("patient_id"),
                "invoice_number": row.get::<String, &str>("invoice_number"),
                "date": row.get::<NaiveDate, &str>("date"),
                "items": row.get::<serde_json::Value, &str>("items"),
                "subtotal": row.get::<f64, &str>("subtotal"),
                "tax_amount": row.get::<f64, &str>("tax_amount"),
                "total_amount": row.get::<f64, &str>("total_amount"),
                "payment_status": row.get::<String, &str>("payment_status"),
                "payment_method": row.get::<Option<String>, &str>("payment_method"),
                "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
            });

            // Broadcast invoice update via WebSocket
            if let Ok(invoice_model) = serde_json::from_value::<Invoice>(invoice.clone()) {
                let _ = websocket::broadcast_billing_update(
                    state.websocket_manager.clone(),
                    invoice_model,
                    "updated"
                ).await;
            }

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "message": "Invoice updated successfully",
                "data": invoice
            })))
        },
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Invoice not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to update invoice: {}", e)
        })))
    }
}

// DELETE /api/invoices/{id} - Delete invoice
pub async fn delete_invoice(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let invoice_id = path.into_inner();

    // Check if invoice exists
    match sqlx::query("SELECT payment_status FROM invoices WHERE id = $1")
        .bind(invoice_id)
        .fetch_optional(&state.db_pool)
        .await
    {
        Ok(Some(row)) => {
            let status: String = row.get("payment_status");
            // Don't allow deletion of paid invoices
            if status == "paid" {
                return Ok(HttpResponse::BadRequest().json(json!({
                    "success": false,
                    "error": "Cannot delete a paid invoice"
                })));
            }

            match sqlx::query("DELETE FROM invoices WHERE id = $1")
                .bind(invoice_id)
                .execute(&state.db_pool)
                .await
            {
                Ok(_) => Ok(HttpResponse::Ok().json(json!({
                    "success": true,
                    "message": "Invoice deleted successfully"
                }))),
                Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": format!("Failed to delete invoice: {}", e)
                })))
            }
        },
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Invoice not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to check invoice: {}", e)
        })))
    }
}

// POST /api/invoices/{id}/pay - Record payment for invoice
pub async fn pay_invoice(
    path: web::Path<Uuid>,
    payment_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let invoice_id = path.into_inner();

    // Get invoice details
    let invoice_result = sqlx::query(
        "SELECT id, patient_id, total_amount, payment_status FROM invoices WHERE id = $1"
    )
    .bind(invoice_id)
    .fetch_optional(&state.db_pool)
    .await;

    let invoice = match invoice_result {
        Ok(Some(row)) => row,
        Ok(None) => return Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Invoice not found"
        }))),
        Err(e) => return Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch invoice: {}", e)
        })))
    };

    let current_status: String = invoice.get("payment_status");
    if current_status == "paid" {
        return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Invoice is already paid"
        })));
    }

    let total_amount: f64 = invoice.get("total_amount");

    // Extract payment details
    let payment_method = match payment_data.get("payment_method").and_then(|v| v.as_str()) {
        Some(method) => method.to_string(),
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "payment_method is required (cash, mpesa, bank_transfer, cheque)"
        })))
    };

    // If payment method is M-Pesa, initiate STK push instead of direct payment
    if payment_method.to_lowercase() == "mpesa" || payment_method.to_lowercase() == "m-pesa" {
        let phone_number = match payment_data.get("phone_number")
            .and_then(|v| v.as_str()) {
            Some(phone) => phone,
            None => {
                return Ok(HttpResponse::BadRequest().json(json!({
                    "success": false,
                    "error": "phone_number is required for M-Pesa payments"
                })));
            }
        };

        // Generate account reference
        let account_ref = format!("INV-{}", invoice_id.to_string().split('-').next().unwrap_or(""));
        
        // Create STK push request
        let stk_request = InitiateStkPushRequest {
            phone_number: phone_number.to_string(),
            amount: total_amount as u32,
            account_reference: account_ref,
            transaction_desc: format!("Payment for invoice {}", invoice_id),
            invoice_id,
        };

        // Call STK push handler
        return initiate_stk_push(
            web::Json(stk_request),
            state
        ).await;
    }

    let amount_paid = payment_data.get("amount_paid")
        .and_then(|v| v.as_f64())
        .unwrap_or(total_amount);

    let reference_number = payment_data.get("reference_number").and_then(|v| v.as_str());
    let notes = payment_data.get("notes").and_then(|v| v.as_str());

    // Validate payment amount
    if amount_paid < total_amount {
        return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": format!("Amount paid ({}) is less than invoice total ({})", amount_paid, total_amount)
        })));
    }

    let change = amount_paid - total_amount;
    let new_status = if amount_paid >= total_amount { "paid" } else { "partial" };

    // Update invoice
    match sqlx::query(
        r#"
        UPDATE invoices SET
            payment_status = $2,
            payment_method = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, patient_id, invoice_number, date, items, subtotal, 
                   tax_amount, total_amount, payment_status, payment_method, 
                   created_at, updated_at
        "#
    )
    .bind(invoice_id)
    .bind(&new_status)
    .bind(&payment_method)
    .fetch_optional(&state.db_pool)
    .await
    {
        Ok(Some(row)) => {
            let invoice = json!({
                "id": row.get::<Uuid, &str>("id"),
                "patient_id": row.get::<Uuid, &str>("patient_id"),
                "invoice_number": row.get::<String, &str>("invoice_number"),
                "date": row.get::<NaiveDate, &str>("date"),
                "items": row.get::<serde_json::Value, &str>("items"),
                "subtotal": row.get::<f64, &str>("subtotal"),
                "tax_amount": row.get::<f64, &str>("tax_amount"),
                "total_amount": row.get::<f64, &str>("total_amount"),
                "payment_status": row.get::<String, &str>("payment_status"),
                "payment_method": row.get::<Option<String>, &str>("payment_method"),
            });

            // Broadcast invoice payment update via WebSocket
            if let Ok(invoice_model) = serde_json::from_value::<Invoice>(invoice.clone()) {
                let _ = websocket::broadcast_billing_update(
                    state.websocket_manager.clone(),
                    invoice_model,
                    "payment_processed"
                ).await;
            }

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "message": "Payment recorded successfully",
                "data": {
                    "invoice_id": invoice_id,
                    "total_amount": total_amount,
                    "amount_paid": amount_paid,
                    "change": change,
                    "payment_method": payment_method,
                    "payment_status": new_status,
                    "reference_number": reference_number,
                    "notes": notes
                }
            })))
        },
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Invoice not found after update"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to record payment: {}", e)
        })))
    }
}

// GET /api/invoices/reports - Get financial reports
pub async fn get_invoice_reports(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let report_type = query.get("type").and_then(|v| v.as_str()).unwrap_or("summary");
    let date_from = query.get("date_from").and_then(|v| v.as_str());
    let date_to = query.get("date_to").and_then(|v| v.as_str());

    // Default to current month if no dates provided
    let (from_date, to_date) = if let (Some(df), Some(dt)) = (date_from, date_to) {
        (
            NaiveDate::parse_from_str(df, "%Y-%m-%d").unwrap_or_else(|_| Utc::now().date_naive()),
            NaiveDate::parse_from_str(dt, "%Y-%m-%d").unwrap_or_else(|_| Utc::now().date_naive())
        )
    } else {
        let now = Utc::now().date_naive();
        // Get first day of month using format parsing
        let first_day_str = format!("{}-{:02}-01", now.format("%Y"), now.format("%m"));
        let first_day = NaiveDate::parse_from_str(&first_day_str, "%Y-%m-%d").unwrap_or(now);
        (first_day, now)
    };

    match report_type {
        "summary" => {
            // Summary report: totals by status
            let summary_result = sqlx::query(
                r#"
                SELECT 
                    payment_status,
                    COUNT(*) as count,
                    SUM(total_amount) as total
                FROM invoices
                WHERE date >= $1 AND date <= $2
                GROUP BY payment_status
                "#
            )
            .bind(from_date)
            .bind(to_date)
            .fetch_all(&state.db_pool)
            .await;

            match summary_result {
                Ok(rows) => {
                    let mut summary = json!({});
                    let mut grand_total = 0.0;
                    let mut total_count = 0;

                    for row in rows {
                        let status: String = row.get("payment_status");
                        let count: i64 = row.get("count");
                        let total: Option<f64> = row.get("total");
                        let total_value = total.unwrap_or(0.0);

                        summary[&status] = json!({
                            "count": count,
                            "total": total_value
                        });

                        grand_total += total_value;
                        total_count += count;
                    }

                    Ok(HttpResponse::Ok().json(json!({
                        "success": true,
                        "data": {
                            "period": {
                                "from": from_date,
                                "to": to_date
                            },
                            "summary": summary,
                            "totals": {
                                "count": total_count,
                                "grand_total": grand_total
                            }
                        }
                    })))
                },
                Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": format!("Failed to generate report: {}", e)
                })))
            }
        },
        "daily" => {
            // Daily breakdown
            let daily_result = sqlx::query(
                r#"
                SELECT 
                    date,
                    COUNT(*) as count,
                    SUM(total_amount) as total,
                    SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as paid
                FROM invoices
                WHERE date >= $1 AND date <= $2
                GROUP BY date
                ORDER BY date
                "#
            )
            .bind(from_date)
            .bind(to_date)
            .fetch_all(&state.db_pool)
            .await;

            match daily_result {
                Ok(rows) => {
                    let daily_data: Vec<serde_json::Value> = rows.iter().map(|row| {
                        json!({
                            "date": row.get::<NaiveDate, &str>("date"),
                            "count": row.get::<i64, &str>("count"),
                            "total": row.get::<Option<f64>, &str>("total").unwrap_or(0.0),
                            "paid": row.get::<Option<f64>, &str>("paid").unwrap_or(0.0)
                        })
                    }).collect();

                    Ok(HttpResponse::Ok().json(json!({
                        "success": true,
                        "data": {
                            "period": {
                                "from": from_date,
                                "to": to_date
                            },
                            "daily_breakdown": daily_data
                        }
                    })))
                },
                Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": format!("Failed to generate report: {}", e)
                })))
            }
        },
        _ => Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Invalid report type. Use 'summary' or 'daily'"
        })))
    }
}

// ===========================================
// PHARMACY MANAGEMENT HANDLERS
// ===========================================

// GET /api/medicines - List medicines with pagination and filters
pub async fn get_medicines(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let per_page = query.get("per_page").and_then(|v| v.as_i64()).unwrap_or(20);
    let search = query.get("search").and_then(|v| v.as_str());
    let low_stock_only = query.get("low_stock_only").and_then(|v| v.as_bool()).unwrap_or(false);
    let offset = (page - 1) * per_page;

    // Build optimized query with WHERE clauses (uses indexes)
    let medicines_result = if low_stock_only {
        // Use partial index idx_medicines_stock_alert for low stock query
        sqlx::query(
            "SELECT id, name, generic_name, dosage_form, strength, manufacturer, 
                    batch_number, expiry_date, current_stock, minimum_stock, 
                    unit_price, created_at, updated_at
             FROM medicines
             WHERE current_stock <= minimum_stock
             ORDER BY name
             LIMIT $1 OFFSET $2"
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db_pool)
        .await
    } else if let Some(search_term) = search {
        // Use index idx_medicines_name for search
        sqlx::query(
            "SELECT id, name, generic_name, dosage_form, strength, manufacturer, 
                    batch_number, expiry_date, current_stock, minimum_stock, 
                    unit_price, created_at, updated_at
             FROM medicines
             WHERE LOWER(name) LIKE $1 OR LOWER(generic_name) LIKE $1
             ORDER BY name
             LIMIT $2 OFFSET $3"
        )
        .bind(format!("%{}%", search_term.to_lowercase()))
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db_pool)
        .await
    } else {
        // No filters - simple query using idx_medicines_name
        sqlx::query(
            "SELECT id, name, generic_name, dosage_form, strength, manufacturer, 
                    batch_number, expiry_date, current_stock, minimum_stock, 
                    unit_price, created_at, updated_at
             FROM medicines
             ORDER BY name
             LIMIT $1 OFFSET $2"
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db_pool)
        .await
    };

    match medicines_result {
        Ok(rows) => {
            let medicines: Vec<serde_json::Value> = rows.iter().filter_map(|row| {
                let name: String = row.get("name");
                let generic_name: Option<String> = row.get("generic_name");
                let current_stock: i32 = row.get("current_stock");
                let minimum_stock: i32 = row.get("minimum_stock");
                let expiry_date: Option<NaiveDate> = row.get("expiry_date");

                // Determine stock status
                let stock_status = if current_stock <= minimum_stock {
                    "low_stock"
                } else if let Some(exp_date) = expiry_date {
                    let days_until_expiry = (exp_date.signed_duration_since(Utc::now().date_naive())).num_days();
                    if days_until_expiry <= 30 && days_until_expiry >= 0 {
                        "expiring_soon"
                    } else if days_until_expiry < 0 {
                        "expired"
                    } else {
                        "normal"
                    }
                } else {
                    "normal"
                };

                Some(json!({
                    "id": row.get::<Uuid, &str>("id"),
                    "name": name,
                    "generic_name": generic_name,
                    "dosage_form": row.get::<String, &str>("dosage_form"),
                    "strength": row.get::<String, &str>("strength"),
                    "manufacturer": row.get::<Option<String>, &str>("manufacturer"),
                    "batch_number": row.get::<Option<String>, &str>("batch_number"),
                    "expiry_date": expiry_date,
                    "current_stock": current_stock,
                    "minimum_stock": minimum_stock,
                    "unit_price": row.get::<f64, &str>("unit_price"),
                    "stock_status": stock_status,
                    "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
                }))
            }).collect();

            // Get total count
            let count_result = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM medicines")
                .fetch_one(&state.db_pool)
                .await;

            let total = count_result.unwrap_or(0);
            let total_pages = ((total as f64) / (per_page as f64)).ceil() as i64;

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": medicines,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "total_pages": total_pages
                }
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch medicines: {}", e)
        })))
    }
}

// GET /api/medicines/{id} - Get medicine by ID
pub async fn get_medicine(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let medicine_id = path.into_inner();

    match sqlx::query(
        "SELECT id, name, generic_name, dosage_form, strength, manufacturer, 
                batch_number, expiry_date, current_stock, minimum_stock, 
                unit_price, created_at, updated_at
         FROM medicines WHERE id = $1"
    )
    .bind(medicine_id)
    .fetch_optional(&state.db_pool)
    .await
    {
        Ok(Some(row)) => {
            let current_stock: i32 = row.get("current_stock");
            let minimum_stock: i32 = row.get("minimum_stock");
            let expiry_date: Option<NaiveDate> = row.get("expiry_date");

            let stock_status = if current_stock <= minimum_stock {
                "low_stock"
            } else if let Some(exp_date) = expiry_date {
                let days_until_expiry = (exp_date - Utc::now().date_naive()).num_days();
                if days_until_expiry <= 30 && days_until_expiry >= 0 {
                    "expiring_soon"
                } else if days_until_expiry < 0 {
                    "expired"
                } else {
                    "normal"
                }
            } else {
                "normal"
            };

            let medicine = json!({
                "id": row.get::<Uuid, &str>("id"),
                "name": row.get::<String, &str>("name"),
                "generic_name": row.get::<Option<String>, &str>("generic_name"),
                "dosage_form": row.get::<String, &str>("dosage_form"),
                "strength": row.get::<String, &str>("strength"),
                "manufacturer": row.get::<Option<String>, &str>("manufacturer"),
                "batch_number": row.get::<Option<String>, &str>("batch_number"),
                "expiry_date": expiry_date,
                "current_stock": current_stock,
                "minimum_stock": minimum_stock,
                "unit_price": row.get::<f64, &str>("unit_price"),
                "stock_status": stock_status,
                "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
            });

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": medicine
            })))
        },
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Medicine not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch medicine: {}", e)
        })))
    }
}

// POST /api/medicines - Create new medicine
pub async fn create_medicine(
    medicine_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    // Extract and validate required fields
    let name = match medicine_data.get("name").and_then(|v| v.as_str()) {
        Some(n) if !n.is_empty() => n,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "name is required"
        })))
    };

    let generic_name = medicine_data.get("generic_name").and_then(|v| v.as_str());
    let dosage_form = match medicine_data.get("dosage_form").and_then(|v| v.as_str()) {
        Some(df) if !df.is_empty() => df,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "dosage_form is required"
        })))
    };

    let strength = match medicine_data.get("strength").and_then(|v| v.as_str()) {
        Some(s) if !s.is_empty() => s,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "strength is required"
        })))
    };

    let manufacturer = medicine_data.get("manufacturer").and_then(|v| v.as_str());
    let batch_number = medicine_data.get("batch_number").and_then(|v| v.as_str());
    let expiry_date = medicine_data.get("expiry_date")
        .and_then(|v| v.as_str())
        .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    
    let current_stock = medicine_data.get("current_stock")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;
    
    let minimum_stock = medicine_data.get("minimum_stock")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;
    
    let unit_price = medicine_data.get("unit_price")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);

    let medicine_id = Uuid::new_v4();
    let now = Utc::now();

    match sqlx::query(
        r#"
        INSERT INTO medicines (
            id, name, generic_name, dosage_form, strength, manufacturer,
            batch_number, expiry_date, current_stock, minimum_stock, unit_price,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, name, generic_name, dosage_form, strength, manufacturer,
                   batch_number, expiry_date, current_stock, minimum_stock, unit_price,
                   created_at, updated_at
        "#
    )
    .bind(medicine_id)
    .bind(name)
    .bind(generic_name)
    .bind(dosage_form)
    .bind(strength)
    .bind(manufacturer)
    .bind(batch_number)
    .bind(expiry_date)
    .bind(current_stock)
    .bind(minimum_stock)
    .bind(unit_price)
    .bind(now)
    .bind(now)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(row) => {
            let medicine = json!({
                "id": row.get::<Uuid, &str>("id"),
                "name": row.get::<String, &str>("name"),
                "generic_name": row.get::<Option<String>, &str>("generic_name"),
                "dosage_form": row.get::<String, &str>("dosage_form"),
                "strength": row.get::<String, &str>("strength"),
                "manufacturer": row.get::<Option<String>, &str>("manufacturer"),
                "batch_number": row.get::<Option<String>, &str>("batch_number"),
                "expiry_date": row.get::<Option<NaiveDate>, &str>("expiry_date"),
                "current_stock": row.get::<i32, &str>("current_stock"),
                "minimum_stock": row.get::<i32, &str>("minimum_stock"),
                "unit_price": row.get::<f64, &str>("unit_price"),
                "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
            });

            Ok(HttpResponse::Created().json(json!({
                "success": true,
                "message": "Medicine created successfully",
                "data": medicine
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to create medicine: {}", e)
        })))
    }
}

// PUT /api/medicines/{id} - Update medicine
pub async fn update_medicine(
    path: web::Path<Uuid>,
    medicine_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let medicine_id = path.into_inner();

    // Check if medicine exists
    match sqlx::query("SELECT id FROM medicines WHERE id = $1")
        .bind(medicine_id)
        .fetch_optional(&state.db_pool)
        .await
    {
        Ok(Some(_)) => {},
        Ok(None) => return Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Medicine not found"
        }))),
        Err(e) => return Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch medicine: {}", e)
        })))
    };

    // Extract optional fields
    let name = medicine_data.get("name").and_then(|v| v.as_str());
    let generic_name = medicine_data.get("generic_name").and_then(|v| v.as_str());
    let dosage_form = medicine_data.get("dosage_form").and_then(|v| v.as_str());
    let strength = medicine_data.get("strength").and_then(|v| v.as_str());
    let manufacturer = medicine_data.get("manufacturer").and_then(|v| v.as_str());
    let batch_number = medicine_data.get("batch_number").and_then(|v| v.as_str());
    let expiry_date = medicine_data.get("expiry_date")
        .and_then(|v| v.as_str())
        .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    let current_stock = medicine_data.get("current_stock").and_then(|v| v.as_i64()).map(|v| v as i32);
    let minimum_stock = medicine_data.get("minimum_stock").and_then(|v| v.as_i64()).map(|v| v as i32);
    let unit_price = medicine_data.get("unit_price").and_then(|v| v.as_f64());

    match sqlx::query(
        r#"
        UPDATE medicines SET
            name = COALESCE($2, name),
            generic_name = COALESCE($3, generic_name),
            dosage_form = COALESCE($4, dosage_form),
            strength = COALESCE($5, strength),
            manufacturer = COALESCE($6, manufacturer),
            batch_number = COALESCE($7, batch_number),
            expiry_date = COALESCE($8, expiry_date),
            current_stock = COALESCE($9, current_stock),
            minimum_stock = COALESCE($10, minimum_stock),
            unit_price = COALESCE($11, unit_price),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, generic_name, dosage_form, strength, manufacturer,
                   batch_number, expiry_date, current_stock, minimum_stock, unit_price,
                   created_at, updated_at
        "#
    )
    .bind(medicine_id)
    .bind(name)
    .bind(generic_name)
    .bind(dosage_form)
    .bind(strength)
    .bind(manufacturer)
    .bind(batch_number)
    .bind(expiry_date)
    .bind(current_stock)
    .bind(minimum_stock)
    .bind(unit_price)
    .fetch_optional(&state.db_pool)
    .await
    {
        Ok(Some(row)) => {
            let medicine = json!({
                "id": row.get::<Uuid, &str>("id"),
                "name": row.get::<String, &str>("name"),
                "generic_name": row.get::<Option<String>, &str>("generic_name"),
                "dosage_form": row.get::<String, &str>("dosage_form"),
                "strength": row.get::<String, &str>("strength"),
                "manufacturer": row.get::<Option<String>, &str>("manufacturer"),
                "batch_number": row.get::<Option<String>, &str>("batch_number"),
                "expiry_date": row.get::<Option<NaiveDate>, &str>("expiry_date"),
                "current_stock": row.get::<i32, &str>("current_stock"),
                "minimum_stock": row.get::<i32, &str>("minimum_stock"),
                "unit_price": row.get::<f64, &str>("unit_price"),
                "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
            });

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "message": "Medicine updated successfully",
                "data": medicine
            })))
        },
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Medicine not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to update medicine: {}", e)
        })))
    }
}

// DELETE /api/medicines/{id} - Delete medicine
pub async fn delete_medicine(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let medicine_id = path.into_inner();

    match sqlx::query("DELETE FROM medicines WHERE id = $1")
        .bind(medicine_id)
        .execute(&state.db_pool)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                Ok(HttpResponse::Ok().json(json!({
                    "success": true,
                    "message": "Medicine deleted successfully"
                })))
            } else {
                Ok(HttpResponse::NotFound().json(json!({
                    "success": false,
                    "error": "Medicine not found"
                })))
            }
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to delete medicine: {}", e)
        })))
    }
}

// POST /api/medicines/{id}/receive - Receive stock
pub async fn receive_stock(
    path: web::Path<Uuid>,
    stock_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let medicine_id = path.into_inner();

    // Check if medicine exists
    match sqlx::query("SELECT id FROM medicines WHERE id = $1")
        .bind(medicine_id)
        .fetch_optional(&state.db_pool)
        .await
    {
        Ok(Some(_)) => {},
        Ok(None) => return Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Medicine not found"
        }))),
        Err(e) => return Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch medicine: {}", e)
        })))
    };

    let quantity = match stock_data.get("quantity").and_then(|v| v.as_i64()) {
        Some(q) if q > 0 => q as i32,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "quantity is required and must be greater than 0"
        })))
    };

    let batch_number = stock_data.get("batch_number").and_then(|v| v.as_str());
    let expiry_date = stock_data.get("expiry_date")
        .and_then(|v| v.as_str())
        .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    let now = Utc::now();

    match sqlx::query(
        r#"
        UPDATE medicines SET
            current_stock = current_stock + $2,
            batch_number = COALESCE($3, batch_number),
            expiry_date = COALESCE($4, expiry_date),
            updated_at = $5
        WHERE id = $1
        RETURNING id, name, current_stock, batch_number, expiry_date, updated_at
        "#
    )
    .bind(medicine_id)
    .bind(quantity)
    .bind(batch_number)
    .bind(expiry_date)
    .bind(now)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(row) => {
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "message": "Stock received successfully",
                "data": {
                    "medicine_id": medicine_id,
                    "medicine_name": row.get::<String, &str>("name"),
                    "quantity_received": quantity,
                    "new_stock": row.get::<i32, &str>("current_stock"),
                    "batch_number": row.get::<Option<String>, &str>("batch_number"),
                    "expiry_date": row.get::<Option<NaiveDate>, &str>("expiry_date"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
                }
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to receive stock: {}", e)
        })))
    }
}

// GET /api/prescriptions - List prescriptions with pagination
pub async fn get_prescriptions(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let per_page = query.get("per_page").and_then(|v| v.as_i64()).unwrap_or(20);
    let patient_id = query.get("patient_id").and_then(|v| v.as_str());
    let status = query.get("status").and_then(|v| v.as_str());
    let offset = (page - 1) * per_page;

    let prescriptions_result = sqlx::query(
        "SELECT p.id, p.patient_id, p.doctor_id, p.consultation_id, p.medicines,
                p.instructions, p.status, p.created_at, p.updated_at,
                pt.first_name, pt.last_name, pt.phone
         FROM prescriptions p
         LEFT JOIN patients pt ON p.patient_id = pt.id
         ORDER BY p.created_at DESC
         LIMIT $1 OFFSET $2"
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db_pool)
    .await;

    match prescriptions_result {
        Ok(rows) => {
            let prescriptions: Vec<serde_json::Value> = rows.iter().filter_map(|row| {
                let row_patient_id = row.get::<Uuid, &str>("patient_id");
                let row_status = row.get::<String, &str>("status");

                // Filter by patient_id if provided
                if let Some(pid_str) = patient_id {
                    if let Ok(pid) = Uuid::parse_str(pid_str) {
                        if row_patient_id != pid {
                            return None;
                        }
                    }
                }

                // Filter by status if provided
                if let Some(status_filter) = status {
                    if row_status != status_filter {
                        return None;
                    }
                }

                Some(json!({
                    "id": row.get::<Uuid, &str>("id"),
                    "patient_id": row_patient_id,
                    "doctor_id": row.get::<Uuid, &str>("doctor_id"),
                    "consultation_id": row.get::<Option<Uuid>, &str>("consultation_id"),
                    "medicines": row.get::<serde_json::Value, &str>("medicines"),
                    "instructions": row.get::<String, &str>("instructions"),
                    "status": row_status,
                    "patient_name": format!("{} {}", 
                        row.get::<Option<String>, &str>("first_name").unwrap_or_default(),
                        row.get::<Option<String>, &str>("last_name").unwrap_or_default()
                    ),
                    "patient_phone": row.get::<Option<String>, &str>("phone").unwrap_or_default(),
                    "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
                }))
            }).collect();

            // Get total count
            let count_result = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM prescriptions")
                .fetch_one(&state.db_pool)
                .await;

            let total = count_result.unwrap_or(0);
            let total_pages = ((total as f64) / (per_page as f64)).ceil() as i64;

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": prescriptions,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "total_pages": total_pages
                }
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch prescriptions: {}", e)
        })))
    }
}

// GET /api/prescriptions/{id} - Get prescription by ID
pub async fn get_prescription(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let prescription_id = path.into_inner();

    match sqlx::query(
        "SELECT p.id, p.patient_id, p.doctor_id, p.consultation_id, p.medicines,
                p.instructions, p.status, p.created_at, p.updated_at,
                pt.first_name, pt.last_name, pt.phone, pt.patient_number
         FROM prescriptions p
         LEFT JOIN patients pt ON p.patient_id = pt.id
         WHERE p.id = $1"
    )
    .bind(prescription_id)
    .fetch_optional(&state.db_pool)
    .await
    {
        Ok(Some(row)) => {
            let prescription = json!({
                "id": row.get::<Uuid, &str>("id"),
                "patient_id": row.get::<Uuid, &str>("patient_id"),
                "doctor_id": row.get::<Uuid, &str>("doctor_id"),
                "consultation_id": row.get::<Option<Uuid>, &str>("consultation_id"),
                "medicines": row.get::<serde_json::Value, &str>("medicines"),
                "instructions": row.get::<String, &str>("instructions"),
                "status": row.get::<String, &str>("status"),
                "patient": {
                    "id": row.get::<Uuid, &str>("patient_id"),
                    "name": format!("{} {}", 
                        row.get::<Option<String>, &str>("first_name").unwrap_or_default(),
                        row.get::<Option<String>, &str>("last_name").unwrap_or_default()
                    ),
                    "phone": row.get::<Option<String>, &str>("phone").unwrap_or_default(),
                    "patient_number": row.get::<Option<String>, &str>("patient_number").unwrap_or_default()
                },
                "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
            });

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": prescription
            })))
        },
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Prescription not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch prescription: {}", e)
        })))
    }
}

// POST /api/prescriptions - Create new prescription
pub async fn create_prescription(
    prescription_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    // Extract and validate required fields
    let patient_id_str = match prescription_data.get("patient_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "patient_id is required"
        })))
    };

    let patient_id = match Uuid::parse_str(patient_id_str) {
        Ok(id) => id,
        Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Invalid patient_id format"
        })))
    };

    let doctor_id_str = match prescription_data.get("doctor_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "doctor_id is required"
        })))
    };

    let doctor_id = match Uuid::parse_str(doctor_id_str) {
        Ok(id) => id,
        Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Invalid doctor_id format"
        })))
    };

    let medicines = match prescription_data.get("medicines") {
        Some(v) if v.is_array() => v.clone(),
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "medicines array is required"
        })))
    };

    let instructions = match prescription_data.get("instructions").and_then(|v| v.as_str()) {
        Some(i) if !i.is_empty() => i,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "instructions is required"
        })))
    };

    let consultation_id = prescription_data.get("consultation_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());

    let status = prescription_data.get("status").and_then(|v| v.as_str()).unwrap_or("active");

    let prescription_id = Uuid::new_v4();
    let now = Utc::now();

    match sqlx::query(
        r#"
        INSERT INTO prescriptions (
            id, patient_id, doctor_id, consultation_id, medicines, instructions, status,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, patient_id, doctor_id, consultation_id, medicines, instructions, status,
                   created_at, updated_at
        "#
    )
    .bind(prescription_id)
    .bind(patient_id)
    .bind(doctor_id)
    .bind(consultation_id)
    .bind(medicines)
    .bind(instructions)
    .bind(status)
    .bind(now)
    .bind(now)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(row) => {
            let prescription = json!({
                "id": row.get::<Uuid, &str>("id"),
                "patient_id": row.get::<Uuid, &str>("patient_id"),
                "doctor_id": row.get::<Uuid, &str>("doctor_id"),
                "consultation_id": row.get::<Option<Uuid>, &str>("consultation_id"),
                "medicines": row.get::<serde_json::Value, &str>("medicines"),
                "instructions": row.get::<String, &str>("instructions"),
                "status": row.get::<String, &str>("status"),
                "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
            });

            Ok(HttpResponse::Created().json(json!({
                "success": true,
                "message": "Prescription created successfully",
                "data": prescription
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to create prescription: {}", e)
        })))
    }
}

// PUT /api/prescriptions/{id} - Update prescription
pub async fn update_prescription(
    path: web::Path<Uuid>,
    prescription_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let prescription_id = path.into_inner();

    // Check if prescription exists
    match sqlx::query("SELECT status FROM prescriptions WHERE id = $1")
        .bind(prescription_id)
        .fetch_optional(&state.db_pool)
        .await
    {
        Ok(Some(row)) => {
            let current_status: String = row.get("status");
            // Don't allow updates to dispensed prescriptions
            if current_status == "dispensed" {
                return Ok(HttpResponse::BadRequest().json(json!({
                    "success": false,
                    "error": "Cannot update a dispensed prescription"
                })));
            }
        },
        Ok(None) => return Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Prescription not found"
        }))),
        Err(e) => return Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch prescription: {}", e)
        })))
    };

    // Extract optional fields
    let medicines = prescription_data.get("medicines");
    let instructions = prescription_data.get("instructions").and_then(|v| v.as_str());
    let status = prescription_data.get("status").and_then(|v| v.as_str());

    match sqlx::query(
        r#"
        UPDATE prescriptions SET
            medicines = COALESCE($2, medicines),
            instructions = COALESCE($3, instructions),
            status = COALESCE($4, status),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, patient_id, doctor_id, consultation_id, medicines, instructions, status,
                   created_at, updated_at
        "#
    )
    .bind(prescription_id)
    .bind(medicines.and_then(|v| serde_json::to_value(v).ok()))
    .bind(instructions)
    .bind(status)
    .fetch_optional(&state.db_pool)
    .await
    {
        Ok(Some(row)) => {
            let prescription = json!({
                "id": row.get::<Uuid, &str>("id"),
                "patient_id": row.get::<Uuid, &str>("patient_id"),
                "doctor_id": row.get::<Uuid, &str>("doctor_id"),
                "consultation_id": row.get::<Option<Uuid>, &str>("consultation_id"),
                "medicines": row.get::<serde_json::Value, &str>("medicines"),
                "instructions": row.get::<String, &str>("instructions"),
                "status": row.get::<String, &str>("status"),
                "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
            });

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "message": "Prescription updated successfully",
                "data": prescription
            })))
        },
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Prescription not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to update prescription: {}", e)
        })))
    }
}

// DELETE /api/prescriptions/{id} - Delete prescription
pub async fn delete_prescription(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let prescription_id = path.into_inner();

    match sqlx::query("DELETE FROM prescriptions WHERE id = $1")
        .bind(prescription_id)
        .execute(&state.db_pool)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                Ok(HttpResponse::Ok().json(json!({
                    "success": true,
                    "message": "Prescription deleted successfully"
                })))
            } else {
                Ok(HttpResponse::NotFound().json(json!({
                    "success": false,
                    "error": "Prescription not found"
                })))
            }
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to delete prescription: {}", e)
        })))
    }
}

// POST /api/prescriptions/{id}/dispense - Dispense prescription
pub async fn dispense_prescription(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let prescription_id = path.into_inner();
    let now = Utc::now();

    // Start transaction for atomic stock update
    let mut tx = match state.db_pool.begin().await {
        Ok(t) => t,
        Err(e) => return Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to start transaction: {}", e)
        })))
    };

    // Get prescription with medicines
    let prescription_result = sqlx::query(
        "SELECT medicines, status FROM prescriptions WHERE id = $1"
    )
    .bind(prescription_id)
    .fetch_optional(&mut *tx)
    .await;

    let prescription = match prescription_result {
        Ok(Some(row)) => row,
        Ok(None) => {
            let _ = tx.rollback().await;
            return Ok(HttpResponse::NotFound().json(json!({
                "success": false,
                "error": "Prescription not found"
            })));
        },
        Err(e) => {
            let _ = tx.rollback().await;
            return Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to fetch prescription: {}", e)
            })));
        }
    };

    let current_status: String = prescription.get("status");
    if current_status == "dispensed" {
        let _ = tx.rollback().await;
        return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Prescription is already dispensed"
        })));
    }

    let medicines: serde_json::Value = prescription.get("medicines");
    
    // Check if medicines array is valid
    let medicines_array = match medicines.as_array() {
        Some(arr) if !arr.is_empty() => arr,
        _ => {
            let _ = tx.rollback().await;
            return Ok(HttpResponse::BadRequest().json(json!({
                "success": false,
                "error": "Prescription has no medicines to dispense"
            })));
        }
    };

    // Validate stock availability for all medicines
    for medicine in medicines_array {
        if let Some(medicine_id_str) = medicine.get("medicine_id").and_then(|v| v.as_str()) {
            if let Ok(medicine_id) = Uuid::parse_str(medicine_id_str) {
                let required_quantity = medicine.get("quantity")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0) as i32;

                let stock_result = sqlx::query_scalar::<_, i32>(
                    "SELECT current_stock FROM medicines WHERE id = $1"
                )
                .bind(medicine_id)
                .fetch_optional(&mut *tx)
                .await;

                match stock_result {
                    Ok(Some(current_stock)) => {
                        if current_stock < required_quantity {
                            let _ = tx.rollback().await;
                            return Ok(HttpResponse::BadRequest().json(json!({
                                "success": false,
                                "error": format!("Insufficient stock. Required: {}, Available: {}", required_quantity, current_stock)
                            })));
                        }
                    },
                    Ok(None) => {
                        let _ = tx.rollback().await;
                        return Ok(HttpResponse::NotFound().json(json!({
                            "success": false,
                            "error": format!("Medicine with id {} not found", medicine_id_str)
                        })));
                    },
                    Err(e) => {
                        let _ = tx.rollback().await;
                        return Ok(HttpResponse::InternalServerError().json(json!({
                            "success": false,
                            "error": format!("Failed to check stock: {}", e)
                        })));
                    }
                }
            }
        }
    }

    // Deduct stock for each medicine
    for medicine in medicines_array {
        if let Some(medicine_id_str) = medicine.get("medicine_id").and_then(|v| v.as_str()) {
            if let Ok(medicine_id) = Uuid::parse_str(medicine_id_str) {
                let quantity = medicine.get("quantity")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0) as i32;

                let update_result = sqlx::query(
                    "UPDATE medicines SET current_stock = current_stock - $1, updated_at = $2 WHERE id = $3"
                )
                .bind(quantity)
                .bind(now)
                .bind(medicine_id)
                .execute(&mut *tx)
                .await;

                if let Err(e) = update_result {
                    let _ = tx.rollback().await;
                    return Ok(HttpResponse::InternalServerError().json(json!({
                        "success": false,
                        "error": format!("Failed to update stock: {}", e)
                    })));
                }
            }
        }
    }

    // Update prescription status to dispensed
    let update_result = sqlx::query(
        "UPDATE prescriptions SET status = $1, updated_at = $2 WHERE id = $3"
    )
    .bind("dispensed")
    .bind(now)
    .bind(prescription_id)
    .execute(&mut *tx)
    .await;

    match update_result {
        Ok(_) => {
            match tx.commit().await {
                Ok(_) => Ok(HttpResponse::Ok().json(json!({
                    "success": true,
                    "message": "Prescription dispensed successfully",
                    "data": {
                        "prescription_id": prescription_id,
                        "status": "dispensed",
                        "dispensed_at": now
                    }
                }))),
                Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": format!("Failed to commit transaction: {}", e)
                })))
            }
        },
        Err(e) => {
            let _ = tx.rollback().await;
            Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to update prescription: {}", e)
            })))
        }
    }
}

// ===========================================
// INVENTORY MANAGEMENT HANDLERS
// ===========================================

// GET /api/inventory/low-stock - Get medicines with low stock
pub async fn get_low_stock(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let per_page = query.get("per_page").and_then(|v| v.as_i64()).unwrap_or(50);
    let offset = (page - 1) * per_page;

    match sqlx::query(
        "SELECT id, name, generic_name, dosage_form, strength, manufacturer,
                batch_number, expiry_date, current_stock, minimum_stock, unit_price,
                created_at, updated_at
         FROM medicines
         WHERE current_stock <= minimum_stock
         ORDER BY (current_stock::float / NULLIF(minimum_stock, 0)) ASC, name
         LIMIT $1 OFFSET $2"
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(rows) => {
            let medicines: Vec<serde_json::Value> = rows.iter().map(|row| {
                let current_stock: i32 = row.get("current_stock");
                let minimum_stock: i32 = row.get("minimum_stock");
                let stock_percentage = if minimum_stock > 0 {
                    (current_stock as f64 / minimum_stock as f64) * 100.0
                } else {
                    0.0
                };

                json!({
                    "id": row.get::<Uuid, &str>("id"),
                    "name": row.get::<String, &str>("name"),
                    "generic_name": row.get::<Option<String>, &str>("generic_name"),
                    "dosage_form": row.get::<String, &str>("dosage_form"),
                    "strength": row.get::<String, &str>("strength"),
                    "manufacturer": row.get::<Option<String>, &str>("manufacturer"),
                    "batch_number": row.get::<Option<String>, &str>("batch_number"),
                    "expiry_date": row.get::<Option<NaiveDate>, &str>("expiry_date"),
                    "current_stock": current_stock,
                    "minimum_stock": minimum_stock,
                    "unit_price": row.get::<f64, &str>("unit_price"),
                    "stock_percentage": stock_percentage,
                    "stock_deficit": minimum_stock - current_stock,
                    "stock_status": "low_stock",
                    "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
                })
            }).collect();

            // Get total count
            let count_result = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM medicines WHERE current_stock <= minimum_stock"
            )
            .fetch_one(&state.db_pool)
            .await;

            let total = count_result.unwrap_or(0);
            let total_pages = ((total as f64) / (per_page as f64)).ceil() as i64;

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": medicines,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "total_pages": total_pages
                }
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch low stock medicines: {}", e)
        })))
    }
}

// GET /api/inventory/expiring - Get medicines expiring soon
pub async fn get_expiring_medicines(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let per_page = query.get("per_page").and_then(|v| v.as_i64()).unwrap_or(50);
    let days = query.get("days").and_then(|v| v.as_i64()).unwrap_or(30);
    let offset = (page - 1) * per_page;

    let cutoff_date = Utc::now().date_naive() + chrono::Duration::days(days);

    match sqlx::query(
        "SELECT id, name, generic_name, dosage_form, strength, manufacturer,
                batch_number, expiry_date, current_stock, minimum_stock, unit_price,
                created_at, updated_at
         FROM medicines
         WHERE expiry_date IS NOT NULL
           AND expiry_date <= $1
           AND expiry_date >= CURRENT_DATE
         ORDER BY expiry_date ASC, name
         LIMIT $2 OFFSET $3"
    )
    .bind(cutoff_date)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(rows) => {
            let now = Utc::now().date_naive();
            let medicines: Vec<serde_json::Value> = rows.iter().map(|row| {
                let expiry_date: Option<NaiveDate> = row.get("expiry_date");
                let days_until_expiry = expiry_date.map(|exp| exp.signed_duration_since(now).num_days()).unwrap_or(0);

                json!({
                    "id": row.get::<Uuid, &str>("id"),
                    "name": row.get::<String, &str>("name"),
                    "generic_name": row.get::<Option<String>, &str>("generic_name"),
                    "dosage_form": row.get::<String, &str>("dosage_form"),
                    "strength": row.get::<String, &str>("strength"),
                    "manufacturer": row.get::<Option<String>, &str>("manufacturer"),
                    "batch_number": row.get::<Option<String>, &str>("batch_number"),
                    "expiry_date": expiry_date,
                    "current_stock": row.get::<i32, &str>("current_stock"),
                    "minimum_stock": row.get::<i32, &str>("minimum_stock"),
                    "unit_price": row.get::<f64, &str>("unit_price"),
                    "days_until_expiry": days_until_expiry,
                    "stock_status": if days_until_expiry <= 0 { "expired" } else { "expiring_soon" },
                    "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
                })
            }).collect();

            // Get total count
            let count_result = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM medicines WHERE expiry_date IS NOT NULL AND expiry_date <= $1 AND expiry_date >= CURRENT_DATE"
            )
            .bind(cutoff_date)
            .fetch_one(&state.db_pool)
            .await;

            let total = count_result.unwrap_or(0);
            let total_pages = ((total as f64) / (per_page as f64)).ceil() as i64;

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": medicines,
                "filter": {
                    "days": days,
                    "cutoff_date": cutoff_date
                },
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "total_pages": total_pages
                }
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch expiring medicines: {}", e)
        })))
    }
}

// GET /api/inventory/alerts - Get all stock alerts (low stock + expiring)
pub async fn get_stock_alerts(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let days = query.get("days").and_then(|v| v.as_i64()).unwrap_or(30);
    let cutoff_date = Utc::now().date_naive() + chrono::Duration::days(days);

    // Get low stock medicines
    let low_stock_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM medicines WHERE current_stock <= minimum_stock"
    )
    .fetch_one(&state.db_pool)
    .await;

    // Get expiring medicines
    let expiring_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM medicines WHERE expiry_date IS NOT NULL AND expiry_date <= $1 AND expiry_date >= CURRENT_DATE"
    )
    .bind(cutoff_date)
    .fetch_one(&state.db_pool)
    .await;

    // Get expired medicines
    let expired_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM medicines WHERE expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE AND current_stock > 0"
    )
    .fetch_one(&state.db_pool)
    .await;

    match (low_stock_result, expiring_result, expired_result) {
        (Ok(low_stock), Ok(expiring), Ok(expired)) => {
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": {
                    "low_stock_count": low_stock,
                    "expiring_count": expiring,
                    "expired_count": expired,
                    "total_alerts": low_stock + expiring + expired,
                    "filter": {
                        "days": days,
                        "cutoff_date": cutoff_date
                    }
                }
            })))
        },
        (Err(e), _, _) | (_, Err(e), _) | (_, _, Err(e)) => {
            Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to fetch stock alerts: {}", e)
            })))
        }
    }
}

// GET /api/inventory/reconciliation - Stock reconciliation report
pub async fn get_stock_reconciliation(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let date_from = query.get("date_from").and_then(|v| v.as_str());
    let date_to = query.get("date_to").and_then(|v| v.as_str());

    // Default to current month if no dates provided
    let (from_date, to_date) = if let (Some(df), Some(dt)) = (date_from, date_to) {
        (
            NaiveDate::parse_from_str(df, "%Y-%m-%d").unwrap_or_else(|_| Utc::now().date_naive()),
            NaiveDate::parse_from_str(dt, "%Y-%m-%d").unwrap_or_else(|_| Utc::now().date_naive())
        )
    } else {
        let now = Utc::now().date_naive();
        // Get first day of month using format parsing
        let first_day_str = format!("{}-{:02}-01", now.format("%Y"), now.format("%m"));
        let first_day = NaiveDate::parse_from_str(&first_day_str, "%Y-%m-%d").unwrap_or(now);
        (first_day, now)
    };

    // Get summary statistics
    let total_medicines_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM medicines"
    )
    .fetch_one(&state.db_pool)
    .await;

    let low_stock_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM medicines WHERE current_stock <= minimum_stock"
    )
    .fetch_one(&state.db_pool)
    .await;

    let out_of_stock_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM medicines WHERE current_stock = 0"
    )
    .fetch_one(&state.db_pool)
    .await;

    let total_stock_value_result = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT SUM(current_stock * unit_price) FROM medicines WHERE current_stock > 0"
    )
    .fetch_one(&state.db_pool)
    .await;

    let expired_stock_result = sqlx::query_scalar::<_, Option<i64>>(
        "SELECT SUM(current_stock) FROM medicines WHERE expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE"
    )
    .fetch_one(&state.db_pool)
    .await;

    match (total_medicines_result, low_stock_result, out_of_stock_result, total_stock_value_result, expired_stock_result) {
        (Ok(total_medicines), Ok(low_stock), Ok(out_of_stock), Ok(total_value), Ok(expired_stock)) => {
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": {
                    "period": {
                        "from": from_date,
                        "to": to_date
                    },
                    "summary": {
                        "total_medicines": total_medicines,
                        "low_stock_count": low_stock,
                        "out_of_stock_count": out_of_stock,
                        "expired_stock_quantity": expired_stock.unwrap_or(0),
                        "total_stock_value": total_value.unwrap_or(0.0),
                        "healthy_stock_count": total_medicines - low_stock - out_of_stock
                    },
                    "generated_at": Utc::now()
                }
            })))
        },
        (Err(e), _, _, _, _) | (_, Err(e), _, _, _) | (_, _, Err(e), _, _) | (_, _, _, Err(e), _) | (_, _, _, _, Err(e)) => {
            Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to generate reconciliation report: {}", e)
            })))
        }
    }
}

// POST /api/inventory/adjust - Manual stock adjustment
pub async fn adjust_stock(
    path: web::Path<Uuid>,
    adjustment_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let medicine_id = path.into_inner();

    // Check if medicine exists and get current stock
    let medicine_result = sqlx::query(
        "SELECT id, name, current_stock FROM medicines WHERE id = $1"
    )
    .bind(medicine_id)
    .fetch_optional(&state.db_pool)
    .await;

    let (medicine_name, current_stock) = match medicine_result {
        Ok(Some(row)) => (
            row.get::<String, &str>("name"),
            row.get::<i32, &str>("current_stock")
        ),
        Ok(None) => return Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Medicine not found"
        }))),
        Err(e) => return Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch medicine: {}", e)
        })))
    };

    let adjustment_type = match adjustment_data.get("adjustment_type").and_then(|v| v.as_str()) {
        Some(t) if t == "increase" || t == "decrease" || t == "set" => t,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "adjustment_type is required and must be 'increase', 'decrease', or 'set'"
        })))
    };

    let quantity = match adjustment_data.get("quantity").and_then(|v| v.as_i64()) {
        Some(q) if q >= 0 => q as i32,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "quantity is required and must be >= 0"
        })))
    };

    let notes = adjustment_data.get("notes").and_then(|v| v.as_str());
    let reason = adjustment_data.get("reason").and_then(|v| v.as_str()).unwrap_or("manual_adjustment");

    // Calculate new stock
    let new_stock = match adjustment_type {
        "increase" => current_stock + quantity,
        "decrease" => {
            if current_stock < quantity {
                return Ok(HttpResponse::BadRequest().json(json!({
                    "success": false,
                    "error": format!("Cannot decrease stock below 0. Current stock: {}, Requested decrease: {}", current_stock, quantity)
                })));
            }
            current_stock - quantity
        },
        "set" => quantity,
        _ => unreachable!()
    };

    let now = Utc::now();

    // Update medicine stock
    match sqlx::query(
        r#"
        UPDATE medicines SET
            current_stock = $2,
            updated_at = $3
        WHERE id = $1
        RETURNING id, name, current_stock, minimum_stock, unit_price, updated_at
        "#
    )
    .bind(medicine_id)
    .bind(new_stock)
    .bind(now)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(row) => {
            let stock_change = match adjustment_type {
                "increase" => Some(quantity),
                "decrease" => Some(-quantity),
                "set" => Some(new_stock - current_stock),
                _ => None
            };

            // Broadcast inventory update via WebSocket
            let _ = websocket::broadcast_inventory_update(
                state.websocket_manager.clone(),
                medicine_id,
                &medicine_name,
                "stock_adjusted",
                stock_change
            ).await;

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "message": "Stock adjusted successfully",
                "data": {
                    "medicine_id": medicine_id,
                    "medicine_name": medicine_name,
                    "adjustment_type": adjustment_type,
                    "previous_stock": current_stock,
                    "adjustment_quantity": if adjustment_type == "set" { new_stock - current_stock } else { quantity },
                    "new_stock": new_stock,
                    "minimum_stock": row.get::<i32, &str>("minimum_stock"),
                    "stock_status": if new_stock <= row.get::<i32, &str>("minimum_stock") { "low_stock" } else { "normal" },
                    "reason": reason,
                    "notes": notes,
                    "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
                }
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to adjust stock: {}", e)
        })))
    }
}

// ===========================================
// REPORTS HANDLERS
// ===========================================

// GET /api/reports/financial - Comprehensive financial report
pub async fn get_financial_report(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let date_from = query.get("date_from").and_then(|v| v.as_str());
    let date_to = query.get("date_to").and_then(|v| v.as_str());

    // Default to current month if no dates provided
    let (from_date, to_date) = if let (Some(df), Some(dt)) = (date_from, date_to) {
        (
            NaiveDate::parse_from_str(df, "%Y-%m-%d").unwrap_or_else(|_| Utc::now().date_naive()),
            NaiveDate::parse_from_str(dt, "%Y-%m-%d").unwrap_or_else(|_| Utc::now().date_naive())
        )
    } else {
        let now = Utc::now().date_naive();
        // Get first day of month using format parsing
        let first_day_str = format!("{}-{:02}-01", now.format("%Y"), now.format("%m"));
        let first_day = NaiveDate::parse_from_str(&first_day_str, "%Y-%m-%d").unwrap_or(now);
        (first_day, now)
    };

    // Get total revenue from paid invoices
    let total_revenue_result = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT SUM(total_amount) FROM invoices WHERE date >= $1 AND date <= $2 AND payment_status = 'paid'"
    )
    .bind(from_date)
    .bind(to_date)
    .fetch_one(&state.db_pool)
    .await;

    // Get pending revenue
    let pending_revenue_result = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT SUM(total_amount) FROM invoices WHERE date >= $1 AND date <= $2 AND payment_status = 'pending'"
    )
    .bind(from_date)
    .bind(to_date)
    .fetch_one(&state.db_pool)
    .await;

    // Get payment method breakdown
    let payment_methods_result = sqlx::query(
        "SELECT payment_method, COUNT(*) as count, SUM(total_amount) as total
         FROM invoices
         WHERE date >= $1 AND date <= $2 AND payment_status = 'paid' AND payment_method IS NOT NULL
         GROUP BY payment_method"
    )
    .bind(from_date)
    .bind(to_date)
    .fetch_all(&state.db_pool)
    .await;

    // Get daily revenue breakdown
    let daily_revenue_result = sqlx::query(
        "SELECT date, COUNT(*) as count, SUM(total_amount) as total
         FROM invoices
         WHERE date >= $1 AND date <= $2 AND payment_status = 'paid'
         GROUP BY date
         ORDER BY date"
    )
    .bind(from_date)
    .bind(to_date)
    .fetch_all(&state.db_pool)
    .await;

    // Get invoice count by status
    let status_count_result = sqlx::query(
        "SELECT payment_status, COUNT(*) as count, SUM(total_amount) as total
         FROM invoices
         WHERE date >= $1 AND date <= $2
         GROUP BY payment_status"
    )
    .bind(from_date)
    .bind(to_date)
    .fetch_all(&state.db_pool)
    .await;

    match (total_revenue_result, pending_revenue_result, payment_methods_result, daily_revenue_result, status_count_result) {
        (Ok(total_revenue), Ok(pending_revenue), Ok(payment_methods), Ok(daily_revenue), Ok(status_counts)) => {
            let payment_breakdown: Vec<serde_json::Value> = payment_methods.iter().map(|row| {
                json!({
                    "method": row.get::<Option<String>, &str>("payment_method"),
                    "count": row.get::<i64, &str>("count"),
                    "total": row.get::<Option<f64>, &str>("total").unwrap_or(0.0)
                })
            }).collect();

            let daily_breakdown: Vec<serde_json::Value> = daily_revenue.iter().map(|row| {
                json!({
                    "date": row.get::<NaiveDate, &str>("date"),
                    "count": row.get::<i64, &str>("count"),
                    "total": row.get::<Option<f64>, &str>("total").unwrap_or(0.0)
                })
            }).collect();

            let status_breakdown: Vec<serde_json::Value> = status_counts.iter().map(|row| {
                json!({
                    "status": row.get::<String, &str>("payment_status"),
                    "count": row.get::<i64, &str>("count"),
                    "total": row.get::<Option<f64>, &str>("total").unwrap_or(0.0)
                })
            }).collect();

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": {
                    "period": {
                        "from": from_date,
                        "to": to_date
                    },
                    "revenue": {
                        "total_paid": total_revenue.unwrap_or(0.0),
                        "pending": pending_revenue.unwrap_or(0.0),
                        "grand_total": total_revenue.unwrap_or(0.0) + pending_revenue.unwrap_or(0.0)
                    },
                    "payment_methods": payment_breakdown,
                    "status_breakdown": status_breakdown,
                    "daily_revenue": daily_breakdown,
                    "generated_at": Utc::now()
                }
            })))
        },
        (Err(e), _, _, _, _) | (_, Err(e), _, _, _) | (_, _, Err(e), _, _) | (_, _, _, Err(e), _) | (_, _, _, _, Err(e)) => {
            Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to generate financial report: {}", e)
            })))
        }
    }
}

// POST /api/sha-claims - Create new SHA claim
pub async fn create_sha_claim(
    claim_data: web::Json<serde_json::Value>,
    req: HttpRequest,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    // Verify JWT and get user ID
    let claims = match verify_jwt_from_request(&req, &state.auth_service) {
        Ok(c) => c,
        Err(response) => return Ok(response),
    };

    let user_id = claims.user_id;

    // Extract required fields
    let claim_number = match claim_data.get("claimNumber").and_then(|v| v.as_str()) {
        Some(cn) if !cn.is_empty() => cn,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "claimNumber is required"
        })))
    };

    let month = match claim_data.get("month").and_then(|v| v.as_str()) {
        Some(m) if !m.is_empty() => m,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "month is required"
        })))
    };

    let current_date = chrono::Utc::now().date_naive();
    let current_year_str = current_date.format("%Y").to_string();
    let year = claim_data.get("year").and_then(|v| v.as_i64()).unwrap_or(current_year_str.parse::<i64>().unwrap_or(2024));
    
    let submission_date_str = match claim_data.get("submissionDate").and_then(|v| v.as_str()) {
        Some(sd) if !sd.is_empty() => sd,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "submissionDate is required (format: YYYY-MM-DD)"
        })))
    };

    let submission_date = match NaiveDate::parse_from_str(submission_date_str, "%Y-%m-%d") {
        Ok(date) => date,
        Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Invalid submissionDate format. Use YYYY-MM-DD"
        })))
    };

    let total_amount = match claim_data.get("totalAmount").and_then(|v| v.as_f64()) {
        Some(ta) if ta >= 0.0 => ta,
        _ => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "totalAmount is required and must be >= 0"
        })))
    };

    // Calculate claim_date from month and year (first day of the month)
    let month_num = match month.to_lowercase().as_str() {
        "january" => 1, "february" => 2, "march" => 3, "april" => 4,
        "may" => 5, "june" => 6, "july" => 7, "august" => 8,
        "september" => 9, "october" => 10, "november" => 11, "december" => 12,
        _ => {
            // Try parsing as number
            month.parse::<u32>().unwrap_or(1).min(12).max(1)
        }
    };
    let claim_date = NaiveDate::from_ymd_opt(year as i32, month_num, 1)
        .unwrap_or_else(|| NaiveDate::from_ymd_opt(year as i32, 1, 1).unwrap());

    // Service date defaults to claim_date (first day of the month)
    let service_date = claim_date;

    // Optional fields
    let total_patients = claim_data.get("totalPatients").and_then(|v| v.as_i64()).unwrap_or(0);
    let sha_website_reference = claim_data.get("shaWebsiteReference").and_then(|v| v.as_str());
    let notes = claim_data.get("notes").and_then(|v| v.as_str());

    // Build notes with all relevant information
    let mut full_notes = String::new();
    if let Some(ref_val) = sha_website_reference {
        full_notes.push_str(&format!("SHA Website Reference: {}\n", ref_val));
    }
    if total_patients > 0 {
        full_notes.push_str(&format!("Total Patients: {}\n", total_patients));
    }
    if let Some(n) = notes {
        full_notes.push_str(&format!("Notes: {}", n));
    }

    let claim_id = Uuid::new_v4();
    let now = Utc::now();

    // Insert into database
    // Note: patient_name and patient_sha_number are required by schema but we're creating aggregate claims
    // Using placeholder values for aggregate monthly claims
    match sqlx::query(
        r#"
        INSERT INTO sha_claims (
            id, claim_number, patient_name, patient_sha_number,
            claim_date, service_date, total_amount,
            status, submission_date, notes, created_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, claim_number, invoice_id, patient_id, patient_name, patient_sha_number,
                  claim_date, service_date, total_amount, approved_amount, status,
                  submission_date, approval_date, payment_date, rejection_reason, notes,
                  created_at, updated_at
        "#
    )
    .bind(claim_id)
    .bind(claim_number)
    .bind(format!("Monthly Aggregate - {} {}", month, year)) // Placeholder patient_name
    .bind("AGGREGATE") // Placeholder patient_sha_number
    .bind(claim_date)
    .bind(service_date)
    .bind(total_amount)
    .bind("pending") // Default status
    .bind(submission_date)
    .bind(if full_notes.is_empty() { None } else { Some(full_notes) })
    .bind(user_id)
    .bind(now)
    .bind(now)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(row) => {
            Ok(HttpResponse::Created().json(json!({
                "success": true,
                "data": {
                    "id": row.get::<Uuid, &str>("id"),
                    "claim_number": row.get::<String, &str>("claim_number"),
                    "claim_date": row.get::<NaiveDate, &str>("claim_date"),
                    "service_date": row.get::<NaiveDate, &str>("service_date"),
                    "total_amount": row.get::<f64, &str>("total_amount"),
                    "status": row.get::<String, &str>("status"),
                    "submission_date": row.get::<Option<NaiveDate>, &str>("submission_date"),
                    "notes": row.get::<Option<String>, &str>("notes"),
                    "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at")
                },
                "message": "SHA claim created successfully"
            })))
        },
        Err(sqlx::Error::Database(db_err)) if db_err.constraint().is_some() => {
            if db_err.message().contains("unique") || db_err.message().contains("claim_number") {
                Ok(HttpResponse::Conflict().json(json!({
                    "success": false,
                    "error": format!("Claim number '{}' already exists", claim_number)
                })))
            } else {
                Ok(HttpResponse::BadRequest().json(json!({
                    "success": false,
                    "error": format!("Database constraint violation: {}", db_err.message())
                })))
            }
        },
        Err(sqlx::Error::Database(db_err)) if db_err.message().contains("does not exist") => {
            Ok(HttpResponse::BadRequest().json(json!({
                "success": false,
                "error": "SHA claims table does not exist. Please run database migrations."
            })))
        },
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to create SHA claim: {}", e)
            })))
        }
    }
}

// GET /api/reports/sha-claims - SHA claim tracking report
pub async fn get_sha_claims_report(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let per_page = query.get("per_page").and_then(|v| v.as_i64()).unwrap_or(20);
    let status = query.get("status").and_then(|v| v.as_str());
    let date_from = query.get("date_from").and_then(|v| v.as_str());
    let date_to = query.get("date_to").and_then(|v| v.as_str());
    let offset = (page - 1) * per_page;

    // Check if sha_claims table exists (it might not in minimal schema)
    // Build WHERE clause
    let mut where_clauses = Vec::new();
    if let Some(s) = status {
        where_clauses.push(format!("status = '{}'", s));
    }
    if let Some(df) = date_from {
        if let Ok(_) = NaiveDate::parse_from_str(df, "%Y-%m-%d") {
            where_clauses.push(format!("claim_date >= '{}'", df));
        }
    }
    if let Some(dt) = date_to {
        if let Ok(_) = NaiveDate::parse_from_str(dt, "%Y-%m-%d") {
            where_clauses.push(format!("claim_date <= '{}'", dt));
        }
    }

    let where_clause = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    // Try to get claims summary first
    let summary_result = sqlx::query(
        &format!(
            "SELECT 
                status,
                COUNT(*) as count,
                SUM(total_amount) as total_amount,
                SUM(approved_amount) as approved_amount
             FROM sha_claims
             {}
             GROUP BY status",
            where_clause
        )
    )
    .fetch_all(&state.db_pool)
    .await;

    // Get claims list
    let claims_result = sqlx::query(
        &format!(
            "SELECT 
                id, claim_number, invoice_id, patient_id, patient_name, patient_sha_number,
                claim_date, service_date, total_amount, approved_amount, status,
                submission_date, approval_date, payment_date, rejection_reason, notes,
                created_at, updated_at
             FROM sha_claims
             {}
             ORDER BY claim_date DESC, created_at DESC
             LIMIT {} OFFSET {}",
            where_clause, per_page, offset
        )
    )
    .fetch_all(&state.db_pool)
    .await;

    match (summary_result, claims_result) {
        (Ok(summary_rows), Ok(claims_rows)) => {
            let status_summary: Vec<serde_json::Value> = summary_rows.iter().map(|row| {
                json!({
                    "status": row.get::<String, &str>("status"),
                    "count": row.get::<i64, &str>("count"),
                    "total_amount": row.get::<Option<f64>, &str>("total_amount").unwrap_or(0.0),
                    "approved_amount": row.get::<Option<f64>, &str>("approved_amount").unwrap_or(0.0)
                })
            }).collect();

            let claims: Vec<serde_json::Value> = claims_rows.iter().map(|row| {
                json!({
                    "id": row.get::<Uuid, &str>("id"),
                    "claim_number": row.get::<String, &str>("claim_number"),
                    "invoice_id": row.get::<Uuid, &str>("invoice_id"),
                    "patient_id": row.get::<Uuid, &str>("patient_id"),
                    "patient_name": row.get::<String, &str>("patient_name"),
                    "patient_sha_number": row.get::<String, &str>("patient_sha_number"),
                    "claim_date": row.get::<NaiveDate, &str>("claim_date"),
                    "service_date": row.get::<NaiveDate, &str>("service_date"),
                    "total_amount": row.get::<f64, &str>("total_amount"),
                    "approved_amount": row.get::<Option<f64>, &str>("approved_amount"),
                    "status": row.get::<String, &str>("status"),
                    "submission_date": row.get::<Option<NaiveDate>, &str>("submission_date"),
                    "approval_date": row.get::<Option<NaiveDate>, &str>("approval_date"),
                    "payment_date": row.get::<Option<NaiveDate>, &str>("payment_date"),
                    "rejection_reason": row.get::<Option<String>, &str>("rejection_reason"),
                    "notes": row.get::<Option<String>, &str>("notes"),
                    "created_at": row.get::<chrono::DateTime<Utc>, &str>("created_at"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, &str>("updated_at")
                })
            }).collect();

            // Get total count
            let count_result = sqlx::query_scalar::<_, i64>(
                &format!("SELECT COUNT(*) FROM sha_claims {}", where_clause)
            )
            .fetch_one(&state.db_pool)
            .await;

            let total = count_result.unwrap_or(0);
            let total_pages = ((total as f64) / (per_page as f64)).ceil() as i64;

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": {
                    "summary": status_summary,
                    "claims": claims,
                    "pagination": {
                        "page": page,
                        "per_page": per_page,
                        "total": total,
                        "total_pages": total_pages
                    }
                }
            })))
        },
        (Err(sqlx::Error::Database(db_err)), _) if db_err.message().contains("does not exist") => {
            // Table doesn't exist, return empty result
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": {
                    "summary": [],
                    "claims": [],
                    "pagination": {
                        "page": page,
                        "per_page": per_page,
                        "total": 0,
                        "total_pages": 0
                    },
                    "note": "SHA claims table not available"
                }
            })))
        },
        (Err(e), _) | (_, Err(e)) => {
            Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to fetch SHA claims report: {}", e)
            })))
        }
    }
}

// GET /api/reports/audit - Audit logs report
pub async fn get_audit_report(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let per_page = query.get("per_page").and_then(|v| v.as_i64()).unwrap_or(50);
    let user_id = query.get("user_id").and_then(|v| v.as_str());
    let action = query.get("action").and_then(|v| v.as_str());
    let date_from = query.get("date_from").and_then(|v| v.as_str());
    let date_to = query.get("date_to").and_then(|v| v.as_str());
    let offset = (page - 1) * per_page;

    // Check if audit_logs table exists (it might not in minimal schema)
    // Build WHERE clause
    let mut where_clauses = Vec::new();
    if let Some(uid) = user_id {
        if Uuid::parse_str(uid).is_ok() {
            where_clauses.push(format!("user_id = '{}'", uid));
        }
    }
    if let Some(act) = action {
        where_clauses.push(format!("action::text LIKE '%{}%'", act));
    }
    if let Some(df) = date_from {
        if let Ok(_) = NaiveDate::parse_from_str(df, "%Y-%m-%d") {
            where_clauses.push(format!("timestamp >= '{}'::timestamp", df));
        }
    }
    if let Some(dt) = date_to {
        if let Ok(_) = NaiveDate::parse_from_str(dt, "%Y-%m-%d") {
            where_clauses.push(format!("timestamp <= '{} 23:59:59'::timestamp", dt));
        }
    }

    let where_clause = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    // Try to query audit_logs table
    let audit_result = sqlx::query(
        &format!(
            "SELECT 
                id, user_id, session_id, action, resource, resource_id, result,
                details, ip_address, user_agent, request_id, timestamp
             FROM audit_logs
             {}
             ORDER BY timestamp DESC
             LIMIT {} OFFSET {}",
            where_clause, per_page, offset
        )
    )
    .fetch_all(&state.db_pool)
    .await;

    match audit_result {
        Ok(rows) => {
            let logs: Vec<serde_json::Value> = rows.iter().map(|row| {
                json!({
                    "id": row.get::<Uuid, &str>("id"),
                    "user_id": row.get::<Option<Uuid>, &str>("user_id"),
                    "session_id": row.get::<Option<String>, &str>("session_id"),
                    "action": row.get::<serde_json::Value, &str>("action"),
                    "resource": row.get::<serde_json::Value, &str>("resource"),
                    "resource_id": row.get::<Option<String>, &str>("resource_id"),
                    "result": row.get::<serde_json::Value, &str>("result"),
                    "details": row.get::<Option<serde_json::Value>, _>("details"),
                    "ip_address": row.get::<Option<String>, &str>("ip_address"),
                    "user_agent": row.get::<Option<String>, &str>("user_agent"),
                    "request_id": row.get::<Option<String>, &str>("request_id"),
                    "timestamp": row.get::<chrono::DateTime<Utc>, &str>("timestamp")
                })
            }).collect();

            // Get total count
            let count_result = sqlx::query_scalar::<_, i64>(
                &format!("SELECT COUNT(*) FROM audit_logs {}", where_clause)
            )
            .fetch_one(&state.db_pool)
            .await;

            let total = count_result.unwrap_or(0);
            let total_pages = ((total as f64) / (per_page as f64)).ceil() as i64;

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": {
                    "logs": logs,
                    "pagination": {
                        "page": page,
                        "per_page": per_page,
                        "total": total,
                        "total_pages": total_pages
                    }
                }
            })))
        },
        Err(sqlx::Error::Database(db_err)) if db_err.message().contains("does not exist") => {
            // Table doesn't exist, return empty result
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": {
                    "logs": [],
                    "pagination": {
                        "page": page,
                        "per_page": per_page,
                        "total": 0,
                        "total_pages": 0
                    },
                    "note": "Audit logs table not available"
                }
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch audit logs: {}", e)
        })))
    }
}

// GET /api/reports/dashboard - Dashboard summary report
pub async fn get_dashboard_report(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    // Get today's date
    let today = Utc::now().date_naive();

    // Get today's appointments count
    let appointments_today_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM appointments WHERE date = $1"
    )
    .bind(today)
    .fetch_one(&state.db_pool)
    .await;

    // Get today's consultations count
    let consultations_today_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM consultations WHERE date = $1"
    )
    .bind(today)
    .fetch_one(&state.db_pool)
    .await;

    // Get today's revenue
    let revenue_today_result = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT SUM(total_amount) FROM invoices WHERE date = $1 AND payment_status = 'paid'"
    )
    .bind(today)
    .fetch_one(&state.db_pool)
    .await;

    // Get pending prescriptions count
    let pending_prescriptions_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM prescriptions WHERE status = 'active'"
    )
    .fetch_one(&state.db_pool)
    .await;

    // Get low stock medicines count
    let low_stock_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM medicines WHERE current_stock <= minimum_stock"
    )
    .fetch_one(&state.db_pool)
    .await;

    // Get pending invoices count
    let pending_invoices_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM invoices WHERE payment_status = 'pending'"
    )
    .fetch_one(&state.db_pool)
    .await;

    // Get total patients count
    let total_patients_result = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM patients"
    )
    .fetch_one(&state.db_pool)
    .await;

    // Get this month's revenue
    // Get first day of month using format parsing
    let first_day_str = format!("{}-{:02}-01", today.format("%Y"), today.format("%m"));
    let first_day_month = NaiveDate::parse_from_str(&first_day_str, "%Y-%m-%d").unwrap_or(today);
    let revenue_month_result = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT SUM(total_amount) FROM invoices WHERE date >= $1 AND date <= $2 AND payment_status = 'paid'"
    )
    .bind(first_day_month)
    .bind(today)
    .fetch_one(&state.db_pool)
    .await;

    match (
        appointments_today_result, consultations_today_result, revenue_today_result,
        pending_prescriptions_result, low_stock_result, pending_invoices_result,
        total_patients_result, revenue_month_result
    ) {
        (
            Ok(appointments), Ok(consultations), Ok(revenue_today),
            Ok(pending_prescriptions), Ok(low_stock), Ok(pending_invoices),
            Ok(total_patients), Ok(revenue_month)
        ) => {
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": {
                    "today": {
                        "appointments": appointments,
                        "consultations": consultations,
                        "revenue": revenue_today.unwrap_or(0.0)
                    },
                    "alerts": {
                        "pending_prescriptions": pending_prescriptions,
                        "low_stock_medicines": low_stock,
                        "pending_invoices": pending_invoices
                    },
                    "overview": {
                        "total_patients": total_patients,
                        "monthly_revenue": revenue_month.unwrap_or(0.0)
                    },
                    "generated_at": Utc::now()
                }
            })))
        },
        (Err(e), _, _, _, _, _, _, _) | (_, Err(e), _, _, _, _, _, _) | (_, _, Err(e), _, _, _, _, _) | 
        (_, _, _, Err(e), _, _, _, _) | (_, _, _, _, Err(e), _, _, _) | (_, _, _, _, _, Err(e), _, _) |
        (_, _, _, _, _, _, Err(e), _) | (_, _, _, _, _, _, _, Err(e)) => {
            Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to generate dashboard report: {}", e)
            })))
        }
    }
}

// ===========================================
// M-PESA HANDLERS
// ===========================================

#[derive(serde::Deserialize)]
pub struct InitiateStkPushRequest {
    pub phone_number: String,
    pub amount: u32,
    pub account_reference: String,
    pub transaction_desc: String,
    pub invoice_id: Uuid,
}

// POST /api/mpesa/stk-push - Initiate STK Push payment
pub async fn initiate_stk_push(
    req: web::Json<InitiateStkPushRequest>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    // Validate phone number format (Kenyan format)
    let phone_number = validate_mpesa_phone_number(&req.phone_number)
        .map_err(|e| actix_web::error::ErrorBadRequest(e))?;
    
    // Validate amount (minimum 1 KES)
    if req.amount < 1 {
        return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Amount must be at least 1 KES"
        })));
    }

    // Verify invoice exists
    let invoice_result = sqlx::query(
        "SELECT id, total_amount, payment_status FROM invoices WHERE id = $1"
    )
    .bind(req.invoice_id)
    .fetch_optional(&state.db_pool)
    .await;

    let invoice = match invoice_result {
        Ok(Some(row)) => row,
        Ok(None) => return Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Invoice not found"
        }))),
        Err(e) => return Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch invoice: {}", e)
        })))
    };

    let invoice_total: f64 = invoice.get("total_amount");
    if req.amount as f64 != invoice_total {
        return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": format!("Amount ({}) does not match invoice total ({})", req.amount, invoice_total)
        })));
    }

    // Create M-Pesa service
    let mpesa_service = MpesaService::new();

    // Generate password and timestamp
    let password = mpesa_service.generate_password()
        .map_err(|e| {
            eprintln!("Failed to generate M-Pesa password: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to generate payment credentials")
        })?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Create payload
    let payload = StkPushRequestPayload {
        business_short_code: mpesa_service.business_short_code.clone(),
        password: password.clone(),
        timestamp: timestamp.to_string(),
        transaction_type: "CustomerPayBillOnline".to_string(),
        amount: req.amount as i32,
        party_a: phone_number.clone(),
        party_b: mpesa_service.business_short_code.clone(),
        phone_number: phone_number.clone(),
        call_back_url: mpesa_service.callback_url.clone(),
        account_reference: req.account_reference.clone(),
        transaction_desc: req.transaction_desc.clone(),
        invoice_id: Some(req.invoice_id),
    };

    // Initiate STK push
    let stk_response = mpesa_service.initiate_stk_push(payload).await
        .map_err(|e| {
            eprintln!("STK push initiation failed: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to initiate payment")
        })?;

    // Store transaction in database
    let mpesa_transaction = create_mpesa_transaction(
        &state.db_pool,
        req.invoice_id,
        stk_response.merchant_request_id.clone(),
        stk_response.checkout_request_id.clone(),
        phone_number,
        req.amount as i32,
        req.account_reference.clone(),
        req.transaction_desc.clone(),
    ).await.map_err(|e| {
        eprintln!("Failed to store M-Pesa transaction: {}", e);
        actix_web::error::ErrorInternalServerError("Failed to store transaction")
    })?;

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "message": "STK push initiated successfully",
        "data": {
            "merchant_request_id": stk_response.merchant_request_id,
            "checkout_request_id": stk_response.checkout_request_id,
            "response_code": stk_response.response_code,
            "response_description": stk_response.response_description,
            "customer_message": stk_response.customer_message,
            "transaction_id": mpesa_transaction.id
        }
    })))
}

// POST /api/mpesa/callback - M-Pesa callback (public, called by Safaricom)
#[derive(serde::Deserialize)]
struct MpesaCallbackBody {
    #[serde(rename = "stkCallback")]
    stk_callback: MpesaCallbackData,
}

#[derive(serde::Deserialize)]
struct MpesaCallbackData {
    #[serde(rename = "MerchantRequestID")]
    merchant_request_id: String,
    #[serde(rename = "CheckoutRequestID")]
    checkout_request_id: String,
    #[serde(rename = "ResultCode")]
    result_code: i32,
    #[serde(rename = "ResultDesc")]
    result_desc: String,
    #[serde(rename = "CallbackMetadata")]
    callback_metadata: Option<serde_json::Value>,
}

pub async fn mpesa_callback(
    req: web::Json<serde_json::Value>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    eprintln!("Received M-Pesa callback: {}", serde_json::to_string(&req.0).unwrap_or_default());

    // Parse callback - Safaricom sends nested structure
    let body = req.get("Body").and_then(|b| b.get("stkCallback"));
    
    if body.is_none() {
        eprintln!("Invalid callback format");
        return Ok(HttpResponse::BadRequest().json(json!({
            "ResultCode": 1,
            "ResultDesc": "Invalid callback format"
        })));
    }

    let callback = body.unwrap();
    
    let merchant_request_id = callback.get("MerchantRequestID")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    
    let checkout_request_id = callback.get("CheckoutRequestID")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    
    let result_code = callback.get("ResultCode")
        .and_then(|v| v.as_i64())
        .unwrap_or(1) as i32;
    
    let result_desc = callback.get("ResultDesc")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    // Extract metadata
    let mut mpesa_receipt_number = None;
    let mut transaction_date = None;
    
    if let Some(metadata) = callback.get("CallbackMetadata")
        .and_then(|m| m.get("Item"))
        .and_then(|i| i.as_array())
    {
        for item in metadata {
            if let Some(name) = item.get("Name").and_then(|v| v.as_str()) {
                if let Some(value) = item.get("Value").and_then(|v| v.as_str()) {
                    match name {
                        "MpesaReceiptNumber" => mpesa_receipt_number = Some(value.to_string()),
                        "TransactionDate" => transaction_date = Some(value.to_string()),
                        _ => {}
                    }
                }
            }
        }
    }

    // Determine transaction status
    let status = if result_code == 0 { "Completed" } else { "Failed" };

    // Update transaction in database
    let _ = update_mpesa_transaction(
        &state.db_pool,
        checkout_request_id.clone(),
        status.to_string(),
        Some(result_code),
        Some(result_desc.clone()),
        mpesa_receipt_number.clone(),
        transaction_date.clone(),
    ).await;

    // If payment successful, update invoice
    if result_code == 0 {
        // Find invoice by transaction
        let transaction_result = get_mpesa_transaction_by_checkout_id(
            &state.db_pool,
            checkout_request_id.clone()
        ).await;

        if let Ok(Some(txn)) = transaction_result {
            // Update invoice payment status
            let _ = sqlx::query(
                "UPDATE invoices SET payment_status = 'paid', payment_method = 'mpesa', updated_at = NOW() WHERE id = $1"
            )
            .bind(txn.invoice_id)
            .execute(&state.db_pool)
            .await;
        }
    }

    // Return success response to Safaricom
    Ok(HttpResponse::Ok().json(json!({
        "ResultCode": 0,
        "ResultDesc": "Success"
    })))
}

// GET /api/mpesa/transaction/{checkout_request_id} - Get transaction status
pub async fn get_mpesa_transaction_status(
    path: web::Path<String>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let checkout_request_id = path.into_inner();
    
    let transaction = get_mpesa_transaction_by_checkout_id(
        &state.db_pool,
        checkout_request_id.clone()
    ).await
    .map_err(|e| {
        eprintln!("Failed to get M-Pesa transaction: {}", e);
        actix_web::error::ErrorInternalServerError("Failed to get transaction")
    })?;

    match transaction {
        Some(txn) => {
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": {
                    "id": txn.id,
                    "invoice_id": txn.invoice_id,
                    "merchant_request_id": txn.merchant_request_id,
                    "checkout_request_id": txn.checkout_request_id,
                    "phone_number": txn.phone_number,
                    "amount": txn.amount,
                    "account_reference": txn.account_reference,
                    "transaction_desc": txn.transaction_desc,
                    "status": txn.status,
                    "result_code": txn.result_code,
                    "result_desc": txn.result_desc,
                    "mpesa_receipt_number": txn.mpesa_receipt_number,
                    "transaction_date": txn.transaction_date,
                    "created_at": txn.created_at,
                    "updated_at": txn.updated_at
                }
            })))
        }
        None => {
            Ok(HttpResponse::NotFound().json(json!({
                "success": false,
                "error": "Transaction not found"
            })))
        }
    }
}

// GET /api/mpesa/invoice/{invoice_id}/transactions - Get invoice M-Pesa transactions
pub async fn get_invoice_mpesa_transactions(
    path: web::Path<Uuid>,
    state: web::Data<AppState>
) -> Result<HttpResponse> {
    let invoice_id = path.into_inner();
    
    let transactions = get_mpesa_transactions_by_invoice(
        &state.db_pool,
        invoice_id
    ).await
    .map_err(|e| {
        eprintln!("Failed to get M-Pesa transactions: {}", e);
        actix_web::error::ErrorInternalServerError("Failed to get transactions")
    })?;

    let response_data: Vec<serde_json::Value> = transactions.into_iter().map(|txn| {
        json!({
            "id": txn.id,
            "invoice_id": txn.invoice_id,
            "merchant_request_id": txn.merchant_request_id,
            "checkout_request_id": txn.checkout_request_id,
            "phone_number": txn.phone_number,
            "amount": txn.amount,
            "account_reference": txn.account_reference,
            "transaction_desc": txn.transaction_desc,
            "status": txn.status,
            "result_code": txn.result_code,
            "result_desc": txn.result_desc,
            "mpesa_receipt_number": txn.mpesa_receipt_number,
            "transaction_date": txn.transaction_date,
            "created_at": txn.created_at,
            "updated_at": txn.updated_at
        })
    }).collect();

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "data": response_data,
        "count": response_data.len()
    })))
}

// Helper function to validate Kenyan phone number
fn validate_mpesa_phone_number(phone: &str) -> Result<String, String> {
    let cleaned = phone.replace(&[' ', '-', '(', ')'], "");
    
    if cleaned.starts_with("+254") && cleaned.len() == 13 {
        return Ok(cleaned);
    }
    
    if cleaned.starts_with("254") && cleaned.len() == 12 {
        return Ok(format!("+{}", cleaned));
    }
    
    if cleaned.starts_with("0") && cleaned.len() == 10 {
        return Ok(format!("+254{}", &cleaned[1..]));
    }
    
    if cleaned.len() == 9 && cleaned.chars().all(|c| c.is_ascii_digit()) {
        return Ok(format!("+254{}", cleaned));
    }
    
    Err("Invalid phone number format. Use format: +254XXXXXXXXX".to_string())
}

// ===========================================
// SMS HANDLERS
// ===========================================

#[derive(serde::Deserialize)]
pub struct SendSMSRequest {
    pub phone_number: String,
    pub message: String,
}

#[derive(serde::Deserialize)]
pub struct SendTemplateSMSRequest {
    pub phone_number: String,
    pub template_name: String,
    pub variables: std::collections::HashMap<String, String>,
}

// Initialize SMS service from environment
fn get_sms_service() -> Result<services::SMSService, String> {
    use services::{SMSService, SMSConfig};
    use std::collections::HashMap;
    
    let api_key = std::env::var("SMS_API_KEY")
        .map_err(|_| "SMS_API_KEY not set".to_string())?;
    let username = std::env::var("SMS_USERNAME")
        .map_err(|_| "SMS_USERNAME not set".to_string())?;
    let sender_id = std::env::var("SMS_SENDER_ID")
        .unwrap_or_else(|_| "SETHMED".to_string());
    let base_url = std::env::var("SMS_BASE_URL")
        .unwrap_or_else(|_| "https://api.africastalking.com/version1".to_string());
    
    let config = SMSConfig {
        api_key,
        username,
        sender_id,
        base_url,
        templates: SMSConfig::default_templates(),
    };
    
    Ok(SMSService::new(config))
}

// POST /api/sms/send - Send SMS
pub async fn send_sms(
    req: web::Json<SendSMSRequest>,
) -> Result<HttpResponse> {
    let sms_service = get_sms_service()
        .map_err(|e| {
            eprintln!("Failed to initialize SMS service: {}", e);
            actix_web::error::ErrorInternalServerError("SMS service not configured")
        })?;
    
    // Validate phone number
    let phone_number = validate_mpesa_phone_number(&req.phone_number)
        .map_err(|e| actix_web::error::ErrorBadRequest(e))?;
    
    match sms_service.send_sms(&phone_number, &req.message).await {
        Ok(response) => {
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "message": "SMS sent successfully",
                "data": {
                    "message_id": response.sms.message_id,
                    "status": response.sms.status,
                    "cost": response.sms.cost,
                    "number": response.sms.number
                }
            })))
        }
        Err(e) => {
            eprintln!("Failed to send SMS: {}", e);
            Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to send SMS: {}", e)
            })))
        }
    }
}

// POST /api/sms/send-template - Send template SMS
pub async fn send_template_sms(
    req: web::Json<SendTemplateSMSRequest>,
) -> Result<HttpResponse> {
    let sms_service = get_sms_service()
        .map_err(|e| {
            eprintln!("Failed to initialize SMS service: {}", e);
            actix_web::error::ErrorInternalServerError("SMS service not configured")
        })?;
    
    // Validate phone number
    let phone_number = validate_mpesa_phone_number(&req.phone_number)
        .map_err(|e| actix_web::error::ErrorBadRequest(e))?;
    
    match sms_service.send_template_sms(&phone_number, &req.template_name, req.variables.clone()).await {
        Ok(response) => {
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "message": "Template SMS sent successfully",
                "data": {
                    "message_id": response.sms.message_id,
                    "status": response.sms.status,
                    "cost": response.sms.cost,
                    "number": response.sms.number
                }
            })))
        }
        Err(e) => {
            eprintln!("Failed to send template SMS: {}", e);
            Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to send template SMS: {}", e)
            })))
        }
    }
}

// GET /api/sms/balance - Get SMS account balance
pub async fn get_sms_balance() -> Result<HttpResponse> {
    let sms_service = get_sms_service()
        .map_err(|e| {
            eprintln!("Failed to initialize SMS service: {}", e);
            actix_web::error::ErrorInternalServerError("SMS service not configured")
        })?;
    
    match sms_service.get_balance().await {
        Ok(balance) => {
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": {
                    "balance": balance,
                    "currency": "KES"
                }
            })))
        }
        Err(e) => {
            eprintln!("Failed to get SMS balance: {}", e);
            Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to get SMS balance: {}", e)
            })))
        }
    }
}

// ===========================================
// EMAIL HANDLERS
// ===========================================

#[derive(serde::Deserialize)]
pub struct SendEmailRequest {
    pub to: String,
    pub subject: String,
    pub html_body: String,
    pub text_body: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct SendTemplateEmailRequest {
    pub to: String,
    pub template_name: String,
    pub variables: std::collections::HashMap<String, String>,
}

// Initialize Email service from environment
fn get_email_service() -> Result<services::EmailService, String> {
    use services::{EmailService, EmailConfig};
    
    let smtp_host = std::env::var("SMTP_HOST")
        .unwrap_or_else(|_| "smtp.gmail.com".to_string());
    let smtp_port = std::env::var("SMTP_PORT")
        .unwrap_or_else(|_| "587".to_string())
        .parse::<u16>()
        .map_err(|_| "Invalid SMTP_PORT".to_string())?;
    let smtp_username = std::env::var("SMTP_USERNAME")
        .map_err(|_| "SMTP_USERNAME not set".to_string())?;
    let smtp_password = std::env::var("SMTP_PASSWORD")
        .map_err(|_| "SMTP_PASSWORD not set".to_string())?;
    let from_email = std::env::var("FROM_EMAIL")
        .or_else(|_| std::env::var("SMTP_FROM_EMAIL"))
        .unwrap_or_else(|_| "noreply@sethmedicalclinic.com".to_string());
    let from_name = std::env::var("FROM_NAME")
        .or_else(|_| std::env::var("SMTP_FROM_NAME"))
        .unwrap_or_else(|_| "Seth Medical Clinic".to_string());
    
    let config = EmailConfig {
        api_key: String::new(), // Not used for SMTP
        from_email,
        from_name,
        smtp_host,
        smtp_port,
        smtp_username,
        smtp_password,
        templates: EmailConfig::default_templates(),
    };
    
    EmailService::new(config)
        .map_err(|e| format!("Failed to create email service: {}", e))
}

// POST /api/email/send - Send email
pub async fn send_email(
    req: web::Json<SendEmailRequest>,
) -> Result<HttpResponse> {
    let email_service = get_email_service()
        .map_err(|e| {
            eprintln!("Failed to initialize email service: {}", e);
            actix_web::error::ErrorInternalServerError("Email service not configured")
        })?;
    
    match email_service.send_email(
        &req.to,
        &req.subject,
        &req.html_body,
        req.text_body.as_deref()
    ).await {
        Ok(_) => {
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "message": "Email sent successfully"
            })))
        }
        Err(e) => {
            eprintln!("Failed to send email: {}", e);
            Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to send email: {}", e)
            })))
        }
    }
}

// POST /api/email/send-template - Send template email
pub async fn send_template_email(
    req: web::Json<SendTemplateEmailRequest>,
) -> Result<HttpResponse> {
    let email_service = get_email_service()
        .map_err(|e| {
            eprintln!("Failed to initialize email service: {}", e);
            actix_web::error::ErrorInternalServerError("Email service not configured")
        })?;
    
    match email_service.send_template_email(&req.to, &req.template_name, req.variables.clone()).await {
        Ok(_) => {
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "message": "Template email sent successfully"
            })))
        }
        Err(e) => {
            eprintln!("Failed to send template email: {}", e);
            Ok(HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": format!("Failed to send template email: {}", e)
            })))
        }
    }
}
