use actix_web::{web, HttpResponse, HttpRequest};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;
use chrono::{Utc, Duration};
use validator::Validate;
use crate::errors::AppError;
use crate::models::ApiResponse;
use crate::auth::AuthService;
use crate::services::email_service::EmailService;

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct PasswordResetRequest {
    #[validate(email)]
    pub email: String,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct PasswordReset {
    pub token: String,
    #[validate(length(min = 8, max = 100))]
    pub new_password: String,
}

pub async fn request_password_reset(
    req: web::Json<PasswordResetRequest>,
    data: web::Data<crate::AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    req.validate().map_err(|e| AppError::Validation(e))?;

    // Find user by email
    let user = sqlx::query("SELECT id, username, email, name FROM users WHERE email = $1 AND is_active = true")
    .bind(&req.email)
    .fetch_optional(&data.db_pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    // Always return success to prevent email enumeration
    if user.is_none() {
        return Ok(HttpResponse::Ok().json(ApiResponse::<()> {
            success: true,
            data: None,
            message: Some("If an account with that email exists, a password reset link has been sent.".to_string()),
            error: None,
        }));
    }

    let user = user.unwrap();
    let user_id: Uuid = user.get("id");
    let user_email: String = user.get("email");
    let user_name: String = user.get("name");
    
    // Generate reset token
    let token = Uuid::new_v4().to_string();
    let token_clone = token.clone();
    let expires_at = Utc::now() + Duration::hours(1);

    // Get IP address and user agent
    let ip_address = http_req
        .peer_addr()
        .map(|addr| addr.ip().to_string());
    let user_agent = http_req
        .headers()
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    // Store token in database
    sqlx::query(
        r#"
        INSERT INTO password_reset_tokens (user_id, token, expires_at, ip_address, user_agent)
        VALUES ($1, $2, $3, $4::inet, $5)
        "#
    )
    .bind(user_id)
    .bind(&token)
    .bind(expires_at)
    .bind(ip_address.as_deref())
    .bind(user_agent)
    .execute(&data.db_pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    // Send password reset email
    let reset_url = format!(
        "{}/reset-password?token={}",
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()),
        token_clone
    );

    let email_html = format!(
        r#"
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }}
                .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Password Reset Request</h2>
                <p>Hello {},</p>
                <p>You requested to reset your password for your account. Click the button below to reset your password:</p>
                <a href="{}" class="button">Reset Password</a>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all;">{}</p>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this password reset, please ignore this email.</p>
                <div class="footer">
                    <p>This is an automated message from Seth Medical Clinic Management System.</p>
                </div>
            </div>
        </body>
        </html>
        "#,
        user_name,
        reset_url,
        reset_url
    );

    // Send email (if email service is configured)
    if let Ok(config) = crate::services::email_service::EmailConfig::from_env() {
        if let Ok(email_service) = EmailService::new(config) {
            if let Err(e) = email_service.send_email(
                &user_email,
                "Password Reset Request",
                &email_html,
                Some(&format!("Reset your password: {}", reset_url)),
            ).await {
                tracing::warn!("Failed to send password reset email: {}", e);
                // Continue anyway - token is created
            }
        }
    }

    Ok(HttpResponse::Ok().json(ApiResponse::<()> {
        success: true,
        data: None,
        message: Some("If an account with that email exists, a password reset link has been sent.".to_string()),
        error: None,
    }))
}

pub async fn reset_password(
    req: web::Json<PasswordReset>,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, AppError> {
    req.validate().map_err(|e| AppError::Validation(e))?;

    // Find token
    let token_data = sqlx::query(
        r#"
        SELECT user_id, expires_at, used
        FROM password_reset_tokens
        WHERE token = $1
        "#
    )
    .bind(&req.token)
    .fetch_optional(&data.db_pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    let token_data = match token_data {
        Some(t) => t,
        None => {
            return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Invalid or expired reset token".to_string()),
            }))
        }
    };

    // Check if token is used
    let used: bool = token_data.try_get("used").unwrap_or(false);
    if used {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Reset token has already been used".to_string()),
        }))
    }

    // Check if token is expired
    let expires_at: chrono::DateTime<chrono::Utc> = token_data.get("expires_at");
    if Utc::now() > expires_at {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Reset token has expired".to_string()),
        }))
    }

    // Hash new password
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "your-super-secret-jwt-key-change-this-in-production".to_string());
    let auth_service = AuthService::new(&jwt_secret, 24, 7);
    let password_hash = auth_service.hash_password(&req.new_password)
        .map_err(|e| AppError::Internal(format!("Failed to hash password: {}", e)))?;

    // Update user password and mark token as used
    let user_id: Uuid = token_data.get("user_id");
    sqlx::query(
        r#"
        UPDATE users
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2
        "#
    )
    .bind(&password_hash)
    .bind(user_id)
    .execute(&data.db_pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    sqlx::query(
        r#"
        UPDATE password_reset_tokens
        SET used = true, used_at = NOW()
        WHERE token = $1
        "#
    )
    .bind(&req.token)
    .execute(&data.db_pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(HttpResponse::Ok().json(ApiResponse::<()> {
        success: true,
        data: None,
        message: Some("Password reset successfully".to_string()),
        error: None,
    }))
}

pub async fn verify_reset_token(
    token: web::Path<String>,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, AppError> {
    let token_data = sqlx::query(
        r#"
        SELECT expires_at, used
        FROM password_reset_tokens
        WHERE token = $1
        "#
    )
    .bind(token.into_inner())
    .fetch_optional(&data.db_pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    match token_data {
        Some(t) => {
            let used: bool = t.try_get("used").unwrap_or(false);
            if used {
                return Ok(HttpResponse::BadRequest().json(ApiResponse::<serde_json::Value> {
                    success: false,
                    data: Some(serde_json::json!({ "valid": false, "reason": "used" })),
                    message: None,
                    error: Some("Token has already been used".to_string()),
                }))
            }

            let expires_at: chrono::DateTime<chrono::Utc> = t.get("expires_at");
            if Utc::now() > expires_at {
                return Ok(HttpResponse::BadRequest().json(ApiResponse::<serde_json::Value> {
                    success: false,
                    data: Some(serde_json::json!({ "valid": false, "reason": "expired" })),
                    message: None,
                    error: Some("Token has expired".to_string()),
                }))
            }

            Ok(HttpResponse::Ok().json(ApiResponse::<serde_json::Value> {
                success: true,
                data: Some(serde_json::json!({ "valid": true })),
                message: None,
                error: None,
            }))
        }
        None => Ok(HttpResponse::NotFound().json(ApiResponse::<serde_json::Value> {
            success: false,
            data: Some(serde_json::json!({ "valid": false, "reason": "not_found" })),
            message: None,
            error: Some("Token not found".to_string()),
        }))
    }
}

