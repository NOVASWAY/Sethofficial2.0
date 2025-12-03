use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, NaiveDate, NaiveTime};
use uuid::Uuid;
use sqlx::FromRow;
use rust_decimal::Decimal;

// Consultation models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Consultation {
    pub id: Uuid,
    pub consultation_number: String,
    pub patient_id: Uuid,
    pub clinician_id: Uuid,
    pub appointment_id: Option<Uuid>,
    pub visit_date: NaiveDate,
    pub visit_time: NaiveTime,
    pub chief_complaint: String,
    pub vital_signs: Option<serde_json::Value>,
    pub physical_examination: Option<String>,
    pub diagnosis: Option<String>,
    pub icd_11_codes: Option<serde_json::Value>,
    pub treatment_plan: Option<String>,
    pub notes: Option<String>,
    pub follow_up_date: Option<NaiveDate>,
    pub status: ConsultationStatus,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConsultationStatus {
    InProgress,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateConsultation {
    pub patient_id: Uuid,
    pub clinician_id: Uuid,
    pub appointment_id: Option<Uuid>,
    pub chief_complaint: String,
    pub vital_signs: Option<VitalSigns>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VitalSigns {
    pub temperature: Option<f32>,
    pub blood_pressure: Option<String>,
    pub pulse: Option<i32>,
    pub weight: Option<f32>,
    pub height: Option<f32>,
    pub respiratory_rate: Option<i32>,
    pub oxygen_saturation: Option<f32>,
}

// Prescription models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Prescription {
    pub id: Uuid,
    pub prescription_number: String,
    pub consultation_id: Uuid,
    pub patient_id: Uuid,
    pub clinician_id: Uuid,
    pub medication_id: Uuid,
    pub medication_name: String,
    pub dosage: String,
    pub frequency: String,
    pub duration_days: i32,
    pub quantity: i32,
    pub instructions: Option<String>,
    pub dispensed: bool,
    pub dispensed_by: Option<Uuid>,
    pub dispensed_at: Option<DateTime<Utc>>,
    pub status: PrescriptionStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PrescriptionStatus {
    Pending,
    Dispensed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePrescription {
    pub consultation_id: Uuid,
    pub patient_id: Uuid,
    pub medication_id: Uuid,
    pub dosage: String,
    pub frequency: String,
    pub duration_days: i32,
    pub quantity: i32,
    pub instructions: Option<String>,
}

// Service models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Service {
    pub id: Uuid,
    pub service_code: String,
    pub service_name: String,
    pub category: String,
    pub description: Option<String>,
    pub unit_price: f64,
    pub cash_price: Option<f64>,
    pub nhif_price: Option<f64>,
    pub sha_approved: bool,
    pub sha_price: Option<f64>,
    pub is_active: bool,
    pub requires_prescription: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateService {
    pub service_code: String,
    pub service_name: String,
    pub category: String,
    pub description: Option<String>,
    pub unit_price: f64,
    pub cash_price: Option<f64>,
    pub nhif_price: Option<f64>,
    pub sha_approved: bool,
    pub sha_price: Option<f64>,
    pub requires_prescription: Option<bool>,
}

// Stock movement models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StockMovement {
    pub id: Uuid,
    pub medication_id: Uuid,
    pub movement_type: StockMovementType,
    pub quantity: i32,
    pub previous_quantity: i32,
    pub new_quantity: i32,
    pub unit_cost: Option<Decimal>,
    pub total_cost: Option<Decimal>,
    pub reference_id: Option<Uuid>,
    pub reference_type: Option<String>,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StockMovementType {
    Purchase,
    Sale,
    Adjustment,
    Return,
    Expired,
    Damaged,
}

// SHA Claims models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ShaClaim {
    pub id: Uuid,
    pub claim_number: String,
    pub invoice_id: Uuid,
    pub patient_id: Uuid,
    pub patient_name: String,
    pub patient_sha_number: String,
    pub claim_date: NaiveDate,
    pub service_date: NaiveDate,
    pub total_amount: Decimal,
    pub approved_amount: Option<Decimal>,
    pub status: ShaClaimStatus,
    pub submission_date: Option<NaiveDate>,
    pub approval_date: Option<NaiveDate>,
    pub payment_date: Option<NaiveDate>,
    pub rejection_reason: Option<String>,
    pub documents: Option<serde_json::Value>,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ShaClaimStatus {
    Pending,
    Submitted,
    Approved,
    Rejected,
    Paid,
}

// Financial transaction models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FinancialTransaction {
    pub id: Uuid,
    pub transaction_number: String,
    pub transaction_date: NaiveDate,
    pub transaction_type: TransactionType,
    pub category: String,
    pub amount: Decimal,
    pub payment_method: Option<String>,
    pub reference_id: Option<Uuid>,
    pub reference_type: Option<String>,
    pub description: String,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransactionType {
    Revenue,
    Expense,
    Refund,
    Adjustment,
}

// Invoice item models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct InvoiceItem {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub item_type: InvoiceItemType,
    pub item_id: Option<Uuid>,
    pub description: String,
    pub quantity: i32,
    pub unit_price: Decimal,
    pub total_price: Decimal,
    pub sha_covered: bool,
    pub sha_amount: Decimal,
    pub patient_amount: Option<Decimal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InvoiceItemType {
    Service,
    Medication,
    Procedure,
}

// Payment allocation models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PaymentAllocation {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub payment_type: PaymentType,
    pub amount: Decimal,
    pub payment_reference: Option<String>,
    pub payment_date: NaiveDate,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaymentType {
    Sha,
    Cash,
    Mpesa,
}

// Report models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Report {
    pub id: Uuid,
    pub report_type: String,
    pub report_name: String,
    pub report_period: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub parameters: Option<serde_json::Value>,
    pub file_path: Option<String>,
    pub file_format: Option<String>,
    pub generated_by: Uuid,
    pub generated_at: DateTime<Utc>,
}

// Complete workflow DTOs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteConsultationWorkflow {
    pub consultation: CreateConsultation,
    pub prescriptions: Vec<CreatePrescription>,
    pub services: Vec<Uuid>, // Service IDs to bill
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteBillingWorkflow {
    pub consultation_id: Uuid,
    pub patient_id: Uuid,
    pub invoice_type: String, // sha, cash, mpesa, mixed
    pub services: Vec<Uuid>,
    pub medications: Vec<Uuid>,
    pub sha_amount: Option<Decimal>,
    pub cash_amount: Option<Decimal>,
    pub mpesa_amount: Option<Decimal>,
    pub mpesa_code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PharmacyDispensing {
    pub prescription_id: Uuid,
    pub dispensed_quantity: i32,
    pub batch_number: String,
    pub notes: Option<String>,
}

