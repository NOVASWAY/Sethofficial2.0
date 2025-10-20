use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use tracing::{info, warn, debug, error};
use sqlx::{PgPool, Row};
use chrono::{DateTime, Utc};

/// HIPAA compliance requirements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HipaaCompliance {
    pub administrative_safeguards: AdministrativeSafeguards,
    pub physical_safeguards: PhysicalSafeguards,
    pub technical_safeguards: TechnicalSafeguards,
    pub audit_controls: AuditControls,
    pub data_integrity: DataIntegrity,
    pub access_control: AccessControl,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdministrativeSafeguards {
    pub security_officer_assigned: bool,
    pub workforce_training_completed: bool,
    pub access_management_procedures: bool,
    pub contingency_plan: bool,
    pub business_associate_agreements: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhysicalSafeguards {
    pub facility_access_controls: bool,
    pub workstation_use_restrictions: bool,
    pub device_media_controls: bool,
    pub disposal_procedures: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechnicalSafeguards {
    pub access_control_implementation: bool,
    pub audit_controls_implementation: bool,
    pub integrity_controls: bool,
    pub transmission_security: bool,
    pub encryption_at_rest: bool,
    pub encryption_in_transit: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditControls {
    pub audit_logging_enabled: bool,
    pub log_retention_policy: String,
    pub log_monitoring_enabled: bool,
    pub access_logging_enabled: bool,
    pub data_modification_logging: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataIntegrity {
    pub data_validation_enabled: bool,
    pub checksum_verification: bool,
    pub backup_verification: bool,
    pub data_corruption_detection: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessControl {
    pub role_based_access: bool,
    pub multi_factor_authentication: bool,
    pub session_timeout: bool,
    pub password_policy_enforced: bool,
    pub privilege_escalation_logging: bool,
}

/// GDPR compliance requirements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GdprCompliance {
    pub data_protection_by_design: bool,
    pub data_minimization: bool,
    pub purpose_limitation: bool,
    pub storage_limitation: bool,
    pub accuracy_requirement: bool,
    pub confidentiality_integrity: bool,
    pub accountability: bool,
    pub consent_management: bool,
    pub data_portability: bool,
    pub right_to_erasure: bool,
    pub data_breach_notification: bool,
    pub privacy_impact_assessment: bool,
}

/// Audit event types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "varchar")]
pub enum AuditEventType {
    // Authentication events
    Login,
    Logout,
    LoginFailed,
    PasswordChanged,
    PasswordReset,
    
    // Data access events
    PatientDataAccessed,
    PatientDataCreated,
    PatientDataUpdated,
    PatientDataDeleted,
    PatientDataExported,
    
    // User management events
    UserCreated,
    UserUpdated,
    UserDeleted,
    UserRoleChanged,
    UserPermissionsChanged,
    
    // System events
    SystemStartup,
    SystemShutdown,
    DatabaseBackup,
    DatabaseRestore,
    ConfigurationChanged,
    SecurityPolicyChanged,
    
    // File operations
    FileUploaded,
    FileDownloaded,
    FileDeleted,
    FileScanned,
    
    // Session events
    SessionCreated,
    SessionExpired,
    SessionTerminated,
    
    // Compliance events
    ComplianceCheck,
    DataRetentionPolicyApplied,
    DataAnonymization,
    ConsentGiven,
    ConsentWithdrawn,
}

/// Audit event severity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "varchar")]
pub enum AuditSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Comprehensive audit event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: String,
    pub event_type: AuditEventType,
    pub severity: AuditSeverity,
    pub timestamp: DateTime<Utc>,
    pub user_id: Option<String>,
    pub user_name: Option<String>,
    pub user_role: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub resource_type: Option<String>,
    pub resource_id: Option<String>,
    pub action: String,
    pub description: String,
    pub old_values: Option<serde_json::Value>,
    pub new_values: Option<serde_json::Value>,
    pub success: bool,
    pub error_message: Option<String>,
    pub session_id: Option<String>,
    pub request_id: Option<String>,
    pub additional_context: Option<HashMap<String, serde_json::Value>>,
}

/// Compliance and audit service
pub struct ComplianceService {
    pool: PgPool,
    hipaa_compliance: HipaaCompliance,
    gdpr_compliance: GdprCompliance,
}

impl ComplianceService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            hipaa_compliance: Self::get_default_hipaa_compliance(),
            gdpr_compliance: Self::get_default_gdpr_compliance(),
        }
    }

    /// Get default HIPAA compliance configuration
    fn get_default_hipaa_compliance() -> HipaaCompliance {
        HipaaCompliance {
            administrative_safeguards: AdministrativeSafeguards {
                security_officer_assigned: true,
                workforce_training_completed: true,
                access_management_procedures: true,
                contingency_plan: true,
                business_associate_agreements: true,
            },
            physical_safeguards: PhysicalSafeguards {
                facility_access_controls: true,
                workstation_use_restrictions: true,
                device_media_controls: true,
                disposal_procedures: true,
            },
            technical_safeguards: TechnicalSafeguards {
                access_control_implementation: true,
                audit_controls_implementation: true,
                integrity_controls: true,
                transmission_security: true,
                encryption_at_rest: true,
                encryption_in_transit: true,
            },
            audit_controls: AuditControls {
                audit_logging_enabled: true,
                log_retention_policy: "7 years".to_string(),
                log_monitoring_enabled: true,
                access_logging_enabled: true,
                data_modification_logging: true,
            },
            data_integrity: DataIntegrity {
                data_validation_enabled: true,
                checksum_verification: true,
                backup_verification: true,
                data_corruption_detection: true,
            },
            access_control: AccessControl {
                role_based_access: true,
                multi_factor_authentication: false, // Can be enabled as needed
                session_timeout: true,
                password_policy_enforced: true,
                privilege_escalation_logging: true,
            },
        }
    }

    /// Get default GDPR compliance configuration
    fn get_default_gdpr_compliance() -> GdprCompliance {
        GdprCompliance {
            data_protection_by_design: true,
            data_minimization: true,
            purpose_limitation: true,
            storage_limitation: true,
            accuracy_requirement: true,
            confidentiality_integrity: true,
            accountability: true,
            consent_management: true,
            data_portability: true,
            right_to_erasure: true,
            data_breach_notification: true,
            privacy_impact_assessment: true,
        }
    }

    /// Log an audit event
    pub async fn log_audit_event(&self, event: AuditEvent) -> Result<(), sqlx::Error> {
        let query = r#"
            INSERT INTO audit_events (
                id, event_type, severity, timestamp, user_id, user_name, user_role,
                ip_address, user_agent, resource_type, resource_id, action, description,
                old_values, new_values, success, error_message, session_id, request_id,
                additional_context
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
            )
        "#;

        sqlx::query(query)
            .bind(&event.id)
            .bind(&format!("{:?}", event.event_type))
            .bind(&format!("{:?}", event.severity))
            .bind(&event.timestamp)
            .bind(&event.user_id)
            .bind(&event.user_name)
            .bind(&event.user_role)
            .bind(&event.ip_address)
            .bind(&event.user_agent)
            .bind(&event.resource_type)
            .bind(&event.resource_id)
            .bind(&event.action)
            .bind(&event.description)
            .bind(&event.old_values)
            .bind(&event.new_values)
            .bind(&event.success)
            .bind(&event.error_message)
            .bind(&event.session_id)
            .bind(&event.request_id)
            .bind(&event.additional_context.as_ref().map(|ctx| serde_json::to_string(ctx).unwrap_or_default()))
            .execute(&self.pool)
            .await?;

        // Log to tracing as well
        match event.severity {
            AuditSeverity::Critical => error!("🔴 CRITICAL AUDIT: {:?} - {}", event.event_type, event.description),
            AuditSeverity::High => warn!("🟠 HIGH AUDIT: {:?} - {}", event.event_type, event.description),
            AuditSeverity::Medium => info!("🟡 MEDIUM AUDIT: {:?} - {}", event.event_type, event.description),
            AuditSeverity::Low => debug!("🟢 LOW AUDIT: {:?} - {}", event.event_type, event.description),
        }

        Ok(())
    }

    /// Get audit events with filtering
    pub async fn get_audit_events(
        &self,
        limit: Option<i64>,
        offset: Option<i64>,
        event_type: Option<AuditEventType>,
        severity: Option<AuditSeverity>,
        user_id: Option<&str>,
        start_date: Option<DateTime<Utc>>,
        end_date: Option<DateTime<Utc>>,
    ) -> Result<Vec<AuditEvent>, sqlx::Error> {
        // For now, just get all audit events with basic filtering
        // TODO: Implement proper parameterized queries
        let query = "SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT $1 OFFSET $2";
        let limit_val = limit.unwrap_or(100);
        let offset_val = offset.unwrap_or(0);
        
        let rows = sqlx::query(query)
            .bind(limit_val)
            .bind(offset_val)
            .fetch_all(&self.pool)
            .await?;
        let mut events = Vec::new();

        for row in rows {
            events.push(AuditEvent {
                id: row.get("id"),
                event_type: row.get("event_type"),
                severity: row.get("severity"),
                timestamp: row.get("timestamp"),
                user_id: row.get("user_id"),
                user_name: row.get("user_name"),
                user_role: row.get("user_role"),
                ip_address: row.get("ip_address"),
                user_agent: row.get("user_agent"),
                resource_type: row.get("resource_type"),
                resource_id: row.get("resource_id"),
                action: row.get("action"),
                description: row.get("description"),
                old_values: row.get("old_values"),
                new_values: row.get("new_values"),
                success: row.get("success"),
                error_message: row.get("error_message"),
                session_id: row.get("session_id"),
                request_id: row.get("request_id"),
                additional_context: row.get::<Option<String>, _>("additional_context")
                    .and_then(|s| serde_json::from_str(&s).ok()),
            });
        }

        Ok(events)
    }

    /// Get compliance status
    pub fn get_compliance_status(&self) -> serde_json::Value {
        serde_json::json!({
            "hipaa": self.hipaa_compliance,
            "gdpr": self.gdpr_compliance,
            "last_updated": Utc::now(),
            "compliance_score": self.calculate_compliance_score()
        })
    }

    /// Calculate overall compliance score
    fn calculate_compliance_score(&self) -> f64 {
        let mut score = 0.0;
        let mut total_checks = 0;

        // HIPAA Administrative Safeguards (20%)
        let admin_score = [
            self.hipaa_compliance.administrative_safeguards.security_officer_assigned,
            self.hipaa_compliance.administrative_safeguards.workforce_training_completed,
            self.hipaa_compliance.administrative_safeguards.access_management_procedures,
            self.hipaa_compliance.administrative_safeguards.contingency_plan,
            self.hipaa_compliance.administrative_safeguards.business_associate_agreements,
        ].iter().filter(|&&x| x).count() as f64 / 5.0;
        score += admin_score * 0.2;
        total_checks += 5;

        // HIPAA Physical Safeguards (15%)
        let physical_score = [
            self.hipaa_compliance.physical_safeguards.facility_access_controls,
            self.hipaa_compliance.physical_safeguards.workstation_use_restrictions,
            self.hipaa_compliance.physical_safeguards.device_media_controls,
            self.hipaa_compliance.physical_safeguards.disposal_procedures,
        ].iter().filter(|&&x| x).count() as f64 / 4.0;
        score += physical_score * 0.15;
        total_checks += 4;

        // HIPAA Technical Safeguards (25%)
        let technical_score = [
            self.hipaa_compliance.technical_safeguards.access_control_implementation,
            self.hipaa_compliance.technical_safeguards.audit_controls_implementation,
            self.hipaa_compliance.technical_safeguards.integrity_controls,
            self.hipaa_compliance.technical_safeguards.transmission_security,
            self.hipaa_compliance.technical_safeguards.encryption_at_rest,
            self.hipaa_compliance.technical_safeguards.encryption_in_transit,
        ].iter().filter(|&&x| x).count() as f64 / 6.0;
        score += technical_score * 0.25;
        total_checks += 6;

        // GDPR Compliance (40%)
        let gdpr_score = [
            self.gdpr_compliance.data_protection_by_design,
            self.gdpr_compliance.data_minimization,
            self.gdpr_compliance.purpose_limitation,
            self.gdpr_compliance.storage_limitation,
            self.gdpr_compliance.accuracy_requirement,
            self.gdpr_compliance.confidentiality_integrity,
            self.gdpr_compliance.accountability,
            self.gdpr_compliance.consent_management,
            self.gdpr_compliance.data_portability,
            self.gdpr_compliance.right_to_erasure,
            self.gdpr_compliance.data_breach_notification,
            self.gdpr_compliance.privacy_impact_assessment,
        ].iter().filter(|&&x| x).count() as f64 / 12.0;
        score += gdpr_score * 0.4;
        total_checks += 12;

        (score * 100.0).round() / 100.0
    }

    /// Generate compliance report
    pub async fn generate_compliance_report(&self) -> Result<serde_json::Value, sqlx::Error> {
        let audit_events_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM audit_events")
            .fetch_one(&self.pool)
            .await?;

        let recent_audit_events = self.get_audit_events(Some(100), Some(0), None, None, None, None, None).await?;

        let critical_events = recent_audit_events.iter()
            .filter(|e| e.severity == AuditSeverity::Critical)
            .count();

        let high_events = recent_audit_events.iter()
            .filter(|e| e.severity == AuditSeverity::High)
            .count();

        let failed_events = recent_audit_events.iter()
            .filter(|e| !e.success)
            .count();

        Ok(serde_json::json!({
            "report_generated_at": Utc::now(),
            "compliance_status": self.get_compliance_status(),
            "audit_summary": {
                "total_audit_events": audit_events_count,
                "recent_events_analyzed": recent_audit_events.len(),
                "critical_events": critical_events,
                "high_severity_events": high_events,
                "failed_events": failed_events,
                "compliance_score": self.calculate_compliance_score()
            },
            "recommendations": self.generate_recommendations(critical_events, high_events, failed_events),
            "next_review_date": (Utc::now() + chrono::Duration::days(30)).format("%Y-%m-%d").to_string()
        }))
    }

    /// Generate compliance recommendations
    fn generate_recommendations(&self, critical_events: usize, high_events: usize, failed_events: usize) -> Vec<String> {
        let mut recommendations = Vec::new();

        if critical_events > 0 {
            recommendations.push("🔴 URGENT: Address critical audit events immediately".to_string());
        }

        if high_events > 5 {
            recommendations.push("🟠 HIGH: Review and address high-severity audit events".to_string());
        }

        if failed_events > 10 {
            recommendations.push("🟡 MEDIUM: Investigate failed audit events for potential security issues".to_string());
        }

        if !self.hipaa_compliance.access_control.multi_factor_authentication {
            recommendations.push("🔐 Consider implementing multi-factor authentication for enhanced security".to_string());
        }

        if self.calculate_compliance_score() < 90.0 {
            recommendations.push("📊 Review compliance configuration to improve overall score".to_string());
        }

        if recommendations.is_empty() {
            recommendations.push("✅ All compliance checks are passing. Continue monitoring.".to_string());
        }

        recommendations
    }

    /// Create audit event builder for easy event creation
    pub fn create_audit_event(&self) -> AuditEventBuilder {
        AuditEventBuilder::new()
    }
}

/// Builder pattern for creating audit events
pub struct AuditEventBuilder {
    event: AuditEvent,
}

impl AuditEventBuilder {
    pub fn new() -> Self {
        Self {
            event: AuditEvent {
                id: uuid::Uuid::new_v4().to_string(),
                event_type: AuditEventType::SystemStartup,
                severity: AuditSeverity::Low,
                timestamp: Utc::now(),
                user_id: None,
                user_name: None,
                user_role: None,
                ip_address: None,
                user_agent: None,
                resource_type: None,
                resource_id: None,
                action: String::new(),
                description: String::new(),
                old_values: None,
                new_values: None,
                success: true,
                error_message: None,
                session_id: None,
                request_id: None,
                additional_context: None,
            },
        }
    }

    pub fn event_type(mut self, event_type: AuditEventType) -> Self {
        self.event.event_type = event_type;
        self
    }

    pub fn severity(mut self, severity: AuditSeverity) -> Self {
        self.event.severity = severity;
        self
    }

    pub fn user_info(mut self, user_id: String, user_name: String, user_role: String) -> Self {
        self.event.user_id = Some(user_id);
        self.event.user_name = Some(user_name);
        self.event.user_role = Some(user_role);
        self
    }

    pub fn request_info(mut self, ip_address: String, user_agent: String, session_id: Option<String>) -> Self {
        self.event.ip_address = Some(ip_address);
        self.event.user_agent = Some(user_agent);
        self.event.session_id = session_id;
        self
    }

    pub fn resource(mut self, resource_type: String, resource_id: String) -> Self {
        self.event.resource_type = Some(resource_type);
        self.event.resource_id = Some(resource_id);
        self
    }

    pub fn action(mut self, action: String, description: String) -> Self {
        self.event.action = action;
        self.event.description = description;
        self
    }

    pub fn data_changes(mut self, old_values: Option<serde_json::Value>, new_values: Option<serde_json::Value>) -> Self {
        self.event.old_values = old_values;
        self.event.new_values = new_values;
        self
    }

    pub fn success(mut self, success: bool) -> Self {
        self.event.success = success;
        self
    }

    pub fn error_message(mut self, error_message: Option<String>) -> Self {
        self.event.error_message = error_message;
        self
    }

    pub fn request_id(mut self, request_id: String) -> Self {
        self.event.request_id = Some(request_id);
        self
    }

    pub fn additional_context(mut self, context: HashMap<String, serde_json::Value>) -> Self {
        self.event.additional_context = Some(context);
        self
    }

    pub fn build(self) -> AuditEvent {
        self.event
    }
}

/// Data retention policy management
pub struct DataRetentionService {
    pool: PgPool,
}

impl DataRetentionService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Apply data retention policies
    pub async fn apply_retention_policies(&self) -> Result<serde_json::Value, sqlx::Error> {
        let mut results = serde_json::json!({
            "applied_at": Utc::now(),
            "policies_applied": []
        });

        // Delete old audit events (keep for 7 years as per HIPAA)
        let audit_retention_date = Utc::now() - chrono::Duration::days(2555); // 7 years
        let deleted_audit_events = sqlx::query_scalar::<_, i64>(
            "DELETE FROM audit_events WHERE timestamp < $1 RETURNING COUNT(*)"
        )
        .bind(audit_retention_date)
        .fetch_one(&self.pool)
        .await?;

        results["policies_applied"].as_array_mut().unwrap().push(
            serde_json::json!({
                "policy": "audit_events_retention",
                "retention_period": "7 years",
                "records_deleted": deleted_audit_events
            })
        );

        // Anonymize old patient data (keep for 6 years after last visit)
        let patient_anonymization_date = Utc::now() - chrono::Duration::days(2190); // 6 years
        let anonymized_patients = sqlx::query_scalar::<_, i64>(
            "UPDATE patients SET 
                name = 'ANONYMIZED', 
                email = NULL, 
                phone = NULL, 
                address = NULL, 
                emergency_contact = NULL,
                medical_history = 'ANONYMIZED',
                insurance_info = 'ANONYMIZED'
            WHERE updated_at < $1 AND name != 'ANONYMIZED' 
            RETURNING COUNT(*)"
        )
        .bind(patient_anonymization_date)
        .fetch_one(&self.pool)
        .await?;

        results["policies_applied"].as_array_mut().unwrap().push(
            serde_json::json!({
                "policy": "patient_data_anonymization",
                "retention_period": "6 years after last update",
                "records_anonymized": anonymized_patients
            })
        );

        Ok(results)
    }

    /// Get data retention statistics
    pub async fn get_retention_stats(&self) -> Result<serde_json::Value, sqlx::Error> {
        let total_audit_events = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM audit_events")
            .fetch_one(&self.pool)
            .await?;

        let old_audit_events = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM audit_events WHERE timestamp < $1"
        )
        .bind(Utc::now() - chrono::Duration::days(2555))
        .fetch_one(&self.pool)
        .await?;

        let total_patients = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM patients")
            .fetch_one(&self.pool)
            .await?;

        let anonymized_patients = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM patients WHERE name = 'ANONYMIZED'"
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(serde_json::json!({
            "audit_events": {
                "total": total_audit_events,
                "eligible_for_deletion": old_audit_events,
                "retention_period": "7 years"
            },
            "patient_data": {
                "total": total_patients,
                "anonymized": anonymized_patients,
                "retention_period": "6 years after last update"
            },
            "last_updated": Utc::now()
        }))
    }
}
