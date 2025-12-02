use actix_web::HttpRequest;
use rand::{Rng, thread_rng};
use rand::distributions::Alphanumeric;
use std::sync::Arc;
use uuid::Uuid;
use chrono::{Utc, Duration};

use crate::redis_client::RedisClient;
use crate::errors::AppError;

/// CSRF token service for generating and validating CSRF tokens
pub struct CsrfService {
    redis_client: Option<Arc<RedisClient>>,
    token_length: usize,
    expiration_minutes: u64,
}

impl CsrfService {
    /// Create a new CSRF service
    pub fn new(
        redis_client: Option<Arc<RedisClient>>,
        token_length: usize,
        expiration_minutes: u64,
    ) -> Self {
        Self {
            redis_client,
            token_length,
            expiration_minutes,
        }
    }

    /// Generate a new CSRF token for a user session
    /// Returns the token string
    pub async fn generate_token(&self, user_id: Option<Uuid>, session_id: Option<String>) -> Result<String, AppError> {
        // Generate a random token
        let token: String = thread_rng()
            .sample_iter(&Alphanumeric)
            .take(self.token_length)
            .map(char::from)
            .collect();

        // Create a unique key for this token
        let key = if let Some(uid) = user_id {
            format!("csrf:user:{}:{}", uid, token)
        } else if let Some(sid) = session_id {
            format!("csrf:session:{}:{}", sid, token)
        } else {
            // Anonymous token (less secure, but allows for unauthenticated requests)
            format!("csrf:anon:{}", token)
        };

        // Store token in Redis with expiration
        if let Some(redis) = &self.redis_client {
            let expiration_seconds = self.expiration_minutes * 60;
            use std::time::Duration;
            redis.set(&key, &token, Some(Duration::from_secs(expiration_seconds))).await
                .map_err(|e| AppError::Internal(format!("Failed to store CSRF token: {}", e)))?;
        } else {
            // If Redis is not available, we can't store tokens securely
            // In production, this should be an error
            log::warn!("CSRF token generated but not stored (Redis unavailable). Token: {}", token);
        }

        Ok(token)
    }

    /// Validate a CSRF token
    /// Returns true if the token is valid, false otherwise
    pub async fn validate_token(
        &self,
        token: &str,
        user_id: Option<Uuid>,
        session_id: Option<String>,
    ) -> Result<bool, AppError> {
        if token.is_empty() {
            return Ok(false);
        }

        // Try to find the token in Redis
        if let Some(redis) = &self.redis_client {
            // Try user-specific token first
            if let Some(uid) = user_id {
                let key = format!("csrf:user:{}:{}", uid, token);
                if let Ok(Some(stored_token)) = redis.get(&key).await {
                    if stored_token == token {
                        // Token is valid, delete it (one-time use) or keep it for multiple uses
                        // For now, we'll keep it until expiration for better UX
                        return Ok(true);
                    }
                }
            }

            // Try session-specific token
            if let Some(sid) = session_id {
                let key = format!("csrf:session:{}:{}", sid, token);
                if let Ok(Some(stored_token)) = redis.get(&key).await {
                    if stored_token == token {
                        return Ok(true);
                    }
                }
            }

            // Try anonymous token
            let key = format!("csrf:anon:{}", token);
            if let Ok(Some(stored_token)) = redis.get(&key).await {
                if stored_token == token {
                    return Ok(true);
                }
            }
        } else {
            // If Redis is not available, we can't validate tokens
            // In development, we might allow this, but log a warning
            log::warn!("CSRF validation skipped (Redis unavailable). This is insecure in production!");
            // In production, this should return false
            #[cfg(not(debug_assertions))]
            return Ok(false);
        }

        Ok(false)
    }

    /// Extract user ID and session ID from request for CSRF validation
    pub fn extract_context_from_request(req: &HttpRequest) -> (Option<Uuid>, Option<String>) {
        // Try to get user ID from JWT claims (if authenticated)
        let user_id = crate::middleware::security::get_user_id_from_request(req);
        
        // Try to get session ID from cookie or header
        let session_id = req
            .cookie("session_id")
            .map(|c| c.value().to_string())
            .or_else(|| {
                req.headers()
                    .get("X-Session-ID")
                    .and_then(|h| h.to_str().ok())
                    .map(|s| s.to_string())
            });

        (user_id, session_id)
    }

    /// Invalidate a CSRF token (useful for logout or token rotation)
    pub async fn invalidate_token(
        &self,
        token: &str,
        user_id: Option<Uuid>,
        session_id: Option<String>,
    ) -> Result<(), AppError> {
        if let Some(redis) = &self.redis_client {
            if let Some(uid) = user_id {
                let key = format!("csrf:user:{}:{}", uid, token);
                let _ = redis.del(&key).await;
            }
            if let Some(sid) = session_id {
                let key = format!("csrf:session:{}:{}", sid, token);
                let _ = redis.del(&key).await;
            }
            let key = format!("csrf:anon:{}", token);
            let _ = redis.del(&key).await;
        }
        Ok(())
    }
}

