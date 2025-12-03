use actix_web::{web, HttpResponse, Result, HttpRequest};
use jsonwebtoken::{encode, Header, EncodingKey};
use serde_json::json;
use uuid::Uuid;
use chrono::{Utc, Duration};

use crate::models::{LoginRequest, LoginResponse, User, ApiResponse};
use crate::AppState;
use crate::middleware::auth::Claims;
use crate::auth::AuthService;
use crate::mfa::MfaService;

pub async fn login(
    req: web::Json<LoginRequest>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    let login_req = req.into_inner();
    
    // Add error handling wrapper
    match login_internal(login_req, data).await {
        Ok(response) => Ok(response),
        Err(e) => {
              Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Authentication error: {}", e)),
            }))
        }
    }
}

async fn login_internal(
    login_req: LoginRequest,
    data: web::Data<AppState>,
) -> Result<HttpResponse, Box<dyn std::error::Error>> {
    
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
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Invalid credentials".to_string()),
            }));
        }
    };

    // Verify password using AuthService
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "your-super-secret-jwt-key-change-this-in-production".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 30);
    let password_valid = match auth_service.verify_password(&login_req.password, &user.password_hash) {
        Ok(is_valid) => is_valid,
        Err(_) => {
            // If Argon2 verification fails, try simple comparison for backward compatibility
            login_req.password == user.password_hash
        }
    };
    
    if !password_valid {
          return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Invalid credentials".to_string()),
        }));
    }

    // Check if MFA is enabled for this user
    let mfa_enabled: Option<bool> = sqlx::query_scalar(
        "SELECT mfa_enabled FROM users WHERE id = $1"
    )
    .bind(user.id)
        .fetch_optional(&data.db_pool)
    .await
    .ok()
    .flatten();

    // If MFA is enabled, create MFA session instead of generating token
    if mfa_enabled.unwrap_or(false) {
        let mfa_service = MfaService::new(data.db_pool.clone());
        
        // Get IP address and user agent from request (if available)
        // For now, we'll use None as we don't have direct access to HttpRequest here
        let mfa_session_token = mfa_service.create_mfa_session(
            user.id,
            None, // IP address
            None, // User agent
        ).await.map_err(|e| format!("Failed to create MFA session: {}", e))?;

        // Return MFA required response
        return Ok(HttpResponse::Ok().json(ApiResponse {
            success: true,
            data: Some(json!({
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
                },
                "mfa_required": true,
                "mfa_session_token": mfa_session_token
            })),
            message: Some("MFA verification required".to_string()),
            error: None,
        }));
    }

    // Note: last_login column doesn't exist in current schema
    // Could add it in a future migration if needed

    // Generate JWT token
    let now = Utc::now();
    let claims = Claims {
        sub: user.id.to_string(),
        username: user.username.clone(),
        role: user.role.clone(),
        permissions: user.permissions.clone(),
        exp: (now + Duration::seconds(86400)).timestamp() as u64,
        iat: now.timestamp() as u64,
        jti: uuid::Uuid::new_v4().to_string(),
    };

    let token = match encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_ref()),
    ) {
        Ok(token) => token,
        Err(e) => {
              return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Token generation failed: {}", e)),
            }));
        }
    };

    // Generate refresh token (longer expiration)
    let refresh_claims = Claims {
        sub: user.id.to_string(),
        username: user.username.clone(),
        role: user.role.clone(),
        permissions: user.permissions.clone(),
        exp: (now + Duration::days(30)).timestamp() as u64,
        iat: now.timestamp() as u64,
        jti: uuid::Uuid::new_v4().to_string(),
    };

    let refresh_token = match encode(
        &Header::default(),
        &refresh_claims,
        &EncodingKey::from_secret(jwt_secret.as_ref()),
    ) {
        Ok(token) => token,
        Err(e) => {
              return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Refresh token generation failed: {}", e)),
            }));
        }
    };

    let response = LoginResponse {
        user: User {
            password_hash: "".to_string(), // Don't send password hash
            ..user
        },
        token,
        refresh_token,
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(response),
        message: Some("Login successful".to_string()),
        error: None,
    }))
}

pub async fn refresh(
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "your-super-secret-jwt-key-change-this-in-production".to_string());
    
    let refresh_token = req.get("refresh_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| actix_web::error::ErrorBadRequest("Refresh token required"))?;

    // Validate refresh token
    let claims = jsonwebtoken::decode::<Claims>(
        refresh_token,
        &jsonwebtoken::DecodingKey::from_secret(jwt_secret.as_ref()),
        &jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256),
    ).map_err(|_| actix_web::error::ErrorUnauthorized("Invalid refresh token"))?;

    // Get user from database
    let user_result = sqlx::query_as::<_, User>(
        "SELECT id, username, email, role, name, department, permissions, is_active, created_at, updated_at, password_hash FROM users WHERE id = $1 AND is_active = true"
    )
    .bind(Uuid::parse_str(&claims.claims.sub).unwrap())
        .fetch_one(&data.db_pool)
    .await;

    let user = match user_result {
        Ok(user) => user,
        Err(_) => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("User not found".to_string()),
            }));
        }
    };

    // Generate new access token
    let now = Utc::now();
    let new_claims = Claims {
        sub: user.id.to_string(),
        username: user.username.clone(),
        role: user.role.clone(),
        permissions: user.permissions.clone(),
        exp: (now + Duration::seconds(86400)).timestamp() as u64,
        iat: now.timestamp() as u64,
        jti: uuid::Uuid::new_v4().to_string(),
    };

    let new_token = encode(
        &Header::default(),
        &new_claims,
        &EncodingKey::from_secret(jwt_secret.as_ref()),
    ).unwrap();

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({
            "token": new_token,
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
        })),
        message: Some("Token refreshed successfully".to_string()),
        error: None,
    }))
}

pub async fn logout(
    req: HttpRequest,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    // In a real implementation, you would add the token to a blacklist
    // For now, we'll just return success
    Ok(HttpResponse::Ok().json(ApiResponse::<()> {
        success: true,
        data: None,
        message: Some("Logout successful".to_string()),
        error: None,
    }))
}

pub async fn get_current_user(
    req: HttpRequest,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    let claims = crate::middleware::auth::get_current_user(&req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_result = sqlx::query_as::<_, User>(
        "SELECT id, username, email, role, name, department, permissions, is_active, created_at, updated_at, password_hash FROM users WHERE id = $1 AND is_active = true"
    )
    .bind(Uuid::parse_str(&claims.sub).unwrap())
        .fetch_one(&data.db_pool)
    .await;

    let user = match user_result {
        Ok(user) => user,
        Err(_) => {
            return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("User not found".to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(User {
            password_hash: "".to_string(), // Don't send password hash
            ..user
        }),
        message: None,
        error: None,
    }))
}
