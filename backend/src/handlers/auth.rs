use actix_web::{web, HttpResponse, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::{LoginRequest, LoginResponse, UserResponse, User, UserRole};
use crate::auth::{AuthService, validate_password};
use crate::database::Database;
use crate::redis_client::RedisClient;

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
}

pub async fn login(
    req: web::Json<LoginRequest>,
    database: web::Data<Database>,
    redis_client: web::Data<RedisClient>,
    auth_service: web::Data<AuthService>,
) -> Result<HttpResponse> {
    // Find user by username and role
    let user = match sqlx::query_as!(
        User,
        "SELECT * FROM users WHERE username = $1 AND role = $2 AND is_active = true",
        req.username,
        req.role
    )
    .fetch_optional(database.get_pool())
    .await
    {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Ok(HttpResponse::Unauthorized().json(ErrorResponse {
                error: "Invalid credentials".to_string(),
                message: "Username, password, or role is incorrect".to_string(),
            }));
        }
        Err(e) => {
            log::error!("Database error during login: {:?}", e);
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Database error".to_string(),
                message: "Failed to authenticate user".to_string(),
            }));
        }
    };

    // Verify password
    if !auth_service.verify_password(&req.password, &user.password_hash)? {
        return Ok(HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Invalid credentials".to_string(),
            message: "Username, password, or role is incorrect".to_string(),
        }));
    }

    // Generate tokens
    let access_token = auth_service.generate_access_token(&user)?;
    let refresh_token = auth_service.generate_refresh_token(user.id)?;

    // Store refresh token in Redis
    let refresh_token_key = format!("refresh_token:{}", user.id);
    redis_client.set(
        &refresh_token_key,
        &refresh_token,
        Some(std::time::Duration::from_secs(7 * 24 * 60 * 60)), // 7 days
    ).await.map_err(|e| {
        log::error!("Failed to store refresh token: {:?}", e);
        actix_web::error::ErrorInternalServerError("Failed to store refresh token")
    })?;

    // Update last login
    sqlx::query!(
        "UPDATE users SET last_login = NOW() WHERE id = $1",
        user.id
    )
    .execute(database.get_pool())
    .await
    .map_err(|e| {
        log::error!("Failed to update last login: {:?}", e);
        actix_web::error::ErrorInternalServerError("Failed to update last login")
    })?;

    let response = LoginResponse {
        user: UserResponse::from(user),
        access_token,
        refresh_token,
    };

    Ok(HttpResponse::Ok().json(response))
}

pub async fn logout(
    req: web::HttpRequest,
    redis_client: web::Data<RedisClient>,
) -> Result<HttpResponse> {
    // Extract user ID from token
    let auth_header = req.headers().get("Authorization")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");

    let token = AuthService::extract_token_from_header(auth_header);
    
    if let Some(token) = token {
        // Invalidate refresh token
        // Note: In a real implementation, you'd need to decode the token to get the user ID
        // For now, we'll just return success
        log::info!("User logged out");
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Logged out successfully"
    })))
}

pub async fn refresh(
    req: web::Json<RefreshRequest>,
    database: web::Data<Database>,
    redis_client: web::Data<RedisClient>,
    auth_service: web::Data<AuthService>,
) -> Result<HttpResponse> {
    // Verify refresh token
    let claims = auth_service.verify_refresh_token(&req.refresh_token)?;

    // Check if refresh token exists in Redis
    let refresh_token_key = format!("refresh_token:{}", claims.sub);
    let stored_token = redis_client.get(&refresh_token_key).await?;

    if stored_token != Some(req.refresh_token.clone()) {
        return Ok(HttpResponse::Unauthorized().json(ErrorResponse {
            error: "Invalid refresh token".to_string(),
            message: "Refresh token is invalid or expired".to_string(),
        }));
    }

    // Get user from database
    let user_id = Uuid::parse_str(&claims.sub)?;
    let user = sqlx::query_as!(
        User,
        "SELECT * FROM users WHERE id = $1 AND is_active = true",
        user_id
    )
    .fetch_optional(database.get_pool())
    .await?
    .ok_or_else(|| actix_web::error::ErrorNotFound("User not found"))?;

    // Generate new tokens
    let access_token = auth_service.generate_access_token(&user)?;
    let new_refresh_token = auth_service.generate_refresh_token(user.id)?;

    // Update refresh token in Redis
    redis_client.set(
        &refresh_token_key,
        &new_refresh_token,
        Some(std::time::Duration::from_secs(7 * 24 * 60 * 60)), // 7 days
    ).await?;

    let response = LoginResponse {
        user: UserResponse::from(user),
        access_token,
        refresh_token: new_refresh_token,
    };

    Ok(HttpResponse::Ok().json(response))
}

pub async fn me(
    req: web::HttpRequest,
    database: web::Data<Database>,
    auth_service: web::Data<AuthService>,
) -> Result<HttpResponse> {
    // Extract and verify token
    let auth_header = req.headers().get("Authorization")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");

    let token = AuthService::extract_token_from_header(auth_header)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("No token provided"))?;

    let claims = auth_service.verify_access_token(&token)?;

    // Get user from database
    let user_id = Uuid::parse_str(&claims.sub)?;
    let user = sqlx::query_as!(
        User,
        "SELECT * FROM users WHERE id = $1 AND is_active = true",
        user_id
    )
    .fetch_optional(database.get_pool())
    .await?
    .ok_or_else(|| actix_web::error::ErrorNotFound("User not found"))?;

    Ok(HttpResponse::Ok().json(UserResponse::from(user)))
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}
