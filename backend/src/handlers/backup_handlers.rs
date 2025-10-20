use actix_web::{web, HttpResponse, Result, HttpRequest};
use uuid::Uuid;
use crate::backup::{BackupRequest, BackupService, BackupConfig};
use crate::error::{ApiError, ApiResponse};
use crate::database::DatabasePool;

/// Create a new backup
pub async fn create_backup(
    req: web::Json<BackupRequest>,
    data: web::Data<crate::AppState>,
    _http_req: HttpRequest,
) -> Result<HttpResponse, ApiError> {
    // TODO: Add authentication check
    let user_id = None; // Extract from JWT token

    let backup_service = BackupService::new(data.database.pool.clone(), data.backup_config.clone());
    
    match backup_service.create_backup(req.into_inner(), user_id).await {
        Ok(backup_job) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(serde_json::json!(backup_job)),
                message: Some("Backup created successfully".to_string()),
                timestamp: chrono::Utc::now().to_rfc3339(),
                request_id: None,
            }))
        }
        Err(e) => Err(e)
    }
}

/// List all backups
pub async fn list_backups(
    query: web::Query<std::collections::HashMap<String, String>>,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, ApiError> {
    let limit = query.get("limit").and_then(|s| s.parse().ok());
    let offset = query.get("offset").and_then(|s| s.parse().ok());

    let backup_service = BackupService::new(data.database.pool.clone(), data.backup_config.clone());
    
    match backup_service.list_backups(limit, offset).await {
        Ok(backups) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(serde_json::json!(backups)),
                message: Some("Backups retrieved successfully".to_string()),
                timestamp: chrono::Utc::now().to_rfc3339(),
                request_id: None,
            }))
        }
        Err(e) => Err(e)
    }
}

/// Get backup statistics
pub async fn get_backup_stats(
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, ApiError> {
    let backup_service = BackupService::new(data.database.pool.clone(), data.backup_config.clone());
    
    match backup_service.get_backup_stats().await {
        Ok(stats) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(serde_json::json!(stats)),
                message: Some("Backup statistics retrieved successfully".to_string()),
                timestamp: chrono::Utc::now().to_rfc3339(),
                request_id: None,
            }))
        }
        Err(e) => Err(e)
    }
}

/// Get backup details
pub async fn get_backup(
    path: web::Path<Uuid>,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, ApiError> {
    let backup_id = path.into_inner();
    
    // Get backup job details
    let backup_job = sqlx::query_as::<_, crate::backup::BackupJob>(
        "SELECT * FROM backup_jobs WHERE id = $1"
    )
    .bind(backup_id)
    .fetch_optional(&data.database.pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to get backup job: {}", e))))?
    .ok_or_else(|| ApiError::not_found("Backup not found"))?;

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!(backup_job)),
        message: Some("Backup details retrieved successfully".to_string()),
        timestamp: chrono::Utc::now().to_rfc3339(),
        request_id: None,
    }))
}

/// Delete a backup
pub async fn delete_backup(
    path: web::Path<Uuid>,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, ApiError> {
    let backup_id = path.into_inner();
    
    // Delete backup job
    let deleted = sqlx::query!(
        "DELETE FROM backup_jobs WHERE id = $1",
        backup_id
    )
    .execute(&data.database.pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to delete backup: {}", e))))?;

    if deleted.rows_affected() == 0 {
        return Err(ApiError::not_found("Backup not found"));
    }

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({ "deleted": true })),
        message: Some("Backup deleted successfully".to_string()),
        timestamp: chrono::Utc::now().to_rfc3339(),
        request_id: None,
    }))
}

/// Download a backup file
pub async fn download_backup(
    path: web::Path<Uuid>,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, ApiError> {
    let backup_id = path.into_inner();
    
    // Get backup job details
    let backup_job = sqlx::query_as::<_, crate::backup::BackupJob>(
        "SELECT * FROM backup_jobs WHERE id = $1"
    )
    .bind(backup_id)
    .fetch_optional(&data.database.pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to get backup job: {}", e))))?
    .ok_or_else(|| ApiError::not_found("Backup not found"))?;

    if backup_job.status != crate::backup::BackupStatus::Completed {
        return Err(ApiError::bad_request("Backup is not completed".to_string()));
    }

    let file_path = backup_job.file_path.ok_or_else(|| ApiError::bad_request("Backup file not found".to_string()))?;
    
    // Read file content
    let content = std::fs::read(&file_path)
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to read backup file: {}", e))))?;

    Ok(HttpResponse::Ok()
        .content_type("application/octet-stream")
        .append_header(("Content-Disposition", format!("attachment; filename=\"{}\"", backup_job.id)))
        .body(content))
}

/// Cleanup old backups
pub async fn cleanup_backups(
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, ApiError> {
    let backup_service = BackupService::new(data.database.pool.clone(), data.backup_config.clone());
    
    match backup_service.cleanup_old_backups().await {
        Ok(deleted_count) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(serde_json::json!({ "deleted_count": deleted_count })),
                message: Some(format!("Cleaned up {} old backups", deleted_count)),
                timestamp: chrono::Utc::now().to_rfc3339(),
                request_id: None,
            }))
        }
        Err(e) => Err(e)
    }
}

/// Get backup configuration
pub async fn get_backup_config(
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, ApiError> {
    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!(data.backup_config)),
        message: Some("Backup configuration retrieved successfully".to_string()),
        timestamp: chrono::Utc::now().to_rfc3339(),
        request_id: None,
    }))
}

/// Update backup configuration
pub async fn update_backup_config(
    req: web::Json<BackupConfig>,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, ApiError> {
    // TODO: Update backup configuration in database
    // For now, just return success
    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({ "updated": true })),
        message: Some("Backup configuration updated successfully".to_string()),
        timestamp: chrono::Utc::now().to_rfc3339(),
        request_id: None,
    }))
}

/// Get backup schedules
pub async fn get_backup_schedules(
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, ApiError> {
    let schedules = sqlx::query_as::<_, crate::backup::BackupSchedule>(
        "SELECT * FROM backup_schedules ORDER BY created_at DESC"
    )
    .fetch_all(&data.database.pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to get backup schedules: {}", e))))?;

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!(schedules)),
        message: Some("Backup schedules retrieved successfully".to_string()),
        timestamp: chrono::Utc::now().to_rfc3339(),
        request_id: None,
    }))
}

/// Create a backup schedule
pub async fn create_backup_schedule(
    req: web::Json<crate::backup::BackupSchedule>,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, ApiError> {
    let schedule = req.into_inner();
    let schedule_id = uuid::Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO backup_schedules (id, name, description, cron_expression, backup_type, enabled, retention_days)
        VALUES ($1, $2, $3, $4, $5::backup_type, $6, $7)
        "#
    )
    .bind(schedule_id)
    .bind(&schedule.name)
    .bind(&schedule.description)
    .bind(&schedule.cron_expression)
    .bind(&schedule.backup_type)
    .bind(schedule.enabled)
    .bind(schedule.retention_days)
    .execute(&data.database.pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to create backup schedule: {}", e))))?;

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({ "id": schedule_id })),
        message: Some("Backup schedule created successfully".to_string()),
        timestamp: chrono::Utc::now().to_rfc3339(),
        request_id: None,
    }))
}

/// Update a backup schedule
pub async fn update_backup_schedule(
    path: web::Path<Uuid>,
    req: web::Json<crate::backup::BackupSchedule>,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, ApiError> {
    let schedule_id = path.into_inner();
    let schedule = req.into_inner();

    let updated = sqlx::query(
        r#"
        UPDATE backup_schedules 
        SET name = $1, description = $2, cron_expression = $3, backup_type = $4::backup_type, 
            enabled = $5, retention_days = $6, updated_at = NOW()
        WHERE id = $7
        "#
    )
    .bind(&schedule.name)
    .bind(&schedule.description)
    .bind(&schedule.cron_expression)
    .bind(&schedule.backup_type)
    .bind(schedule.enabled)
    .bind(schedule.retention_days)
    .bind(schedule_id)
    .execute(&data.database.pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to update backup schedule: {}", e))))?;

    if updated.rows_affected() == 0 {
        return Err(ApiError::not_found("Backup schedule not found"));
    }

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({ "updated": true })),
        message: Some("Backup schedule updated successfully".to_string()),
        timestamp: chrono::Utc::now().to_rfc3339(),
        request_id: None,
    }))
}

/// Delete a backup schedule
pub async fn delete_backup_schedule(
    path: web::Path<Uuid>,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, ApiError> {
    let schedule_id = path.into_inner();

    let deleted = sqlx::query!(
        "DELETE FROM backup_schedules WHERE id = $1",
        schedule_id
    )
    .execute(&data.database.pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to delete backup schedule: {}", e))))?;

    if deleted.rows_affected() == 0 {
        return Err(ApiError::not_found("Backup schedule not found"));
    }

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({ "deleted": true })),
        message: Some("Backup schedule deleted successfully".to_string()),
        timestamp: chrono::Utc::now().to_rfc3339(),
        request_id: None,
    }))
}

/// Toggle backup schedule
pub async fn toggle_backup_schedule(
    path: web::Path<Uuid>,
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, ApiError> {
    let schedule_id = path.into_inner();

    let updated = sqlx::query!(
        r#"
        UPDATE backup_schedules 
        SET enabled = NOT enabled, updated_at = NOW()
        WHERE id = $1
        "#,
        schedule_id
    )
    .execute(&data.database.pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to toggle backup schedule: {}", e))))?;

    if updated.rows_affected() == 0 {
        return Err(ApiError::not_found("Backup schedule not found"));
    }

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({ "toggled": true })),
        message: Some("Backup schedule toggled successfully".to_string()),
        timestamp: chrono::Utc::now().to_rfc3339(),
        request_id: None,
    }))
}

/// Get scheduler status
pub async fn get_scheduler_status(
    data: web::Data<crate::AppState>,
) -> Result<HttpResponse, ApiError> {
    // TODO: Get actual scheduler status
    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({ "status": "running" })),
        message: Some("Scheduler status retrieved successfully".to_string()),
        timestamp: chrono::Utc::now().to_rfc3339(),
        request_id: None,
    }))
}