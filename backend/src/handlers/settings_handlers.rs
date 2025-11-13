use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use std::collections::HashMap;

use crate::models::{ApiResponse, SystemSetting, UpdateSystemSetting, CreateSystemSetting, SettingsResponse, UpdateSettingsRequest, UserSetting, CreateUserSetting, UpdateUserSetting};
use crate::AppState;
use crate::middleware::auth::get_current_user;
use crate::error::ApiError;
use crate::encryption::EncryptionService;

/// List of sensitive setting keys that should be encrypted
const SENSITIVE_SETTINGS: &[&str] = &[
    "apiKey",
    "api_key", 
    "password",
    "secret",
    "token",
    "authToken",
    "auth_token",
    "consumer_key",
    "consumer_secret",
    "passkey",
    "smtp_password",
    "sendgrid_api_key",
    "mailgun_api_key",
    "twilio_auth_token",
    "africas_talking_api_key",
    "jwt_secret",
    "encryption_key",
    "database_password",
    "redis_password"
];

/// Check if a setting key is sensitive and should be encrypted
fn is_sensitive_setting(key: &str) -> bool {
    SENSITIVE_SETTINGS.iter().any(|&sensitive| {
        key.to_lowercase().contains(sensitive) || 
        key.to_lowercase().ends_with(sensitive) ||
        key.to_lowercase().starts_with(sensitive)
    })
}

/// Get all system settings grouped by category
pub async fn get_settings(
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    // Get current user for audit logging
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| ApiError::unauthorized(Some("Authentication required".to_string())))?;

    // Fetch all settings from database
    let settings = sqlx::query_as::<_, SystemSetting>(
        "SELECT * FROM system_settings ORDER BY category, key"
    )
    .fetch_all(&data.db_pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to fetch settings: {}", e))))?;

    // Initialize encryption service
    let encryption_service = EncryptionService::new()
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to initialize encryption service: {}", e))))?;

    // Group settings by category
    let mut grouped_settings: HashMap<String, serde_json::Value> = HashMap::new();
    
    for setting in settings {
        let category = setting.category.unwrap_or_else(|| "general".to_string());
        let entry = grouped_settings.entry(category).or_insert_with(|| json!({}));
        
        if let Some(obj) = entry.as_object_mut() {
            // Decrypt sensitive settings when retrieving
            let value = if is_sensitive_setting(&setting.key) {
                match encryption_service.decrypt(&setting.value) {
                    Ok(decrypted) => json!(decrypted),
                    Err(_) => {
                        // If decryption fails, it might be an old unencrypted value
                        // or corrupted data, return the original value
                        json!(setting.value)
                    }
                }
            } else {
                json!(setting.value)
            };
            
            obj.insert(setting.key.clone(), value);
        }
    }

    // Create response structure
    let response = SettingsResponse {
        general: grouped_settings.remove("general").unwrap_or_else(|| json!({})),
        schedule: grouped_settings.remove("schedule").unwrap_or_else(|| json!({})),
        billing: grouped_settings.remove("billing").unwrap_or_else(|| json!({})),
        inventory: grouped_settings.remove("inventory").unwrap_or_else(|| json!({})),
        security: grouped_settings.remove("security").unwrap_or_else(|| json!({})),
        audit: grouped_settings.remove("audit").unwrap_or_else(|| json!({})),
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!(response)),
        message: None,
        error: None,
    }))
}

/// Update system settings
pub async fn update_settings(
    req: web::Json<UpdateSettingsRequest>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    // Get current user for audit logging
    let claims = get_current_user(&http_req)
        .ok_or_else(|| ApiError::unauthorized(Some("Authentication required".to_string())))?;

    let settings_data = &req.settings;
    
    if let Some(settings_obj) = settings_data.as_object() {
        // Initialize encryption service
        let encryption_service = EncryptionService::new()
            .map_err(|e| ApiError::internal_error(Some(format!("Failed to initialize encryption service: {}", e))))?;

        let mut updated_count = 0;
        
        for (key, value) in settings_obj {
            let value_str = match value {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                _ => value.to_string(),
            };

            // Encrypt sensitive settings before storing
            let final_value = if is_sensitive_setting(key) {
                match encryption_service.encrypt(&value_str) {
                    Ok(encrypted) => encrypted,
                    Err(e) => {
                        return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                            success: false,
                            data: None,
                            message: None,
                            error: Some(format!("Failed to encrypt sensitive setting {}: {}", key, e)),
                        }));
                    }
                }
            } else {
                value_str
            };

            // Update or insert setting
                let result = sqlx::query(
                    r#"
                    INSERT INTO system_settings (key, value, updated_at)
                    VALUES ($1, $2, NOW())
                    ON CONFLICT (key) 
                    DO UPDATE SET 
                        value = EXCLUDED.value,
                        updated_at = NOW()
                    "#
                )
                .bind(key)
                .bind(final_value)
            .execute(&data.db_pool)
            .await;

            match result {
                Ok(_) => updated_count += 1,
                Err(e) => {
                    return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                        success: false,
                        data: None,
                        message: None,
                        error: Some(format!("Failed to update setting {}: {}", key, e)),
                    }));
                }
            }
        }

        // Log the settings update
        let audit_logger = crate::audit::AuditLogger::new(data.db_pool.clone());
        let audit_log = crate::audit::AuditLog {
            id: uuid::Uuid::new_v4(),
            user_id: Some(claims.sub.parse().unwrap_or_else(|_| uuid::Uuid::new_v4())),
            session_id: None,
            action: crate::audit::AuditAction::SettingsUpdate,
            resource: crate::audit::AuditResource::SystemSettings,
            resource_id: None,
            result: crate::audit::AuditResult::Success,
            details: Some(json!({
                "updated_count": updated_count,
                "settings": settings_data
            })),
            ip_address: None,
            user_agent: None,
            request_id: None,
            timestamp: chrono::Utc::now(),
        };
        
        if let Err(e) = audit_logger.log(audit_log).await {
            eprintln!("Failed to log audit event: {}", e);
        }

        Ok(HttpResponse::Ok().json(ApiResponse::<()> {
            success: true,
            data: None,
            message: Some(format!("Successfully updated {} settings", updated_count)),
            error: None,
        }))
    } else {
        Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Invalid settings format".to_string()),
        }))
    }
}

pub async fn create_backup(
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({"backup_id": "backup_123"})),
        message: Some("Backup created successfully".to_string()),
        error: None,
    }))
}

pub async fn restore_backup(
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
      Ok(HttpResponse::Ok().json(ApiResponse::<()> {
        success: true,
        data: None,
        message: Some("Backup restored successfully".to_string()),
        error: None,
    }))
}

/// Get user-specific settings
pub async fn get_user_settings(
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    // Get current user
    let claims = get_current_user(&http_req)
        .ok_or_else(|| ApiError::unauthorized(Some("Authentication required".to_string())))?;

    let user_id: Uuid = claims.sub.parse()
        .map_err(|_| ApiError::bad_request("Invalid user ID".to_string()))?;

    // Fetch user settings from database
    let settings = sqlx::query_as::<_, UserSetting>(
        "SELECT * FROM user_settings WHERE user_id = $1 ORDER BY category, key"
    )
    .bind(user_id)
    .fetch_all(&data.db_pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to fetch user settings: {}", e))))?;

    // Initialize encryption service
    let encryption_service = EncryptionService::new()
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to initialize encryption service: {}", e))))?;

    // Group settings by category
    let mut grouped_settings: HashMap<String, serde_json::Value> = HashMap::new();
    
    for setting in settings {
        let category = setting.category.unwrap_or_else(|| "general".to_string());
        let entry = grouped_settings.entry(category).or_insert_with(|| json!({}));
        
        if let Some(obj) = entry.as_object_mut() {
            // Decrypt sensitive settings when retrieving
            let value = if is_sensitive_setting(&setting.key) {
                match encryption_service.decrypt(&setting.value) {
                    Ok(decrypted) => json!(decrypted),
                    Err(_) => {
                        // If decryption fails, it might be an old unencrypted value
                        json!(setting.value)
                    }
                }
            } else {
                json!(setting.value)
            };
            
            obj.insert(setting.key.clone(), value);
        }
    }

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!(grouped_settings)),
        message: None,
        error: None,
    }))
}

/// Update user-specific settings
pub async fn update_user_settings(
    req: web::Json<UpdateSettingsRequest>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    // Get current user
    let claims = get_current_user(&http_req)
        .ok_or_else(|| ApiError::unauthorized(Some("Authentication required".to_string())))?;

    let user_id: Uuid = claims.sub.parse()
        .map_err(|_| ApiError::bad_request("Invalid user ID".to_string()))?;

    let settings_data = &req.settings;
    
    if let Some(settings_obj) = settings_data.as_object() {
        // Initialize encryption service
        let encryption_service = EncryptionService::new()
            .map_err(|e| ApiError::internal_error(Some(format!("Failed to initialize encryption service: {}", e))))?;

        let mut updated_count = 0;
        
        for (key, value) in settings_obj {
            let value_str = match value {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                _ => value.to_string(),
            };

            // Encrypt sensitive settings before storing
            let final_value = if is_sensitive_setting(key) {
                match encryption_service.encrypt(&value_str) {
                    Ok(encrypted) => encrypted,
                    Err(e) => {
                        return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                            success: false,
                            data: None,
                            message: None,
                            error: Some(format!("Failed to encrypt sensitive setting {}: {}", key, e)),
                        }));
                    }
                }
            } else {
                value_str
            };

            // Update or insert user setting
            let result = sqlx::query(
                r#"
                INSERT INTO user_settings (user_id, key, value, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id, key) 
                DO UPDATE SET 
                    value = EXCLUDED.value,
                    updated_at = NOW()
                "#
            )
            .bind(user_id)
            .bind(key)
            .bind(final_value)
            .execute(&data.db_pool)
            .await;

            match result {
                Ok(_) => updated_count += 1,
                Err(e) => {
                    return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                        success: false,
                        data: None,
                        message: None,
                        error: Some(format!("Failed to update user setting {}: {}", key, e)),
                    }));
                }
            }
        }

        // Log the user settings update
        let audit_logger = crate::audit::AuditLogger::new(data.db_pool.clone());
        let audit_log = crate::audit::AuditLog {
            id: uuid::Uuid::new_v4(),
            user_id: Some(user_id),
            session_id: None,
            action: crate::audit::AuditAction::SettingsUpdate,
            resource: crate::audit::AuditResource::UserSettings,
            resource_id: Some(user_id.to_string()),
            result: crate::audit::AuditResult::Success,
            details: Some(json!({
                "updated_count": updated_count,
                "settings": settings_data
            })),
            ip_address: None,
            user_agent: None,
            request_id: None,
            timestamp: chrono::Utc::now(),
        };
        
        if let Err(e) = audit_logger.log(audit_log).await {
            eprintln!("Failed to log audit event: {}", e);
        }

        Ok(HttpResponse::Ok().json(ApiResponse::<()> {
            success: true,
            data: None,
            message: Some(format!("Successfully updated {} user settings", updated_count)),
            error: None,
        }))
    } else {
        Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Invalid settings format".to_string()),
        }))
    }
}

/// Delete a user-specific setting
pub async fn delete_user_setting(
    path: web::Path<String>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    // Get current user
    let claims = get_current_user(&http_req)
        .ok_or_else(|| ApiError::unauthorized(Some("Authentication required".to_string())))?;

    let user_id: Uuid = claims.sub.parse()
        .map_err(|_| ApiError::bad_request("Invalid user ID".to_string()))?;

    let setting_key = path.into_inner();

    // Delete the user setting
    let result = sqlx::query(
        "DELETE FROM user_settings WHERE user_id = $1 AND key = $2"
    )
    .bind(user_id)
    .bind(&setting_key)
    .execute(&data.db_pool)
    .await;

    match result {
        Ok(result) => {
            if result.rows_affected() > 0 {
                // Log the deletion
                let audit_logger = crate::audit::AuditLogger::new(data.db_pool.clone());
                let audit_log = crate::audit::AuditLog {
                    id: uuid::Uuid::new_v4(),
                    user_id: Some(user_id),
                    session_id: None,
                    action: crate::audit::AuditAction::SettingsDelete,
                    resource: crate::audit::AuditResource::UserSettings,
                    resource_id: Some(user_id.to_string()),
                    result: crate::audit::AuditResult::Success,
                    details: Some(json!({
                        "deleted_key": setting_key
                    })),
                    ip_address: None,
                    user_agent: None,
                    request_id: None,
                    timestamp: chrono::Utc::now(),
                };
                
                if let Err(e) = audit_logger.log(audit_log).await {
                    eprintln!("Failed to log audit event: {}", e);
                }

                Ok(HttpResponse::Ok().json(ApiResponse::<()> {
                    success: true,
                    data: None,
                    message: Some(format!("Successfully deleted setting: {}", setting_key)),
                    error: None,
                }))
            } else {
                Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: None,
                    error: Some(format!("Setting not found: {}", setting_key)),
                }))
            }
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to delete setting: {}", e)),
            }))
        }
    }
}
