use actix_web::{web, HttpResponse, HttpRequest};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use chrono::{Utc, Duration};
use validator::Validate;
use crate::errors::AppError;
use crate::models::ApiResponse;
use crate::services::email_service::EmailService;

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct ResendVerificationRequest {
    #[validate(email)]
    pub email: String,
}

pub async fn verify_email(
    token: web::Path<String>,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, AppError> {
    let token_value = token.into_inner();

    // Find token
    let token_data = sqlx::query!(
        r#"
        SELECT user_id, email, expires_at, used
        FROM email_verification_tokens
        WHERE token = $1
        "#,
        token_value
    )
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
                error: Some("Invalid or expired verification token".to_string()),
            }))
        }
    };

    // Check if token is used
    if token_data.used {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Verification token has already been used".to_string()),
        }))
    }

    // Check if token is expired
    if Utc::now() > token_data.expires_at {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Verification token has expired".to_string()),
        }))
    }

    // Mark email as verified and token as used
    sqlx::query!(
        r#"
        UPDATE users
        SET email_verified = true, updated_at = NOW()
        WHERE id = $1
        "#,
        token_data.user_id
    )
    .execute(&data.db_pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    sqlx::query!(
        r#"
        UPDATE email_verification_tokens
        SET used = true, used_at = NOW()
        WHERE token = $1
        "#,
        token_value
    )
    .execute(&data.db_pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    Ok(HttpResponse::Ok().json(ApiResponse::<()> {
        success: true,
        data: None,
        message: Some("Email verified successfully".to_string()),
        error: None,
    }))
}

pub async fn resend_verification(
    req: web::Json<ResendVerificationRequest>,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, AppError> {
    req.validate().map_err(|e| AppError::Validation(e))?;

    // Find user by email
    let user = sqlx::query!(
        "SELECT id, username, email, name, email_verified FROM users WHERE email = $1 AND is_active = true",
        req.email
    )
    .fetch_optional(&data.db_pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    // Always return success to prevent email enumeration
    if user.is_none() {
        return Ok(HttpResponse::Ok().json(ApiResponse::<()> {
            success: true,
            data: None,
            message: Some("If an account with that email exists, a verification email has been sent.".to_string()),
            error: None,
        }));
    }

    let user = user.unwrap();

    // Check if already verified
    if user.email_verified {
        return Ok(HttpResponse::Ok().json(ApiResponse::<()> {
            success: true,
            data: None,
            message: Some("Email is already verified".to_string()),
            error: None,
        }));
    }

    // Generate verification token
    let token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + Duration::days(7);

    // Store token in database
    sqlx::query!(
        r#"
        INSERT INTO email_verification_tokens (user_id, token, email, expires_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (token) DO NOTHING
        "#,
        user.id,
        token,
        user.email,
        expires_at
    )
    .execute(&data.db_pool)
    .await
    .map_err(|e| AppError::Database(e))?;

    // Send verification email
    let verify_url = format!(
        "{}/verify-email?token={}",
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()),
        token
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
                <h2>Verify Your Email Address</h2>
                <p>Hello {},</p>
                <p>Thank you for registering with Seth Medical Clinic. Please verify your email address by clicking the button below:</p>
                <a href="{}" class="button">Verify Email Address</a>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all;">{}</p>
                <p>This link will expire in 7 days.</p>
                <p>If you didn't create an account, please ignore this email.</p>
                <div class="footer">
                    <p>This is an automated message from Seth Medical Clinic Management System.</p>
                </div>
            </div>
        </body>
        </html>
        "#,
        user.name,
        verify_url,
        verify_url
    );

    // Send email (if email service is configured)
    if let Ok(config) = crate::services::email_service::EmailConfig::from_env() {
        if let Ok(email_service) = EmailService::new(config) {
            if let Err(e) = email_service.send_email(
                &user.email,
                "Verify Your Email Address",
                &email_html,
                Some(&format!("Verify your email: {}", verify_url)),
            ).await {
                tracing::warn!("Failed to send verification email: {}", e);
                // Continue anyway - token is created
            }
        }
    }

    Ok(HttpResponse::Ok().json(ApiResponse::<()> {
        success: true,
        data: None,
        message: Some("If an account with that email exists, a verification email has been sent.".to_string()),
        error: None,
    }))
}

