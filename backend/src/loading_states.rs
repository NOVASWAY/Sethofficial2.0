use actix_web::{web, HttpRequest, HttpResponse, Result, middleware::Next, dev::ServiceRequest, dev::ServiceResponse, Error};
use actix_web::body::MessageBody;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use uuid::Uuid;
use crate::error::ApiError;

// Loading state for individual operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadingState {
    pub operation_id: String,
    pub operation_type: String,
    pub status: LoadingStatus,
    pub progress: Option<u8>, // 0-100 percentage
    pub message: Option<String>,
    pub started_at: u64, // Unix timestamp
    pub estimated_duration: Option<Duration>,
    pub user_id: Option<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LoadingStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

// Global loading state manager
pub struct LoadingStateManager {
    states: Arc<RwLock<HashMap<String, LoadingState>>>,
    cleanup_interval: Duration,
}

impl LoadingStateManager {
    pub fn new() -> Self {
        Self {
            states: Arc::new(RwLock::new(HashMap::new())),
            cleanup_interval: Duration::from_secs(300), // 5 minutes
        }
    }

    pub async fn start_operation(
        &self,
        operation_type: String,
        user_id: Option<String>,
        estimated_duration: Option<Duration>,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> String {
        let operation_id = Uuid::new_v4().to_string();
        let state = LoadingState {
            operation_id: operation_id.clone(),
            operation_type,
            status: LoadingStatus::Pending,
            progress: Some(0),
            message: Some("Initializing operation...".to_string()),
            started_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            estimated_duration,
            user_id,
            metadata: metadata.unwrap_or_default(),
        };

        let mut states = self.states.write().await;
        states.insert(operation_id.clone(), state);
        operation_id
    }

    pub async fn update_progress(
        &self,
        operation_id: &str,
        progress: u8,
        message: Option<String>,
    ) -> Result<(), ApiError> {
        let mut states = self.states.write().await;
        if let Some(state) = states.get_mut(operation_id) {
            state.progress = Some(progress);
            if let Some(msg) = message {
                state.message = Some(msg);
            }
            state.status = LoadingStatus::InProgress;
        } else {
            return Err(ApiError::not_found("Operation not found"));
        }
        Ok(())
    }

    pub async fn complete_operation(
        &self,
        operation_id: &str,
        message: Option<String>,
    ) -> Result<(), ApiError> {
        let mut states = self.states.write().await;
        if let Some(state) = states.get_mut(operation_id) {
            state.status = LoadingStatus::Completed;
            state.progress = Some(100);
            if let Some(msg) = message {
                state.message = Some(msg);
            }
        } else {
            return Err(ApiError::not_found("Operation not found"));
        }
        Ok(())
    }

    pub async fn fail_operation(
        &self,
        operation_id: &str,
        error_message: String,
    ) -> Result<(), ApiError> {
        let mut states = self.states.write().await;
        if let Some(state) = states.get_mut(operation_id) {
            state.status = LoadingStatus::Failed;
            state.message = Some(error_message);
        } else {
            return Err(ApiError::not_found("Operation not found"));
        }
        Ok(())
    }

    pub async fn cancel_operation(
        &self,
        operation_id: &str,
        reason: Option<String>,
    ) -> Result<(), ApiError> {
        let mut states = self.states.write().await;
        if let Some(state) = states.get_mut(operation_id) {
            state.status = LoadingStatus::Cancelled;
            if let Some(reason) = reason {
                state.message = Some(reason);
            }
        } else {
            return Err(ApiError::not_found("Operation not found"));
        }
        Ok(())
    }

    pub async fn get_operation_status(&self, operation_id: &str) -> Option<LoadingState> {
        let states = self.states.read().await;
        states.get(operation_id).cloned()
    }

    pub async fn get_user_operations(&self, user_id: &str) -> Vec<LoadingState> {
        let states = self.states.read().await;
        states
            .values()
            .filter(|state| state.user_id.as_ref() == Some(&user_id.to_string()))
            .cloned()
            .collect()
    }

    pub async fn cleanup_old_operations(&self) {
        let mut states = self.states.write().await;
        let cutoff_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() - 3600; // 1 hour ago
        
        states.retain(|_, state| {
            match state.status {
                LoadingStatus::Completed | LoadingStatus::Failed | LoadingStatus::Cancelled => {
                    state.started_at > cutoff_time
                }
                _ => true, // Keep pending and in-progress operations
            }
        });
    }

    pub async fn get_operation_count(&self) -> usize {
        let states = self.states.read().await;
        states.len()
    }

    pub async fn get_active_operations(&self) -> Vec<LoadingState> {
        let states = self.states.read().await;
        states
            .values()
            .filter(|state| {
                matches!(state.status, LoadingStatus::Pending | LoadingStatus::InProgress)
            })
            .cloned()
            .collect()
    }
}

// Progress tracking for long-running operations
pub struct ProgressTracker {
    operation_id: String,
    manager: Arc<LoadingStateManager>,
    total_steps: u32,
    current_step: u32,
}

impl ProgressTracker {
    pub fn new(
        operation_id: String,
        manager: Arc<LoadingStateManager>,
        total_steps: u32,
    ) -> Self {
        Self {
            operation_id,
            manager,
            total_steps,
            current_step: 0,
        }
    }

    pub async fn advance_step(&mut self, message: Option<String>) -> Result<(), ApiError> {
        self.current_step += 1;
        let progress = ((self.current_step as f64 / self.total_steps as f64) * 100.0) as u8;
        self.manager
            .update_progress(&self.operation_id, progress, message)
            .await
    }

    pub async fn set_step(&mut self, step: u32, message: Option<String>) -> Result<(), ApiError> {
        self.current_step = step;
        let progress = ((self.current_step as f64 / self.total_steps as f64) * 100.0) as u8;
        self.manager
            .update_progress(&self.operation_id, progress, message)
            .await
    }

    pub async fn complete(&self, message: Option<String>) -> Result<(), ApiError> {
        self.manager
            .complete_operation(&self.operation_id, message)
            .await
    }

    pub async fn fail(&self, error_message: String) -> Result<(), ApiError> {
        self.manager
            .fail_operation(&self.operation_id, error_message)
            .await
    }
}

// Operation types for different API endpoints
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationType {
    // Patient operations
    CreatePatient,
    UpdatePatient,
    DeletePatient,
    GetPatients,
    SearchPatients,
    
    // User operations
    CreateUser,
    UpdateUser,
    DeleteUser,
    GetUsers,
    Login,
    Logout,
    
    // Consultation operations
    CreateConsultation,
    UpdateConsultation,
    GetConsultations,
    AddPrescription,
    
    // Invoice operations
    CreateInvoice,
    UpdateInvoice,
    ProcessPayment,
    PrintInvoice,
    GetInvoices,
    
    // Pharmacy operations
    CreateMedicine,
    UpdateMedicine,
    DispensePrescription,
    GetMedicines,
    GetPrescriptions,
    ReceiveStock,
    
    // Appointment operations
    CreateAppointment,
    UpdateAppointment,
    CancelAppointment,
    GetAppointments,
    CheckInPatient,
    CallNextPatient,
    GetQueue,
    
    // File operations
    UploadFile,
    DeleteFile,
    GetFiles,
    
    // Report operations
    GenerateReport,
    GetReports,
    
    // System operations
    Backup,
    Restore,
    HealthCheck,
    
    // M-Pesa operations
    InitiateStkPush,
    ProcessMpesaCallback,
    GetMpesaTransactions,
}

impl OperationType {
    pub fn estimated_duration(&self) -> Option<Duration> {
        match self {
            OperationType::CreatePatient => Some(Duration::from_secs(2)),
            OperationType::UpdatePatient => Some(Duration::from_secs(2)),
            OperationType::DeletePatient => Some(Duration::from_secs(1)),
            OperationType::GetPatients => Some(Duration::from_secs(3)),
            OperationType::SearchPatients => Some(Duration::from_secs(5)),
            
            OperationType::CreateUser => Some(Duration::from_secs(3)),
            OperationType::UpdateUser => Some(Duration::from_secs(2)),
            OperationType::DeleteUser => Some(Duration::from_secs(1)),
            OperationType::GetUsers => Some(Duration::from_secs(3)),
            OperationType::Login => Some(Duration::from_secs(2)),
            OperationType::Logout => Some(Duration::from_secs(1)),
            
            OperationType::CreateConsultation => Some(Duration::from_secs(5)),
            OperationType::UpdateConsultation => Some(Duration::from_secs(3)),
            OperationType::GetConsultations => Some(Duration::from_secs(4)),
            OperationType::AddPrescription => Some(Duration::from_secs(3)),
            
            OperationType::CreateInvoice => Some(Duration::from_secs(4)),
            OperationType::UpdateInvoice => Some(Duration::from_secs(3)),
            OperationType::ProcessPayment => Some(Duration::from_secs(10)),
            OperationType::PrintInvoice => Some(Duration::from_secs(5)),
            OperationType::GetInvoices => Some(Duration::from_secs(4)),
            
            OperationType::CreateMedicine => Some(Duration::from_secs(3)),
            OperationType::UpdateMedicine => Some(Duration::from_secs(2)),
            OperationType::DispensePrescription => Some(Duration::from_secs(5)),
            OperationType::GetMedicines => Some(Duration::from_secs(3)),
            OperationType::GetPrescriptions => Some(Duration::from_secs(4)),
            OperationType::ReceiveStock => Some(Duration::from_secs(4)),
            
            OperationType::CreateAppointment => Some(Duration::from_secs(3)),
            OperationType::UpdateAppointment => Some(Duration::from_secs(2)),
            OperationType::CancelAppointment => Some(Duration::from_secs(1)),
            OperationType::GetAppointments => Some(Duration::from_secs(4)),
            OperationType::CheckInPatient => Some(Duration::from_secs(2)),
            OperationType::CallNextPatient => Some(Duration::from_secs(1)),
            OperationType::GetQueue => Some(Duration::from_secs(2)),
            
            OperationType::UploadFile => Some(Duration::from_secs(10)),
            OperationType::DeleteFile => Some(Duration::from_secs(1)),
            OperationType::GetFiles => Some(Duration::from_secs(3)),
            
            OperationType::GenerateReport => Some(Duration::from_secs(15)),
            OperationType::GetReports => Some(Duration::from_secs(5)),
            
            OperationType::Backup => Some(Duration::from_secs(300)), // 5 minutes
            OperationType::Restore => Some(Duration::from_secs(600)), // 10 minutes
            OperationType::HealthCheck => Some(Duration::from_secs(1)),
            
            OperationType::InitiateStkPush => Some(Duration::from_secs(15)),
            OperationType::ProcessMpesaCallback => Some(Duration::from_secs(5)),
            OperationType::GetMpesaTransactions => Some(Duration::from_secs(3)),
        }
    }

    pub fn default_message(&self) -> String {
        match self {
            OperationType::CreatePatient => "Creating new patient record...".to_string(),
            OperationType::UpdatePatient => "Updating patient information...".to_string(),
            OperationType::DeletePatient => "Removing patient record...".to_string(),
            OperationType::GetPatients => "Retrieving patient list...".to_string(),
            OperationType::SearchPatients => "Searching for patients...".to_string(),
            
            OperationType::CreateUser => "Creating new user account...".to_string(),
            OperationType::UpdateUser => "Updating user information...".to_string(),
            OperationType::DeleteUser => "Removing user account...".to_string(),
            OperationType::GetUsers => "Retrieving user list...".to_string(),
            OperationType::Login => "Authenticating user...".to_string(),
            OperationType::Logout => "Logging out user...".to_string(),
            
            OperationType::CreateConsultation => "Creating consultation record...".to_string(),
            OperationType::UpdateConsultation => "Updating consultation details...".to_string(),
            OperationType::GetConsultations => "Retrieving consultation history...".to_string(),
            OperationType::AddPrescription => "Adding prescription to consultation...".to_string(),
            
            OperationType::CreateInvoice => "Generating invoice...".to_string(),
            OperationType::UpdateInvoice => "Updating invoice details...".to_string(),
            OperationType::ProcessPayment => "Processing payment...".to_string(),
            OperationType::PrintInvoice => "Generating invoice printout...".to_string(),
            OperationType::GetInvoices => "Retrieving invoice list...".to_string(),
            
            OperationType::CreateMedicine => "Adding new medicine to inventory...".to_string(),
            OperationType::UpdateMedicine => "Updating medicine information...".to_string(),
            OperationType::DispensePrescription => "Dispensing prescription...".to_string(),
            OperationType::GetMedicines => "Retrieving medicine list...".to_string(),
            OperationType::GetPrescriptions => "Retrieving prescription list...".to_string(),
            OperationType::ReceiveStock => "Processing stock receipt...".to_string(),
            
            OperationType::CreateAppointment => "Scheduling new appointment...".to_string(),
            OperationType::UpdateAppointment => "Updating appointment details...".to_string(),
            OperationType::CancelAppointment => "Cancelling appointment...".to_string(),
            OperationType::GetAppointments => "Retrieving appointment schedule...".to_string(),
            OperationType::CheckInPatient => "Checking in patient...".to_string(),
            OperationType::CallNextPatient => "Calling next patient...".to_string(),
            OperationType::GetQueue => "Retrieving patient queue...".to_string(),
            
            OperationType::UploadFile => "Uploading file...".to_string(),
            OperationType::DeleteFile => "Removing file...".to_string(),
            OperationType::GetFiles => "Retrieving file list...".to_string(),
            
            OperationType::GenerateReport => "Generating report...".to_string(),
            OperationType::GetReports => "Retrieving reports...".to_string(),
            
            OperationType::Backup => "Creating system backup...".to_string(),
            OperationType::Restore => "Restoring from backup...".to_string(),
            OperationType::HealthCheck => "Checking system health...".to_string(),
            
            OperationType::InitiateStkPush => "Initiating M-Pesa payment...".to_string(),
            OperationType::ProcessMpesaCallback => "Processing payment callback...".to_string(),
            OperationType::GetMpesaTransactions => "Retrieving payment history...".to_string(),
        }
    }
}

// API endpoints for loading state management
pub async fn get_operation_status(
    path: web::Path<String>,
    manager: web::Data<Arc<LoadingStateManager>>,
) -> Result<HttpResponse, ApiError> {
    let operation_id = path.into_inner();
    
    match manager.get_operation_status(&operation_id).await {
        Some(state) => Ok(HttpResponse::Ok().json(state)),
        None => Err(ApiError::not_found("Operation not found")),
    }
}

pub async fn get_user_operations(
    path: web::Path<String>,
    manager: web::Data<Arc<LoadingStateManager>>,
) -> Result<HttpResponse, ApiError> {
    let user_id = path.into_inner();
    let operations = manager.get_user_operations(&user_id).await;
    
    Ok(HttpResponse::Ok().json(operations))
}

pub async fn get_active_operations(
    manager: web::Data<Arc<LoadingStateManager>>,
) -> Result<HttpResponse, ApiError> {
    let operations = manager.get_active_operations().await;
    
    Ok(HttpResponse::Ok().json(operations))
}

pub async fn cancel_operation(
    path: web::Path<String>,
    manager: web::Data<Arc<LoadingStateManager>>,
) -> Result<HttpResponse, ApiError> {
    let operation_id = path.into_inner();
    
    manager
        .cancel_operation(&operation_id, Some("Cancelled by user".to_string()))
        .await?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Operation cancelled successfully"
    })))
}

pub async fn get_operation_count(
    manager: web::Data<Arc<LoadingStateManager>>,
) -> Result<HttpResponse, ApiError> {
    let count = manager.get_operation_count().await;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "total_operations": count
    })))
}

// Middleware for automatic loading state management
pub async fn loading_state_middleware(
    req: ServiceRequest,
    next: Next<impl MessageBody>,
) -> Result<ServiceResponse<impl MessageBody>, Error> {
    // This middleware would automatically track loading states for API calls
    // Implementation would depend on the specific requirements
    
    next.call(req).await
}

// Utility functions for common operations
pub async fn track_operation<F, R>(
    manager: Arc<LoadingStateManager>,
    operation_type: OperationType,
    user_id: Option<String>,
    operation: F,
) -> Result<R, ApiError>
where
    F: FnOnce(ProgressTracker) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<R, ApiError>> + Send>>,
{
    let operation_id = manager
        .start_operation(
            format!("{:?}", operation_type),
            user_id,
            operation_type.estimated_duration(),
            None,
        )
        .await;

    let tracker = ProgressTracker::new(
        operation_id.clone(),
        manager.clone(),
        1, // Default to 1 step
    );

    match operation(tracker).await {
        Ok(result) => {
            manager
                .complete_operation(&operation_id, Some("Operation completed successfully".to_string()))
                .await?;
            Ok(result)
        }
        Err(error) => {
            let error_message = error.message.clone();
            manager
                .fail_operation(&operation_id, error_message)
                .await?;
            Err(error)
        }
    }
}

// Helper macro for easy operation tracking
#[macro_export]
macro_rules! track_operation {
    ($manager:expr, $operation_type:expr, $user_id:expr, $operation:expr) => {
        crate::loading_states::track_operation(
            $manager,
            $operation_type,
            $user_id,
            |tracker| Box::pin($operation(tracker)),
        )
    };
}
