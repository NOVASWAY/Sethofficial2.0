use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use uuid::Uuid;
use chrono::{DateTime, Utc, NaiveDateTime};
use lettre::{
    message::{header::ContentType, Mailbox},
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};
use twilio::{Client as TwilioClient, OutboundMessage};
use sqlx::{PgPool, Row};
use crate::error::ApiError;

/// Notification types that can be sent
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NotificationType {
    Email,
    Sms,
    Push,
    InApp,
}

/// Notification priority levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NotificationPriority {
    Low,
    Normal,
    High,
    Urgent,
}

/// Notification status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NotificationStatus {
    Pending,
    Sent,
    Delivered,
    Failed,
    Cancelled,
}

/// Template types for different notification scenarios
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum NotificationTemplate {
    AppointmentReminder,
    AppointmentConfirmation,
    AppointmentCancellation,
    PaymentConfirmation,
    PaymentReminder,
    PrescriptionReady,
    TestResultsReady,
    WelcomeMessage,
    PasswordReset,
    AccountActivation,
    Custom,
}

/// Notification request structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationRequest {
    pub id: String,
    pub recipient_id: Option<String>,
    pub recipient_email: Option<String>,
    pub recipient_phone: Option<String>,
    pub notification_type: NotificationType,
    pub template: NotificationTemplate,
    pub subject: Option<String>,
    pub content: String,
    pub priority: NotificationPriority,
    pub scheduled_at: Option<u64>,
    pub metadata: HashMap<String, serde_json::Value>,
    pub created_at: u64,
    pub created_by: Option<String>,
}

/// Notification record for database storage
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NotificationRecord {
    pub id: Uuid,
    pub recipient_id: Option<Uuid>,
    pub recipient_email: Option<String>,
    pub recipient_phone: Option<String>,
    pub notification_type: String,
    pub template: String,
    pub subject: Option<String>,
    pub content: String,
    pub priority: String,
    pub status: String,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub sent_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub failed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
    pub updated_at: DateTime<Utc>,
}

/// Email configuration
#[derive(Debug, Clone)]
pub struct EmailConfig {
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_username: String,
    pub smtp_password: String,
    pub from_email: String,
    pub from_name: String,
    pub use_tls: bool,
}

/// SMS configuration
#[derive(Debug, Clone)]
pub struct SmsConfig {
    pub twilio_account_sid: String,
    pub twilio_auth_token: String,
    pub twilio_phone_number: String,
    pub enabled: bool,
}

/// Notification service configuration
#[derive(Debug, Clone)]
pub struct NotificationConfig {
    pub email: EmailConfig,
    pub sms: SmsConfig,
    pub max_retry_attempts: u32,
    pub retry_delay_seconds: u64,
    pub batch_size: usize,
    pub enable_logging: bool,
}

/// Notification service implementation
pub struct NotificationService {
    config: NotificationConfig,
    email_transport: Option<AsyncSmtpTransport<Tokio1Executor>>,
    twilio_client: Option<TwilioClient>,
    templates: Arc<RwLock<HashMap<NotificationTemplate, NotificationTemplateData>>>,
    queue: Arc<RwLock<Vec<NotificationRequest>>>,
    database: PgPool,
}

/// Template data structure
#[derive(Debug, Clone)]
pub struct NotificationTemplateData {
    pub subject_template: String,
    pub content_template: String,
    pub variables: Vec<String>,
}

impl NotificationService {
    /// Create a new notification service
    pub fn new(config: NotificationConfig, database: PgPool) -> Self {
        let email_transport = if !config.email.smtp_host.is_empty() {
            let creds = Credentials::new(
                config.email.smtp_username.clone(),
                config.email.smtp_password.clone(),
            );

            let mut transport_builder = AsyncSmtpTransport::<Tokio1Executor>::relay(&config.email.smtp_host)
                .unwrap()
                .port(config.email.smtp_port)
                .credentials(creds);

            if config.email.use_tls {
                match lettre::transport::smtp::client::TlsParameters::new_rustls(config.email.smtp_host.clone()) {
                    Ok(tls_params) => {
                        transport_builder = transport_builder.tls(lettre::transport::smtp::client::Tls::Required(tls_params));
                    }
                    Err(e) => {
                        eprintln!("Warning: Failed to create TLS parameters: {}", e);
                        // Continue without TLS
                    }
                }
            }

            Some(transport_builder.build())
        } else {
            None
        };

        let twilio_client = if config.sms.enabled && !config.sms.twilio_account_sid.is_empty() {
            Some(TwilioClient::new(
                &config.sms.twilio_account_sid,
                &config.sms.twilio_auth_token,
            ))
        } else {
            None
        };

        Self {
            config,
            email_transport,
            twilio_client,
            templates: Arc::new(RwLock::new(HashMap::new())),
            queue: Arc::new(RwLock::new(Vec::new())),
            database,
        }
    }

    /// Load configuration from environment variables
    pub async fn from_env(database: PgPool) -> Result<Self, ApiError> {
        let email_config = EmailConfig {
            smtp_host: std::env::var("SMTP_HOST").unwrap_or_default(),
            smtp_port: std::env::var("SMTP_PORT")
                .unwrap_or_else(|_| "587".to_string())
                .parse()
                .map_err(|_| ApiError::internal_error(Some("Invalid SMTP port".to_string())))?,
            smtp_username: std::env::var("SMTP_USERNAME").unwrap_or_default(),
            smtp_password: std::env::var("SMTP_PASSWORD").unwrap_or_default(),
            from_email: std::env::var("FROM_EMAIL").unwrap_or_else(|_| "noreply@clinic.com".to_string()),
            from_name: std::env::var("FROM_NAME").unwrap_or_else(|_| "Clinic Management".to_string()),
            use_tls: std::env::var("SMTP_USE_TLS")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
        };

        let sms_config = SmsConfig {
            twilio_account_sid: std::env::var("TWILIO_ACCOUNT_SID").unwrap_or_default(),
            twilio_auth_token: std::env::var("TWILIO_AUTH_TOKEN").unwrap_or_default(),
            twilio_phone_number: std::env::var("TWILIO_PHONE_NUMBER").unwrap_or_default(),
            enabled: std::env::var("SMS_ENABLED")
                .unwrap_or_else(|_| "false".to_string())
                .parse()
                .unwrap_or(false),
        };

        let config = NotificationConfig {
            email: email_config,
            sms: sms_config,
            max_retry_attempts: std::env::var("NOTIFICATION_MAX_RETRIES")
                .unwrap_or_else(|_| "3".to_string())
                .parse()
                .unwrap_or(3),
            retry_delay_seconds: std::env::var("NOTIFICATION_RETRY_DELAY")
                .unwrap_or_else(|_| "60".to_string())
                .parse()
                .unwrap_or(60),
            batch_size: std::env::var("NOTIFICATION_BATCH_SIZE")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .unwrap_or(10),
            enable_logging: std::env::var("NOTIFICATION_LOGGING")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
        };

        let mut service = Self::new(config, database);
        service.load_default_templates().await;
        Ok(service)
    }

    /// Load default notification templates
    async fn load_default_templates(&mut self) {
        let mut templates = self.templates.write().await;

        // Appointment reminder template
        templates.insert(
            NotificationTemplate::AppointmentReminder,
            NotificationTemplateData {
                subject_template: "Appointment Reminder - {{clinic_name}}".to_string(),
                content_template: "Dear {{patient_name}},\n\nThis is a reminder that you have an appointment scheduled for {{appointment_date}} at {{appointment_time}} with Dr. {{doctor_name}}.\n\nPlease arrive 15 minutes early.\n\nIf you need to reschedule, please contact us at {{clinic_phone}}.\n\nBest regards,\n{{clinic_name}}".to_string(),
                variables: vec![
                    "patient_name".to_string(),
                    "appointment_date".to_string(),
                    "appointment_time".to_string(),
                    "doctor_name".to_string(),
                    "clinic_name".to_string(),
                    "clinic_phone".to_string(),
                ],
            },
        );

        // Payment confirmation template
        templates.insert(
            NotificationTemplate::PaymentConfirmation,
            NotificationTemplateData {
                subject_template: "Payment Confirmation - {{clinic_name}}".to_string(),
                content_template: "Dear {{patient_name}},\n\nYour payment of KES {{amount}} has been received successfully.\n\nPayment Details:\n- Invoice: {{invoice_number}}\n- Date: {{payment_date}}\n- Method: {{payment_method}}\n\nThank you for your payment.\n\nBest regards,\n{{clinic_name}}".to_string(),
                variables: vec![
                    "patient_name".to_string(),
                    "amount".to_string(),
                    "invoice_number".to_string(),
                    "payment_date".to_string(),
                    "payment_method".to_string(),
                    "clinic_name".to_string(),
                ],
            },
        );

        // Prescription ready template
        templates.insert(
            NotificationTemplate::PrescriptionReady,
            NotificationTemplateData {
                subject_template: "Prescription Ready - {{clinic_name}}".to_string(),
                content_template: "Dear {{patient_name}},\n\nYour prescription is ready for collection at our pharmacy.\n\nPrescription Details:\n- Doctor: Dr. {{doctor_name}}\n- Date: {{prescription_date}}\n- Prescription ID: {{prescription_id}}\n\nPlease bring a valid ID when collecting.\n\nBest regards,\n{{clinic_name}}".to_string(),
                variables: vec![
                    "patient_name".to_string(),
                    "doctor_name".to_string(),
                    "prescription_date".to_string(),
                    "prescription_id".to_string(),
                    "clinic_name".to_string(),
                ],
            },
        );

        // Welcome message template
        templates.insert(
            NotificationTemplate::WelcomeMessage,
            NotificationTemplateData {
                subject_template: "Welcome to {{clinic_name}}".to_string(),
                content_template: "Dear {{patient_name}},\n\nWelcome to {{clinic_name}}! We're excited to have you as our patient.\n\nYour account has been created successfully. You can now:\n- Book appointments online\n- View your medical records\n- Receive appointment reminders\n- Access your prescriptions\n\nIf you have any questions, please don't hesitate to contact us.\n\nBest regards,\n{{clinic_name}} Team".to_string(),
                variables: vec![
                    "patient_name".to_string(),
                    "clinic_name".to_string(),
                ],
            },
        );
    }

    /// Send a notification
    pub async fn send_notification(&self, request: NotificationRequest) -> Result<String, ApiError> {
        // Store notification in database
        let notification_id = self.store_notification(&request).await?;

        // Process the notification based on type
        match request.notification_type {
            NotificationType::Email => {
                self.send_email(&request).await?;
            }
            NotificationType::Sms => {
                self.send_sms(&request).await?;
            }
            NotificationType::Push => {
                // TODO: Implement push notifications
                tracing::info!("Push notification not yet implemented");
            }
            NotificationType::InApp => {
                // TODO: Implement in-app notifications
                tracing::info!("In-app notification not yet implemented");
            }
        }

        // Update notification status to sent
        self.update_notification_status(&notification_id, NotificationStatus::Sent).await?;

        Ok(notification_id)
    }

    /// Send email notification
    async fn send_email(&self, request: &NotificationRequest) -> Result<(), ApiError> {
        let transport = self.email_transport.as_ref()
            .ok_or_else(|| ApiError::internal_error(Some("Email service not configured".to_string())))?;

        let recipient_email = request.recipient_email.as_ref()
            .ok_or_else(|| ApiError::bad_request("Recipient email is required".to_string()))?;

        let from_email = format!("{} <{}>", self.config.email.from_name, self.config.email.from_email);
        let from: Mailbox = from_email.parse()
            .map_err(|e| ApiError::internal_error(Some(format!("Invalid from email: {}", e))))?;

        let to: Mailbox = recipient_email.parse()
            .map_err(|e| ApiError::internal_error(Some(format!("Invalid recipient email: {}", e))))?;

        let subject = request.subject.as_ref()
            .cloned()
            .unwrap_or_else(|| "Notification from Clinic Management".to_string());

        let message = Message::builder()
            .from(from)
            .to(to)
            .subject(subject)
            .header(ContentType::TEXT_PLAIN)
            .body(request.content.clone())
            .map_err(|e| ApiError::internal_error(Some(format!("Failed to create email message: {}", e))))?;

        transport.send(message).await
            .map_err(|e| ApiError::internal_error(Some(format!("Failed to send email: {}", e))))?;

        if self.config.enable_logging {
            tracing::info!("Email sent successfully to {}", recipient_email);
        }

        Ok(())
    }

    /// Send SMS notification
    async fn send_sms(&self, request: &NotificationRequest) -> Result<(), ApiError> {
        let client = self.twilio_client.as_ref()
            .ok_or_else(|| ApiError::internal_error(Some("SMS service not configured".to_string())))?;

        let recipient_phone = request.recipient_phone.as_ref()
            .ok_or_else(|| ApiError::bad_request("Recipient phone number is required".to_string()))?;

        let message = OutboundMessage::new(
            &self.config.sms.twilio_phone_number,
            recipient_phone,
            &request.content,
        );

        client.send_message(message).await
            .map_err(|e| ApiError::internal_error(Some(format!("Failed to send SMS: {}", e))))?;

        if self.config.enable_logging {
            tracing::info!("SMS sent successfully to {}", recipient_phone);
        }

        Ok(())
    }

    /// Store notification in database
    async fn store_notification(&self, request: &NotificationRequest) -> Result<String, ApiError> {
        let notification_id = Uuid::parse_str(&request.id)
            .map_err(|_| ApiError::bad_request("Invalid notification ID".to_string()))?;

        let recipient_id = request.recipient_id.as_ref()
            .and_then(|id| Uuid::parse_str(id).ok());

        let created_by = request.created_by.as_ref()
            .and_then(|id| Uuid::parse_str(id).ok());

        let scheduled_at = request.scheduled_at.map(|timestamp| {
            DateTime::from_timestamp(timestamp as i64, 0)
                .unwrap_or_else(|| Utc::now())
        });

        sqlx::query(
            r#"
            INSERT INTO notifications (
                id, recipient_id, recipient_email, recipient_phone,
                notification_type, template, subject, content, priority,
                scheduled_at, metadata, created_at, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
            "#
        )
        .bind(notification_id)
        .bind(recipient_id)
        .bind(&request.recipient_email)
        .bind(&request.recipient_phone)
        .bind(format!("{:?}", request.notification_type).to_lowercase())
        .bind(format!("{:?}", request.template).to_lowercase())
        .bind(&request.subject)
        .bind(&request.content)
        .bind(format!("{:?}", request.priority).to_lowercase())
        .bind(scheduled_at)
        .bind(serde_json::to_value(&request.metadata).unwrap_or(serde_json::Value::Object(serde_json::Map::new())))
        .bind(Utc::now())
        .bind(created_by)
        .execute(&self.database)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to store notification: {}", e))))?;

        Ok(request.id.clone())
    }

    /// Update notification status
    async fn update_notification_status(&self, notification_id: &str, status: NotificationStatus) -> Result<(), ApiError> {
        let notification_uuid = Uuid::parse_str(notification_id)
            .map_err(|_| ApiError::bad_request("Invalid notification ID".to_string()))?;

        let now = Utc::now();
        let (sent_at, delivered_at, failed_at) = match status {
            NotificationStatus::Sent => (Some(now), None, None),
            NotificationStatus::Delivered => (Some(now), Some(now), None),
            NotificationStatus::Failed => (None, None, Some(now)),
            _ => (None, None, None),
        };

        sqlx::query(
            r#"
            UPDATE notifications 
            SET status = $1, sent_at = $2, delivered_at = $3, failed_at = $4, updated_at = $5
            WHERE id = $6
            "#
        )
        .bind(format!("{:?}", status).to_lowercase())
        .bind(sent_at)
        .bind(delivered_at)
        .bind(failed_at)
        .bind(now)
        .bind(notification_uuid)
        .execute(&self.database)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to update notification status: {}", e))))?;

        if self.config.enable_logging {
            tracing::info!("Notification {} status updated to {:?}", notification_id, status);
        }
        Ok(())
    }

    /// Process notification template with variables
    pub async fn process_template(
        &self,
        template: NotificationTemplate,
        variables: HashMap<String, String>,
    ) -> Result<(String, String), ApiError> {
        let templates = self.templates.read().await;
        let template_data = templates.get(&template)
            .ok_or_else(|| ApiError::not_found("Template not found"))?;

        let mut subject = template_data.subject_template.clone();
        let mut content = template_data.content_template.clone();

        // Replace variables in subject and content
        for (key, value) in variables {
            let placeholder = format!("{{{{{}}}}}", key);
            subject = subject.replace(&placeholder, &value);
            content = content.replace(&placeholder, &value);
        }

        Ok((subject, content))
    }

    /// Send appointment reminder
    pub async fn send_appointment_reminder(
        &self,
        patient_name: String,
        patient_email: Option<String>,
        patient_phone: Option<String>,
        appointment_date: String,
        appointment_time: String,
        doctor_name: String,
        clinic_name: String,
        clinic_phone: String,
    ) -> Result<String, ApiError> {
        let mut variables = HashMap::new();
        variables.insert("patient_name".to_string(), patient_name);
        variables.insert("appointment_date".to_string(), appointment_date);
        variables.insert("appointment_time".to_string(), appointment_time);
        variables.insert("doctor_name".to_string(), doctor_name);
        variables.insert("clinic_name".to_string(), clinic_name);
        variables.insert("clinic_phone".to_string(), clinic_phone);

        let (subject, content) = self.process_template(NotificationTemplate::AppointmentReminder, variables).await?;

        let notification_id = Uuid::new_v4().to_string();
        let notification_type = if patient_email.is_some() { NotificationType::Email } else { NotificationType::Sms };
        let request = NotificationRequest {
            id: notification_id.clone(),
            recipient_id: None,
            recipient_email: patient_email,
            recipient_phone: patient_phone,
            notification_type,
            template: NotificationTemplate::AppointmentReminder,
            subject: Some(subject),
            content,
            priority: NotificationPriority::Normal,
            scheduled_at: None,
            metadata: HashMap::new(),
            created_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            created_by: None,
        };

        self.send_notification(request).await
    }

    /// Send payment confirmation
    pub async fn send_payment_confirmation(
        &self,
        patient_name: String,
        patient_email: Option<String>,
        patient_phone: Option<String>,
        amount: String,
        invoice_number: String,
        payment_date: String,
        payment_method: String,
        clinic_name: String,
    ) -> Result<String, ApiError> {
        let mut variables = HashMap::new();
        variables.insert("patient_name".to_string(), patient_name);
        variables.insert("amount".to_string(), amount);
        variables.insert("invoice_number".to_string(), invoice_number);
        variables.insert("payment_date".to_string(), payment_date);
        variables.insert("payment_method".to_string(), payment_method);
        variables.insert("clinic_name".to_string(), clinic_name);

        let (subject, content) = self.process_template(NotificationTemplate::PaymentConfirmation, variables).await?;

        let notification_id = Uuid::new_v4().to_string();
        let notification_type = if patient_email.is_some() { NotificationType::Email } else { NotificationType::Sms };
        let request = NotificationRequest {
            id: notification_id.clone(),
            recipient_id: None,
            recipient_email: patient_email,
            recipient_phone: patient_phone,
            notification_type,
            template: NotificationTemplate::PaymentConfirmation,
            subject: Some(subject),
            content,
            priority: NotificationPriority::Normal,
            scheduled_at: None,
            metadata: HashMap::new(),
            created_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            created_by: None,
        };

        self.send_notification(request).await
    }

    /// Send prescription ready notification
    pub async fn send_prescription_ready(
        &self,
        patient_name: String,
        patient_email: Option<String>,
        patient_phone: Option<String>,
        doctor_name: String,
        prescription_date: String,
        prescription_id: String,
        clinic_name: String,
    ) -> Result<String, ApiError> {
        let mut variables = HashMap::new();
        variables.insert("patient_name".to_string(), patient_name);
        variables.insert("doctor_name".to_string(), doctor_name);
        variables.insert("prescription_date".to_string(), prescription_date);
        variables.insert("prescription_id".to_string(), prescription_id);
        variables.insert("clinic_name".to_string(), clinic_name);

        let (subject, content) = self.process_template(NotificationTemplate::PrescriptionReady, variables).await?;

        let notification_id = Uuid::new_v4().to_string();
        let notification_type = if patient_email.is_some() { NotificationType::Email } else { NotificationType::Sms };
        let request = NotificationRequest {
            id: notification_id.clone(),
            recipient_id: None,
            recipient_email: patient_email,
            recipient_phone: patient_phone,
            notification_type,
            template: NotificationTemplate::PrescriptionReady,
            subject: Some(subject),
            content,
            priority: NotificationPriority::Normal,
            scheduled_at: None,
            metadata: HashMap::new(),
            created_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            created_by: None,
        };

        self.send_notification(request).await
    }

    /// Send welcome message
    pub async fn send_welcome_message(
        &self,
        patient_name: String,
        patient_email: Option<String>,
        patient_phone: Option<String>,
        clinic_name: String,
    ) -> Result<String, ApiError> {
        let mut variables = HashMap::new();
        variables.insert("patient_name".to_string(), patient_name);
        variables.insert("clinic_name".to_string(), clinic_name);

        let (subject, content) = self.process_template(NotificationTemplate::WelcomeMessage, variables).await?;

        let notification_id = Uuid::new_v4().to_string();
        let notification_type = if patient_email.is_some() { NotificationType::Email } else { NotificationType::Sms };
        let request = NotificationRequest {
            id: notification_id.clone(),
            recipient_id: None,
            recipient_email: patient_email,
            recipient_phone: patient_phone,
            notification_type,
            template: NotificationTemplate::WelcomeMessage,
            subject: Some(subject),
            content,
            priority: NotificationPriority::Normal,
            scheduled_at: None,
            metadata: HashMap::new(),
            created_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            created_by: None,
        };

        self.send_notification(request).await
    }

    /// Get notification history
    pub async fn get_notification_history(
        &self,
        recipient_id: Option<String>,
        notification_type: Option<NotificationType>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<NotificationRecord>, ApiError> {
        let limit = limit.unwrap_or(50).min(100) as i64;
        let offset = offset.unwrap_or(0) as i64;

        let recipient_uuid = recipient_id.and_then(|id| Uuid::parse_str(&id).ok());

        let notifications = sqlx::query_as::<_, NotificationRecord>(
            r#"
            SELECT 
                id, recipient_id, recipient_email, recipient_phone,
                notification_type, template, subject, content, priority, status,
                scheduled_at, sent_at, delivered_at, failed_at, error_message,
                metadata, created_at, created_by, updated_at
            FROM notifications
            WHERE ($1::uuid IS NULL OR recipient_id = $1)
            AND ($2::text IS NULL OR notification_type::text = $2)
            ORDER BY created_at DESC
            LIMIT $3 OFFSET $4
            "#
        )
        .bind(recipient_uuid)
        .bind(notification_type.map(|t| format!("{:?}", t).to_lowercase()))
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.database)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to fetch notifications: {}", e))))?;

        Ok(notifications)
    }

    /// Get notification statistics
    pub async fn get_notification_stats(&self) -> Result<HashMap<String, u64>, ApiError> {
        let row = sqlx::query(
            r#"
            SELECT 
                COUNT(*) as total_notifications,
                COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
                COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN notification_type = 'email' THEN 1 END) as email_count,
                COUNT(CASE WHEN notification_type = 'sms' THEN 1 END) as sms_count
            FROM notifications
            "#
        )
        .fetch_one(&self.database)
        .await
        .map_err(|e| ApiError::internal_error(Some(format!("Failed to fetch notification stats: {}", e))))?;

        let mut result = HashMap::new();
        result.insert("total".to_string(), row.get::<i64, _>("total_notifications") as u64);
        result.insert("sent".to_string(), row.get::<i64, _>("sent_count") as u64);
        result.insert("delivered".to_string(), row.get::<i64, _>("delivered_count") as u64);
        result.insert("failed".to_string(), row.get::<i64, _>("failed_count") as u64);
        result.insert("pending".to_string(), row.get::<i64, _>("pending_count") as u64);
        result.insert("email".to_string(), row.get::<i64, _>("email_count") as u64);
        result.insert("sms".to_string(), row.get::<i64, _>("sms_count") as u64);

        Ok(result)
    }
}

/// Notification handler functions for API endpoints
pub mod handlers {
    use super::*;
    use actix_web::{web, HttpResponse, Result, HttpRequest};
    use crate::models::ApiResponse;
    use std::sync::Arc;

    /// Send a custom notification
    pub async fn send_notification(
        req: web::Json<NotificationRequest>,
        notification_service: web::Data<Arc<NotificationService>>,
    ) -> Result<HttpResponse> {
        let notification_id = notification_service.send_notification(req.into_inner()).await
            .map_err(|e| e.into_actix_web_error())?;

        Ok(HttpResponse::Ok().json(ApiResponse {
            success: true,
            data: Some(serde_json::json!({
                "notification_id": notification_id,
                "message": "Notification sent successfully"
            })),
            message: Some("Notification sent successfully".to_string()),
            error: None,
        }))
    }

    /// Send appointment reminder
    pub async fn send_appointment_reminder(
        req: web::Json<serde_json::Value>,
        notification_service: web::Data<Arc<NotificationService>>,
    ) -> Result<HttpResponse> {
        let patient_name = req.get("patient_name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ApiError::bad_request("patient_name is required".to_string()))?
            .to_string();

        let patient_email = req.get("patient_email").and_then(|v| v.as_str()).map(|s| s.to_string());
        let patient_phone = req.get("patient_phone").and_then(|v| v.as_str()).map(|s| s.to_string());
        let appointment_date = req.get("appointment_date")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ApiError::bad_request("appointment_date is required".to_string()))?
            .to_string();
        let appointment_time = req.get("appointment_time")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ApiError::bad_request("appointment_time is required".to_string()))?
            .to_string();
        let doctor_name = req.get("doctor_name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ApiError::bad_request("doctor_name is required".to_string()))?
            .to_string();
        let clinic_name = req.get("clinic_name")
            .and_then(|v| v.as_str())
            .unwrap_or("Clinic Management")
            .to_string();
        let clinic_phone = req.get("clinic_phone")
            .and_then(|v| v.as_str())
            .unwrap_or("+254700000000")
            .to_string();

        let notification_id = notification_service.send_appointment_reminder(
            patient_name,
            patient_email,
            patient_phone,
            appointment_date,
            appointment_time,
            doctor_name,
            clinic_name,
            clinic_phone,
        ).await.map_err(|e| e.into_actix_web_error())?;

        Ok(HttpResponse::Ok().json(ApiResponse {
            success: true,
            data: Some(serde_json::json!({
                "notification_id": notification_id,
                "message": "Appointment reminder sent successfully"
            })),
            message: Some("Appointment reminder sent successfully".to_string()),
            error: None,
        }))
    }

    /// Send payment confirmation
    pub async fn send_payment_confirmation(
        req: web::Json<serde_json::Value>,
        notification_service: web::Data<Arc<NotificationService>>,
    ) -> Result<HttpResponse> {
        let patient_name = req.get("patient_name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ApiError::bad_request("patient_name is required".to_string()))?
            .to_string();

        let patient_email = req.get("patient_email").and_then(|v| v.as_str()).map(|s| s.to_string());
        let patient_phone = req.get("patient_phone").and_then(|v| v.as_str()).map(|s| s.to_string());
        let amount = req.get("amount")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ApiError::bad_request("amount is required".to_string()))?
            .to_string();
        let invoice_number = req.get("invoice_number")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ApiError::bad_request("invoice_number is required".to_string()))?
            .to_string();
        let payment_date = req.get("payment_date")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ApiError::bad_request("payment_date is required".to_string()))?
            .to_string();
        let payment_method = req.get("payment_method")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ApiError::bad_request("payment_method is required".to_string()))?
            .to_string();
        let clinic_name = req.get("clinic_name")
            .and_then(|v| v.as_str())
            .unwrap_or("Clinic Management")
            .to_string();

        let notification_id = notification_service.send_payment_confirmation(
            patient_name,
            patient_email,
            patient_phone,
            amount,
            invoice_number,
            payment_date,
            payment_method,
            clinic_name,
        ).await.map_err(|e| e.into_actix_web_error())?;

        Ok(HttpResponse::Ok().json(ApiResponse {
            success: true,
            data: Some(serde_json::json!({
                "notification_id": notification_id,
                "message": "Payment confirmation sent successfully"
            })),
            message: Some("Payment confirmation sent successfully".to_string()),
            error: None,
        }))
    }

    /// Get notification history
    pub async fn get_notification_history(
        query: web::Query<HashMap<String, String>>,
        notification_service: web::Data<Arc<NotificationService>>,
    ) -> Result<HttpResponse> {
        let recipient_id = query.get("recipient_id").map(|s| s.clone());
        let notification_type = query.get("type")
            .and_then(|s| serde_json::from_str::<NotificationType>(s).ok());
        let limit = query.get("limit")
            .and_then(|s| s.parse::<u32>().ok());
        let offset = query.get("offset")
            .and_then(|s| s.parse::<u32>().ok());

        let notifications = notification_service.get_notification_history(
            recipient_id,
            notification_type,
            limit,
            offset,
        ).await.map_err(|e| e.into_actix_web_error())?;

        Ok(HttpResponse::Ok().json(ApiResponse {
            success: true,
            data: Some(serde_json::json!(notifications)),
            message: None,
            error: None,
        }))
    }

    /// Get notification statistics
    pub async fn get_notification_stats(
        notification_service: web::Data<Arc<NotificationService>>,
    ) -> Result<HttpResponse> {
        let stats = notification_service.get_notification_stats().await
            .map_err(|e| e.into_actix_web_error())?;

        Ok(HttpResponse::Ok().json(ApiResponse {
            success: true,
            data: Some(serde_json::json!(stats)),
            message: None,
            error: None,
        }))
    }
}

impl ApiError {
    fn into_actix_web_error(self) -> actix_web::Error {
        actix_web::error::ErrorInternalServerError(self.message)
    }
}
