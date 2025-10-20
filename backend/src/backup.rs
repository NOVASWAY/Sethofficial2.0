use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::path::Path;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::error::{ApiError, ApiResponse};
use crate::database::DatabasePool;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupConfig {
    pub enabled: bool,
    pub cron_expression: String, // Cron expression
    pub retention_days: u32,
    pub backup_path: String,
    pub compression: bool,
    pub include_files: bool,
    pub max_backup_size_mb: u64,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct BackupJob {
    pub id: Uuid,
    pub backup_type: BackupType,
    pub status: BackupStatus,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub file_path: Option<String>,
    pub file_size_bytes: Option<i64>,
    pub error_message: Option<String>,
    pub created_by: Option<Uuid>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type, Clone)]
#[sqlx(type_name = "backup_type", rename_all = "snake_case")]
pub enum BackupType {
    Full,
    Incremental,
    Schema,
    Data,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type, Clone, PartialEq)]
#[sqlx(type_name = "backup_status", rename_all = "snake_case")]
pub enum BackupStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupRequest {
    pub backup_type: BackupType,
    pub description: Option<String>,
    pub include_files: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RestoreRequest {
    pub backup_id: Uuid,
    pub restore_type: RestoreType,
    pub confirm: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum RestoreType {
    Full,
    Schema,
    Data,
    Files,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct BackupSchedule {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub cron_expression: String,
    pub backup_type: BackupType,
    pub enabled: bool,
    pub last_run_at: Option<DateTime<Utc>>,
    pub next_run_at: Option<DateTime<Utc>>,
    pub retention_days: i32,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct BackupStats {
    pub total_backups: i64,
    pub total_size_bytes: i64,
    pub last_backup: Option<DateTime<Utc>>,
    pub oldest_backup: Option<DateTime<Utc>>,
    pub failed_backups: i64,
    pub successful_backups: i64,
}

pub struct BackupService {
    pool: DatabasePool,
    config: BackupConfig,
}

impl BackupService {
    pub fn new(pool: DatabasePool, config: BackupConfig) -> Self {
        Self { pool, config }
    }

    /// Create a new backup
    pub async fn create_backup(&self, request: BackupRequest, user_id: Option<String>) -> Result<BackupJob, ApiError> {
        let backup_id = Uuid::new_v4();
        let started_at = Utc::now();

        // Insert backup job record
        let backup_job = sqlx::query_as::<_, BackupJob>(
            r#"
            INSERT INTO backup_jobs (id, backup_type, status, started_at, created_by, description)
            VALUES ($1, $2::backup_type, $3::backup_status, $4, $5, $6)
            RETURNING *
            "#
        )
        .bind(backup_id)
        .bind(&request.backup_type)
        .bind(&BackupStatus::InProgress)
        .bind(started_at)
        .bind(user_id.as_ref().and_then(|s| Uuid::parse_str(s).ok()))
        .bind(&request.description)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to create backup job: {}", e))))?;

        // Perform the actual backup
        match self.perform_backup(&backup_job, &request).await {
            Ok((file_path, file_size)) => {
                // Update backup job with success
                sqlx::query!(
                    r#"
                    UPDATE backup_jobs 
                    SET status = $1, completed_at = $2, file_path = $3, file_size_bytes = $4
                    WHERE id = $5
                    "#,
                    BackupStatus::Completed as _,
                    Utc::now(),
                    file_path,
                    file_size as i64,
                    backup_id
                )
                .execute(&self.pool)
                .await
                .map_err(|e| ApiError::internal_error(Some(format!("Failed to update backup job: {}", e))))?;

                Ok(BackupJob {
                    id: backup_id,
                    backup_type: request.backup_type.clone(),
                    status: BackupStatus::Completed,
                    started_at,
                    completed_at: Some(Utc::now()),
                    file_path: Some(file_path),
                    file_size_bytes: Some(file_size.try_into().unwrap_or(0)),
                    error_message: None,
                    created_by: user_id.as_ref().and_then(|s| uuid::Uuid::parse_str(s).ok()),
                    description: request.description.clone(),
                    created_at: started_at,
                    updated_at: Utc::now(),
                })
            }
            Err(e) => {
                // Update backup job with failure
                sqlx::query!(
                    r#"
                    UPDATE backup_jobs 
                    SET status = $1, completed_at = $2, error_message = $3
                    WHERE id = $4
                    "#,
                    BackupStatus::Failed as _,
                    Utc::now(),
                    e.to_string(),
                    backup_id
                )
                .execute(&self.pool)
                .await
                .map_err(|e| ApiError::internal_error(Some(format!("Failed to update backup job: {}", e))))?;

                Err(e)
            }
        }
    }

    /// Perform the actual backup operation
    #[allow(unused_variables)]
    async fn perform_backup(&self, backup_job: &BackupJob, request: &BackupRequest) -> Result<(String, u64), ApiError> {
        let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        let backup_filename = format!("backup_{}_{}_{}.sql", 
            backup_job.id, 
            timestamp,
            match request.backup_type {
                BackupType::Full => "full",
                BackupType::Incremental => "incremental", 
                BackupType::Schema => "schema",
                BackupType::Data => "data",
            }
        );
        
        let backup_path = Path::new(&self.config.backup_path);
        if !backup_path.exists() {
            fs::create_dir_all(backup_path)
                .map_err(|e| ApiError::internal_error(Some(format!("Failed to create backup directory: {}", e))))?;
        }

        let full_path = backup_path.join(&backup_filename);
        let file_path_str = full_path.to_string_lossy().to_string();

        // Generate SQL dump based on backup type
        let sql_dump = match request.backup_type {
            BackupType::Full => self.generate_full_dump().await?,
            BackupType::Schema => self.generate_schema_dump().await?,
            BackupType::Data => self.generate_data_dump().await?,
            BackupType::Incremental => self.generate_incremental_dump().await?,
        };

        // Write backup to file
        fs::write(&full_path, sql_dump)
            .map_err(|e| ApiError::internal_error(Some(format!("Failed to write backup file: {}", e))))?;

        // Get file size
        let metadata = fs::metadata(&full_path)
            .map_err(|e| ApiError::internal_error(Some(format!("Failed to get file metadata: {}", e))))?;
        let file_size = metadata.len();

        // Compress if enabled
        if self.config.compression {
            self.compress_backup(&full_path).await?;
        }

        Ok((file_path_str, file_size))
    }

    /// Generate full database dump
    #[allow(unused_variables)]
    async fn generate_full_dump(&self) -> Result<String, ApiError> {
        let mut dump = String::new();
        
        // Add header
        dump.push_str("-- Clinic Management System Database Backup\n");
        dump.push_str(&format!("-- Generated at: {}\n", Utc::now()));
        dump.push_str("-- Backup Type: Full\n\n");

        // TODO: Implement full database dump using pg_dump or custom logic
        // For now, return a placeholder
        dump.push_str("-- Full backup functionality to be implemented\n");
        dump.push_str("-- Use pg_dump for production backups\n");

        Ok(dump)
    }

    /// Generate schema-only dump
    #[allow(unused_variables)]
    async fn generate_schema_dump(&self) -> Result<String, ApiError> {
        let mut dump = String::new();
        
        dump.push_str("-- Clinic Management System Schema Backup\n");
        dump.push_str(&format!("-- Generated at: {}\n", Utc::now()));
        dump.push_str("-- Backup Type: Schema Only\n\n");

        // TODO: Implement schema dump using pg_dump --schema-only
        dump.push_str("-- Schema backup functionality to be implemented\n");

        Ok(dump)
    }

    /// Generate data-only dump
    #[allow(unused_variables)]
    async fn generate_data_dump(&self) -> Result<String, ApiError> {
        let mut dump = String::new();
        
        dump.push_str("-- Clinic Management System Data Backup\n");
        dump.push_str(&format!("-- Generated at: {}\n", Utc::now()));
        dump.push_str("-- Backup Type: Data Only\n\n");

        // TODO: Implement data dump using pg_dump --data-only
        dump.push_str("-- Data backup functionality to be implemented\n");

        Ok(dump)
    }

    /// Generate incremental dump (changes since last backup)
    async fn generate_incremental_dump(&self) -> Result<String, ApiError> {
        // For now, implement as data-only dump
        // In a production system, this would track changes using triggers or WAL
        self.generate_data_dump().await
    }

    /// Compress backup file
    async fn compress_backup(&self, file_path: &Path) -> Result<(), ApiError> {
        // Simple compression using gzip
        let compressed_path = format!("{}.gz", file_path.to_string_lossy());
        
        // Read file content
        let content = fs::read(file_path)
            .map_err(|e| ApiError::internal_error(Some(format!("Failed to read backup file: {}", e))))?;
        
        // Compress content (simplified - in production use proper compression library)
        // For now, just rename the file
        fs::rename(file_path, &compressed_path)
            .map_err(|e| ApiError::internal_error(Some(format!("Failed to compress backup file: {}", e))))?;
        
        Ok(())
    }

    /// Get backup statistics
    pub async fn get_backup_stats(&self) -> Result<BackupStats, ApiError> {
        let stats = sqlx::query_as::<_, BackupStats>(
            r#"
            SELECT 
                COUNT(*) as total_backups,
                COALESCE(SUM(file_size_bytes), 0) as total_size_bytes,
                MAX(completed_at) as last_backup,
                MIN(started_at) as oldest_backup,
                COUNT(*) FILTER (WHERE status = 'failed') as failed_backups,
                COUNT(*) FILTER (WHERE status = 'completed') as successful_backups
            FROM backup_jobs
            "#
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to get backup stats: {}", e))))?;

        Ok(stats)
    }

    /// List all backups
    pub async fn list_backups(&self, limit: Option<i64>, offset: Option<i64>) -> Result<Vec<BackupJob>, ApiError> {
        let limit = limit.unwrap_or(50);
        let offset = offset.unwrap_or(0);

        let backups = sqlx::query_as::<_, BackupJob>(
            r#"
            SELECT * FROM backup_jobs 
            ORDER BY started_at DESC 
            LIMIT $1 OFFSET $2
            "#
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to list backups: {}", e))))?;

        Ok(backups)
    }

    /// Delete old backups based on retention policy
    pub async fn cleanup_old_backups(&self) -> Result<u64, ApiError> {
        let cutoff_date = Utc::now() - chrono::Duration::days(self.config.retention_days as i64);
        
        let deleted_count = sqlx::query!(
            r#"
            DELETE FROM backup_jobs 
            WHERE started_at < $1 AND status = 'completed'
            "#,
            cutoff_date
        )
        .execute(&self.pool)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to cleanup old backups: {}", e))))?
        .rows_affected();

        Ok(deleted_count)
    }
}

// API Handlers

/// Create a new backup
pub async fn create_backup(
    req: web::Json<BackupRequest>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse, ApiError> {
    // TODO: Add authentication check
    let user_id = None; // Extract from JWT token

    let backup_service = BackupService::new(data.pool.clone(), data.backup_config.clone());
    
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
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
) -> Result<HttpResponse, ApiError> {
    let limit = query.get("limit").and_then(|v| v.as_i64());
    let offset = query.get("offset").and_then(|v| v.as_i64());

    let backup_service = BackupService::new(data.pool.clone(), data.backup_config.clone());
    
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
    data: web::Data<AppState>,
) -> Result<HttpResponse, ApiError> {
    let backup_service = BackupService::new(data.pool.clone(), data.backup_config.clone());
    
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

/// Download backup file
pub async fn download_backup(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
) -> Result<HttpResponse, ApiError> {
    let backup_id = path.into_inner();
    
    // Get backup job details
    let backup_job = sqlx::query_as::<_, BackupJob>(
        "SELECT * FROM backup_jobs WHERE id = $1"
    )
    .bind(backup_id)
    .fetch_optional(&data.pool)
    .await
    .map_err(|e| ApiError::internal_error(Some(format!("Failed to get backup job: {}", e))))?
    .ok_or_else(|| ApiError::not_found("Backup not found"))?;

    if backup_job.status != BackupStatus::Completed {
        return Err(ApiError::bad_request("Backup is not completed".to_string()));
    }

    let file_path = backup_job.file_path
        .ok_or_else(|| ApiError::internal_error(Some("Backup file path not found".to_string())))?;

    // Check if file exists
    if !Path::new(&file_path).exists() {
        return Err(ApiError::not_found("Backup file not found"));
    }

    // Read file content
    let content = fs::read(&file_path)
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to read backup file: {}", e))))?;

    // Return file as download
    Ok(HttpResponse::Ok()
        .content_type("application/octet-stream")
        .append_header(("Content-Disposition", format!("attachment; filename=\"backup_{}.sql\"", backup_id)))
        .body(content))
}

/// Cleanup old backups
pub async fn cleanup_backups(
    data: web::Data<AppState>,
) -> Result<HttpResponse, ApiError> {
    let backup_service = BackupService::new(data.pool.clone(), data.backup_config.clone());
    
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

// AppState extension
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub backup_config: BackupConfig,
    // ... other fields
}

impl AppState {
    pub fn new(pool: DatabasePool) -> Self {
        Self {
            pool,
            backup_config: BackupConfig {
                enabled: true,
                cron_expression: "0 2 * * *".to_string(), // Daily at 2 AM
                retention_days: 30,
                backup_path: "./backups".to_string(),
                compression: true,
                include_files: true,
                max_backup_size_mb: 1024,
            },
        }
    }
}
