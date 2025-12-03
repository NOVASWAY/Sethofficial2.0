use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use chrono::{DateTime, Utc};

use crate::models::ApiResponse;
use crate::auth::verify_jwt_token;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserPreferences {
    pub id: Uuid,
    pub user_id: Uuid,
    pub layout_config: serde_json::Value,
    pub custom_metrics: Option<Vec<String>>,
    pub favorite_modules: Option<Vec<String>>,
    pub refresh_interval: Option<i32>,
    pub auto_refresh: Option<bool>,
    pub theme: Option<String>,
    pub language: Option<String>,
    pub timezone: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateUserPreferences {
    pub layout_config: Option<serde_json::Value>,
    pub custom_metrics: Option<Vec<String>>,
    pub favorite_modules: Option<Vec<String>>,
    pub refresh_interval: Option<i32>,
    pub auto_refresh: Option<bool>,
    pub theme: Option<String>,
    pub language: Option<String>,
    pub timezone: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RolePreferenceTemplate {
    pub role: String,
    pub default_layout_config: serde_json::Value,
    pub default_custom_metrics: Vec<String>,
    pub default_favorite_modules: Vec<String>,
    pub default_refresh_interval: i32,
    pub default_auto_refresh: bool,
    pub default_theme: String,
    pub default_language: String,
    pub default_timezone: String,
}

// Get user preferences
pub async fn get_user_preferences(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse> {
    let user_id = path.into_inner();
    
    // Verify JWT token
    let token = match req.headers().get("Authorization") {
        Some(header) => {
            let auth_str = header.to_str().unwrap_or("");
            if auth_str.starts_with("Bearer ") {
                &auth_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: Some("Invalid authorization header".to_string()),
                    error: Some("Invalid token format".to_string()),
                }));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Authorization header missing".to_string()),
                error: Some("No token provided".to_string()),
            }));
        }
    };

    let claims = match verify_jwt_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid token".to_string()),
                error: Some("Token verification failed".to_string()),
            }));
        }
    };

    // Check if user is requesting their own preferences or has admin permissions
    let claims_user_id = Uuid::parse_str(&claims.sub).map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID in token"))?;
    if claims_user_id != user_id && claims.role != "admin" {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Access denied".to_string()),
            error: Some("Insufficient permissions".to_string()),
        }));
    }

    // Get user preferences from database
    let preferences = match sqlx::query_as::<_, UserPreferences>(
        "SELECT id, user_id, layout_config, custom_metrics, favorite_modules, 
                refresh_interval, auto_refresh, theme, language, timezone, 
                created_at, updated_at 
         FROM user_dashboard_preferences 
         WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_optional(&**pool)
    .await
    {
        Ok(Some(prefs)) => prefs,
        Ok(None) => {
            // Create default preferences if none exist
            match create_default_preferences(&pool, &user_id, &claims.role).await {
                Ok(prefs) => prefs,
                Err(e) => {
                    return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                        success: false,
                        data: None,
                        message: Some("Failed to create default preferences".to_string()),
                        error: Some(format!("{}", e)),
                    }));
                }
            }
        }
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to fetch user preferences".to_string()),
                error: Some(format!("{}", e)),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(preferences),
        message: Some("User preferences retrieved successfully".to_string()),
        error: None,
    }))
}

// Update user preferences
pub async fn update_user_preferences(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    update_data: web::Json<UpdateUserPreferences>,
) -> Result<HttpResponse> {
    let user_id = path.into_inner();
    
    // Verify JWT token
    let token = match req.headers().get("Authorization") {
        Some(header) => {
            let auth_str = header.to_str().unwrap_or("");
            if auth_str.starts_with("Bearer ") {
                &auth_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: Some("Invalid authorization header".to_string()),
                    error: Some("Invalid token format".to_string()),
                }));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Authorization header missing".to_string()),
                error: Some("No token provided".to_string()),
            }));
        }
    };

    let claims = match verify_jwt_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid token".to_string()),
                error: Some("Token verification failed".to_string()),
            }));
        }
    };

    // Check if user is updating their own preferences or has admin permissions
    let claims_user_id = Uuid::parse_str(&claims.sub).map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID in token"))?;
    if claims_user_id != user_id && claims.role != "admin" {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Access denied".to_string()),
            error: Some("Insufficient permissions".to_string()),
        }));
    }

    // Validate input data
    if let Some(refresh_interval) = update_data.refresh_interval {
        if refresh_interval < 5 || refresh_interval > 300 {
            return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid refresh interval".to_string()),
                error: Some("Refresh interval must be between 5 and 300 seconds".to_string()),
            }));
        }
    }

    if let Some(ref theme) = update_data.theme {
        if !["light", "dark", "auto"].contains(&theme.as_str()) {
            return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid theme".to_string()),
                error: Some("Theme must be 'light', 'dark', or 'auto'".to_string()),
            }));
        }
    }

    if let Some(ref language) = update_data.language {
        if !["en", "sw", "fr"].contains(&language.as_str()) {
            return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid language".to_string()),
                error: Some("Language must be 'en', 'sw', or 'fr'".to_string()),
            }));
        }
    }

    // Update user preferences
    let update_data_inner = update_data.into_inner();
    // Clone values needed later before binding
    let layout_config_clone = update_data_inner.layout_config.clone();
    let custom_metrics_clone = update_data_inner.custom_metrics.clone();
    let favorite_modules_clone = update_data_inner.favorite_modules.clone();
    let refresh_interval_clone = update_data_inner.refresh_interval;
    let auto_refresh_clone = update_data_inner.auto_refresh;
    let theme_clone = update_data_inner.theme.clone();
    let language_clone = update_data_inner.language.clone();
    let timezone_clone = update_data_inner.timezone.clone();
    
    let updated_preferences = match sqlx::query_as::<UserPreferences>(
        "UPDATE user_dashboard_preferences 
         SET layout_config = COALESCE($2, layout_config),
             custom_metrics = COALESCE($3, custom_metrics),
             favorite_modules = COALESCE($4, favorite_modules),
             refresh_interval = COALESCE($5, refresh_interval),
             auto_refresh = COALESCE($6, auto_refresh),
             theme = COALESCE($7, theme),
             language = COALESCE($8, language),
             timezone = COALESCE($9, timezone),
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING id, user_id, layout_config, custom_metrics, favorite_modules, 
                   refresh_interval, auto_refresh, theme, language, timezone, 
                   created_at, updated_at"
    )
    .bind(user_id)
    .bind(update_data_inner.layout_config)
    .bind(update_data_inner.custom_metrics.as_deref())
    .bind(update_data_inner.favorite_modules.as_deref())
    .bind(update_data_inner.refresh_interval)
    .bind(update_data_inner.auto_refresh)
    .bind(update_data_inner.theme.as_deref())
    .bind(update_data_inner.language.as_deref())
    .bind(update_data_inner.timezone.as_deref())
    .fetch_optional(&**pool)
    .await
    {
        Ok(Some(prefs)) => prefs,
        Ok(None) => {
            // Create new preferences if none exist
            match create_default_preferences(&pool, &user_id, &claims.role).await {
                Ok(mut prefs) => {
                    // Update with provided data (using cloned values)
                    if let Some(layout_config) = &layout_config_clone {
                        prefs.layout_config = layout_config.clone();
                    }
                    if let Some(custom_metrics) = &custom_metrics_clone {
                        prefs.custom_metrics = Some(custom_metrics.clone());
                    }
                    if let Some(favorite_modules) = &favorite_modules_clone {
                        prefs.favorite_modules = Some(favorite_modules.clone());
                    }
                    if let Some(refresh_interval) = refresh_interval_clone {
                        prefs.refresh_interval = Some(refresh_interval);
                    }
                    if let Some(auto_refresh) = auto_refresh_clone {
                        prefs.auto_refresh = Some(auto_refresh);
                    }
                    if let Some(theme) = &theme_clone {
                        prefs.theme = Some(theme.clone());
                    }
                    if let Some(language) = &language_clone {
                        prefs.language = Some(language.clone());
                    }
                    if let Some(timezone) = &timezone_clone {
                        prefs.timezone = Some(timezone.clone());
                    }

                    // Save updated preferences
                    match sqlx::query_as::<UserPreferences>(
                        "UPDATE user_dashboard_preferences 
                         SET layout_config = $2, custom_metrics = $3, favorite_modules = $4,
                             refresh_interval = $5, auto_refresh = $6, theme = $7, 
                             language = $8, timezone = $9, updated_at = NOW()
                         WHERE user_id = $1
                         RETURNING id, user_id, layout_config, custom_metrics, favorite_modules, 
                                   refresh_interval, auto_refresh, theme, language, timezone, 
                                   created_at, updated_at"
                    )
                    .bind(user_id)
                    .bind(&prefs.layout_config)
                    .bind(prefs.custom_metrics.as_ref().map(|v| v.as_slice()))
                    .bind(prefs.favorite_modules.as_ref().map(|v| v.as_slice()))
                    .bind(prefs.refresh_interval)
                    .bind(prefs.auto_refresh)
                    .bind(prefs.theme.as_deref())
                    .bind(prefs.language.as_deref())
                    .bind(prefs.timezone.as_deref())
                    .fetch_one(&**pool)
                    .await
                    {
                        Ok(updated_prefs) => updated_prefs,
                        Err(e) => {
                            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                                success: false,
                                data: None,
                                message: Some("Failed to update preferences".to_string()),
                                error: Some(format!("{}", e)),
                            }));
                        }
                    }
                }
                Err(e) => {
                    return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                        success: false,
                        data: None,
                        message: Some("Failed to create default preferences".to_string()),
                        error: Some(format!("{}", e)),
                    }));
                }
            }
        }
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to update user preferences".to_string()),
                error: Some(format!("{}", e)),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(updated_preferences),
        message: Some("User preferences updated successfully".to_string()),
        error: None,
    }))
}

// Reset user preferences to defaults
pub async fn reset_user_preferences(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse> {
    let user_id = path.into_inner();
    
    // Verify JWT token
    let token = match req.headers().get("Authorization") {
        Some(header) => {
            let auth_str = header.to_str().unwrap_or("");
            if auth_str.starts_with("Bearer ") {
                &auth_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: Some("Invalid authorization header".to_string()),
                    error: Some("Invalid token format".to_string()),
                }));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Authorization header missing".to_string()),
                error: Some("No token provided".to_string()),
            }));
        }
    };

    let claims = match verify_jwt_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid token".to_string()),
                error: Some("Token verification failed".to_string()),
            }));
        }
    };

    // Check if user is resetting their own preferences or has admin permissions
    let claims_user_id = Uuid::parse_str(&claims.sub).map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID in token"))?;
    if claims_user_id != user_id && claims.role != "admin" {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Access denied".to_string()),
            error: Some("Insufficient permissions".to_string()),
        }));
    }

    // Get user role for default preferences
    let user_role: String = match sqlx::query_scalar::<_, String>(
        "SELECT role FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(&**pool)
    .await
    {
        Ok(role) => role,
        Err(_) => {
            return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("User not found".to_string()),
                error: Some("User does not exist".to_string()),
            }));
        }
    };

    // Delete existing preferences
    match sqlx::query!(
        "DELETE FROM user_dashboard_preferences WHERE user_id = $1",
        user_id
    )
    .execute(&**pool)
    .await
    {
        Ok(_) => {}
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to reset preferences".to_string()),
                error: Some(format!("{}", e)),
            }));
        }
    }

    // Create default preferences
    let default_preferences = match create_default_preferences(&pool, &user_id, &user_role).await {
        Ok(prefs) => prefs,
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to create default preferences".to_string()),
                error: Some(format!("{}", e)),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(default_preferences),
        message: Some("User preferences reset to defaults successfully".to_string()),
        error: None,
    }))
}

// Get role preference template
pub async fn get_role_preference_template(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let role = path.into_inner();
    
    // Verify JWT token
    let token = match req.headers().get("Authorization") {
        Some(header) => {
            let auth_str = header.to_str().unwrap_or("");
            if auth_str.starts_with("Bearer ") {
                &auth_str[7..]
            } else {
                return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: Some("Invalid authorization header".to_string()),
                    error: Some("Invalid token format".to_string()),
                }));
            }
        }
        None => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Authorization header missing".to_string()),
                error: Some("No token provided".to_string()),
            }));
        }
    };

    let _claims = match verify_jwt_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return Ok(HttpResponse::Unauthorized().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Invalid token".to_string()),
                error: Some("Token verification failed".to_string()),
            }));
        }
    };

    // Get role-specific template
    let template = get_role_template(&role);

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(template),
        message: Some("Role preference template retrieved successfully".to_string()),
        error: None,
    }))
}

// Helper function to create default preferences
async fn create_default_preferences(
    pool: &PgPool,
    user_id: &Uuid,
    role: &str,
) -> Result<UserPreferences, sqlx::Error> {
    let template = get_role_template(role);

    let preferences = sqlx::query_as::<UserPreferences>(
        "INSERT INTO user_dashboard_preferences 
         (user_id, layout_config, custom_metrics, favorite_modules, 
          refresh_interval, auto_refresh, theme, language, timezone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, user_id, layout_config, custom_metrics, favorite_modules, 
                   refresh_interval, auto_refresh, theme, language, timezone, 
                   created_at, updated_at"
    )
    .bind(user_id)
    .bind(template.default_layout_config)
    .bind(&template.default_custom_metrics)
    .bind(&template.default_favorite_modules)
    .bind(template.default_refresh_interval)
    .bind(template.default_auto_refresh)
    .bind(template.default_theme)
    .bind(template.default_language)
    .bind(template.default_timezone)
    .fetch_one(pool)
    .await?;

    Ok(preferences)
}

// Helper function to get role-specific template
fn get_role_template(role: &str) -> RolePreferenceTemplate {
    match role {
        "admin" => RolePreferenceTemplate {
            role: "admin".to_string(),
            default_layout_config: serde_json::json!({
                "layout": "detailed",
                "defaultView": "overview",
                "showSystemHealth": true,
                "showAuditLogs": true
            }),
            default_custom_metrics: vec![
                "total_revenue".to_string(),
                "active_users".to_string(),
                "system_health".to_string(),
                "audit_logs".to_string()
            ],
            default_favorite_modules: vec![
                "users".to_string(),
                "settings".to_string(),
                "reports".to_string(),
                "audit_logs".to_string()
            ],
            default_refresh_interval: 30,
            default_auto_refresh: true,
            default_theme: "auto".to_string(),
            default_language: "en".to_string(),
            default_timezone: "Africa/Nairobi".to_string(),
        },
        "clinician" => RolePreferenceTemplate {
            role: "clinician".to_string(),
            default_layout_config: serde_json::json!({
                "layout": "detailed",
                "defaultView": "consultations",
                "showPatientHistory": true,
                "showPrescriptions": true
            }),
            default_custom_metrics: vec![
                "consultations_today".to_string(),
                "prescriptions_written".to_string(),
                "diagnoses_made".to_string(),
                "follow_up_required".to_string()
            ],
            default_favorite_modules: vec![
                "consultations".to_string(),
                "prescriptions".to_string(),
                "patients".to_string(),
                "reports".to_string()
            ],
            default_refresh_interval: 60,
            default_auto_refresh: true,
            default_theme: "auto".to_string(),
            default_language: "en".to_string(),
            default_timezone: "Africa/Nairobi".to_string(),
        },
        "nurse" => RolePreferenceTemplate {
            role: "nurse".to_string(),
            default_layout_config: serde_json::json!({
                "layout": "compact",
                "defaultView": "patients",
                "showVitals": true,
                "showMedications": true
            }),
            default_custom_metrics: vec![
                "patients_seen_today".to_string(),
                "vitals_recorded".to_string(),
                "pending_assessments".to_string(),
                "medications_administered".to_string()
            ],
            default_favorite_modules: vec![
                "patients".to_string(),
                "consultations".to_string(),
                "vitals".to_string(),
                "medications".to_string()
            ],
            default_refresh_interval: 45,
            default_auto_refresh: true,
            default_theme: "light".to_string(),
            default_language: "en".to_string(),
            default_timezone: "Africa/Nairobi".to_string(),
        },
        "pharmacist" => RolePreferenceTemplate {
            role: "pharmacist".to_string(),
            default_layout_config: serde_json::json!({
                "layout": "detailed",
                "defaultView": "pharmacy",
                "showStockAlerts": true,
                "showExpiryAlerts": true
            }),
            default_custom_metrics: vec![
                "prescriptions_dispensed".to_string(),
                "stock_movements".to_string(),
                "expiry_alerts".to_string(),
                "inventory_value".to_string()
            ],
            default_favorite_modules: vec![
                "pharmacy".to_string(),
                "inventory".to_string(),
                "prescriptions".to_string(),
                "stock_alerts".to_string()
            ],
            default_refresh_interval: 30,
            default_auto_refresh: true,
            default_theme: "auto".to_string(),
            default_language: "en".to_string(),
            default_timezone: "Africa/Nairobi".to_string(),
        },
        "receptionist" => RolePreferenceTemplate {
            role: "receptionist".to_string(),
            default_layout_config: serde_json::json!({
                "layout": "compact",
                "defaultView": "appointments",
                "showPatientQueue": true,
                "showBilling": true
            }),
            default_custom_metrics: vec![
                "new_patients_today".to_string(),
                "appointments_today".to_string(),
                "pending_registrations".to_string(),
                "billing_pending".to_string()
            ],
            default_favorite_modules: vec![
                "patients".to_string(),
                "appointments".to_string(),
                "billing".to_string(),
                "queue".to_string()
            ],
            default_refresh_interval: 20,
            default_auto_refresh: true,
            default_theme: "light".to_string(),
            default_language: "en".to_string(),
            default_timezone: "Africa/Nairobi".to_string(),
        },
        _ => RolePreferenceTemplate {
            role: "default".to_string(),
            default_layout_config: serde_json::json!({
                "layout": "detailed",
                "defaultView": "overview"
            }),
            default_custom_metrics: vec![
                "total_patients".to_string(),
                "today_consultations".to_string(),
                "pending_prescriptions".to_string()
            ],
            default_favorite_modules: vec![
                "patients".to_string(),
                "consultations".to_string(),
                "reports".to_string()
            ],
            default_refresh_interval: 30,
            default_auto_refresh: true,
            default_theme: "auto".to_string(),
            default_language: "en".to_string(),
            default_timezone: "Africa/Nairobi".to_string(),
        }
    }
}
