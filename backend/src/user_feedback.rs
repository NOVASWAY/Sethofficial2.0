use actix_web::{web, HttpRequest, HttpResponse, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use uuid::Uuid;
use crate::error::ApiError;
use crate::loading_states::{LoadingStateManager, OperationType};

// User feedback types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FeedbackType {
    Success,
    Warning,
    Error,
    Info,
    Progress,
}

// User feedback message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserFeedback {
    pub id: String,
    pub user_id: String,
    pub feedback_type: FeedbackType,
    pub title: String,
    pub message: String,
    pub details: Option<String>,
    pub action_required: bool,
    pub action_url: Option<String>,
    pub action_text: Option<String>,
    pub auto_dismiss: bool,
    pub dismiss_after: Option<Duration>,
    pub created_at: u64, // Unix timestamp
    pub read: bool,
    pub metadata: HashMap<String, serde_json::Value>,
}

// Feedback manager
pub struct FeedbackManager {
    feedbacks: Arc<RwLock<HashMap<String, UserFeedback>>>,
    loading_manager: Arc<LoadingStateManager>,
}

impl FeedbackManager {
    pub fn new(loading_manager: Arc<LoadingStateManager>) -> Self {
        Self {
            feedbacks: Arc::new(RwLock::new(HashMap::new())),
            loading_manager,
        }
    }

    pub async fn create_feedback(
        &self,
        user_id: String,
        feedback_type: FeedbackType,
        title: String,
        message: String,
        details: Option<String>,
        action_required: bool,
        action_url: Option<String>,
        action_text: Option<String>,
        auto_dismiss: bool,
        dismiss_after: Option<Duration>,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> String {
        let feedback_id = Uuid::new_v4().to_string();
        let feedback = UserFeedback {
            id: feedback_id.clone(),
            user_id,
            feedback_type,
            title,
            message,
            details,
            action_required,
            action_url,
            action_text,
            auto_dismiss,
            dismiss_after,
            created_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            read: false,
            metadata: metadata.unwrap_or_default(),
        };

        let mut feedbacks = self.feedbacks.write().await;
        feedbacks.insert(feedback_id.clone(), feedback);
        feedback_id
    }

    pub async fn get_user_feedbacks(&self, user_id: &str) -> Vec<UserFeedback> {
        let feedbacks = self.feedbacks.read().await;
        feedbacks
            .values()
            .filter(|feedback| feedback.user_id == user_id)
            .cloned()
            .collect()
    }

    pub async fn get_unread_feedbacks(&self, user_id: &str) -> Vec<UserFeedback> {
        let feedbacks = self.feedbacks.read().await;
        feedbacks
            .values()
            .filter(|feedback| feedback.user_id == user_id && !feedback.read)
            .cloned()
            .collect()
    }

    pub async fn mark_as_read(&self, feedback_id: &str) -> Result<(), ApiError> {
        let mut feedbacks = self.feedbacks.write().await;
        if let Some(feedback) = feedbacks.get_mut(feedback_id) {
            feedback.read = true;
            Ok(())
        } else {
            Err(ApiError::not_found("Feedback not found"))
        }
    }

    pub async fn mark_all_as_read(&self, user_id: &str) -> Result<(), ApiError> {
        let mut feedbacks = self.feedbacks.write().await;
        for feedback in feedbacks.values_mut() {
            if feedback.user_id == user_id {
                feedback.read = true;
            }
        }
        Ok(())
    }

    pub async fn delete_feedback(&self, feedback_id: &str) -> Result<(), ApiError> {
        let mut feedbacks = self.feedbacks.write().await;
        if feedbacks.remove(feedback_id).is_some() {
            Ok(())
        } else {
            Err(ApiError::not_found("Feedback not found"))
        }
    }

    pub async fn cleanup_old_feedbacks(&self) {
        let mut feedbacks = self.feedbacks.write().await;
        let cutoff_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() - 86400; // 24 hours ago
        
        feedbacks.retain(|_, feedback| {
            match feedback.feedback_type {
                FeedbackType::Error => feedback.created_at > cutoff_time,
                _ => feedback.created_at > cutoff_time - 3600, // Keep errors longer
            }
        });
    }

    // Operation-specific feedback methods
    pub async fn operation_started(
        &self,
        user_id: String,
        operation_type: OperationType,
        operation_id: String,
    ) -> String {
        self.create_feedback(
            user_id,
            FeedbackType::Info,
            "Operation Started".to_string(),
            operation_type.default_message(),
            Some(format!("Operation ID: {}", operation_id)),
            false,
            Some(format!("/api/v1/operations/{}", operation_id)),
            Some("View Progress".to_string()),
            true,
            Some(Duration::from_secs(30)),
            Some({
                let mut metadata = HashMap::new();
                metadata.insert("operation_id".to_string(), serde_json::Value::String(operation_id));
                metadata.insert("operation_type".to_string(), serde_json::Value::String(format!("{:?}", operation_type)));
                metadata
            }),
        ).await
    }

    pub async fn operation_completed(
        &self,
        user_id: String,
        operation_type: OperationType,
        operation_id: String,
        success_message: Option<String>,
    ) -> String {
        self.create_feedback(
            user_id,
            FeedbackType::Success,
            "Operation Completed".to_string(),
            success_message.unwrap_or_else(|| format!("{} completed successfully", format!("{:?}", operation_type))),
            Some(format!("Operation ID: {}", operation_id)),
            false,
            None,
            None,
            true,
            Some(Duration::from_secs(10)),
            Some({
                let mut metadata = HashMap::new();
                metadata.insert("operation_id".to_string(), serde_json::Value::String(operation_id));
                metadata.insert("operation_type".to_string(), serde_json::Value::String(format!("{:?}", operation_type)));
                metadata
            }),
        ).await
    }

    pub async fn operation_failed(
        &self,
        user_id: String,
        operation_type: OperationType,
        operation_id: String,
        error_message: String,
        retry_url: Option<String>,
    ) -> String {
        self.create_feedback(
            user_id,
            FeedbackType::Error,
            "Operation Failed".to_string(),
            error_message,
            Some(format!("Operation ID: {}", operation_id)),
            retry_url.is_some(),
            retry_url,
            Some("Retry".to_string()),
            false, // Don't auto-dismiss errors
            None,
            Some({
                let mut metadata = HashMap::new();
                metadata.insert("operation_id".to_string(), serde_json::Value::String(operation_id));
                metadata.insert("operation_type".to_string(), serde_json::Value::String(format!("{:?}", operation_type)));
                metadata
            }),
        ).await
    }

    pub async fn operation_progress(
        &self,
        user_id: String,
        operation_type: OperationType,
        operation_id: String,
        progress: u8,
        progress_message: String,
    ) -> String {
        self.create_feedback(
            user_id,
            FeedbackType::Progress,
            "Operation Progress".to_string(),
            progress_message,
            Some(format!("Progress: {}% - Operation ID: {}", progress, operation_id)),
            false,
            Some(format!("/api/v1/operations/{}", operation_id)),
            Some("View Details".to_string()),
            true,
            Some(Duration::from_secs(5)),
            Some({
                let mut metadata = HashMap::new();
                metadata.insert("operation_id".to_string(), serde_json::Value::String(operation_id));
                metadata.insert("operation_type".to_string(), serde_json::Value::String(format!("{:?}", operation_type)));
                metadata.insert("progress".to_string(), serde_json::Value::Number(serde_json::Number::from(progress)));
                metadata
            }),
        ).await
    }

    // System-wide notifications
    pub async fn system_notification(
        &self,
        user_id: String,
        title: String,
        message: String,
        notification_type: FeedbackType,
        action_required: bool,
        action_url: Option<String>,
        action_text: Option<String>,
    ) -> String {
        self.create_feedback(
            user_id,
            notification_type,
            title,
            message,
            None,
            action_required,
            action_url,
            action_text,
            !action_required, // Auto-dismiss if no action required
            if action_required { None } else { Some(Duration::from_secs(15)) },
            None,
        ).await
    }

    // Validation feedback
    pub async fn validation_error(
        &self,
        user_id: String,
        field: String,
        error_message: String,
    ) -> String {
        self.create_feedback(
            user_id,
            FeedbackType::Error,
            "Validation Error".to_string(),
            format!("Invalid {}: {}", field, error_message),
            None,
            false,
            None,
            None,
            true,
            Some(Duration::from_secs(10)),
            Some({
                let mut metadata = HashMap::new();
                metadata.insert("field".to_string(), serde_json::Value::String(field));
                metadata.insert("error_type".to_string(), serde_json::Value::String("validation".to_string()));
                metadata
            }),
        ).await
    }

    // Success feedback
    pub async fn success_message(
        &self,
        user_id: String,
        title: String,
        message: String,
        action_url: Option<String>,
        action_text: Option<String>,
    ) -> String {
        self.create_feedback(
            user_id,
            FeedbackType::Success,
            title,
            message,
            None,
            false,
            action_url,
            action_text,
            true,
            Some(Duration::from_secs(8)),
            None,
        ).await
    }

    // Warning feedback
    pub async fn warning_message(
        &self,
        user_id: String,
        title: String,
        message: String,
        action_required: bool,
        action_url: Option<String>,
        action_text: Option<String>,
    ) -> String {
        self.create_feedback(
            user_id,
            FeedbackType::Warning,
            title,
            message,
            None,
            action_required,
            action_url,
            action_text,
            !action_required,
            if action_required { None } else { Some(Duration::from_secs(12)) },
            None,
        ).await
    }
}

// API endpoints for user feedback
pub async fn get_user_feedbacks(
    path: web::Path<String>,
    manager: web::Data<Arc<FeedbackManager>>,
) -> Result<HttpResponse, ApiError> {
    let user_id = path.into_inner();
    let feedbacks = manager.get_user_feedbacks(&user_id).await;
    
    Ok(HttpResponse::Ok().json(feedbacks))
}

pub async fn get_unread_feedbacks(
    path: web::Path<String>,
    manager: web::Data<Arc<FeedbackManager>>,
) -> Result<HttpResponse, ApiError> {
    let user_id = path.into_inner();
    let feedbacks = manager.get_unread_feedbacks(&user_id).await;
    
    Ok(HttpResponse::Ok().json(feedbacks))
}

pub async fn mark_feedback_as_read(
    path: web::Path<String>,
    manager: web::Data<Arc<FeedbackManager>>,
) -> Result<HttpResponse, ApiError> {
    let feedback_id = path.into_inner();
    
    manager.mark_as_read(&feedback_id).await?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Feedback marked as read"
    })))
}

pub async fn mark_all_feedbacks_as_read(
    path: web::Path<String>,
    manager: web::Data<Arc<FeedbackManager>>,
) -> Result<HttpResponse, ApiError> {
    let user_id = path.into_inner();
    
    manager.mark_all_as_read(&user_id).await?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "All feedbacks marked as read"
    })))
}

pub async fn delete_feedback(
    path: web::Path<String>,
    manager: web::Data<Arc<FeedbackManager>>,
) -> Result<HttpResponse, ApiError> {
    let feedback_id = path.into_inner();
    
    manager.delete_feedback(&feedback_id).await?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Feedback deleted successfully"
    })))
}

// WebSocket integration for real-time feedback
pub async fn broadcast_feedback_to_user(
    feedback_manager: Arc<FeedbackManager>,
    websocket_manager: actix::Addr<crate::websocket::WebSocketManager>,
    user_id: String,
    feedback: UserFeedback,
) {
    let message = serde_json::json!({
        "type": "feedback",
        "data": feedback
    });

    // Send feedback to user via WebSocket
    websocket_manager
        .send(crate::websocket::DirectMessage {
            session_id: uuid::Uuid::parse_str(&user_id).unwrap_or_else(|_| uuid::Uuid::new_v4()),
            message: crate::websocket::WebSocketMessage::new("feedback".to_string(), serde_json::json!(feedback)),
        })
        .await;
}

// Helper functions for common feedback scenarios
pub async fn notify_operation_start(
    feedback_manager: Arc<FeedbackManager>,
    user_id: String,
    operation_type: OperationType,
    operation_id: String,
) -> String {
    feedback_manager
        .operation_started(user_id, operation_type, operation_id)
        .await
}

pub async fn notify_operation_complete(
    feedback_manager: Arc<FeedbackManager>,
    user_id: String,
    operation_type: OperationType,
    operation_id: String,
    success_message: Option<String>,
) -> String {
    feedback_manager
        .operation_completed(user_id, operation_type, operation_id, success_message)
        .await
}

pub async fn notify_operation_failed(
    feedback_manager: Arc<FeedbackManager>,
    user_id: String,
    operation_type: OperationType,
    operation_id: String,
    error_message: String,
    retry_url: Option<String>,
) -> String {
    feedback_manager
        .operation_failed(user_id, operation_type, operation_id, error_message, retry_url)
        .await
}

pub async fn notify_validation_error(
    feedback_manager: Arc<FeedbackManager>,
    user_id: String,
    field: String,
    error_message: String,
) -> String {
    feedback_manager
        .validation_error(user_id, field, error_message)
        .await
}

pub async fn notify_success(
    feedback_manager: Arc<FeedbackManager>,
    user_id: String,
    title: String,
    message: String,
    action_url: Option<String>,
    action_text: Option<String>,
) -> String {
    feedback_manager
        .success_message(user_id, title, message, action_url, action_text)
        .await
}

pub async fn notify_warning(
    feedback_manager: Arc<FeedbackManager>,
    user_id: String,
    title: String,
    message: String,
    action_required: bool,
    action_url: Option<String>,
    action_text: Option<String>,
) -> String {
    feedback_manager
        .warning_message(user_id, title, message, action_required, action_url, action_text)
        .await
}
