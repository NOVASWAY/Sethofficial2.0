use actix_web::{web, HttpResponse, Result, HttpRequest};
use uuid::Uuid;
use crate::backup::{BackupRequest, BackupService, BackupConfig};
use crate::error::{ApiError, ApiResponse};
use crate::database::DatabasePool;
use crate::middleware::auth::get_current_user;

/// Create a new backup
pub async fn create_backup(
    req: web::Json<BackupRequest>,
    data: web::Data<crate::AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse, ApiError> {
    // Authentication check
    let claims = get_current_user(&http_req)
        .ok_or_else(|| ApiError::unauthorized(Some("Authentication required".to_string())))?;
    
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ApiError::unauthorized(Some("Invalid user ID".to_string())))?;

    let backup_config = BackupConfig {
        enabled: true,
        cron_expression: "0 2 * * *".to_string(),
        retention_days: 30,
        backup_path: "/backups".to_string(),
        compression: true,
        include_files: true,
        max_backup_size_mb: 1024,
    };
    let backup_service = BackupService::new(data.db_pool.clone(), backup_config);
    
    match backup_service.create_backup(req.into_inner(), Some(user_id.to_string())).await {
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

    let backup_config = BackupConfig {
        enabled: true,
        cron_expression: "0 2 * * *".to_string(),
        retention_days: 30,
        backup_path: "/backups".to_string(),
        compression: true,
        include_files: true,
        max_backup_size_mb: 1024,
    };
    let backup_service = BackupService::new(data.db_pool.clone(), backup_config);
    
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
    let backup_config = BackupConfig {
        enabled: true,
        cron_expression: "0 2 * * *".to_string(),
        retention_days: 30,
        backup_path: "/backups".to_string(),
        compression: true,
        include_files: true,
        max_backup_size_mb: 1024,
    };
    let backup_service = BackupService::new(data.db_pool.clone(), backup_config);
    
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
    .fetch_optional(&data.db_pool)
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
    .execute(&data.db_pool)
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
    .fetch_optional(&data.db_pool)
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
    let backup_config = BackupConfig {
        enabled: true,
        cron_expression: "0 2 * * *".to_string(),
        retention_days: 30,
        backup_path: "/backups".to_string(),
        compression: true,
        include_files: true,
        max_backup_size_mb: 1024,
    };
    let backup_service = BackupService::new(data.db_pool.clone(), backup_config);
    
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
    // Get configuration from database
    let config_row = sqlx::query!(
        r#"
        SELECT enabled, schedule, retention_days, backup_path, compression, include_files, max_backup_size_mb
        FROM backup_config
        ORDER BY updated_at DESC
        LIMIT 1
        "#
    )
    .fetch_optional(&data.db_pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to get backup config: {}", e))))?;

    let backup_config = if let Some(row) = config_row {
        BackupConfig {
            enabled: row.enabled,
            cron_expression: row.schedule,
            retention_days: row.retention_days as u32,
            backup_path: row.backup_path,
            compression: row.compression,
            include_files: row.include_files,
            max_backup_size_mb: row.max_backup_size_mb as u64,
        }
    } else {
        // Return default if no config exists
        BackupConfig {
            enabled: true,
            cron_expression: "0 2 * * *".to_string(),
            retention_days: 30,
            backup_path: "./backups".to_string(),
            compression: true,
            include_files: true,
            max_backup_size_mb: 1024,
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!(backup_config)),
        message: Some("Backup configuration retrieved successfully".to_string()),
        timestamp: chrono::Utc::now().to_rfc3339(),
        request_id: None,
    }))
}

/// Update backup configuration
pub async fn update_backup_config(
    req: web::Json<BackupConfig>,
    data: web::Data<crate::AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse, ApiError> {
    // Authentication check - only admins should update backup config
    let claims = get_current_user(&http_req)
        .ok_or_else(|| ApiError::unauthorized(Some("Authentication required".to_string())))?;
    
    if claims.role != "admin" {
        return Err(ApiError::forbidden(Some("Only administrators can update backup configuration".to_string())));
    }

    let config = req.into_inner();

    // Check if config exists and get the ID
    let existing_id: Option<Uuid> = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM backup_config ORDER BY updated_at DESC LIMIT 1"
    )
    .fetch_optional(&data.db_pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to check backup config: {}", e))))?;

    if let Some(config_id) = existing_id {
        // Update existing config
        sqlx::query(
            r#"
            UPDATE backup_config
            SET enabled = $1,
                schedule = $2,
                retention_days = $3,
                backup_path = $4,
                compression = $5,
                include_files = $6,
                max_backup_size_mb = $7,
                updated_at = NOW()
            WHERE id = $8
            "#
        )
        .bind(config.enabled)
        .bind(&config.cron_expression)
        .bind(config.retention_days as i32)
        .bind(&config.backup_path)
        .bind(config.compression)
        .bind(config.include_files)
        .bind(config.max_backup_size_mb as i32)
        .bind(config_id)
        .execute(&data.db_pool)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to update backup config: {}", e))))?;
    } else {
        // Insert new config
        sqlx::query(
            r#"
            INSERT INTO backup_config (enabled, schedule, retention_days, backup_path, compression, include_files, max_backup_size_mb)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#
        )
        .bind(config.enabled)
        .bind(&config.cron_expression)
        .bind(config.retention_days as i32)
        .bind(&config.backup_path)
        .bind(config.compression)
        .bind(config.include_files)
        .bind(config.max_backup_size_mb as i32)
        .execute(&data.db_pool)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to create backup config: {}", e))))?;
    }

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
    .fetch_all(&data.db_pool)
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
    .execute(&data.db_pool)
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
    .execute(&data.db_pool)
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
    .execute(&data.db_pool)
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
    .execute(&data.db_pool)
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
    // Get backup configuration to check if scheduler is enabled
    let config_enabled: Option<bool> = sqlx::query_scalar::<_, bool>(
        "SELECT enabled FROM backup_config ORDER BY updated_at DESC LIMIT 1"
    )
    .fetch_optional(&data.db_pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to get backup config: {}", e))))?;

    let enabled = config_enabled.unwrap_or(true);

    // Get count of active schedules
    let active_schedules: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM backup_schedules WHERE enabled = true"
    )
    .fetch_one(&data.db_pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to get schedules: {}", e))))?;

    // Get last backup job to determine if scheduler is working
    let last_backup: Option<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar::<_, chrono::DateTime<chrono::Utc>>(
        "SELECT MAX(started_at) FROM backup_jobs WHERE status = 'completed'"
    )
    .fetch_optional(&data.db_pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to get last backup: {}", e))))?;

    // Determine status based on configuration and recent activity
    let status = if !enabled {
        "disabled"
    } else if active_schedules == 0 {
        "no_schedules"
    } else if let Some(last) = last_backup {
        let hours_since = (chrono::Utc::now() - last).num_hours();
        if hours_since < 48 {
            "running"
        } else {
            "inactive"
        }
    } else {
        "pending"
    };

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({
            "status": status,
            "enabled": enabled,
            "active_schedules": active_schedules,
            "last_backup": last_backup.map(|d| d.to_rfc3339()),
        })),
        message: Some("Scheduler status retrieved successfully".to_string()),
        timestamp: chrono::Utc::now().to_rfc3339(),
        request_id: None,
    }))
}