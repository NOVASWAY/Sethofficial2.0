use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use chrono::Utc;
use sqlx::Row;

use crate::models::{Note, CreateNote, UpdateNote, NoteWithUser, ApiResponse};
use crate::AppState;
use crate::middleware::auth::get_current_user;

/// GET /api/notes?resource_type=patient&resource_id=uuid
/// Get all notes for a specific resource
pub async fn get_notes(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    let resource_type = query.get("resource_type")
        .and_then(|v| v.as_str())
        .ok_or_else(|| actix_web::error::ErrorBadRequest("resource_type is required"))?;

    let resource_id = query.get("resource_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| actix_web::error::ErrorBadRequest("resource_id is required and must be a valid UUID"))?;

    // Get user role to check permissions
    let user_row = sqlx::query("SELECT role FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&data.db_pool)
        .await
        .map_err(|e| {
            eprintln!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    let user_role = user_row
        .and_then(|row| row.try_get::<String, _>("role").ok())
        .unwrap_or_else(|| "user".to_string());

    let is_admin = user_role == "admin";

    // Build query - filter out private notes unless user is admin or note creator
    let notes_result = if is_admin {
        sqlx::query(
            r#"
            SELECT n.*, u.name as user_name, u.role as user_role
            FROM notes n
            LEFT JOIN users u ON n.user_id = u.id
            WHERE n.resource_type = $1 
            AND n.resource_id = $2
            AND n.deleted_at IS NULL
            ORDER BY n.is_urgent DESC, n.is_important DESC, n.created_at DESC
            "#
        )
        .bind(resource_type)
        .bind(resource_id)
        .fetch_all(&data.db_pool)
        .await
    } else {
        sqlx::query(
            r#"
            SELECT n.*, u.name as user_name, u.role as user_role
            FROM notes n
            LEFT JOIN users u ON n.user_id = u.id
            WHERE n.resource_type = $1 
            AND n.resource_id = $2
            AND n.deleted_at IS NULL
            AND (n.is_private = false OR n.user_id = $3)
            ORDER BY n.is_urgent DESC, n.is_important DESC, n.created_at DESC
            "#
        )
        .bind(resource_type)
        .bind(resource_id)
        .bind(user_id)
        .fetch_all(&data.db_pool)
        .await
    };

    let notes = match notes_result {
        Ok(rows) => {
            rows.into_iter().map(|row| {
                let tags: Option<Vec<String>> = row.try_get::<Option<Vec<String>>, _>("tags").ok().flatten();
                json!({
                    "id": row.get::<Uuid, _>("id"),
                    "resource_type": row.get::<String, _>("resource_type"),
                    "resource_id": row.get::<Uuid, _>("resource_id"),
                    "user_id": row.get::<Uuid, _>("user_id"),
                    "user_name": row.try_get::<String, _>("user_name").unwrap_or_else(|_| "Unknown".to_string()),
                    "user_role": row.try_get::<String, _>("user_role").unwrap_or_else(|_| "user".to_string()),
                    "content": row.get::<String, _>("content"),
                    "is_important": row.get::<bool, _>("is_important"),
                    "is_urgent": row.get::<bool, _>("is_urgent"),
                    "is_private": row.get::<bool, _>("is_private"),
                    "tags": tags,
                    "metadata": row.try_get::<Option<serde_json::Value>, _>("metadata").ok().flatten(),
                    "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at"),
                    "deleted_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("deleted_at").ok().flatten(),
                    "created_by": row.try_get::<Option<Uuid>, _>("created_by").ok().flatten(),
                })
            }).collect::<Vec<_>>()
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to fetch notes".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(notes),
        message: Some("Notes retrieved successfully".to_string()),
        error: None,
    }))
}

/// POST /api/notes
/// Create a new note
pub async fn create_note(
    req: web::Json<CreateNote>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    let note_data = req.into_inner();

    // Validate content
    if note_data.content.trim().is_empty() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Note content cannot be empty".to_string()),
            error: Some("Validation error".to_string()),
        }));
    }

    let note_id = Uuid::new_v4();
    let now = Utc::now();

    // Convert tags Vec<String> to PostgreSQL array
    let tags_array: Option<Vec<String>> = note_data.tags;

    match sqlx::query(
        r#"
        INSERT INTO notes (
            id, resource_type, resource_id, user_id, content,
            is_important, is_urgent, is_private, tags, metadata,
            created_at, updated_at, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, resource_type, resource_id, user_id, content,
                  is_important, is_urgent, is_private, tags, metadata,
                  created_at, updated_at, deleted_at, created_by
        "#
    )
    .bind(note_id)
    .bind(&note_data.resource_type)
    .bind(note_data.resource_id)
    .bind(user_id)
    .bind(&note_data.content)
    .bind(note_data.is_important.unwrap_or(false))
    .bind(note_data.is_urgent.unwrap_or(false))
    .bind(note_data.is_private.unwrap_or(false))
    .bind(&tags_array)
    .bind(note_data.metadata.as_ref().map(|m| json!(m)))
    .bind(now)
    .bind(now)
    .bind(user_id)
    .fetch_one(&data.db_pool)
    .await
    {
        Ok(row) => {
            let tags: Option<Vec<String>> = row.try_get::<Option<Vec<String>>, _>("tags").ok().flatten();
            let note = json!({
                "id": row.get::<Uuid, _>("id"),
                "resource_type": row.get::<String, _>("resource_type"),
                "resource_id": row.get::<Uuid, _>("resource_id"),
                "user_id": row.get::<Uuid, _>("user_id"),
                "content": row.get::<String, _>("content"),
                "is_important": row.get::<bool, _>("is_important"),
                "is_urgent": row.get::<bool, _>("is_urgent"),
                "is_private": row.get::<bool, _>("is_private"),
                "tags": tags,
                "metadata": row.try_get::<Option<serde_json::Value>, _>("metadata").ok().flatten(),
                "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at"),
                "deleted_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("deleted_at").ok().flatten(),
                "created_by": row.try_get::<Option<Uuid>, _>("created_by").ok().flatten(),
            });

            Ok(HttpResponse::Created().json(ApiResponse {
                success: true,
                data: Some(note),
                message: Some("Note created successfully".to_string()),
                error: None,
            }))
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to create note".to_string()),
                error: Some(e.to_string()),
            }))
        }
    }
}

/// PUT /api/notes/{id}
/// Update a note
pub async fn update_note(
    path: web::Path<Uuid>,
    req: web::Json<UpdateNote>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    let note_id = path.into_inner();
    let update_data = req.into_inner();

    // Check if note exists and user has permission (creator or admin)
    let note_row = sqlx::query("SELECT user_id FROM notes WHERE id = $1 AND deleted_at IS NULL")
        .bind(note_id)
        .fetch_optional(&data.db_pool)
        .await
        .map_err(|e| {
            eprintln!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    let note = match note_row {
        Some(row) => row,
        None => {
            return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Note not found".to_string()),
                error: Some("Note does not exist".to_string()),
            }));
        }
    };

    let note_user_id: Uuid = note.get("user_id");

    // Check user role
    let user_row = sqlx::query("SELECT role FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&data.db_pool)
        .await
        .map_err(|e| {
            eprintln!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    let user_role = user_row
        .and_then(|row| row.try_get::<String, _>("role").ok())
        .unwrap_or_else(|| "user".to_string());

    let is_admin = user_role == "admin";

    // Only creator or admin can update
    if note_user_id != user_id && !is_admin {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("You don't have permission to update this note".to_string()),
            error: Some("Permission denied".to_string()),
        }));
    }

    // Build update query dynamically
    let mut updates = Vec::new();
    let mut param_count = 1;

    let content_opt = update_data.content.clone();
    let is_important_opt = update_data.is_important;
    let is_urgent_opt = update_data.is_urgent;
    let is_private_opt = update_data.is_private;
    let tags_opt = update_data.tags.clone();
    let metadata_opt = update_data.metadata.clone();

    if let Some(ref content) = content_opt {
        if content.trim().is_empty() {
            return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Note content cannot be empty".to_string()),
                error: Some("Validation error".to_string()),
            }));
        }
        updates.push(format!("content = ${}", param_count));
        param_count += 1;
    }

    if is_important_opt.is_some() {
        updates.push(format!("is_important = ${}", param_count));
        param_count += 1;
    }

    if is_urgent_opt.is_some() {
        updates.push(format!("is_urgent = ${}", param_count));
        param_count += 1;
    }

    if is_private_opt.is_some() {
        updates.push(format!("is_private = ${}", param_count));
        param_count += 1;
    }

    if tags_opt.is_some() {
        updates.push(format!("tags = ${}", param_count));
        param_count += 1;
    }

    if metadata_opt.is_some() {
        updates.push(format!("metadata = ${}", param_count));
        param_count += 1;
    }

    if updates.is_empty() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("No fields to update".to_string()),
            error: Some("Validation error".to_string()),
        }));
    }

    updates.push(format!("updated_at = ${}", param_count));
    param_count += 1;

    let query_str = format!(
        "UPDATE notes SET {} WHERE id = ${} AND deleted_at IS NULL RETURNING id, resource_type, resource_id, user_id, content, is_important, is_urgent, is_private, tags, metadata, created_at, updated_at, deleted_at, created_by",
        updates.join(", "),
        param_count
    );

    // Build parameters
    let mut query = sqlx::query(&query_str);
    
    if let Some(content) = content_opt {
        query = query.bind(content);
    }
    if let Some(is_important) = is_important_opt {
        query = query.bind(is_important);
    }
    if let Some(is_urgent) = is_urgent_opt {
        query = query.bind(is_urgent);
    }
    if let Some(is_private) = is_private_opt {
        query = query.bind(is_private);
    }
    if let Some(ref tags) = tags_opt {
        query = query.bind(tags);
    }
    if let Some(metadata) = metadata_opt {
        query = query.bind(json!(metadata));
    }
    query = query.bind(Utc::now());
    query = query.bind(note_id);

    match query.fetch_optional(&data.db_pool).await {
        Ok(Some(row)) => {
            let tags: Option<Vec<String>> = row.try_get::<Option<Vec<String>>, _>("tags").ok().flatten();
            let note = json!({
                "id": row.get::<Uuid, _>("id"),
                "resource_type": row.get::<String, _>("resource_type"),
                "resource_id": row.get::<Uuid, _>("resource_id"),
                "user_id": row.get::<Uuid, _>("user_id"),
                "content": row.get::<String, _>("content"),
                "is_important": row.get::<bool, _>("is_important"),
                "is_urgent": row.get::<bool, _>("is_urgent"),
                "is_private": row.get::<bool, _>("is_private"),
                "tags": tags,
                "metadata": row.try_get::<Option<serde_json::Value>, _>("metadata").ok().flatten(),
                "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at"),
                "deleted_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("deleted_at").ok().flatten(),
                "created_by": row.try_get::<Option<Uuid>, _>("created_by").ok().flatten(),
            });

            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(note),
                message: Some("Note updated successfully".to_string()),
                error: None,
            }))
        },
        Ok(None) => {
            Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Note not found".to_string()),
                error: Some("Note does not exist".to_string()),
            }))
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to update note".to_string()),
                error: Some(e.to_string()),
            }))
        }
    }
}

/// DELETE /api/notes/{id}
/// Soft delete a note
pub async fn delete_note(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    let note_id = path.into_inner();

    // Check if note exists and user has permission
    let note_row = sqlx::query("SELECT user_id FROM notes WHERE id = $1 AND deleted_at IS NULL")
        .bind(note_id)
        .fetch_optional(&data.db_pool)
        .await
        .map_err(|e| {
            eprintln!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    let note = match note_row {
        Some(row) => row,
        None => {
            return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Note not found".to_string()),
                error: Some("Note does not exist".to_string()),
            }));
        }
    };

    let note_user_id: Uuid = note.get("user_id");

    // Check user role
    let user_row = sqlx::query("SELECT role FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&data.db_pool)
        .await
        .map_err(|e| {
            eprintln!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    let user_role = user_row
        .and_then(|row| row.try_get::<String, _>("role").ok())
        .unwrap_or_else(|| "user".to_string());

    let is_admin = user_role == "admin";

    // Only creator or admin can delete
    if note_user_id != user_id && !is_admin {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("You don't have permission to delete this note".to_string()),
            error: Some("Permission denied".to_string()),
        }));
    }

    match sqlx::query("UPDATE notes SET deleted_at = $1 WHERE id = $2")
        .bind(Utc::now())
        .bind(note_id)
        .execute(&data.db_pool)
        .await
    {
        Ok(_) => {
            Ok(HttpResponse::Ok().json(ApiResponse::<()> {
                success: true,
                data: None,
                message: Some("Note deleted successfully".to_string()),
                error: None,
            }))
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to delete note".to_string()),
                error: Some(e.to_string()),
            }))
        }
    }
}

