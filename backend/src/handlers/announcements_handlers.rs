use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use chrono::Utc;
use sqlx::Row;

use crate::models::ApiResponse;
use crate::AppState;
use crate::middleware::auth::get_current_user;

/// GET /api/announcements
/// Get announcements visible to the current user
pub async fn get_announcements(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    // Get user info (role, department)
    let user_row = sqlx::query(
        "SELECT role, department FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(&data.db_pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;

    let (user_role, user_department) = match user_row {
        Some(row) => (
            row.try_get::<String, _>("role").ok(),
            row.try_get::<Option<String>, _>("department").ok().flatten(),
        ),
        None => (None, None),
    };

    // Get query parameters
    let include_acknowledged = query.get("include_acknowledged")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    
    let limit = query.get("limit")
        .and_then(|v| v.as_i64())
        .unwrap_or(50) as i64;

    // Build query to get announcements visible to user
    let announcements_result = sqlx::query(
        r#"
        SELECT DISTINCT a.id, a.title, a.content, a.priority, a.status, a.scope,
               a.target_departments, a.target_roles, a.target_user_ids,
               a.published_at, a.expires_at, a.is_pinned, a.requires_acknowledgment,
               a.allow_comments, a.tags, a.metadata, a.created_by, a.created_at, a.updated_at,
               u.name as creator_name, u.role as creator_role,
               CASE WHEN aa.user_id IS NOT NULL THEN true ELSE false END as is_acknowledged,
               aa.acknowledged_at
        FROM announcements a
        LEFT JOIN users u ON a.created_by = u.id
        LEFT JOIN announcement_acknowledgments aa ON a.id = aa.announcement_id AND aa.user_id = $1
        WHERE a.deleted_at IS NULL
        AND a.status = 'published'
        AND (
            a.scope = 'system'
            OR (a.scope = 'department' AND ($2 = ANY(a.target_departments) OR $2 IS NULL))
            OR (a.scope = 'role' AND ($3 = ANY(a.target_roles)))
            OR (a.scope = 'custom' AND ($1 = ANY(a.target_user_ids)))
        )
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        AND ($4 = true OR aa.user_id IS NULL)
        ORDER BY a.is_pinned DESC, a.published_at DESC
        LIMIT $5
        "#
    )
    .bind(user_id)
    .bind(user_department.as_deref())
    .bind(user_role.as_deref())
    .bind(include_acknowledged)
    .bind(limit)
    .fetch_all(&data.db_pool)
    .await;

    let announcements = match announcements_result {
        Ok(rows) => {
            rows.into_iter().map(|row| {
                json!({
                    "id": row.get::<Uuid, _>("id"),
                    "title": row.get::<String, _>("title"),
                    "content": row.get::<String, _>("content"),
                    "priority": row.get::<String, _>("priority"),
                    "status": row.get::<String, _>("status"),
                    "scope": row.get::<String, _>("scope"),
                    "target_departments": row.try_get::<Option<Vec<String>>, _>("target_departments").ok().flatten(),
                    "target_roles": row.try_get::<Option<Vec<String>>, _>("target_roles").ok().flatten(),
                    "target_user_ids": row.try_get::<Option<Vec<Uuid>>, _>("target_user_ids").ok().flatten(),
                    "published_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("published_at").ok().flatten(),
                    "expires_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("expires_at").ok().flatten(),
                    "is_pinned": row.get::<bool, _>("is_pinned"),
                    "requires_acknowledgment": row.get::<bool, _>("requires_acknowledgment"),
                    "allow_comments": row.get::<bool, _>("allow_comments"),
                    "tags": row.try_get::<Option<Vec<String>>, _>("tags").ok().flatten(),
                    "metadata": row.try_get::<Option<serde_json::Value>, _>("metadata").ok().flatten(),
                    "created_by": row.get::<Uuid, _>("created_by"),
                    "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at"),
                    "creator_name": row.try_get::<Option<String>, _>("creator_name").ok().flatten(),
                    "creator_role": row.try_get::<Option<String>, _>("creator_role").ok().flatten(),
                    "is_acknowledged": row.get::<bool, _>("is_acknowledged"),
                    "acknowledged_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("acknowledged_at").ok().flatten(),
                })
            }).collect::<Vec<_>>()
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to fetch announcements".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(announcements),
        message: Some("Announcements retrieved successfully".to_string()),
        error: None,
    }))
}

/// POST /api/announcements
/// Create a new announcement (admin/manager only)
pub async fn create_announcement(
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let creator_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    // Check if user is admin or manager
    let user_row = sqlx::query("SELECT role FROM users WHERE id = $1")
        .bind(creator_id)
        .fetch_optional(&data.db_pool)
        .await
        .map_err(|e| {
            eprintln!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    let user_role = user_row
        .and_then(|row| row.try_get::<String, _>("role").ok())
        .unwrap_or_else(|| "user".to_string());

    if user_role != "admin" && user_role != "manager" {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Only admins and managers can create announcements".to_string()),
            error: Some("Permission denied".to_string()),
        }));
    }

    let announcement_data = req.into_inner();

    // Extract required fields
    let title = announcement_data.get("title")
        .and_then(|v| v.as_str())
        .ok_or_else(|| actix_web::error::ErrorBadRequest("title is required"))?;

    if title.trim().is_empty() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Announcement title cannot be empty".to_string()),
            error: Some("Validation error".to_string()),
        }));
    }

    let content = announcement_data.get("content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| actix_web::error::ErrorBadRequest("content is required"))?;

    if content.trim().is_empty() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Announcement content cannot be empty".to_string()),
            error: Some("Validation error".to_string()),
        }));
    }

    let scope = announcement_data.get("scope")
        .and_then(|v| v.as_str())
        .unwrap_or("system");

    let priority = announcement_data.get("priority")
        .and_then(|v| v.as_str())
        .unwrap_or("normal");

    let status = announcement_data.get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("draft");

    let target_departments = announcement_data.get("target_departments")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect::<Vec<_>>());
    
    let target_roles = announcement_data.get("target_roles")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect::<Vec<_>>());
    
    let target_user_ids = announcement_data.get("target_user_ids")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().and_then(|s| Uuid::parse_str(s).ok())).collect::<Vec<_>>());

    let published_at = announcement_data.get("published_at")
        .and_then(|v| v.as_str())
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc));

    let expires_at = announcement_data.get("expires_at")
        .and_then(|v| v.as_str())
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc));

    let is_pinned = announcement_data.get("is_pinned")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let requires_acknowledgment = announcement_data.get("requires_acknowledgment")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let allow_comments = announcement_data.get("allow_comments")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let tags = announcement_data.get("tags")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect::<Vec<_>>());

    let metadata = announcement_data.get("metadata");

    let announcement_id = Uuid::new_v4();
    let now = Utc::now();

    // If status is published and published_at is not set, set it to now
    let final_published_at = if status == "published" && published_at.is_none() {
        Some(now)
    } else {
        published_at
    };

    match sqlx::query(
        r#"
        INSERT INTO announcements (
            id, title, content, priority, status, scope,
            target_departments, target_roles, target_user_ids,
            published_at, expires_at, is_pinned, requires_acknowledgment,
            allow_comments, tags, metadata, created_by, updated_by,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING id, title, content, priority, status, scope,
                  target_departments, target_roles, target_user_ids,
                  published_at, expires_at, is_pinned, requires_acknowledgment,
                  allow_comments, tags, metadata, created_by, created_at, updated_at
        "#
    )
    .bind(announcement_id)
    .bind(title)
    .bind(content)
    .bind(priority)
    .bind(status)
    .bind(scope)
    .bind(target_departments)
    .bind(target_roles)
    .bind(target_user_ids)
    .bind(final_published_at)
    .bind(expires_at)
    .bind(is_pinned)
    .bind(requires_acknowledgment)
    .bind(allow_comments)
    .bind(tags)
    .bind(metadata.map(|m| json!(m)))
    .bind(creator_id)
    .bind(creator_id)
    .bind(now)
    .bind(now)
    .fetch_one(&data.db_pool)
    .await
    {
        Ok(row) => {
            // If published, create notifications for target users
            if status == "published" {
                // This would trigger notifications - simplified for now
                // In production, you'd query target users and create notifications
            }

            let announcement = json!({
                "id": row.get::<Uuid, _>("id"),
                "title": row.get::<String, _>("title"),
                "content": row.get::<String, _>("content"),
                "priority": row.get::<String, _>("priority"),
                "status": row.get::<String, _>("status"),
                "scope": row.get::<String, _>("scope"),
                "target_departments": row.try_get::<Option<Vec<String>>, _>("target_departments").ok().flatten(),
                "target_roles": row.try_get::<Option<Vec<String>>, _>("target_roles").ok().flatten(),
                "target_user_ids": row.try_get::<Option<Vec<Uuid>>, _>("target_user_ids").ok().flatten(),
                "published_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("published_at").ok().flatten(),
                "expires_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("expires_at").ok().flatten(),
                "is_pinned": row.get::<bool, _>("is_pinned"),
                "requires_acknowledgment": row.get::<bool, _>("requires_acknowledgment"),
                "allow_comments": row.get::<bool, _>("allow_comments"),
                "tags": row.try_get::<Option<Vec<String>>, _>("tags").ok().flatten(),
                "metadata": row.try_get::<Option<serde_json::Value>, _>("metadata").ok().flatten(),
                "created_by": row.get::<Uuid, _>("created_by"),
                "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at"),
            });

            Ok(HttpResponse::Created().json(ApiResponse {
                success: true,
                data: Some(announcement),
                message: Some("Announcement created successfully".to_string()),
                error: None,
            }))
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to create announcement".to_string()),
                error: Some(e.to_string()),
            }))
        }
    }
}

/// POST /api/announcements/{id}/acknowledge
/// Acknowledge an announcement
pub async fn acknowledge_announcement(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    let announcement_id = path.into_inner();

    // Verify announcement exists and is published
    let announcement_result = sqlx::query(
        "SELECT requires_acknowledgment FROM announcements WHERE id = $1 AND deleted_at IS NULL AND status = 'published'"
    )
    .bind(announcement_id)
    .fetch_optional(&data.db_pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;

    match announcement_result {
        Some(row) => {
            let requires_ack = row.get::<bool, _>("requires_acknowledgment");
            
            if !requires_ack {
                return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: Some("This announcement does not require acknowledgment".to_string()),
                    error: Some("Invalid request".to_string()),
                }));
            }
        },
        None => {
            return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Announcement not found or not published".to_string()),
                error: Some("Not found".to_string()),
            }));
        }
    }

    // Insert acknowledgment (or update if exists)
    match sqlx::query(
        r#"
        INSERT INTO announcement_acknowledgments (announcement_id, user_id, acknowledged_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (announcement_id, user_id) DO UPDATE SET acknowledged_at = $3
        RETURNING id, announcement_id, user_id, acknowledged_at
        "#
    )
    .bind(announcement_id)
    .bind(user_id)
    .bind(Utc::now())
    .fetch_one(&data.db_pool)
    .await
    {
        Ok(row) => {
            let acknowledgment = json!({
                "id": row.get::<Uuid, _>("id"),
                "announcement_id": row.get::<Uuid, _>("announcement_id"),
                "user_id": row.get::<Uuid, _>("user_id"),
                "acknowledged_at": row.get::<chrono::DateTime<Utc>, _>("acknowledged_at"),
            });

            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(acknowledgment),
                message: Some("Announcement acknowledged".to_string()),
                error: None,
            }))
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to acknowledge announcement".to_string()),
                error: Some(e.to_string()),
            }))
        }
    }
}

/// GET /api/announcements/unread-count
/// Get count of unread announcements
pub async fn get_unread_announcements_count(
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    // Get user info
    let user_row = sqlx::query("SELECT role, department FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&data.db_pool)
        .await
        .map_err(|e| {
            eprintln!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    let (user_role, user_department) = match user_row {
        Some(row) => (
            row.try_get::<String, _>("role").ok(),
            row.try_get::<Option<String>, _>("department").ok().flatten(),
        ),
        None => (None, None),
    };

    let count_result = sqlx::query(
        r#"
        SELECT COUNT(DISTINCT a.id) as count
        FROM announcements a
        LEFT JOIN announcement_acknowledgments aa ON a.id = aa.announcement_id AND aa.user_id = $1
        WHERE a.deleted_at IS NULL
        AND a.status = 'published'
        AND (
            a.scope = 'system'
            OR (a.scope = 'department' AND ($2 = ANY(a.target_departments) OR $2 IS NULL))
            OR (a.scope = 'role' AND ($3 = ANY(a.target_roles)))
            OR (a.scope = 'custom' AND ($1 = ANY(a.target_user_ids)))
        )
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        AND aa.user_id IS NULL
        "#
    )
    .bind(user_id)
    .bind(user_department.as_deref())
    .bind(user_role.as_deref())
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

