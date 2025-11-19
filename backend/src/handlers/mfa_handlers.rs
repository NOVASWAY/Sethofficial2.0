use actix_web::{web, HttpResponse, HttpRequest};
use serde_json::json;
use uuid::Uuid;

use crate::mfa::{MfaService, MfaVerificationRequest, MfaEnrollmentRequest};
use crate::errors::AppError;
use crate::models::ApiResponse;
use crate::middleware::auth::get_current_user;

/// Get user's MFA status
pub async fn get_mfa_status(
    req: HttpRequest,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, AppError> {
    let claims = get_current_user(&req)
        .ok_or_else(|| AppError::Authentication("Unauthorized".to_string()))?;
    
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Authentication("Invalid user ID".to_string()))?;

    let mfa_service = MfaService::new(data.db_pool.clone());
    let status = mfa_service.get_user_mfa_status(user_id).await?;

    Ok(HttpResponse::Ok().json(ApiResponse {
        error: None,
        success: true,
        data: Some(json!(status)),
        message: Some("MFA status retrieved successfully".to_string()),
    }))
}

/// Setup TOTP for user
pub async fn setup_totp(
    req: HttpRequest,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, AppError> {
    let claims = get_current_user(&req)
        .ok_or_else(|| AppError::Authentication("Unauthorized".to_string()))?;
    
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Authentication("Invalid user ID".to_string()))?;

    // Get user details
    let user = sqlx::query_as!(
        crate::models::User,
        "SELECT id, username, email, role, name, department, permissions, is_active, created_at, updated_at, password_hash FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(&data.db_pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    let mfa_service = MfaService::new(data.db_pool.clone());
    let setup_response = mfa_service.setup_totp(
        user_id,
        &user.username,
        &user.email,
    ).await?;

    Ok(HttpResponse::Ok().json(ApiResponse {
        error: None,
        success: true,
        data: Some(json!(setup_response)),
        message: Some("TOTP setup completed. Scan the QR code with your authenticator app.".to_string()),
    }))
}

/// Verify MFA code and complete login
pub async fn verify_mfa(
    req: web::Json<MfaVerificationRequest>,
    http_req: HttpRequest,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, AppError> {
    // Validate request - check code is not empty
    if req.code.is_empty() {
        return Err(AppError::Internal("MFA code is required".to_string()));
    }
    if req.session_token.is_empty() {
        return Err(AppError::Internal("Session token is required".to_string()));
    }

    let ip_address = http_req
        .peer_addr()
        .map(|addr| addr.ip().to_string());
    let user_agent = http_req
        .headers()
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    let mfa_service = MfaService::new(data.db_pool.clone());
    let user_id = mfa_service.verify_mfa_session(
        &req.session_token,
        &req.code,
        &req.method,
        ip_address.as_deref(),
        user_agent.as_deref(),
    ).await?;

    // Generate JWT token for the user
    let user = sqlx::query_as!(
        crate::models::User,
        "SELECT id, username, email, role, name, department, permissions, is_active, created_at, updated_at, password_hash FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(&data.db_pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "your-super-secret-jwt-key-change-this-in-production".to_string());
    let auth_service = crate::auth::AuthService::new(&jwt_secret, 24, 7);
    let token = auth_service.generate_access_token(&user)
        .map_err(|e| AppError::Internal(format!("Failed to generate token: {}", e)))?;
    let refresh_token = auth_service.generate_refresh_token(user_id)
        .map_err(|e| AppError::Internal(format!("Failed to generate refresh token: {}", e)))?;

    Ok(HttpResponse::Ok().json(ApiResponse {
        error: None,
        success: true,
        data: Some(json!({
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.role,
                "name": user.name,
                "department": user.department,
            },
            "token": token,
            "refresh_token": refresh_token,
        })),
        message: Some("MFA verification successful".to_string()),
    }))
}

/// Disable MFA for user
pub async fn disable_mfa(
    req: HttpRequest,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, AppError> {
    let claims = get_current_user(&req)
        .ok_or_else(|| AppError::Authentication("Unauthorized".to_string()))?;
    
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Authentication("Invalid user ID".to_string()))?;

    let mfa_service = MfaService::new(data.db_pool.clone());
    mfa_service.disable_mfa(user_id).await?;

    Ok(HttpResponse::Ok().json(ApiResponse::<()> {
        error: None,
        success: true,
        data: None,
        message: Some("MFA disabled successfully".to_string()),
    }))
}

/// Get MFA session status
pub async fn get_mfa_session(
    session_token: web::Path<String>,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, AppError> {
    let mfa_service = MfaService::new(data.db_pool.clone());
    let session = mfa_service.get_mfa_session(&session_token.into_inner()).await?;

    Ok(HttpResponse::Ok().json(ApiResponse {
        error: None,
        success: true,
        data: Some(json!({
            "session_token": session.session_token,
            "mfa_verified": session.mfa_verified,
            "expires_at": session.expires_at,
        })),
        message: None,
    }))
}

