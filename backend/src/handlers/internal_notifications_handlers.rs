use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use chrono::Utc;
use sqlx::Row;

use crate::models::ApiResponse;
use crate::AppState;
use crate::middleware::auth::get_current_user;

/// GET /api/notifications
/// Get all notifications for the current user
pub async fn get_user_notifications(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    // Get query parameters
    let unread_only = query.get("unread_only")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    
    let limit = query.get("limit")
        .and_then(|v| v.as_i64())
        .unwrap_or(50) as i64;

    // Build query
    let query_str = if unread_only {
        r#"
        SELECT id, recipient_id, recipient_email, recipient_phone,
               notification_type, template, subject, content, priority,
               status, is_read, read_at, action_url, action_label,
               scheduled_at, sent_at, delivered_at, failed_at, error_message,
               metadata, created_at, created_by, updated_at
        FROM notifications
        WHERE recipient_id = $1 
        AND notification_type = 'in_app'
        AND is_read = false
        ORDER BY 
            CASE priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'normal' THEN 3
                WHEN 'low' THEN 4
            END,
            created_at DESC
        LIMIT $2
        "#
    } else {
        r#"
        SELECT id, recipient_id, recipient_email, recipient_phone,
               notification_type, template, subject, content, priority,
               status, is_read, read_at, action_url, action_label,
               scheduled_at, sent_at, delivered_at, failed_at, error_message,
               metadata, created_at, created_by, updated_at
        FROM notifications
        WHERE recipient_id = $1 
        AND notification_type = 'in_app'
        ORDER BY 
            CASE priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'normal' THEN 3
                WHEN 'low' THEN 4
            END,
            created_at DESC
        LIMIT $2
        "#
    };

    let notifications_result = sqlx::query(query_str)
        .bind(user_id)
        .bind(limit)
        .fetch_all(&data.db_pool)
        .await;

    let notifications = match notifications_result {
        Ok(rows) => {
            rows.into_iter().map(|row| {
                json!({
                    "id": row.get::<Uuid, _>("id"),
                    "recipient_id": row.try_get::<Option<Uuid>, _>("recipient_id").ok().flatten(),
                    "template": row.get::<String, _>("template"),
                    "subject": row.try_get::<Option<String>, _>("subject").ok().flatten(),
                    "content": row.get::<String, _>("content"),
                    "priority": row.get::<String, _>("priority"),
                    "status": row.get::<String, _>("status"),
                    "is_read": row.get::<bool, _>("is_read"),
                    "read_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("read_at").ok().flatten(),
                    "action_url": row.try_get::<Option<String>, _>("action_url").ok().flatten(),
                    "action_label": row.try_get::<Option<String>, _>("action_label").ok().flatten(),
                    "metadata": row.try_get::<Option<serde_json::Value>, _>("metadata").ok().flatten(),
                    "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                    "created_by": row.try_get::<Option<Uuid>, _>("created_by").ok().flatten(),
                })
            }).collect::<Vec<_>>()
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to fetch notifications".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(notifications),
        message: Some("Notifications retrieved successfully".to_string()),
        error: None,
    }))
}

/// GET /api/notifications/unread-count
/// Get count of unread notifications
pub async fn get_unread_count(
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    let count_result = sqlx::query(
        r#"
        SELECT COUNT(*) as count
        FROM notifications
        WHERE recipient_id = $1 
        AND notification_type = 'in_app'
        AND is_read = false
        "#
    )
    .bind(user_id)
    .fetch_one(&data.db_pool)
    .await;

    let count = match count_result {
        Ok(row) => row.get::<i64, _>("count"),
        Err(e) => {
            eprintln!("Database error: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to get unread count".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({ "count": count })),
        message: None,
        error: None,
    }))
}

/// POST /api/notifications/{id}/read
/// Mark a notification as read
pub async fn mark_notification_read(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    let notification_id = path.into_inner();

    // Verify notification belongs to user
    let notification_result = sqlx::query(
        "SELECT recipient_id FROM notifications WHERE id = $1"
    )
    .bind(notification_id)
    .fetch_optional(&data.db_pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;

    let notification = match notification_result {
        Some(row) => row,
        None => {
            return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Notification not found".to_string()),
                error: Some("Notification does not exist".to_string()),
            }));
        }
    };

    let recipient_id: Option<Uuid> = notification.try_get("recipient_id").ok().flatten();

    if recipient_id != Some(user_id) {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("You don't have permission to mark this notification as read".to_string()),
            error: Some("Permission denied".to_string()),
        }));
    }

    match sqlx::query(
        "UPDATE notifications SET is_read = true, read_at = $1 WHERE id = $2"
    )
    .bind(Utc::now())
    .bind(notification_id)
    .execute(&data.db_pool)
    .await
    {
        Ok(_) => {
            Ok(HttpResponse::Ok().json(ApiResponse::<()> {
                success: true,
                data: None,
                message: Some("Notification marked as read".to_string()),
                error: None,
            }))
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to mark notification as read".to_string()),
                error: Some(e.to_string()),
            }))
        }
    }
}

/// POST /api/notifications/read-all
/// Mark all notifications as read for the current user
pub async fn mark_all_read(
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    match sqlx::query(
        "UPDATE notifications SET is_read = true, read_at = $1 WHERE recipient_id = $2 AND notification_type = 'in_app' AND is_read = false"
    )
    .bind(Utc::now())
    .bind(user_id)
    .execute(&data.db_pool)
    .await
    {
        Ok(result) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(json!({ "updated_count": result.rows_affected() })),
                message: Some("All notifications marked as read".to_string()),
                error: None,
            }))
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to mark all notifications as read".to_string()),
                error: Some(e.to_string()),
            }))
        }
    }
}

/// POST /api/notifications
/// Create a new internal notification
pub async fn create_internal_notification(
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let creator_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    let notification_data = req.into_inner();

    // Extract required fields
    let recipient_id = notification_data.get("recipient_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| actix_web::error::ErrorBadRequest("recipient_id is required and must be a valid UUID"))?;

    let content = notification_data.get("content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| actix_web::error::ErrorBadRequest("content is required"))?;

    if content.trim().is_empty() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Notification content cannot be empty".to_string()),
            error: Some("Validation error".to_string()),
        }));
    }

    let template = notification_data.get("template")
        .and_then(|v| v.as_str())
        .unwrap_or("custom");

    let priority = notification_data.get("priority")
        .and_then(|v| v.as_str())
        .unwrap_or("normal");

    let subject = notification_data.get("subject").and_then(|v| v.as_str());
    let action_url = notification_data.get("action_url").and_then(|v| v.as_str());
    let action_label = notification_data.get("action_label").and_then(|v| v.as_str());
    let metadata = notification_data.get("metadata");

    let notification_id = Uuid::new_v4();
    let now = Utc::now();

    match sqlx::query(
        r#"
        INSERT INTO notifications (
            id, recipient_id, notification_type, template, subject, content,
            priority, status, action_url, action_label, metadata,
            created_at, created_by, updated_at
        )
        VALUES ($1, $2, 'in_app', $3, $4, $5, $6, 'sent', $7, $8, $9, $10, $11, $12)
        RETURNING id, recipient_id, template, subject, content, priority,
                  status, is_read, action_url, action_label, metadata,
                  created_at, created_by
        "#
    )
    .bind(notification_id)
    .bind(recipient_id)
    .bind(template)
    .bind(subject)
    .bind(content)
    .bind(priority)
    .bind(action_url)
    .bind(action_label)
    .bind(metadata.map(|m| json!(m)))
    .bind(now)
    .bind(creator_id)
    .bind(now)
    .fetch_one(&data.db_pool)
    .await
    {
        Ok(row) => {
            let notification = json!({
                "id": row.get::<Uuid, _>("id"),
                "recipient_id": row.get::<Option<Uuid>, _>("recipient_id"),
                "template": row.get::<String, _>("template"),
                "subject": row.try_get::<Option<String>, _>("subject").ok().flatten(),
                "content": row.get::<String, _>("content"),
                "priority": row.get::<String, _>("priority"),
                "status": row.get::<String, _>("status"),
                "is_read": row.get::<bool, _>("is_read"),
                "action_url": row.try_get::<Option<String>, _>("action_url").ok().flatten(),
                "action_label": row.try_get::<Option<String>, _>("action_label").ok().flatten(),
                "metadata": row.try_get::<Option<serde_json::Value>, _>("metadata").ok().flatten(),
                "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                "created_by": row.try_get::<Option<Uuid>, _>("created_by").ok().flatten(),
            });

            // TODO: Send via WebSocket if available
            // WebSocket notification sending can be implemented here

            Ok(HttpResponse::Created().json(ApiResponse {
                success: true,
                data: Some(notification),
                message: Some("Notification created successfully".to_string()),
                error: None,
            }))
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to create notification".to_string()),
                error: Some(e.to_string()),
            }))
        }
    }
}

