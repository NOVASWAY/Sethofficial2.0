use serde::{Deserialize, Serialize};
use sqlx::{PgPool, FromRow};
use uuid::Uuid;
use chrono::{Utc, DateTime, Duration};
use totp_lite::totp_custom;
use sha2::{Sha256, Digest};
use hex;
use rand::Rng;
use std::collections::HashMap;
use tracing::{info, warn, error};

use crate::errors::AppError;

/// MFA method types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "varchar")]
pub enum MfaMethod {
    #[sqlx(rename = "totp")]
    Totp,
    #[sqlx(rename = "sms")]
    Sms,
    #[sqlx(rename = "email")]
    Email,
}

/// MFA session (temporary session after password verification, before MFA)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MfaSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub session_token: String,
    pub mfa_verified: bool,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub verified_at: Option<DateTime<Utc>>,
}

/// MFA recovery code (hashed)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MfaRecoveryCode {
    pub id: Uuid,
    pub user_id: Uuid,
    pub code_hash: String,
    pub used: bool,
    pub created_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
}

/// MFA verification attempt
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MfaVerificationAttempt {
    pub id: Uuid,
    pub user_id: Uuid,
    pub session_token: Option<String>,
    pub attempt_type: String,
    pub success: bool,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// User MFA status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserMfaStatus {
    pub mfa_enabled: bool,
    pub mfa_method: Option<MfaMethod>,
    pub totp_secret_configured: bool,
    pub phone_number: Option<String>,
    pub email_verified: bool,
    pub recovery_codes_count: i64,
}

/// TOTP setup response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TotpSetupResponse {
    pub secret: String, // Base32 encoded secret (for QR code generation)
    pub qr_code_url: String, // Data URL for QR code
    pub backup_codes: Vec<String>, // Recovery codes (shown once)
}

/// MFA verification request
#[derive(Debug, Clone, Serialize, Deserialize, validator::Validate)]
pub struct MfaVerificationRequest {
    #[validate(length(min = 1, max = 10))]
    pub code: String, // TOTP code or recovery code
    pub session_token: String,
    #[validate(length(min = 1))]
    pub method: String, // 'totp', 'sms', 'recovery_code'
}

/// MFA enrollment request
#[derive(Debug, Clone, Serialize, Deserialize, validator::Validate)]
pub struct MfaEnrollmentRequest {
    #[validate(length(min = 1))]
    pub method: String, // 'totp', 'sms'
    pub phone_number: Option<String>, // Required for SMS
}

/// MFA service
pub struct MfaService {
    pool: PgPool,
    issuer: String, // For TOTP QR code (e.g., "Seth Medical Clinic")
}

impl MfaService {
    pub fn new(pool: PgPool) -> Self {
        let issuer = std::env::var("MFA_ISSUER_NAME")
            .unwrap_or_else(|_| "Seth Medical Clinic".to_string());
        
        Self {
            pool,
            issuer,
        }
    }

    /// Get user's MFA status
    pub async fn get_user_mfa_status(&self, user_id: Uuid) -> Result<UserMfaStatus, AppError> {
        let user_row = sqlx::query!(
            r#"
            SELECT 
                COALESCE(mfa_enabled, false) as mfa_enabled,
                mfa_method::text as mfa_method,
                (mfa_secret IS NOT NULL) as totp_secret_configured,
                phone_number,
                COALESCE(email_verified, false) as email_verified,
                (SELECT COUNT(*) FROM mfa_recovery_codes 
                 WHERE user_id = $1 AND used = false AND expires_at > NOW())::bigint as recovery_codes_count
            FROM users
            WHERE id = $1
            "#,
            user_id
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        let mfa_method = user_row.mfa_method.map(|m| {
            match m.as_str() {
                "totp" => MfaMethod::Totp,
                "sms" => MfaMethod::Sms,
                "email" => MfaMethod::Email,
                _ => MfaMethod::Totp,
            }
        });

        Ok(UserMfaStatus {
            mfa_enabled: user_row.mfa_enabled,
            mfa_method,
            totp_secret_configured: user_row.totp_secret_configured,
            phone_number: user_row.phone_number,
            email_verified: user_row.email_verified,
            recovery_codes_count: user_row.recovery_codes_count.unwrap_or(0) as i64,
        })
    }

    /// Generate TOTP secret and QR code
    pub async fn setup_totp(&self, user_id: Uuid, username: &str, email: &str) -> Result<TotpSetupResponse, AppError> {
        // Generate random secret (16 bytes, base32 encoded)
        let mut secret_bytes = [0u8; 16];
        rand::thread_rng().fill(&mut secret_bytes);
        let secret = base32::encode(base32::Alphabet::RFC4648 { padding: false }, &secret_bytes);

        // Generate recovery codes
        let backup_codes = self.generate_recovery_codes(user_id).await?;

        // Generate QR code URL (Google Authenticator format)
        let qr_code_url = format!(
            "otpauth://totp/{}:{}?secret={}&issuer={}&algorithm=SHA1&digits=6&period=30",
            urlencoding::encode(&self.issuer),
            urlencoding::encode(username),
            secret,
            urlencoding::encode(&self.issuer)
        );

        // Store secret in database (in production, encrypt this)
        sqlx::query!(
            r#"
            UPDATE users 
            SET mfa_secret = $1, 
                mfa_method = 'totp',
                updated_at = NOW()
            WHERE id = $2
            "#,
            secret,
            user_id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        info!("TOTP setup completed for user: {}", user_id);

        Ok(TotpSetupResponse {
            secret: secret.clone(),
            qr_code_url,
            backup_codes: backup_codes.clone(),
        })
    }

    /// Verify TOTP code
    pub async fn verify_totp(&self, user_id: Uuid, code: &str) -> Result<bool, AppError> {
        // Get user's TOTP secret
        let user = sqlx::query!(
            r#"
            SELECT mfa_secret, mfa_enabled
            FROM users
            WHERE id = $1
            "#,
            user_id
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        let user = match user {
            Some(u) => u,
            None => return Ok(false),
        };

        if !user.mfa_enabled.unwrap_or(false) {
            return Ok(false);
        }

        let secret = match user.mfa_secret {
            Some(s) => s,
            None => return Ok(false),
        };

        // Verify TOTP code (allow time window of ±1 period)
        // totp_lite expects the secret as a string, not bytes
        let now = Utc::now().timestamp();
        let valid = (-1..=1).any(|offset| {
            let timestamp = now + (offset * 30);
            // Convert timestamp to step (30 second intervals)
            let step = timestamp / 30;
            // totp-lite 2.0 API: totp_custom(secret, period, digits, timestamp_offset)
            // timestamp_offset of 0 means use current time
            let expected_code = totp_custom(&secret, 30, 6, 0);
            format!("{:06}", expected_code) == code
        });

        Ok(valid)
    }

    /// Generate recovery codes
    async fn generate_recovery_codes(&self, user_id: Uuid) -> Result<Vec<String>, AppError> {
        let mut codes = Vec::new();
        let mut hashed_codes = Vec::new();

        // Generate 10 recovery codes
        for _ in 0..10 {
            let code = Self::generate_recovery_code();
            let hash = Self::hash_recovery_code(&code);
            
            codes.push(code);
            hashed_codes.push(hash);
        }

        // Store hashed codes in database
        for hash in hashed_codes {
            sqlx::query!(
                r#"
                INSERT INTO mfa_recovery_codes (user_id, code_hash, expires_at)
                VALUES ($1, $2, NOW() + INTERVAL '1 year')
                "#,
                user_id,
                hash
            )
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Database(e))?;
        }

        Ok(codes)
    }

    /// Generate a single recovery code
    fn generate_recovery_code() -> String {
        // Generate 8-character alphanumeric code
        const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let mut rng = rand::thread_rng();
        (0..8)
            .map(|_| {
                let idx = rng.gen_range(0..CHARS.len());
                CHARS[idx] as char
            })
            .collect()
    }

    /// Hash recovery code
    fn hash_recovery_code(code: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(code.as_bytes());
        hex::encode(hasher.finalize())
    }

    /// Verify recovery code
    pub async fn verify_recovery_code(&self, user_id: Uuid, code: &str) -> Result<bool, AppError> {
        let code_hash = Self::hash_recovery_code(code);

        // Check if code exists and is unused
        let result = sqlx::query!(
            r#"
            UPDATE mfa_recovery_codes
            SET used = true, used_at = NOW()
            WHERE user_id = $1 
              AND code_hash = $2 
              AND used = false 
              AND expires_at > NOW()
            RETURNING id
            "#,
            user_id,
            code_hash
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        Ok(result.is_some())
    }

    /// Create MFA session (after password verification)
    pub async fn create_mfa_session(
        &self,
        user_id: Uuid,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<String, AppError> {
        // Generate session token
        let session_token = Uuid::new_v4().to_string();

        // Insert session (expires in 10 minutes)
        sqlx::query!(
            r#"
            INSERT INTO mfa_sessions (user_id, session_token, expires_at, ip_address, user_agent)
            VALUES ($1, $2, NOW() + INTERVAL '10 minutes', $3::inet, $4)
            "#,
            user_id,
            session_token,
            ip_address,
            user_agent
        )
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        Ok(session_token)
    }

    /// Verify MFA and complete session
    pub async fn verify_mfa_session(
        &self,
        session_token: &str,
        code: &str,
        method: &str,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<Uuid, AppError> {
        // Get session
        let session = sqlx::query_as!(
            MfaSession,
            r#"
            SELECT id, user_id, session_token, mfa_verified, created_at, expires_at,
                   ip_address::text as ip_address, user_agent
            FROM mfa_sessions
            WHERE session_token = $1 AND expires_at > NOW()
            "#,
            session_token
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        let session = match session {
            Some(s) => s,
            None => return Err(AppError::Authentication("Invalid or expired session".to_string())),
        };

        if session.mfa_verified {
            return Err(AppError::Authentication("Session already verified".to_string()));
        }

        // Verify code based on method
        let verified = match method {
            "totp" => {
                self.verify_totp(session.user_id, code).await?
            }
            "recovery_code" => {
                self.verify_recovery_code(session.user_id, code).await?
            }
            "sms" => {
                // TODO: Implement SMS verification
                false
            }
            _ => false,
        };

        // Log attempt
        sqlx::query!(
            r#"
            INSERT INTO mfa_verification_attempts (user_id, session_token, attempt_type, success, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5::inet, $6)
            "#,
            session.user_id,
            session_token,
            method,
            verified,
            ip_address,
            user_agent
        )
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        if !verified {
            return Err(AppError::Authentication("Invalid verification code".to_string()));
        }

        // Mark session as verified
        sqlx::query!(
            r#"
            UPDATE mfa_sessions
            SET mfa_verified = true, verified_at = NOW()
            WHERE id = $1
            "#,
            session.id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        // Enable MFA for user if not already enabled
        sqlx::query!(
            r#"
            UPDATE users
            SET mfa_enabled = true, updated_at = NOW()
            WHERE id = $1 AND mfa_enabled = false
            "#,
            session.user_id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        Ok(session.user_id)
    }

    /// Get MFA session status
    pub async fn get_mfa_session(&self, session_token: &str) -> Result<MfaSession, AppError> {
        let session = sqlx::query_as!(
            MfaSession,
            r#"
            SELECT id, user_id, session_token, mfa_verified, created_at, expires_at,
                   ip_address::text as ip_address, user_agent
            FROM mfa_sessions
            WHERE session_token = $1
            "#,
            session_token
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        match session {
            Some(s) => Ok(s),
            None => Err(AppError::Authentication("Session not found".to_string())),
        }
    }

    /// Disable MFA for user
    pub async fn disable_mfa(&self, user_id: Uuid) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            UPDATE users
            SET mfa_enabled = false, mfa_method = NULL, mfa_secret = NULL, updated_at = NOW()
            WHERE id = $1
            "#,
            user_id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        // Invalidate all recovery codes
        sqlx::query!(
            r#"
            UPDATE mfa_recovery_codes
            SET used = true, used_at = NOW()
            WHERE user_id = $1 AND used = false
            "#,
            user_id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Database(e))?;

        info!("MFA disabled for user: {}", user_id);
        Ok(())
    }
}


