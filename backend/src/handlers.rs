use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{AppState, models::User};

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
    state: web::Data<AppState>
) -> Result<HttpResponse> {
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
        "INSERT INTO users (id, username, password_hash, role, name, department, permissions, is_active, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        Uuid::new_v4(),
        username,
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
            match state.auth_service.verify_password(&user.password_hash, password) {
                Ok(true) => {
                    // Generate JWT token
                    match state.auth_service.generate_token(&user) {
                        Ok(token) => Ok(HttpResponse::Ok().json(json!({
                            "success": true,
                            "token": token,
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
    // For now, just return a simple response
    // In a real implementation, you'd extract and verify the JWT token
    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "message": "Profile endpoint - authentication required",
        "note": "JWT verification not yet implemented"
    })))
}
