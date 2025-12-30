use actix_web::web::Data;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::backup::{BackupService, BackupConfig, BackupRequest, BackupType, BackupSchedule};
use crate::error::ApiError;
use tracing::{info, error, warn};

pub struct BackupScheduler {
    pool: PgPool,
    backup_config: BackupConfig,
    running: Arc<std::sync::atomic::AtomicBool>,
}

impl BackupScheduler {
    pub fn new(pool: PgPool, backup_config: BackupConfig) -> Self {
        Self {
            pool,
            backup_config,
            running: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    /// Start the backup scheduler
    pub async fn start(&self) -> Result<(), ApiError> {
        if self.running.load(std::sync::atomic::Ordering::Relaxed) {
            return Err(ApiError::bad_request("Backup scheduler is already running".to_string()));
        }

        self.running.store(true, std::sync::atomic::Ordering::Relaxed);
        info!("Backup scheduler started");

        // Spawn the scheduler task
        let pool = self.pool.clone();
        let backup_config = self.backup_config.clone();
        let running = self.running.clone();

        tokio::spawn(async move {
            let scheduler = BackupScheduler {
                pool: pool.clone(),
                backup_config: backup_config.clone(),
                running: running.clone(),
            };

            while running.load(std::sync::atomic::Ordering::Relaxed) {
                if let Err(e) = scheduler.check_and_run_scheduled_backups().await {
                    error!("Error in backup scheduler: {}", e);
                }

                // Check every minute
                sleep(Duration::from_secs(60)).await;
            }
        });

        Ok(())
    }

    /// Stop the backup scheduler
    pub fn stop(&self) {
        self.running.store(false, std::sync::atomic::Ordering::Relaxed);
        info!("Backup scheduler stopped");
    }

    /// Check if any scheduled backups need to run
    async fn check_and_run_scheduled_backups(&self) -> Result<(), ApiError> {
        // Check if backup_schedules table exists - if not, migrations haven't run yet
        // Handle connection errors gracefully - if we can't connect, skip this check
        let table_exists: bool = match sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'backup_schedules'
            )
            "#
        )
        .fetch_one(&self.pool)
        .await
        {
            Ok(exists) => exists,
            Err(e) => {
                // If it's a connection error or pool timeout, log and skip
                if e.to_string().contains("pool timed out") || 
                   e.to_string().contains("connection") ||
                   e.to_string().contains("does not exist") {
                    warn!("Backup scheduler: Database connection issue ({}). Skipping scheduler check.", e);
                    return Ok(());
                }
                // For other errors, return them
                return Err(ApiError::internal_error(Some(format!("Failed to check table existence: {}", e))));
            }
        };
        
        if !table_exists {
            // Migrations haven't run yet - skip scheduler checks
            warn!("Backup scheduler: backup_schedules table does not exist. Migrations may not have run yet. Skipping scheduler check.");
            return Ok(());
        }
        
        let now = Utc::now();
        
        // Get all enabled schedules that are due to run
        let schedules = sqlx::query_as::<_, BackupSchedule>(
            r#"
            SELECT id, name, description, backup_type, cron_expression, enabled, last_run_at, next_run_at, retention_days, created_by, created_at, updated_at
            FROM backup_schedules 
            WHERE enabled = true 
            AND (next_run_at IS NULL OR next_run_at <= $1)
            ORDER BY next_run_at ASC
            "#
        )
        .bind(now)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to get backup schedules: {}", e))))?;

        for schedule in schedules {
            if let Err(e) = self.run_scheduled_backup(&schedule).await {
                error!("Failed to run scheduled backup '{}': {}", schedule.name, e);
            }
        }

        Ok(())
    }

    /// Run a scheduled backup
    async fn run_scheduled_backup(&self, schedule: &BackupSchedule) -> Result<(), ApiError> {
        info!("Running scheduled backup: {}", schedule.name);

        let backup_service = BackupService::new(self.pool.clone(), self.backup_config.clone());
        
        let backup_request = BackupRequest {
            backup_type: schedule.backup_type.clone(),
            description: Some(format!("Scheduled backup: {}", schedule.name)),
            include_files: Some(self.backup_config.include_files),
        };

        // Create the backup
        match backup_service.create_backup(backup_request, None).await {
            Ok(backup_job) => {
                info!("Scheduled backup '{}' completed successfully: {}", schedule.name, backup_job.id);
                
                // Update the schedule with last run time and calculate next run
                self.update_schedule_after_run(schedule.id, backup_job.started_at).await?;
            }
            Err(e) => {
                error!("Scheduled backup '{}' failed: {}", schedule.name, e);
                
                // Update the schedule even on failure to prevent immediate retry
                self.update_schedule_after_run(schedule.id, Utc::now()).await?;
            }
        }

        Ok(())
    }

    /// Update schedule after running a backup
    async fn update_schedule_after_run(&self, schedule_id: Uuid, last_run: DateTime<Utc>) -> Result<(), ApiError> {
        let next_run = self.calculate_next_run_time(&last_run).await?;

        sqlx::query(
            r#"
            UPDATE backup_schedules 
            SET last_run_at = $1, next_run_at = $2, updated_at = NOW()
            WHERE id = $3
            "#
        )
        .bind(last_run)
        .bind(next_run)
        .bind(schedule_id)
        .execute(&self.pool)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to update schedule: {}", e))))?;

        Ok(())
    }

    /// Calculate next run time based on schedule
    async fn calculate_next_run_time(&self, last_run: &DateTime<Utc>) -> Result<DateTime<Utc>, ApiError> {
        // Simple implementation - in production, use a proper cron parser
        // For now, assume daily backups
        let next_run = *last_run + chrono::Duration::days(1);
        Ok(next_run)
    }

    /// Get all backup schedules
    pub async fn get_schedules(&self) -> Result<Vec<BackupSchedule>, ApiError> {
        let schedules = sqlx::query_as::<_, BackupSchedule>(
            r#"
            SELECT id, name, description, backup_type, cron_expression, enabled, last_run_at, next_run_at, retention_days, created_by, created_at, updated_at
            FROM backup_schedules 
            ORDER BY name
            "#
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to get backup schedules: {}", e))))?;

        Ok(schedules)
    }

    /// Create a new backup schedule
    pub async fn create_schedule(&self, schedule: &BackupSchedule) -> Result<Uuid, ApiError> {
        let schedule_id = Uuid::new_v4();
        let next_run = self.calculate_next_run_time(&Utc::now()).await?;

        sqlx::query(
            r#"
            INSERT INTO backup_schedules (id, name, backup_type, cron_expression, enabled, retention_days, next_run_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#
        )
        .bind(schedule_id)
        .bind(&schedule.name)
        .bind(&schedule.backup_type)
        .bind(&schedule.cron_expression)
        .bind(schedule.enabled)
        .bind(schedule.retention_days as i32)
        .bind(next_run)
        .execute(&self.pool)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to create backup schedule: {}", e))))?;

        Ok(schedule_id)
    }

    /// Update a backup schedule
    pub async fn update_schedule(&self, schedule_id: Uuid, schedule: &BackupSchedule) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            UPDATE backup_schedules 
            SET name = $1, backup_type = $2, cron_expression = $3, enabled = $4, retention_days = $5, updated_at = NOW()
            WHERE id = $6
            "#
        )
        .bind(&schedule.name)
        .bind(&schedule.backup_type)
        .bind(&schedule.cron_expression)
        .bind(schedule.enabled)
        .bind(schedule.retention_days as i32)
        .bind(schedule_id)
        .execute(&self.pool)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to update backup schedule: {}", e))))?;

        Ok(())
    }

    /// Delete a backup schedule
    pub async fn delete_schedule(&self, schedule_id: Uuid) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM backup_schedules WHERE id = $1")
        .bind(schedule_id)
        .execute(&self.pool)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to delete backup schedule: {}", e))))?;

        Ok(())
    }

    /// Enable/disable a backup schedule
    pub async fn toggle_schedule(&self, schedule_id: Uuid, enabled: bool) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            UPDATE backup_schedules 
            SET enabled = $1, updated_at = NOW()
            WHERE id = $2
            "#
        )
        .bind(enabled)
        .bind(schedule_id)
        .execute(&self.pool)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to toggle backup schedule: {}", e))))?;

        Ok(())
    }

    /// Run cleanup of old backups
    pub async fn run_cleanup(&self) -> Result<u64, ApiError> {
        let backup_service = BackupService::new(self.pool.clone(), self.backup_config.clone());
        backup_service.cleanup_old_backups().await
    }

    /// Get scheduler status
    pub fn is_running(&self) -> bool {
        self.running.load(std::sync::atomic::Ordering::Relaxed)
    }
}

// Global scheduler instance
static mut BACKUP_SCHEDULER: Option<Arc<BackupScheduler>> = None;

/// Initialize the global backup scheduler
pub async fn init_backup_scheduler(pool: PgPool, backup_config: BackupConfig) -> Result<(), ApiError> {
    let scheduler = Arc::new(BackupScheduler::new(pool, backup_config));
    
    unsafe {
        BACKUP_SCHEDULER = Some(scheduler.clone());
    }

    scheduler.start().await?;
    Ok(())
}

/// Get the global backup scheduler
pub fn get_backup_scheduler() -> Option<Arc<BackupScheduler>> {
    unsafe {
        BACKUP_SCHEDULER.clone()
    }
}

/// Stop the global backup scheduler
pub fn stop_backup_scheduler() {
    if let Some(scheduler) = get_backup_scheduler() {
        scheduler.stop();
    }
}
