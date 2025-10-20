use actix_web::{web, HttpRequest, HttpResponse, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{Utc, Duration};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::{
    AppState, 
    security::{
        SecurityConfig, 
        PasswordSecurity, 
        LoginAttemptTracker, 
        SessionManager,
        SecurityUtils,
        InputSanitizer,
        SecureClaims
    },
    error::ApiError,
    models::{User, CreateUser},
    auth::AuthService,
};

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
    pub remember_me: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    pub name: String,
    pub role: String,
    pub department: Option<String>,
    pub permissions: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub success: bool,
    pub data: Option<LoginData>,
    pub message: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LoginData {
    pub access_token: String,
    pub refresh_token: String,
    pub user: UserResponse,
    pub session_id: String,
    pub expires_in: u64,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: String,
    pub username: String,
    pub name: String,
    pub role: String,
    pub department: Option<String>,
    pub permissions: serde_json::Value,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Deserialize)]
pub struct ResetPasswordRequest {
    pub username: String,
}

// Enhanced login with security features
pub async fn secure_login(
    req: web::Json<LoginRequest>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let login_data = req.into_inner();
    
    // Sanitize input
    let username = InputSanitizer::sanitize_string(&login_data.username);
    let password = InputSanitizer::sanitize_string(&login_data.password);
    
    if username.is_empty() || password.is_empty() {
        return Ok(HttpResponse::BadRequest().json(LoginResponse {
            success: false,
            data: None,
            message: None,
            error: Some("Username and password are required".to_string()),
        }));
    }

    // Get client information for security tracking
    let client_ip = http_req
        .connection_info()
        .remote_addr()
        .unwrap_or("unknown")
        .to_string();
    
    let user_agent = http_req
        .headers()
        .get("User-Agent")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("")
        .to_string();

    // Check for suspicious requests
    if SecurityUtils::is_suspicious_request(&http_req) {
        return Ok(HttpResponse::Forbidden().json(LoginResponse {
            success: false,
            data: None,
            message: None,
            error: Some("Access denied".to_string()),
        }));
    }

    // Check login attempts and lockout
    let login_tracker = data.login_attempt_tracker.as_ref().unwrap();
    if login_tracker.is_locked(&username) {
        if let Some(remaining_time) = login_tracker.get_remaining_lockout_time(&username) {
            return Ok(HttpResponse::TooManyRequests().json(LoginResponse {
                success: false,
                data: None,
                message: None,
                error: Some(format!(
                    "Account locked due to too many failed attempts. Try again in {} minutes.",
                    remaining_time / 60
                )),
            }));
        }
    }

    // Find user by username
    let user = match sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE username = $1 AND is_active = true"
    )
    .bind(&username)
    .fetch_optional(&data.database.pool)
    .await
    {
        Ok(Some(user)) => user,
        Ok(None) => {
            // Record failed attempt
            login_tracker.record_failed_attempt(&username);
            return Ok(HttpResponse::Unauthorized().json(LoginResponse {
                success: false,
                data: None,
                message: None,
                error: Some("Invalid username or password".to_string()),
            }));
        }
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(LoginResponse {
                success: false,
                data: None,
                message: None,
                error: Some("Database error".to_string()),
            }));
        }
    };

    // Verify password
    match PasswordSecurity::verify_password(&password, &user.password_hash) {
        Ok(true) => {
            // Password is correct
            login_tracker.record_successful_attempt(&username);
        }
        Ok(false) => {
            // Password is incorrect
            login_tracker.record_failed_attempt(&username);
            return Ok(HttpResponse::Unauthorized().json(LoginResponse {
                success: false,
                data: None,
                message: None,
                error: Some("Invalid username or password".to_string()),
            }));
        }
        Err(_) => {
            return Ok(HttpResponse::InternalServerError().json(LoginResponse {
                success: false,
                data: None,
                message: None,
                error: Some("Authentication error".to_string()),
            }));
        }
    }

    // Generate tokens
    let now = Utc::now();
    let exp = now + Duration::hours(data.security_config.jwt_expiration_hours as i64);
    
    let session_id = Uuid::new_v4().to_string();
    let jti = Uuid::new_v4().to_string();
    
    // Create secure claims
    let claims = SecureClaims {
        sub: user.id.to_string(),
        username: user.username.clone(),
        role: user.role.clone(),
        permissions: user.permissions.clone(),
        exp: exp.timestamp() as u64,
        iat: now.timestamp() as u64,
        jti: jti.clone(),
        iss: "clinic-management".to_string(),
        aud: "clinic-management-users".to_string(),
        nbf: now.timestamp() as u64,
        session_id: session_id.clone(),
        ip_address: client_ip.clone(),
        user_agent_hash: SecurityUtils::hash_user_agent(&user_agent),
    };

    // Generate access token
    let access_token = match data.auth_service.generate_access_token(&user) {
        Ok(token) => token,
        Err(_) => {
            return Ok(HttpResponse::InternalServerError().json(LoginResponse {
                success: false,
                data: None,
                message: None,
                error: Some("Token generation failed".to_string()),
            }));
        }
    };

    // Generate refresh token
    let refresh_token = match data.auth_service.generate_refresh_token(user.id) {
        Ok(token) => token,
        Err(_) => {
            return Ok(HttpResponse::InternalServerError().json(LoginResponse {
                success: false,
                data: None,
                message: None,
                error: Some("Refresh token generation failed".to_string()),
            }));
        }
    };

    // Create session
    if let Some(session_manager) = &data.session_manager {
        session_manager.create_session(&user.id.to_string(), &client_ip, &user_agent);
    }

    // Update last login time
    let _ = sqlx::query(
        "UPDATE users SET updated_at = $1 WHERE id = $2"
    )
    .bind(Utc::now())
    .bind(user.id)
    .execute(&data.database.pool)
    .await;

    // Log successful login
    if let Some(audit_service) = &data.audit_service {
        let _ = audit_service.log_action(
            &user.id.to_string(),
            "LOGIN",
            "User",
            &user.id.to_string(),
            Some(serde_json::json!({
                "ip_address": client_ip,
                "user_agent": user_agent,
                "session_id": session_id
            }))
        ).await;
    }

    let user_response = UserResponse {
        id: user.id.to_string(),
        username: user.username,
        name: user.name,
        role: user.role,
        department: user.department,
        permissions: user.permissions,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
    };

    Ok(HttpResponse::Ok().json(LoginResponse {
        success: true,
        data: Some(LoginData {
            access_token,
            refresh_token,
            user: user_response,
            session_id,
            expires_in: data.security_config.jwt_expiration_hours * 3600,
        }),
        message: Some("Login successful".to_string()),
        error: None,
    }))
}

// Enhanced registration with security features
pub async fn secure_register(
    req: web::Json<RegisterRequest>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let register_data = req.into_inner();
    
    // Sanitize input
    let username = InputSanitizer::sanitize_string(&register_data.username);
    let password = InputSanitizer::sanitize_string(&register_data.password);
    let name = InputSanitizer::sanitize_string(&register_data.name);
    let role = InputSanitizer::sanitize_string(&register_data.role);
    
    // Validate input
    if username.is_empty() || password.is_empty() || name.is_empty() || role.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "success": false,
            "message": "All required fields must be provided",
            "error": "MISSING_REQUIRED_FIELDS"
        })));
    }

    // Validate password strength
    match PasswordSecurity::validate_password_strength(&password, &data.security_config) {
        Ok(_) => {},
        Err(error) => {
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "success": false,
                "message": error,
                "error": "WEAK_PASSWORD"
            })));
        }
    }

    // Check if username already exists
    let existing_user = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM users WHERE username = $1"
    )
    .bind(&username)
    .fetch_one(&data.database.pool)
    .await;

    match existing_user {
        Ok(count) if count > 0 => {
            return Ok(HttpResponse::Conflict().json(serde_json::json!({
                "success": false,
                "message": "Username already exists",
                "error": "USERNAME_EXISTS"
            })));
        }
        Ok(_) => {},
        Err(_) => {
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "message": "Database error",
                "error": "DATABASE_ERROR"
            })));
        }
    }

    // Hash password
    let password_hash = match PasswordSecurity::hash_password(&password) {
        Ok(hash) => hash,
        Err(_) => {
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "message": "Password hashing failed",
                "error": "HASHING_ERROR"
            })));
        }
    };

    // Create user
    let user_id = Uuid::new_v4();
    let now = Utc::now();
    let permissions = serde_json::to_value(register_data.permissions.unwrap_or_default()).unwrap_or_default();

    let result = sqlx::query(
        r#"
        INSERT INTO users (
            id, username, password_hash, role, name, department, permissions, is_active, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
        "#
    )
    .bind(user_id)
    .bind(&username)
    .bind(&password_hash)
    .bind(&role)
    .bind(&name)
    .bind(&register_data.department)
    .bind(&permissions)
    .bind(true)
    .bind(now)
    .bind(now)
    .execute(&data.database.pool)
    .await;

    match result {
        Ok(_) => {
            // Log user creation
            if let Some(audit_service) = &data.audit_service {
                let _ = audit_service.log_action(
                    &user_id.to_string(),
                    "CREATE",
                    "User",
                    &user_id.to_string(),
                    Some(serde_json::json!({
                        "username": username,
                        "role": role,
                        "department": register_data.department
                    }))
                ).await;
            }

            Ok(HttpResponse::Created().json(serde_json::json!({
                "success": true,
                "message": "User created successfully",
                "data": {
                    "user_id": user_id,
                    "username": username,
                    "name": name,
                    "role": role
                }
            })))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "message": "Failed to create user",
                "error": "CREATION_FAILED"
            })))
        }
    }
}

// Secure logout
pub async fn secure_logout(
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    // Extract user from token
    if let Some(claims) = http_req.extensions().get::<SecureClaims>() {
        // Invalidate session
        if let Some(session_manager) = &data.session_manager {
            session_manager.invalidate_session(&claims.session_id);
        }

        // Log logout
        if let Some(audit_service) = &data.audit_service {
            let _ = audit_service.log_action(
                &claims.sub,
                "LOGOUT",
                "User",
                &claims.sub,
                Some(serde_json::json!({
                    "session_id": claims.session_id,
                    "ip_address": claims.ip_address
                }))
            ).await;
        }
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": "Logout successful"
    })))
}

// Change password
pub async fn change_password(
    req: web::Json<ChangePasswordRequest>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let change_data = req.into_inner();
    
    // Get current user
    let claims = match http_req.extensions().get::<SecureClaims>() {
        Some(claims) => claims,
        None => {
            return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
                "success": false,
                "message": "Authentication required",
                "error": "UNAUTHORIZED"
            })));
        }
    };

    // Validate new password strength
    match PasswordSecurity::validate_password_strength(&change_data.new_password, &data.security_config) {
        Ok(_) => {},
        Err(error) => {
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "success": false,
                "message": error,
                "error": "WEAK_PASSWORD"
            })));
        }
    }

    // Get current user data
    let user = match sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1"
    )
    .bind(Uuid::parse_str(&claims.sub).unwrap())
    .fetch_optional(&data.database.pool)
    .await
    {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "success": false,
                "message": "User not found",
                "error": "USER_NOT_FOUND"
            })));
        }
        Err(_) => {
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "message": "Database error",
                "error": "DATABASE_ERROR"
            })));
        }
    };

    // Verify current password
    match PasswordSecurity::verify_password(&change_data.current_password, &user.password_hash) {
        Ok(true) => {},
        Ok(false) => {
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "success": false,
                "message": "Current password is incorrect",
                "error": "INVALID_CURRENT_PASSWORD"
            })));
        }
        Err(_) => {
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "message": "Password verification failed",
                "error": "VERIFICATION_ERROR"
            })));
        }
    }

    // Hash new password
    let new_password_hash = match PasswordSecurity::hash_password(&change_data.new_password) {
        Ok(hash) => hash,
        Err(_) => {
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "message": "Password hashing failed",
                "error": "HASHING_ERROR"
            })));
        }
    };

    // Update password
    let result = sqlx::query(
        "UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3"
    )
    .bind(&new_password_hash)
    .bind(Utc::now())
    .bind(Uuid::parse_str(&claims.sub).unwrap())
    .execute(&data.database.pool)
    .await;

    match result {
        Ok(_) => {
            // Log password change
            if let Some(audit_service) = &data.audit_service {
                let _ = audit_service.log_action(
                    &claims.sub,
                    "PASSWORD_CHANGE",
                    "User",
                    &claims.sub,
                    Some(serde_json::json!({
                        "session_id": claims.session_id,
                        "ip_address": claims.ip_address
                    }))
                ).await;
            }

            // Invalidate all sessions for this user
            if let Some(session_manager) = &data.session_manager {
                // This would need to be implemented to invalidate all sessions for a user
                // For now, just invalidate the current session
                session_manager.invalidate_session(&claims.session_id);
            }

            Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "message": "Password changed successfully"
            })))
        }
        Err(_) => {
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "message": "Failed to update password",
                "error": "UPDATE_FAILED"
            })))
        }
    }
}

// Get current user info
pub async fn get_current_user_info(
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = match http_req.extensions().get::<SecureClaims>() {
        Some(claims) => claims,
        None => {
            return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
                "success": false,
                "message": "Authentication required",
                "error": "UNAUTHORIZED"
            })));
        }
    };

    // Get user data
    let user = match sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1"
    )
    .bind(Uuid::parse_str(&claims.sub).unwrap())
    .fetch_optional(&data.database.pool)
    .await
    {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "success": false,
                "message": "User not found",
                "error": "USER_NOT_FOUND"
            })));
        }
        Err(_) => {
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "message": "Database error",
                "error": "DATABASE_ERROR"
            })));
        }
    };

    let user_response = UserResponse {
        id: user.id.to_string(),
        username: user.username,
        name: user.name,
        role: user.role,
        department: user.department,
        permissions: user.permissions,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
    };

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "data": user_response
    })))
}
