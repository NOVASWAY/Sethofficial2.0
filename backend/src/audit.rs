use sqlx::{PgPool, Row};
use serde::{Deserialize, Serialize};
use chrono::Utc;
use uuid::Uuid;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum AuditAction {
    // User actions
    UserLogin,
    UserLogout,
    UserCreate,
    UserUpdate,
    UserDelete,
    
    // Patient actions
    PatientCreate,
    PatientUpdate,
    PatientDelete,
    PatientView,
    
    // Appointment actions
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentCancel,
    AppointmentComplete,
    AppointmentView,
    
    // Medication actions
    MedicationCreate,
    MedicationUpdate,
    MedicationDelete,
    MedicationDispense,
    MedicationView,
    
    // Invoice actions
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceDelete,
    InvoicePay,
    InvoiceView,
    
    // System actions
    SystemBackup,
    SystemRestore,
    SystemConfig,
    SettingsUpdate,
    SettingsDelete,
    
    // Security actions
    SecurityViolation,
    AccessDenied,
    PasswordChange,
    RoleChange,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum AuditResource {
    User,
    Patient,
    Appointment,
    Medication,
    Invoice,
    System,
    SystemSettings,
    UserSettings,
    Security,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum AuditResult {
    Success,
    Failure,
    Partial,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuditLog {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub session_id: Option<String>,
    pub action: AuditAction,
    pub resource: AuditResource,
    pub resource_id: Option<String>,
    pub result: AuditResult,
    pub details: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub request_id: Option<String>,
    pub timestamp: chrono::DateTime<Utc>,
}

impl AuditLog {
    pub fn new(
        user_id: Option<Uuid>,
        session_id: Option<String>,
        action: AuditAction,
        resource: AuditResource,
        resource_id: Option<String>,
        result: AuditResult,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            user_id,
            session_id,
            action,
            resource,
            resource_id,
            result,
            details: None,
            ip_address: None,
            user_agent: None,
            request_id: None,
            timestamp: Utc::now(),
        }
    }
    
    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }
    
    pub fn with_ip_address(mut self, ip_address: String) -> Self {
        self.ip_address = Some(ip_address);
        self
    }
    
    pub fn with_user_agent(mut self, user_agent: String) -> Self {
        self.user_agent = Some(user_agent);
        self
    }
    
    pub fn with_request_id(mut self, request_id: String) -> Self {
        self.request_id = Some(request_id);
        self
    }
}

pub struct AuditLogger {
    pool: PgPool,
}

impl AuditLogger {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
    
    pub async fn log(&self, audit_log: AuditLog) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "INSERT INTO audit_logs (
                id, user_id, session_id, action, resource, resource_id, 
                result, details, ip_address, user_agent, request_id, timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
            audit_log.id,
            audit_log.user_id,
            audit_log.session_id,
            serde_json::to_value(&audit_log.action).map_err(|e| sqlx::Error::Decode(Box::new(e)))?,
            serde_json::to_value(&audit_log.resource).map_err(|e| sqlx::Error::Decode(Box::new(e)))?,
            audit_log.resource_id,
            serde_json::to_value(&audit_log.result).map_err(|e| sqlx::Error::Decode(Box::new(e)))?,
            audit_log.details,
            audit_log.ip_address,
            audit_log.user_agent,
            audit_log.request_id,
            audit_log.timestamp
        )
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
    
    pub async fn log_user_action(
        &self,
        user_id: Option<Uuid>,
        session_id: Option<String>,
        action: AuditAction,
        resource: AuditResource,
        resource_id: Option<String>,
        result: AuditResult,
        details: Option<serde_json::Value>,
        ip_address: Option<String>,
        user_agent: Option<String>,
        request_id: Option<String>,
    ) -> Result<(), sqlx::Error> {
        let audit_log = AuditLog::new(user_id, session_id, action, resource, resource_id, result)
            .with_details(details.unwrap_or(serde_json::Value::Null))
            .with_ip_address(ip_address.unwrap_or_default())
            .with_user_agent(user_agent.unwrap_or_default())
            .with_request_id(request_id.unwrap_or_default());
        
        self.log(audit_log).await
    }
    
    pub async fn log_security_event(
        &self,
        user_id: Option<Uuid>,
        session_id: Option<String>,
        action: AuditAction,
        details: serde_json::Value,
        ip_address: Option<String>,
        user_agent: Option<String>,
        request_id: Option<String>,
    ) -> Result<(), sqlx::Error> {
        self.log_user_action(
            user_id,
            session_id,
            action,
            AuditResource::Security,
            None,
            AuditResult::Failure,
            Some(details),
            ip_address,
            user_agent,
            request_id,
        ).await
    }
    
    pub async fn log_business_action(
        &self,
        user_id: Option<Uuid>,
        session_id: Option<String>,
        action: AuditAction,
        resource: AuditResource,
        resource_id: Option<String>,
        result: AuditResult,
        details: Option<serde_json::Value>,
        ip_address: Option<String>,
        user_agent: Option<String>,
        request_id: Option<String>,
    ) -> Result<(), sqlx::Error> {
        self.log_user_action(
            user_id,
            session_id,
            action,
            resource,
            resource_id,
            result,
            details,
            ip_address,
            user_agent,
            request_id,
        ).await
    }
}

// Audit log queries
pub async fn get_audit_logs(
    pool: &PgPool,
    user_id: Option<Uuid>,
    action: Option<AuditAction>,
    resource: Option<AuditResource>,
    start_date: Option<chrono::DateTime<Utc>>,
    end_date: Option<chrono::DateTime<Utc>>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<AuditLog>, sqlx::Error> {
    let mut query = sqlx::QueryBuilder::new(
        "SELECT id, user_id, session_id, action, resource, resource_id, 
         result, details, ip_address, user_agent, request_id, timestamp 
         FROM audit_logs WHERE 1=1"
    );
    
    if let Some(user_id) = user_id {
        query.push(" AND user_id = ");
        query.push_bind(user_id);
    }
    
    if let Some(action) = action {
        query.push(" AND action = ");
        query.push_bind(serde_json::to_value(&action).map_err(|e| sqlx::Error::Decode(Box::new(e)))?);
    }
    
    if let Some(resource) = resource {
        query.push(" AND resource = ");
        query.push_bind(serde_json::to_value(&resource).map_err(|e| sqlx::Error::Decode(Box::new(e)))?);
    }
    
    if let Some(start_date) = start_date {
        query.push(" AND timestamp >= ");
        query.push_bind(start_date);
    }
    
    if let Some(end_date) = end_date {
        query.push(" AND timestamp <= ");
        query.push_bind(end_date);
    }
    
    query.push(" ORDER BY timestamp DESC");
    
    if let Some(limit) = limit {
        query.push(" LIMIT ");
        query.push_bind(limit);
    }
    
    if let Some(offset) = offset {
        query.push(" OFFSET ");
        query.push_bind(offset);
    }
    
    let rows = query.build().fetch_all(pool).await?;
    
    let mut audit_logs = Vec::new();
    for row in rows {
        let audit_log = AuditLog {
            id: row.get("id"),
            user_id: row.get("user_id"),
            session_id: row.get("session_id"),
            action: serde_json::from_value(row.get("action")).map_err(|e| sqlx::Error::Decode(Box::new(e)))?,
            resource: serde_json::from_value(row.get("resource")).map_err(|e| sqlx::Error::Decode(Box::new(e)))?,
            resource_id: row.get("resource_id"),
            result: serde_json::from_value(row.get("result")).map_err(|e| sqlx::Error::Decode(Box::new(e)))?,
            details: row.get("details"),
            ip_address: row.get("ip_address"),
            user_agent: row.get("user_agent"),
            request_id: row.get("request_id"),
            timestamp: row.get("timestamp"),
        };
        audit_logs.push(audit_log);
    }
    
    Ok(audit_logs)
}

// Audit log statistics
pub async fn get_audit_statistics(
    pool: &PgPool,
    start_date: Option<chrono::DateTime<Utc>>,
    end_date: Option<chrono::DateTime<Utc>>,
) -> Result<HashMap<String, i64>, sqlx::Error> {
    let mut query = sqlx::QueryBuilder::new(
        "SELECT action, COUNT(*) as count FROM audit_logs WHERE 1=1"
    );
    
    if let Some(start_date) = start_date {
        query.push(" AND timestamp >= ");
        query.push_bind(start_date);
    }
    
    if let Some(end_date) = end_date {
        query.push(" AND timestamp <= ");
        query.push_bind(end_date);
    }
    
    query.push(" GROUP BY action ORDER BY count DESC");
    
    let rows = query.build().fetch_all(pool).await?;
    
    let mut stats = HashMap::new();
    for row in rows {
        let action: serde_json::Value = row.get("action");
        let count: i64 = row.get("count");
        stats.insert(action.to_string(), count);
    }
    
    Ok(stats)
}

// Security audit functions
pub async fn log_failed_login(
    audit_logger: &AuditLogger,
    username: &str,
    ip_address: Option<String>,
    user_agent: Option<String>,
    request_id: Option<String>,
) -> Result<(), sqlx::Error> {
    let details = serde_json::json!({
        "username": username,
        "reason": "Invalid credentials"
    });
    
    audit_logger.log_security_event(
        None,
        None,
        AuditAction::UserLogin,
        details,
        ip_address,
        user_agent,
        request_id,
    ).await
}

pub async fn log_successful_login(
    audit_logger: &AuditLogger,
    user_id: Uuid,
    session_id: String,
    ip_address: Option<String>,
    user_agent: Option<String>,
    request_id: Option<String>,
) -> Result<(), sqlx::Error> {
    let details = serde_json::json!({
        "login_time": Utc::now(),
        "session_created": true
    });
    
    audit_logger.log_user_action(
        Some(user_id),
        Some(session_id),
        AuditAction::UserLogin,
        AuditResource::User,
        Some(user_id.to_string()),
        AuditResult::Success,
        Some(details),
        ip_address,
        user_agent,
        request_id,
    ).await
}

pub async fn log_access_denied(
    audit_logger: &AuditLogger,
    user_id: Option<Uuid>,
    session_id: Option<String>,
    resource: &str,
    action: &str,
    ip_address: Option<String>,
    user_agent: Option<String>,
    request_id: Option<String>,
) -> Result<(), sqlx::Error> {
    let details = serde_json::json!({
        "resource": resource,
        "attempted_action": action,
        "reason": "Insufficient permissions"
    });
    
    audit_logger.log_security_event(
        user_id,
        session_id,
        AuditAction::AccessDenied,
        details,
        ip_address,
        user_agent,
        request_id,
    ).await
}
