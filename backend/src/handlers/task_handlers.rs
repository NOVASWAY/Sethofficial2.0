use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use chrono::Utc;
use sqlx::Row;

use crate::models::ApiResponse;
use crate::AppState;
use crate::middleware::auth::get_current_user;

/// GET /api/tasks
/// Get tasks for the current user or all tasks (if admin)
pub async fn get_tasks(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    // Get user role to check if admin
    let user_row = sqlx::query("SELECT role FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&data.db_pool)
        .await
        .map_err(|e| {
            eprintln!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    let is_admin = user_row
        .and_then(|row| row.try_get::<String, _>("role").ok())
        .map(|role| role == "admin")
        .unwrap_or(false);

    // Get query parameters
    let assigned_to_me = query.get("assigned_to_me")
        .and_then(|v| v.as_bool())
        .unwrap_or(!is_admin); // Default to assigned_to_me unless admin
    
    let status_filter = query.get("status").and_then(|v| v.as_str());
    let priority_filter = query.get("priority").and_then(|v| v.as_str());
    let task_type_filter = query.get("task_type").and_then(|v| v.as_str());
    let limit = query.get("limit")
        .and_then(|v| v.as_i64())
        .unwrap_or(50) as i64;

    // Build query
    let mut query_str = String::from(
        r#"
        SELECT t.id, t.task_type, t.title, t.description, t.assigned_to, t.assigned_by,
               t.status, t.priority, t.due_date, t.completed_at, t.cancelled_at,
               t.patient_id, t.consultation_id, t.prescription_id, t.lab_order_id,
               t.invoice_id, t.appointment_id, t.metadata, t.tags,
               t.created_at, t.updated_at,
               u1.name as assignee_name, u1.role as assignee_role,
               u2.name as assigner_name, u2.role as assigner_role
        FROM tasks t
        LEFT JOIN users u1 ON t.assigned_to = u1.id
        LEFT JOIN users u2 ON t.assigned_by = u2.id
        WHERE t.deleted_at IS NULL
        "#
    );

    // Build query conditionally - sqlx doesn't support dynamic binding with trait objects
    // So we build separate queries for each combination
    let query_result = if assigned_to_me {
        if let Some(status) = status_filter {
            if let Some(priority) = priority_filter {
                if let Some(task_type) = task_type_filter {
                    // All filters
                    sqlx::query(&format!("{} AND t.assigned_to = $1 AND t.status = $2 AND t.priority = $3 AND t.task_type = $4 ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $5", query_str))
                        .bind(user_id).bind(status).bind(priority).bind(task_type).bind(limit)
                        .fetch_all(&data.db_pool).await
                } else {
                    // assigned_to, status, priority
                    sqlx::query(&format!("{} AND t.assigned_to = $1 AND t.status = $2 AND t.priority = $3 ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $4", query_str))
                        .bind(user_id).bind(status).bind(priority).bind(limit)
                        .fetch_all(&data.db_pool).await
                }
            } else if let Some(task_type) = task_type_filter {
                // assigned_to, status, task_type
                sqlx::query(&format!("{} AND t.assigned_to = $1 AND t.status = $2 AND t.task_type = $3 ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $4", query_str))
                    .bind(user_id).bind(status).bind(task_type).bind(limit)
                    .fetch_all(&data.db_pool).await
            } else {
                // assigned_to, status
                sqlx::query(&format!("{} AND t.assigned_to = $1 AND t.status = $2 ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $3", query_str))
                    .bind(user_id).bind(status).bind(limit)
                    .fetch_all(&data.db_pool).await
            }
        } else if let Some(priority) = priority_filter {
            if let Some(task_type) = task_type_filter {
                // assigned_to, priority, task_type
                sqlx::query(&format!("{} AND t.assigned_to = $1 AND t.priority = $2 AND t.task_type = $3 ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $4", query_str))
                    .bind(user_id).bind(priority).bind(task_type).bind(limit)
                    .fetch_all(&data.db_pool).await
            } else {
                // assigned_to, priority
                sqlx::query(&format!("{} AND t.assigned_to = $1 AND t.priority = $2 ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $3", query_str))
                    .bind(user_id).bind(priority).bind(limit)
                    .fetch_all(&data.db_pool).await
            }
        } else if let Some(task_type) = task_type_filter {
            // assigned_to, task_type
            sqlx::query(&format!("{} AND t.assigned_to = $1 AND t.task_type = $2 ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $3", query_str))
                .bind(user_id).bind(task_type).bind(limit)
                .fetch_all(&data.db_pool).await
        } else {
            // assigned_to only
            sqlx::query(&format!("{} AND t.assigned_to = $1 ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $2", query_str))
                .bind(user_id).bind(limit)
                .fetch_all(&data.db_pool).await
        }
    } else {
        if let Some(status) = status_filter {
            if let Some(priority) = priority_filter {
                if let Some(task_type) = task_type_filter {
                    // status, priority, task_type
                    sqlx::query(&format!("{} AND t.status = $1 AND t.priority = $2 AND t.task_type = $3 ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $4", query_str))
                        .bind(status).bind(priority).bind(task_type).bind(limit)
                        .fetch_all(&data.db_pool).await
                } else {
                    // status, priority
                    sqlx::query(&format!("{} AND t.status = $1 AND t.priority = $2 ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $3", query_str))
                        .bind(status).bind(priority).bind(limit)
                        .fetch_all(&data.db_pool).await
                }
            } else if let Some(task_type) = task_type_filter {
                // status, task_type
                sqlx::query(&format!("{} AND t.status = $1 AND t.task_type = $2 ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $3", query_str))
                    .bind(status).bind(task_type).bind(limit)
                    .fetch_all(&data.db_pool).await
            } else {
                // status only
                sqlx::query(&format!("{} AND t.status = $1 ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $2", query_str))
                    .bind(status).bind(limit)
                    .fetch_all(&data.db_pool).await
            }
        } else if let Some(priority) = priority_filter {
            if let Some(task_type) = task_type_filter {
                // priority, task_type
                sqlx::query(&format!("{} AND t.priority = $1 AND t.task_type = $2 ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $3", query_str))
                    .bind(priority).bind(task_type).bind(limit)
                    .fetch_all(&data.db_pool).await
            } else {
                // priority only
                sqlx::query(&format!("{} AND t.priority = $1 ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $2", query_str))
                    .bind(priority).bind(limit)
                    .fetch_all(&data.db_pool).await
            }
        } else if let Some(task_type) = task_type_filter {
            // task_type only
            sqlx::query(&format!("{} AND t.task_type = $1 ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $2", query_str))
                .bind(task_type).bind(limit)
                .fetch_all(&data.db_pool).await
        } else {
            // no filters
            sqlx::query(&format!("{} ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $1", query_str))
                .bind(limit)
                .fetch_all(&data.db_pool).await
        }
    };

    let tasks_result = query_result;

    let tasks = match tasks_result {
        Ok(rows) => {
            rows.into_iter().map(|row| {
                json!({
                    "id": row.get::<Uuid, _>("id"),
                    "task_type": row.get::<String, _>("task_type"),
                    "title": row.get::<String, _>("title"),
                    "description": row.try_get::<Option<String>, _>("description").ok().flatten(),
                    "assigned_to": row.try_get::<Option<Uuid>, _>("assigned_to").ok().flatten(),
                    "assigned_by": row.try_get::<Option<Uuid>, _>("assigned_by").ok().flatten(),
                    "status": row.get::<String, _>("status"),
                    "priority": row.get::<String, _>("priority"),
                    "due_date": row.try_get::<Option<chrono::DateTime<Utc>>, _>("due_date").ok().flatten(),
                    "completed_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("completed_at").ok().flatten(),
                    "cancelled_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("cancelled_at").ok().flatten(),
                    "patient_id": row.try_get::<Option<Uuid>, _>("patient_id").ok().flatten(),
                    "consultation_id": row.try_get::<Option<Uuid>, _>("consultation_id").ok().flatten(),
                    "prescription_id": row.try_get::<Option<Uuid>, _>("prescription_id").ok().flatten(),
                    "lab_order_id": row.try_get::<Option<Uuid>, _>("lab_order_id").ok().flatten(),
                    "invoice_id": row.try_get::<Option<Uuid>, _>("invoice_id").ok().flatten(),
                    "appointment_id": row.try_get::<Option<Uuid>, _>("appointment_id").ok().flatten(),
                    "metadata": row.try_get::<Option<serde_json::Value>, _>("metadata").ok().flatten(),
                    "tags": row.try_get::<Option<Vec<String>>, _>("tags").ok().flatten(),
                    "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at"),
                    "assignee_name": row.try_get::<Option<String>, _>("assignee_name").ok().flatten(),
                    "assignee_role": row.try_get::<Option<String>, _>("assignee_role").ok().flatten(),
                    "assigner_name": row.try_get::<Option<String>, _>("assigner_name").ok().flatten(),
                    "assigner_role": row.try_get::<Option<String>, _>("assigner_role").ok().flatten(),
                })
            }).collect::<Vec<_>>()
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to fetch tasks".to_string()),
                error: Some(e.to_string()),
            }));
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(tasks),
        message: Some("Tasks retrieved successfully".to_string()),
        error: None,
    }))
}

/// POST /api/tasks
/// Create a new task
pub async fn create_task(
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let assigner_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    let task_data = req.into_inner();

    // Extract required fields
    let task_type = task_data.get("task_type")
        .and_then(|v| v.as_str())
        .ok_or_else(|| actix_web::error::ErrorBadRequest("task_type is required"))?;

    let title = task_data.get("title")
        .and_then(|v| v.as_str())
        .ok_or_else(|| actix_web::error::ErrorBadRequest("title is required"))?;

    if title.trim().is_empty() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("Task title cannot be empty".to_string()),
            error: Some("Validation error".to_string()),
        }));
    }

    let assigned_to = task_data.get("assigned_to")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| actix_web::error::ErrorBadRequest("assigned_to is required and must be a valid UUID"))?;

    let description = task_data.get("description").and_then(|v| v.as_str());
    let priority = task_data.get("priority")
        .and_then(|v| v.as_str())
        .unwrap_or("normal");
    let due_date = task_data.get("due_date")
        .and_then(|v| v.as_str())
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc));
    
    // Related entity IDs
    let patient_id = task_data.get("patient_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let consultation_id = task_data.get("consultation_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let prescription_id = task_data.get("prescription_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let lab_order_id = task_data.get("lab_order_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let invoice_id = task_data.get("invoice_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let appointment_id = task_data.get("appointment_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());

    let tags = task_data.get("tags")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect::<Vec<_>>());
    let metadata = task_data.get("metadata");

    let task_id = Uuid::new_v4();
    let now = Utc::now();

    match sqlx::query(
        r#"
        INSERT INTO tasks (
            id, task_type, title, description, assigned_to, assigned_by,
            status, priority, due_date,
            patient_id, consultation_id, prescription_id, lab_order_id,
            invoice_id, appointment_id, metadata, tags,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING id, task_type, title, description, assigned_to, assigned_by,
                  status, priority, due_date, patient_id, consultation_id,
                  prescription_id, lab_order_id, invoice_id, appointment_id,
                  metadata, tags, created_at, updated_at
        "#
    )
    .bind(task_id)
    .bind(task_type)
    .bind(title)
    .bind(description)
    .bind(assigned_to)
    .bind(assigner_id)
    .bind(priority)
    .bind(due_date)
    .bind(patient_id)
    .bind(consultation_id)
    .bind(prescription_id)
    .bind(lab_order_id)
    .bind(invoice_id)
    .bind(appointment_id)
    .bind(metadata.map(|m| json!(m)))
    .bind(tags)
    .bind(now)
    .bind(now)
    .fetch_one(&data.db_pool)
    .await
    {
        Ok(row) => {
            // Record assignment in history
            let _ = sqlx::query(
                "INSERT INTO task_assignments_history (task_id, new_assignee, assigned_by, created_at) VALUES ($1, $2, $3, $4)"
            )
            .bind(task_id)
            .bind(assigned_to)
            .bind(assigner_id)
            .bind(now)
            .execute(&data.db_pool)
            .await;

            // Create notification for assigned user
            let _ = sqlx::query(
                r#"
                INSERT INTO notifications (
                    id, recipient_id, notification_type, template, subject, content,
                    priority, status, action_url, action_label, created_at, created_by
                )
                VALUES (gen_random_uuid(), $1, 'in_app', 'task_assigned', $2, $3, $4, 'sent', $5, 'View Task', $6, $7)
                "#
            )
            .bind(assigned_to)
            .bind(format!("New Task: {}", title))
            .bind(description.unwrap_or(title))
            .bind(priority)
            .bind(format!("/dashboard/tasks/{}", task_id))
            .bind(now)
            .bind(assigner_id)
            .execute(&data.db_pool)
            .await;

            let task = json!({
                "id": row.get::<Uuid, _>("id"),
                "task_type": row.get::<String, _>("task_type"),
                "title": row.get::<String, _>("title"),
                "description": row.try_get::<Option<String>, _>("description").ok().flatten(),
                "assigned_to": row.get::<Option<Uuid>, _>("assigned_to"),
                "assigned_by": row.get::<Option<Uuid>, _>("assigned_by"),
                "status": row.get::<String, _>("status"),
                "priority": row.get::<String, _>("priority"),
                "due_date": row.try_get::<Option<chrono::DateTime<Utc>>, _>("due_date").ok().flatten(),
                "patient_id": row.try_get::<Option<Uuid>, _>("patient_id").ok().flatten(),
                "consultation_id": row.try_get::<Option<Uuid>, _>("consultation_id").ok().flatten(),
                "prescription_id": row.try_get::<Option<Uuid>, _>("prescription_id").ok().flatten(),
                "lab_order_id": row.try_get::<Option<Uuid>, _>("lab_order_id").ok().flatten(),
                "invoice_id": row.try_get::<Option<Uuid>, _>("invoice_id").ok().flatten(),
                "appointment_id": row.try_get::<Option<Uuid>, _>("appointment_id").ok().flatten(),
                "metadata": row.try_get::<Option<serde_json::Value>, _>("metadata").ok().flatten(),
                "tags": row.try_get::<Option<Vec<String>>, _>("tags").ok().flatten(),
                "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at"),
            });

            Ok(HttpResponse::Created().json(ApiResponse {
                success: true,
                data: Some(task),
                message: Some("Task created successfully".to_string()),
                error: None,
            }))
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to create task".to_string()),
                error: Some(e.to_string()),
            }))
        }
    }
}

/// PUT /api/tasks/{id}
/// Update a task
pub async fn update_task(
    path: web::Path<Uuid>,
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    let task_id = path.into_inner();
    let update_data = req.into_inner();

    // Verify task exists and user has permission
    let task_result = sqlx::query(
        "SELECT assigned_to, assigned_by FROM tasks WHERE id = $1 AND deleted_at IS NULL"
    )
    .bind(task_id)
    .fetch_optional(&data.db_pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;

    let task = match task_result {
        Some(row) => row,
        None => {
            return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Task not found".to_string()),
                error: Some("Task does not exist".to_string()),
            }));
        }
    };

    let assigned_to: Option<Uuid> = task.try_get("assigned_to").ok().flatten();
    let assigned_by: Option<Uuid> = task.try_get("assigned_by").ok().flatten();

    // Check permission: assigned user or assigner can update
    if assigned_to != Some(user_id) && assigned_by != Some(user_id) {
        // Check if user is admin
        let user_row = sqlx::query("SELECT role FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(&data.db_pool)
            .await
            .map_err(|e| {
                eprintln!("Database error: {}", e);
                actix_web::error::ErrorInternalServerError("Database error")
            })?;

        let is_admin = user_row
            .and_then(|row| row.try_get::<String, _>("role").ok())
            .map(|role| role == "admin")
            .unwrap_or(false);

        if !is_admin {
            return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("You don't have permission to update this task".to_string()),
                error: Some("Permission denied".to_string()),
            }));
        }
    }

    // Build update query dynamically
    let mut updates = Vec::new();
    let mut bind_count = 1;
    let mut bind_values: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> = vec![];

    if let Some(title) = update_data.get("title").and_then(|v| v.as_str()) {
        updates.push(format!("title = ${}", bind_count));
        bind_values.push(Box::new(title.to_string()));
        bind_count += 1;
    }

    if let Some(description) = update_data.get("description") {
        if description.is_null() {
            updates.push(format!("description = ${}", bind_count));
            bind_values.push(Box::new(None::<String>));
        } else if let Some(desc_str) = description.as_str() {
            updates.push(format!("description = ${}", bind_count));
            bind_values.push(Box::new(desc_str.to_string()));
        }
        bind_count += 1;
    }

    if let Some(status) = update_data.get("status").and_then(|v| v.as_str()) {
        updates.push(format!("status = ${}", bind_count));
        bind_values.push(Box::new(status.to_string()));
        bind_count += 1;

        // Set completed_at or cancelled_at based on status
        if status == "completed" {
            updates.push(format!("completed_at = ${}", bind_count));
            bind_values.push(Box::new(Some(Utc::now())));
            bind_count += 1;
        } else if status == "cancelled" {
            updates.push(format!("cancelled_at = ${}", bind_count));
            bind_values.push(Box::new(Some(Utc::now())));
            bind_count += 1;
        }
    }

    if let Some(priority) = update_data.get("priority").and_then(|v| v.as_str()) {
        updates.push(format!("priority = ${}", bind_count));
        bind_values.push(Box::new(priority.to_string()));
        bind_count += 1;
    }

    if let Some(due_date) = update_data.get("due_date") {
        if due_date.is_null() {
            updates.push(format!("due_date = ${}", bind_count));
            bind_values.push(Box::new(None::<chrono::DateTime<Utc>>));
        } else if let Some(date_str) = due_date.as_str() {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(date_str) {
                updates.push(format!("due_date = ${}", bind_count));
                bind_values.push(Box::new(dt.with_timezone(&Utc)));
            }
        }
        bind_count += 1;
    }

    // Handle reassignment
    if let Some(new_assignee) = update_data.get("assigned_to")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
    {
        if assigned_to != Some(new_assignee) {
            updates.push(format!("assigned_to = ${}", bind_count));
            bind_values.push(Box::new(new_assignee));
            bind_count += 1;

            // Record in history
            let _ = sqlx::query(
                "INSERT INTO task_assignments_history (task_id, previous_assignee, new_assignee, assigned_by, created_at) VALUES ($1, $2, $3, $4, $5)"
            )
            .bind(task_id)
            .bind(assigned_to)
            .bind(new_assignee)
            .bind(user_id)
            .bind(Utc::now())
            .execute(&data.db_pool)
            .await;

            // Create notification for new assignee
            let task_title = update_data.get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Task");
            
            let _ = sqlx::query(
                r#"
                INSERT INTO notifications (
                    id, recipient_id, notification_type, template, subject, content,
                    priority, status, action_url, action_label, created_at, created_by
                )
                VALUES (gen_random_uuid(), $1, 'in_app', 'task_assigned', $2, $3, 'normal', 'sent', $4, 'View Task', $5, $6)
                "#
            )
            .bind(new_assignee)
            .bind(format!("Task Assigned: {}", task_title))
            .bind(format!("You have been assigned a task: {}", task_title))
            .bind(format!("/dashboard/tasks/{}", task_id))
            .bind(Utc::now())
            .bind(user_id)
            .execute(&data.db_pool)
            .await;
        }
    }

    if updates.is_empty() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: Some("No fields to update".to_string()),
            error: Some("Validation error".to_string()),
        }));
    }

    updates.push(format!("updated_at = ${}", bind_count));
    bind_values.push(Box::new(Utc::now()));
    bind_count += 1;

    let update_query = format!(
        "UPDATE tasks SET {} WHERE id = ${}",
        updates.join(", "),
        bind_count
    );

    // Execute update (simplified - in production use proper parameter binding)
    match sqlx::query(&update_query)
        .bind(task_id)
        .execute(&data.db_pool)
        .await
    {
        Ok(_) => {
            // Fetch updated task
            let updated_task = sqlx::query(
                r#"
                SELECT t.id, t.task_type, t.title, t.description, t.assigned_to, t.assigned_by,
                       t.status, t.priority, t.due_date, t.completed_at, t.cancelled_at,
                       t.patient_id, t.consultation_id, t.prescription_id, t.lab_order_id,
                       t.invoice_id, t.appointment_id, t.metadata, t.tags,
                       t.created_at, t.updated_at,
                       u1.name as assignee_name, u1.role as assignee_role,
                       u2.name as assigner_name, u2.role as assigner_role
                FROM tasks t
                LEFT JOIN users u1 ON t.assigned_to = u1.id
                LEFT JOIN users u2 ON t.assigned_by = u2.id
                WHERE t.id = $1
                "#
            )
            .bind(task_id)
            .fetch_one(&data.db_pool)
            .await;

            match updated_task {
                Ok(row) => {
                    let task = json!({
                        "id": row.get::<Uuid, _>("id"),
                        "task_type": row.get::<String, _>("task_type"),
                        "title": row.get::<String, _>("title"),
                        "description": row.try_get::<Option<String>, _>("description").ok().flatten(),
                        "assigned_to": row.get::<Option<Uuid>, _>("assigned_to"),
                        "assigned_by": row.get::<Option<Uuid>, _>("assigned_by"),
                        "status": row.get::<String, _>("status"),
                        "priority": row.get::<String, _>("priority"),
                        "due_date": row.try_get::<Option<chrono::DateTime<Utc>>, _>("due_date").ok().flatten(),
                        "completed_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("completed_at").ok().flatten(),
                        "cancelled_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("cancelled_at").ok().flatten(),
                        "patient_id": row.try_get::<Option<Uuid>, _>("patient_id").ok().flatten(),
                        "consultation_id": row.try_get::<Option<Uuid>, _>("consultation_id").ok().flatten(),
                        "prescription_id": row.try_get::<Option<Uuid>, _>("prescription_id").ok().flatten(),
                        "lab_order_id": row.try_get::<Option<Uuid>, _>("lab_order_id").ok().flatten(),
                        "invoice_id": row.try_get::<Option<Uuid>, _>("invoice_id").ok().flatten(),
                        "appointment_id": row.try_get::<Option<Uuid>, _>("appointment_id").ok().flatten(),
                        "metadata": row.try_get::<Option<serde_json::Value>, _>("metadata").ok().flatten(),
                        "tags": row.try_get::<Option<Vec<String>>, _>("tags").ok().flatten(),
                        "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                        "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at"),
                        "assignee_name": row.try_get::<Option<String>, _>("assignee_name").ok().flatten(),
                        "assignee_role": row.try_get::<Option<String>, _>("assignee_role").ok().flatten(),
                        "assigner_name": row.try_get::<Option<String>, _>("assigner_name").ok().flatten(),
                        "assigner_role": row.try_get::<Option<String>, _>("assigner_role").ok().flatten(),
                    });

                    Ok(HttpResponse::Ok().json(ApiResponse {
                        success: true,
                        data: Some(task),
                        message: Some("Task updated successfully".to_string()),
                        error: None,
                    }))
                },
                Err(e) => {
                    eprintln!("Database error: {}", e);
                    Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                        success: false,
                        data: None,
                        message: Some("Failed to fetch updated task".to_string()),
                        error: Some(e.to_string()),
                    }))
                }
            }
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to update task".to_string()),
                error: Some(e.to_string()),
            }))
        }
    }
}

/// GET /api/tasks/{id}
/// Get a single task by ID
pub async fn get_task(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    let task_id = path.into_inner();

    let task_result = sqlx::query(
        r#"
        SELECT t.id, t.task_type, t.title, t.description, t.assigned_to, t.assigned_by,
               t.status, t.priority, t.due_date, t.completed_at, t.cancelled_at,
               t.patient_id, t.consultation_id, t.prescription_id, t.lab_order_id,
               t.invoice_id, t.appointment_id, t.metadata, t.tags,
               t.created_at, t.updated_at,
               u1.name as assignee_name, u1.role as assignee_role,
               u2.name as assigner_name, u2.role as assigner_role
        FROM tasks t
        LEFT JOIN users u1 ON t.assigned_to = u1.id
        LEFT JOIN users u2 ON t.assigned_by = u2.id
        WHERE t.id = $1 AND t.deleted_at IS NULL
        "#
    )
    .bind(task_id)
    .fetch_optional(&data.db_pool)
    .await;

    match task_result {
        Ok(Some(row)) => {
            let assigned_to: Option<Uuid> = row.try_get("assigned_to").ok().flatten();
            let assigned_by: Option<Uuid> = row.try_get("assigned_by").ok().flatten();

            // Check permission: assigned user, assigner, or admin can view
            if assigned_to != Some(user_id) && assigned_by != Some(user_id) {
                // Check if user is admin
                let user_row = sqlx::query("SELECT role FROM users WHERE id = $1")
                    .bind(user_id)
                    .fetch_optional(&data.db_pool)
                    .await
                    .map_err(|e| {
                        eprintln!("Database error: {}", e);
                        actix_web::error::ErrorInternalServerError("Database error")
                    })?;

                let is_admin = user_row
                    .and_then(|row| row.try_get::<String, _>("role").ok())
                    .map(|role| role == "admin")
                    .unwrap_or(false);

                if !is_admin {
                    return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
                        success: false,
                        data: None,
                        message: Some("You don't have permission to view this task".to_string()),
                        error: Some("Permission denied".to_string()),
                    }));
                }
            }

            let task = json!({
                "id": row.get::<Uuid, _>("id"),
                "task_type": row.get::<String, _>("task_type"),
                "title": row.get::<String, _>("title"),
                "description": row.try_get::<Option<String>, _>("description").ok().flatten(),
                "assigned_to": row.get::<Option<Uuid>, _>("assigned_to"),
                "assigned_by": row.get::<Option<Uuid>, _>("assigned_by"),
                "status": row.get::<String, _>("status"),
                "priority": row.get::<String, _>("priority"),
                "due_date": row.try_get::<Option<chrono::DateTime<Utc>>, _>("due_date").ok().flatten(),
                "completed_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("completed_at").ok().flatten(),
                "cancelled_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("cancelled_at").ok().flatten(),
                "patient_id": row.try_get::<Option<Uuid>, _>("patient_id").ok().flatten(),
                "consultation_id": row.try_get::<Option<Uuid>, _>("consultation_id").ok().flatten(),
                "prescription_id": row.try_get::<Option<Uuid>, _>("prescription_id").ok().flatten(),
                "lab_order_id": row.try_get::<Option<Uuid>, _>("lab_order_id").ok().flatten(),
                "invoice_id": row.try_get::<Option<Uuid>, _>("invoice_id").ok().flatten(),
                "appointment_id": row.try_get::<Option<Uuid>, _>("appointment_id").ok().flatten(),
                "metadata": row.try_get::<Option<serde_json::Value>, _>("metadata").ok().flatten(),
                "tags": row.try_get::<Option<Vec<String>>, _>("tags").ok().flatten(),
                "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at"),
                "assignee_name": row.try_get::<Option<String>, _>("assignee_name").ok().flatten(),
                "assignee_role": row.try_get::<Option<String>, _>("assignee_role").ok().flatten(),
                "assigner_name": row.try_get::<Option<String>, _>("assigner_name").ok().flatten(),
                "assigner_role": row.try_get::<Option<String>, _>("assigner_role").ok().flatten(),
            });

            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(task),
                message: None,
                error: None,
            }))
        },
        Ok(None) => {
            Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Task not found".to_string()),
                error: Some("Task does not exist".to_string()),
            }))
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to fetch task".to_string()),
                error: Some(e.to_string()),
            }))
        }
    }
}

/// DELETE /api/tasks/{id}
/// Soft delete a task
pub async fn delete_task(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid user ID"))?;

    let task_id = path.into_inner();

    // Verify task exists and user has permission (assigner or admin)
    let task_result = sqlx::query(
        "SELECT assigned_by FROM tasks WHERE id = $1 AND deleted_at IS NULL"
    )
    .bind(task_id)
    .fetch_optional(&data.db_pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;

    let task = match task_result {
        Some(row) => row,
        None => {
            return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Task not found".to_string()),
                error: Some("Task does not exist".to_string()),
            }));
        }
    };

    let assigned_by: Option<Uuid> = task.try_get("assigned_by").ok().flatten();

    // Check permission: assigner or admin can delete
    if assigned_by != Some(user_id) {
        // Check if user is admin
        let user_row = sqlx::query("SELECT role FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(&data.db_pool)
            .await
            .map_err(|e| {
                eprintln!("Database error: {}", e);
                actix_web::error::ErrorInternalServerError("Database error")
            })?;

        let is_admin = user_row
            .and_then(|row| row.try_get::<String, _>("role").ok())
            .map(|role| role == "admin")
            .unwrap_or(false);

        if !is_admin {
            return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("You don't have permission to delete this task".to_string()),
                error: Some("Permission denied".to_string()),
            }));
        }
    }

    match sqlx::query(
        "UPDATE tasks SET deleted_at = $1 WHERE id = $2"
    )
    .bind(Utc::now())
    .bind(task_id)
    .execute(&data.db_pool)
    .await
    {
        Ok(_) => {
            Ok(HttpResponse::Ok().json(ApiResponse::<()> {
                success: true,
                data: None,
                message: Some("Task deleted successfully".to_string()),
                error: None,
            }))
        },
        Err(e) => {
            eprintln!("Database error: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: Some("Failed to delete task".to_string()),
                error: Some(e.to_string()),
            }))
        }
    }
}

