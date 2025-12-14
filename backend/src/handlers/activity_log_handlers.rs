use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

use crate::models::ApiResponse;
use crate::auth::verify_jwt_token;
use crate::errors::AppError;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserActivity {
    pub id: Uuid,
    pub user_id: Uuid,
    pub action: String,
    pub module: String,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub details: serde_json::Value,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub session_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LogActivityRequest {
    pub action: String,
    pub module: String,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActivityStats {
    pub total_activities: i64,
    pub activities_today: i64,
    pub activities_this_week: i64,
    pub activities_this_month: i64,
    pub top_actions: Vec<ActionCount>,
    pub top_modules: Vec<ModuleCount>,
    pub hourly_distribution: Vec<HourlyCount>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ActionCount {
    pub action: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ModuleCount {
    pub module: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct HourlyCount {
    pub hour: i32,
    pub count: i64,
}

// Log user activity
pub async fn log_user_activity(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    activity_data: web::Json<LogActivityRequest>,
) -> Result<HttpResponse> {
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

    // Validate input data
    if activity_data.action.is_empty() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Action is required".to_string()),
            error: Some("Action cannot be empty".to_string()),
        }));
    }

    if activity_data.module.is_empty() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Module is required".to_string()),
            error: Some("Module cannot be empty".to_string()),
        }));
    }

    // Get client IP address
    let ip_address = req
        .headers()
        .get("X-Forwarded-For")
        .or_else(|| req.headers().get("X-Real-IP"))
        .and_then(|header| header.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string());

    // Get user agent
    let user_agent = req
        .headers()
        .get("User-Agent")
        .and_then(|header| header.to_str().ok())
        .map(|s| s.to_string());

    // Log the activity
    let activity = match sqlx::query_as::<_, UserActivity>(
        "INSERT INTO user_activity_logs 
         (user_id, action, module, entity_type, entity_id, details, ip_address, user_agent, session_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8, $9)
         RETURNING id, user_id, action, module, entity_type, entity_id, details, 
                   ip_address, user_agent, session_id, created_at"
    )
    .bind(uuid::Uuid::parse_str(&claims.sub).map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?)
    .bind(&activity_data.action)
    .bind(&activity_data.module)
    .bind(activity_data.entity_type.as_deref())
    .bind(activity_data.entity_id)
    .bind(activity_data.details.as_ref().unwrap_or(&serde_json::Value::Object(serde_json::Map::new())))
    .bind(ip_address.as_deref())
    .bind(user_agent.as_deref())
    .bind(claims.session_id.as_deref())
    .fetch_one(pool.get_ref())
    .await
    {
        Ok(activity) => activity,
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to log activity".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Created().json(ApiResponse {
        success: true,
        data: Some(activity),
        message: Some("Activity logged successfully".to_string()),
        error: None,
    }))
}

// Get user activity logs
pub async fn get_user_activity(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    query: web::Query<HashMap<String, String>>,
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

    // Check if user is requesting their own activity or has admin permissions
    if claims.sub != user_id.to_string() && claims.role != "admin" {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Access denied".to_string()),
            error: Some("Insufficient permissions".to_string()),
        }));
    }

    // Parse query parameters
    let limit = query
        .get("limit")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(50)
        .min(100); // Max 100 records

    let offset = query
        .get("offset")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(0);

    let action_filter = query.get("action");
    let module_filter = query.get("module");
    let entity_type_filter = query.get("entity_type");

    // Build query
    let mut query_builder = sqlx::QueryBuilder::new(
        "SELECT id, user_id, action, module, entity_type, entity_id, details, 
                ip_address, user_agent, session_id, created_at 
         FROM user_activity_logs 
         WHERE user_id = "
    );
    query_builder.push_bind(user_id);

    if let Some(action) = action_filter {
        query_builder.push(" AND action = ");
        query_builder.push_bind(action);
    }

    if let Some(module) = module_filter {
        query_builder.push(" AND module = ");
        query_builder.push_bind(module);
    }

    if let Some(entity_type) = entity_type_filter {
        query_builder.push(" AND entity_type = ");
        query_builder.push_bind(entity_type);
    }

    query_builder.push(" ORDER BY created_at DESC LIMIT ");
    query_builder.push_bind(limit);
    query_builder.push(" OFFSET ");
    query_builder.push_bind(offset);

    // Execute query
    let query = query_builder.build_query_as::<UserActivity>();
    let activities = match query.fetch_all(pool.get_ref())
        .await
    {
        Ok(activities) => activities,
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to fetch user activities".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(activities),
        message: Some("User activities retrieved successfully".to_string()),
        error: None,
    }))
}

// Get recent activities
pub async fn get_recent_activities(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    query: web::Query<HashMap<String, String>>,
) -> Result<HttpResponse> {
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

    // Parse query parameters
    let limit = query
        .get("limit")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(20)
        .min(50); // Max 50 records

    let hours = query
        .get("hours")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(24)
        .min(168); // Max 1 week

    // Get recent activities
    let activities = match sqlx::query_as::<_, UserActivity>(
        "SELECT ual.id, ual.user_id, ual.action, ual.module, ual.entity_type, ual.entity_id, 
                ual.details, ual.ip_address, ual.user_agent, ual.session_id, ual.created_at
         FROM user_activity_logs ual
         JOIN users u ON ual.user_id = u.id
         WHERE ual.created_at >= NOW() - INTERVAL $1 hours
         ORDER BY ual.created_at DESC
         LIMIT $2"
    )
    .bind(hours)
    .bind(limit)
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(activities) => activities,
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to fetch recent activities".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(activities),
        message: Some("Recent activities retrieved successfully".to_string()),
        error: None,
    }))
}

// Get activity statistics
pub async fn get_activity_statistics(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    query: web::Query<HashMap<String, String>>,
) -> Result<HttpResponse> {
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

    // Only admin can access activity statistics
    if claims.role != "admin" {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Access denied".to_string()),
            error: Some("Admin access required".to_string()),
        }));
    }

    // Parse query parameters
    let user_id_filter = query.get("user_id").and_then(|s| s.parse::<Uuid>().ok());
    let days = query
        .get("days")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(30)
        .min(365); // Max 1 year

    // Calculate statistics
    let total_activities = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM user_activity_logs WHERE created_at >= NOW() - INTERVAL $1 days"
    )
    .bind(days)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    let activities_today = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM user_activity_logs WHERE created_at >= CURRENT_DATE"
    )
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    let activities_this_week = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM user_activity_logs WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)"
    )
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    let activities_this_month = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM user_activity_logs WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)"
    )
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    // Get top actions
    let top_actions = sqlx::query_as::<_, ActionCount>(
        "SELECT action, COUNT(*) as count 
         FROM user_activity_logs 
         WHERE created_at >= NOW() - INTERVAL $1 days
         GROUP BY action 
         ORDER BY count DESC 
         LIMIT 10"
    )
    .bind(days)
    .fetch_all(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Database error: {}", e)))?;

    // Get top modules
    let top_modules = sqlx::query_as::<_, ModuleCount>(
        "SELECT module, COUNT(*) as count 
         FROM user_activity_logs 
         WHERE created_at >= NOW() - INTERVAL $1 days
         GROUP BY module 
         ORDER BY count DESC 
         LIMIT 10"
    )
    .bind(days)
    .fetch_all(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Database error: {}", e)))?;

    // Get hourly distribution
    let hourly_distribution = sqlx::query_as::<_, HourlyCount>(
        "SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count 
         FROM user_activity_logs 
         WHERE created_at >= NOW() - INTERVAL $1 days
         GROUP BY EXTRACT(HOUR FROM created_at) 
         ORDER BY hour"
    )
    .bind(days)
    .fetch_all(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Database error: {}", e)))?;

    let stats = ActivityStats {
        total_activities,
        activities_today,
        activities_this_week,
        activities_this_month,
        top_actions,
        top_modules,
        hourly_distribution,
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(stats),
        message: Some("Activity statistics retrieved successfully".to_string()),
        error: None,
    }))
}
