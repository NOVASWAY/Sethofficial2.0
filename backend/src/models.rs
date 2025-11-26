use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc, NaiveDate, NaiveTime};
use sqlx::FromRow;

// User models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub role: String,
    pub name: String,
    pub department: String,
    pub permissions: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub password_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUser {
    pub username: String,
    pub password: String,
    pub role: String,
    pub name: String,
    pub department: Option<String>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateUser {
    pub name: Option<String>,
    pub department: Option<String>,
    pub permissions: Option<Vec<String>>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub user: User,
    pub token: String,
    pub refresh_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub message: Option<String>,
    pub error: Option<String>,
}

// Patient models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Patient {
    pub id: Uuid,
    pub patient_number: String, // OP/Client number
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: DateTime<Utc>, // Used to calculate age
    pub gender: String,
    pub phone: String,
    pub location: Option<String>, // Address/Location
    pub emergency_contact: Option<String>,
    pub emergency_phone: Option<String>,
    pub blood_type: Option<String>,
    pub medical_history: Option<String>,
    pub allergies: Option<serde_json::Value>,
    pub insurance_type: Option<String>,
    pub insurance_number: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePatient {
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: DateTime<Utc>,
    pub gender: String,
    pub phone: String,
    pub location: Option<String>, // Address/Location
    pub emergency_contact: Option<String>,
    pub emergency_phone: Option<String>,
    pub blood_type: Option<String>,
    pub medical_history: Option<String>,
    pub allergies: Option<serde_json::Value>,
    pub insurance_type: Option<String>,
    pub insurance_number: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdatePatient {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub date_of_birth: Option<NaiveDate>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    pub location: Option<String>, // Address/Location
    pub emergency_contact: Option<String>,
    pub emergency_phone: Option<String>,
    pub blood_type: Option<String>,
    pub medical_history: Option<String>,
    pub allergies: Option<String>,
    pub insurance_type: Option<String>,
    pub insurance_number: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PatientImport {
    pub name: String,
    pub age: i32,
    pub phone: String,
    pub location: String,
    pub op_number: String,
}

// Import tracking models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ImportSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub file_name: String,
    pub file_size: Option<i64>,
    pub total_records: i32,
    pub imported_count: i32,
    pub failed_count: i32,
    pub duplicate_count: i32,
    pub status: String, // pending, in_progress, completed, failed, cancelled, partial
    pub batch_size: i32,
    pub total_batches: i32,
    pub current_batch: i32,
    pub progress_percentage: Option<rust_decimal::Decimal>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_summary: Option<serde_json::Value>,
    pub batch_results: Option<serde_json::Value>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateImportSession {
    pub file_name: String,
    pub file_size: Option<i64>,
    pub total_records: i32,
    pub batch_size: Option<i32>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ImportAuditLog {
    pub id: Uuid,
    pub import_session_id: Uuid,
    pub user_id: Uuid,
    pub action: String,
    pub record_index: Option<i32>,
    pub record_data: Option<serde_json::Value>,
    pub result: String,
    pub error_message: Option<String>,
    pub error_details: Option<serde_json::Value>,
    pub batch_number: Option<i32>,
    pub timestamp: DateTime<Utc>,
}

// Appointment models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Appointment {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub doctor_id: Uuid,
    pub appointment_date: NaiveDate,
    pub appointment_time: NaiveTime,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateAppointment {
    pub patient_id: Uuid,
    pub doctor_id: Uuid,
    pub appointment_date: NaiveDate,
    pub appointment_time: NaiveTime,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CheckInRequest {
    pub patient_id: Uuid,
    pub appointment_id: Uuid,
}

// Queue models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct QueueItem {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub appointment_id: Uuid,
    pub queue_number: i32,
    pub status: String,
    pub checked_in_at: Option<DateTime<Utc>>,
    pub called_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

// Alert models for WebSocket notifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockAlert {
    pub medicine_id: Uuid,
    pub medicine_name: String,
    pub current_stock: i32,
    pub min_stock: i32,
    pub alert_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpiryAlert {
    pub medicine_id: Uuid,
    pub medicine_name: String,
    pub batch_number: String,
    pub expiry_date: chrono::NaiveDate,
    pub days_until_expiry: i32,
}

// Consultation models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Consultation {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub doctor_id: Uuid,
    pub date: NaiveDate,
    pub time: NaiveTime,
    pub chief_complaint: String,
    pub diagnosis: Option<String>,
    pub treatment_plan: Option<String>,
    pub notes: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateConsultation {
    pub patient_id: Uuid,
    pub doctor_id: Uuid,
    pub date: NaiveDate,
    pub time: NaiveTime,
    pub chief_complaint: String,
    pub diagnosis: Option<String>,
    pub treatment_plan: Option<String>,
    pub notes: Option<String>,
}

// Medicine models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Medicine {
    pub id: Uuid,
    pub name: String,
    pub generic_name: Option<String>,
    pub dosage_form: String,
    pub strength: String,
    pub manufacturer: Option<String>,
    pub unit_price: f64, // Using f64 instead of rust_decimal::Decimal
    pub stock_quantity: i32,
    pub minimum_stock: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateMedicine {
    pub name: String,
    pub generic_name: Option<String>,
    pub dosage_form: String,
    pub strength: String,
    pub manufacturer: Option<String>,
    pub unit_price: f64,
    pub stock_quantity: i32,
    pub minimum_stock: i32,
}

// Prescription models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Prescription {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub doctor_id: Uuid,
    pub consultation_id: Option<Uuid>,
    pub medicines: serde_json::Value,
    pub instructions: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePrescription {
    pub patient_id: Uuid,
    pub doctor_id: Uuid,
    pub consultation_id: Option<Uuid>,
    pub medicines: serde_json::Value,
    pub instructions: String,
}

// Invoice models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Invoice {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub invoice_number: String,
    pub date: NaiveDate,
    pub items: serde_json::Value,
    pub subtotal: f64,
    pub tax_amount: f64,
    pub total_amount: f64,
    pub payment_status: String,
    pub payment_method: Option<String>,
    pub consultation_id: Option<Uuid>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateInvoice {
    pub patient_id: Uuid,
    pub date: NaiveDate,
    pub items: Vec<CreateInvoiceItem>,
    pub consultation_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateInvoiceItem {
    pub description: String,
    pub quantity: i32,
    pub unit_price: f64,
}

// Invoice Item models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct InvoiceItem {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub description: String,
    pub quantity: i32,
    pub unit_price: f64,
    pub total_price: f64,
    pub created_at: DateTime<Utc>,
}

// Payment models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Payment {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub payment_method: String,
    pub amount_received: Option<f64>,
    pub change_given: Option<f64>,
    pub payment_date: NaiveDate,
    pub reference_number: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePayment {
    pub invoice_id: Uuid,
    pub payment_method: String,
    pub amount_received: Option<f64>,
    pub reference_number: Option<String>,
    pub notes: Option<String>,
}

// Pricing models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Pricing {
    pub id: Uuid,
    pub service_name: String,
    pub cash_price: f64,
    pub sha_price: Option<f64>,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Lab test order models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LabTestOrder {
    pub id: Uuid,
    pub order_number: String,
    pub patient_id: Uuid,
    pub consultation_id: Option<Uuid>,
    pub ordering_clinician_id: Uuid,
    pub test_type: String,
    pub test_code: Option<String>,
    pub test_name: String,
    pub priority: String, // routine, urgent, stat
    pub clinical_indication: Option<String>,
    pub sample_type: Option<String>,
    pub sample_collection_date: Option<DateTime<Utc>>,
    pub status: String, // pending, collected, in_progress, completed, cancelled
    pub notes: Option<String>,
    pub ordered_at: DateTime<Utc>,
    pub collected_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateLabTestOrder {
    pub patient_id: Uuid,
    pub consultation_id: Option<Uuid>,
    pub ordering_clinician_id: Uuid,
    pub test_type: String,
    pub test_code: Option<String>,
    pub test_name: String,
    pub priority: Option<String>, // routine, urgent, stat
    pub clinical_indication: Option<String>,
    pub sample_type: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateLabTestOrder {
    pub status: Option<String>,
    pub sample_collection_date: Option<DateTime<Utc>>,
    pub collected_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

// Lab test result models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LabTestResult {
    pub id: Uuid,
    pub order_id: Uuid,
    pub result_number: String,
    pub test_type: String,
    pub test_code: Option<String>,
    pub test_name: String,
    pub test_values: serde_json::Value, // Actual test results
    pub reference_ranges: Option<serde_json::Value>, // Normal ranges
    pub abnormal_flags: Option<serde_json::Value>, // Which values are abnormal
    pub result_date: DateTime<Utc>,
    pub verified_by: Option<Uuid>,
    pub verified_at: Option<DateTime<Utc>>,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub attachments: Option<serde_json::Value>, // Array of file paths/URLs
    pub status: String, // pending, verified, reviewed, cancelled
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateLabTestResult {
    pub order_id: Uuid,
    pub test_type: String,
    pub test_code: Option<String>,
    pub test_name: String,
    pub test_values: serde_json::Value,
    pub reference_ranges: Option<serde_json::Value>,
    pub abnormal_flags: Option<serde_json::Value>,
    pub notes: Option<String>,
    pub attachments: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateLabTestResult {
    pub test_values: Option<serde_json::Value>,
    pub reference_ranges: Option<serde_json::Value>,
    pub abnormal_flags: Option<serde_json::Value>,
    pub notes: Option<String>,
    pub attachments: Option<serde_json::Value>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePricing {
    pub service_name: String,
    pub cash_price: f64,
    pub sha_price: Option<f64>,
    pub description: Option<String>,
}

// Report models
#[derive(Debug, Serialize, Deserialize)]
pub struct ReportRequest {
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub report_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReportResponse {
    pub report_type: String,
    pub period: String,
    pub data: serde_json::Value,
    pub generated_at: DateTime<Utc>,
}

// Pagination models
#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: i64,
    pub page: i32,
    pub per_page: i32,
    pub total_pages: i32,
}

// M-Pesa models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MpesaTransaction {
    pub id: Uuid,
    pub checkout_request_id: String,
    pub merchant_request_id: String,
    pub amount: f64,
    pub phone_number: String,
    pub account_reference: String,
    pub transaction_description: String,
    pub status: String,
    pub response_code: Option<String>,
    pub response_description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StkPushRequest {
    pub amount: f64,
    pub phone_number: String,
    pub account_reference: String,
    pub transaction_description: String,
}

// File upload models
#[derive(Debug, Serialize, Deserialize)]
pub struct FileUploadResponse {
    pub filename: String,
    pub url: String,
    pub size: u64,
    pub uploaded_at: DateTime<Utc>,
}

// Settings models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SystemSetting {
    pub id: Uuid,
    pub key: String,
    pub value: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub is_encrypted: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserSetting {
    pub id: Uuid,
    pub user_id: Uuid,
    pub key: String,
    pub value: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub is_encrypted: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateUserSetting {
    pub key: String,
    pub value: String,
    pub description: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateUserSetting {
    pub value: String,
    pub description: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateSystemSetting {
    pub value: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub is_encrypted: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSystemSetting {
    pub key: String,
    pub value: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub is_encrypted: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SettingsResponse {
    pub general: serde_json::Value,
    pub schedule: serde_json::Value,
    pub billing: serde_json::Value,
    pub inventory: serde_json::Value,
    pub security: serde_json::Value,
    pub audit: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateSettingsRequest {
    pub settings: serde_json::Value,
}