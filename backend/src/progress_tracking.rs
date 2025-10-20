use actix_web::{web, HttpRequest, HttpResponse, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use uuid::Uuid;
use crate::error::ApiError;
use crate::loading_states::{LoadingStateManager, OperationType, ProgressTracker};
use crate::user_feedback::{FeedbackManager, FeedbackType};

// Progress tracking for complex operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressStep {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: StepStatus,
    pub progress: u8, // 0-100
    pub started_at: Option<u64>, // Unix timestamp
    pub completed_at: Option<u64>, // Unix timestamp
    pub error_message: Option<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StepStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Skipped,
}

// Complex operation progress tracker
pub struct ComplexProgressTracker {
    operation_id: String,
    steps: Vec<ProgressStep>,
    current_step_index: usize,
    loading_manager: Arc<LoadingStateManager>,
    feedback_manager: Arc<FeedbackManager>,
    user_id: String,
    operation_type: OperationType,
}

impl ComplexProgressTracker {
    pub fn new(
        operation_id: String,
        step_names: Vec<String>,
        loading_manager: Arc<LoadingStateManager>,
        feedback_manager: Arc<FeedbackManager>,
        user_id: String,
        operation_type: OperationType,
    ) -> Self {
        let steps = step_names
            .into_iter()
            .enumerate()
            .map(|(index, name)| ProgressStep {
                id: Uuid::new_v4().to_string(),
                name: name.clone(),
                description: format!("Step {}: {}", index + 1, name),
                status: StepStatus::Pending,
                progress: 0,
                started_at: None,
                completed_at: None,
                error_message: None,
                metadata: HashMap::new(),
            })
            .collect();

        Self {
            operation_id,
            steps,
            current_step_index: 0,
            loading_manager,
            feedback_manager,
            user_id,
            operation_type,
        }
    }

    pub async fn start_step(&mut self, step_name: &str) -> Result<(), ApiError> {
        let step_description = if let Some(step) = self.steps.iter().find(|s| s.name == step_name) {
            step.description.clone()
        } else {
            return Err(ApiError::validation_error(format!("Step '{}' not found", step_name)));
        };

        if let Some(step) = self.steps.iter_mut().find(|s| s.name == step_name) {
            step.status = StepStatus::InProgress;
            step.started_at = Some(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs());
            step.progress = 0;
        }

        // Update overall progress
        self.update_overall_progress().await?;

        // Send feedback
        self.feedback_manager
            .operation_progress(
                self.user_id.clone(),
                self.operation_type.clone(),
                self.operation_id.clone(),
                self.get_overall_progress(),
                format!("Starting: {}", step_description),
            )
            .await;

        Ok(())
    }

    pub async fn update_step_progress(
        &mut self,
        step_name: &str,
        progress: u8,
        message: Option<String>,
    ) -> Result<(), ApiError> {
        if let Some(step) = self.steps.iter_mut().find(|s| s.name == step_name) {
            step.progress = progress;

            // Update overall progress
            self.update_overall_progress().await?;

            // Send feedback if message provided
            if let Some(msg) = message {
                self.feedback_manager
                    .operation_progress(
                        self.user_id.clone(),
                        self.operation_type.clone(),
                        self.operation_id.clone(),
                        self.get_overall_progress(),
                        msg,
                    )
                    .await;
            }

            Ok(())
        } else {
            Err(ApiError::validation_error(format!("Step '{}' not found", step_name)))
        }
    }

    pub async fn complete_step(&mut self, step_name: &str) -> Result<(), ApiError> {
        let step_description = if let Some(step) = self.steps.iter().find(|s| s.name == step_name) {
            step.description.clone()
        } else {
            return Err(ApiError::validation_error(format!("Step '{}' not found", step_name)));
        };

        if let Some(step) = self.steps.iter_mut().find(|s| s.name == step_name) {
            step.status = StepStatus::Completed;
            step.progress = 100;
            step.completed_at = Some(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs());
        }

        // Update overall progress
        self.update_overall_progress().await?;

        // Send feedback
        self.feedback_manager
            .operation_progress(
                self.user_id.clone(),
                self.operation_type.clone(),
                self.operation_id.clone(),
                self.get_overall_progress(),
                format!("Completed: {}", step_description),
            )
            .await;

        Ok(())
    }

    pub async fn fail_step(&mut self, step_name: &str, error_message: String) -> Result<(), ApiError> {
        if let Some(step) = self.steps.iter_mut().find(|s| s.name == step_name) {
            step.status = StepStatus::Failed;
            step.error_message = Some(error_message.clone());
            step.completed_at = Some(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs());

            // Update overall progress
            self.update_overall_progress().await?;

            // Send error feedback
            self.feedback_manager
                .operation_failed(
                    self.user_id.clone(),
                    self.operation_type.clone(),
                    self.operation_id.clone(),
                    format!("Failed at step '{}': {}", step_name, error_message),
                    None,
                )
                .await;

            Ok(())
        } else {
            Err(ApiError::validation_error(format!("Step '{}' not found", step_name)))
        }
    }

    pub async fn skip_step(&mut self, step_name: &str, reason: Option<String>) -> Result<(), ApiError> {
        if let Some(step) = self.steps.iter_mut().find(|s| s.name == step_name) {
            step.status = StepStatus::Skipped;
            step.progress = 100;
            step.completed_at = Some(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs());
            if let Some(reason) = reason {
                step.metadata.insert("skip_reason".to_string(), serde_json::Value::String(reason));
            }

            // Update overall progress
            self.update_overall_progress().await?;

            Ok(())
        } else {
            Err(ApiError::validation_error(format!("Step '{}' not found", step_name)))
        }
    }

    pub async fn complete_operation(&self, success_message: Option<String>) -> Result<(), ApiError> {
        self.loading_manager
            .complete_operation(&self.operation_id, success_message.clone())
            .await?;

        self.feedback_manager
            .operation_completed(
                self.user_id.clone(),
                self.operation_type.clone(),
                self.operation_id.clone(),
                success_message,
            )
            .await;

        Ok(())
    }

    pub async fn fail_operation(&self, error_message: String) -> Result<(), ApiError> {
        self.loading_manager
            .fail_operation(&self.operation_id, error_message.clone())
            .await?;

        self.feedback_manager
            .operation_failed(
                self.user_id.clone(),
                self.operation_type.clone(),
                self.operation_id.clone(),
                error_message,
                None,
            )
            .await;

        Ok(())
    }

    fn get_overall_progress(&self) -> u8 {
        if self.steps.is_empty() {
            return 0;
        }

        let total_progress: u32 = self.steps.iter().map(|step| step.progress as u32).sum();
        (total_progress / self.steps.len() as u32) as u8
    }

    async fn update_overall_progress(&self) -> Result<(), ApiError> {
        let overall_progress = self.get_overall_progress();
        self.loading_manager
            .update_progress(&self.operation_id, overall_progress, None)
            .await
    }

    pub fn get_current_step(&self) -> Option<&ProgressStep> {
        self.steps.get(self.current_step_index)
    }

    pub fn get_steps(&self) -> &[ProgressStep] {
        &self.steps
    }

    pub fn get_completed_steps(&self) -> Vec<&ProgressStep> {
        self.steps
            .iter()
            .filter(|step| matches!(step.status, StepStatus::Completed | StepStatus::Skipped))
            .collect()
    }

    pub fn get_failed_steps(&self) -> Vec<&ProgressStep> {
        self.steps
            .iter()
            .filter(|step| matches!(step.status, StepStatus::Failed))
            .collect()
    }

    pub fn get_pending_steps(&self) -> Vec<&ProgressStep> {
        self.steps
            .iter()
            .filter(|step| matches!(step.status, StepStatus::Pending))
            .collect()
    }

    pub fn get_in_progress_steps(&self) -> Vec<&ProgressStep> {
        self.steps
            .iter()
            .filter(|step| matches!(step.status, StepStatus::InProgress))
            .collect()
    }

    pub fn is_complete(&self) -> bool {
        self.steps.iter().all(|step| {
            matches!(step.status, StepStatus::Completed | StepStatus::Skipped)
        })
    }

    pub fn has_failures(&self) -> bool {
        self.steps.iter().any(|step| matches!(step.status, StepStatus::Failed))
    }

    pub fn get_estimated_remaining_time(&self) -> Option<Duration> {
        if self.steps.is_empty() {
            return None;
        }

        let completed_steps = self.get_completed_steps();
        if completed_steps.is_empty() {
            return self.operation_type.estimated_duration();
        }

        let total_time: Duration = completed_steps
            .iter()
            .filter_map(|step| {
                step.started_at.and_then(|start| {
                    step.completed_at.map(|end| Duration::from_secs(end - start))
                })
            })
            .sum();

        let avg_time_per_step = total_time / completed_steps.len() as u32;
        let remaining_steps = self.get_pending_steps().len() + self.get_in_progress_steps().len();
        
        Some(avg_time_per_step * remaining_steps as u32)
    }
}

// Progress tracking for batch operations
pub struct BatchProgressTracker {
    operation_id: String,
    total_items: u32,
    processed_items: u32,
    failed_items: u32,
    current_item: String,
    loading_manager: Arc<LoadingStateManager>,
    feedback_manager: Arc<FeedbackManager>,
    user_id: String,
    operation_type: OperationType,
    errors: Vec<String>,
}

impl BatchProgressTracker {
    pub fn new(
        operation_id: String,
        total_items: u32,
        loading_manager: Arc<LoadingStateManager>,
        feedback_manager: Arc<FeedbackManager>,
        user_id: String,
        operation_type: OperationType,
    ) -> Self {
        Self {
            operation_id,
            total_items,
            processed_items: 0,
            failed_items: 0,
            current_item: String::new(),
            loading_manager,
            feedback_manager,
            user_id,
            operation_type,
            errors: Vec::new(),
        }
    }

    pub async fn start_item(&mut self, item_name: String) -> Result<(), ApiError> {
        self.current_item = item_name.clone();
        
        let progress = ((self.processed_items as f64 / self.total_items as f64) * 100.0) as u8;
        self.loading_manager
            .update_progress(&self.operation_id, progress, Some(format!("Processing: {}", item_name)))
            .await?;

        Ok(())
    }

    pub async fn complete_item(&mut self, item_name: String) -> Result<(), ApiError> {
        self.processed_items += 1;
        self.current_item.clear();
        
        let progress = ((self.processed_items as f64 / self.total_items as f64) * 100.0) as u8;
        self.loading_manager
            .update_progress(&self.operation_id, progress, Some(format!("Completed: {}", item_name)))
            .await?;

        // Send periodic feedback
        if self.processed_items % 10 == 0 || self.processed_items == self.total_items {
            self.feedback_manager
                .operation_progress(
                    self.user_id.clone(),
                    self.operation_type.clone(),
                    self.operation_id.clone(),
                    progress,
                    format!("Processed {}/{} items", self.processed_items, self.total_items),
                )
                .await;
        }

        Ok(())
    }

    pub async fn fail_item(&mut self, item_name: String, error_message: String) -> Result<(), ApiError> {
        self.failed_items += 1;
        self.errors.push(format!("{}: {}", item_name, error_message));
        self.current_item.clear();
        
        let progress = ((self.processed_items as f64 / self.total_items as f64) * 100.0) as u8;
        self.loading_manager
            .update_progress(&self.operation_id, progress, Some(format!("Failed: {}", item_name)))
            .await?;

        Ok(())
    }

    pub async fn complete_batch(&self, success_message: Option<String>) -> Result<(), ApiError> {
        let message = success_message.unwrap_or_else(|| {
            format!(
                "Batch operation completed. Processed: {}, Failed: {}",
                self.processed_items, self.failed_items
            )
        });

        self.loading_manager
            .complete_operation(&self.operation_id, Some(message.clone()))
            .await?;

        self.feedback_manager
            .operation_completed(
                self.user_id.clone(),
                self.operation_type.clone(),
                self.operation_id.clone(),
                Some(message),
            )
            .await;

        Ok(())
    }

    pub async fn fail_batch(&self, error_message: String) -> Result<(), ApiError> {
        let message = format!(
            "Batch operation failed: {}. Processed: {}, Failed: {}",
            error_message, self.processed_items, self.failed_items
        );

        self.loading_manager
            .fail_operation(&self.operation_id, message.clone())
            .await?;

        self.feedback_manager
            .operation_failed(
                self.user_id.clone(),
                self.operation_type.clone(),
                self.operation_id.clone(),
                message,
                None,
            )
            .await;

        Ok(())
    }

    pub fn get_progress_percentage(&self) -> u8 {
        ((self.processed_items as f64 / self.total_items as f64) * 100.0) as u8
    }

    pub fn get_errors(&self) -> &[String] {
        &self.errors
    }

    pub fn get_success_rate(&self) -> f64 {
        if self.processed_items == 0 {
            return 0.0;
        }
        ((self.processed_items - self.failed_items) as f64 / self.processed_items as f64) * 100.0
    }
}

// API endpoints for progress tracking
pub async fn get_operation_progress(
    path: web::Path<String>,
    manager: web::Data<Arc<LoadingStateManager>>,
) -> Result<HttpResponse, ApiError> {
    let operation_id = path.into_inner();
    
    match manager.get_operation_status(&operation_id).await {
        Some(state) => Ok(HttpResponse::Ok().json(state)),
        None => Err(ApiError::not_found("Operation not found")),
    }
}

pub async fn get_user_operation_progress(
    path: web::Path<String>,
    manager: web::Data<Arc<LoadingStateManager>>,
) -> Result<HttpResponse, ApiError> {
    let user_id = path.into_inner();
    let operations = manager.get_user_operations(&user_id).await;
    
    Ok(HttpResponse::Ok().json(operations))
}

// Utility functions for common progress tracking scenarios
pub async fn track_simple_operation<F, R>(
    loading_manager: Arc<LoadingStateManager>,
    feedback_manager: Arc<FeedbackManager>,
    user_id: String,
    operation_type: OperationType,
    operation: F,
) -> Result<R, ApiError>
where
    F: FnOnce() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<R, ApiError>> + Send>>,
{
    let operation_id = loading_manager
        .start_operation(
            format!("{:?}", operation_type),
            Some(user_id.clone()),
            operation_type.estimated_duration(),
            None,
        )
        .await;

    // Notify start
    feedback_manager
        .operation_started(user_id.clone(), operation_type.clone(), operation_id.clone())
        .await;

    match operation().await {
        Ok(result) => {
            loading_manager
                .complete_operation(&operation_id, Some("Operation completed successfully".to_string()))
                .await?;

            feedback_manager
                .operation_completed(
                    user_id,
                    operation_type,
                    operation_id,
                    Some("Operation completed successfully".to_string()),
                )
                .await;

            Ok(result)
        }
        Err(error) => {
            let error_message = error.message.clone();
            loading_manager
                .fail_operation(&operation_id, error_message.clone())
                .await?;

            feedback_manager
                .operation_failed(
                    user_id,
                    operation_type,
                    operation_id,
                    error_message,
                    None,
                )
                .await;

            Err(error)
        }
    }
}

// Helper macro for simple operation tracking
#[macro_export]
macro_rules! track_simple_operation {
    ($loading_manager:expr, $feedback_manager:expr, $user_id:expr, $operation_type:expr, $operation:expr) => {
        crate::progress_tracking::track_simple_operation(
            $loading_manager,
            $feedback_manager,
            $user_id,
            $operation_type,
            || Box::pin($operation()),
        )
    };
}
