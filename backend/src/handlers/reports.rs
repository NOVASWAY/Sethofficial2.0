use actix_web::{web, HttpResponse, Result};
use serde::{Deserialize, Serialize};

use crate::database::Database;

#[derive(Debug, Serialize, Deserialize)]
pub struct FinancialReport {
    pub period: String,
    pub total_revenue: rust_decimal::Decimal,
    pub total_tax: rust_decimal::Decimal,
    pub invoice_count: i64,
    pub payment_methods: PaymentMethodSummary,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentMethodSummary {
    pub cash_total: rust_decimal::Decimal,
    pub mpesa_total: rust_decimal::Decimal,
    pub sha_total: rust_decimal::Decimal,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MedicalReport {
    pub period: String,
    pub total_patients: i64,
    pub total_appointments: i64,
    pub completed_appointments: i64,
    pub cancelled_appointments: i64,
    pub no_show_appointments: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OperationalReport {
    pub period: String,
    pub active_users: i64,
    pub low_stock_medications: i64,
    pub expiring_medications: i64,
    pub pending_invoices: i64,
}

pub async fn get_financial_report(
    query: web::Query<ReportQuery>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let start_date = chrono::NaiveDate::parse_from_str(&query.start_date, "%Y-%m-%d")?;
    let end_date = chrono::NaiveDate::parse_from_str(&query.end_date, "%Y-%m-%d")?;
    
    // Get total revenue and tax
    let revenue_data = sqlx::query!(
        "SELECT 
            COALESCE(SUM(total), 0) as total_revenue,
            COALESCE(SUM(tax), 0) as total_tax,
            COUNT(*) as invoice_count
         FROM invoices 
         WHERE date BETWEEN $1 AND $2 AND status = 'paid'",
        start_date,
        end_date
    )
    .fetch_one(database.get_pool())
    .await?;

    // Get payment method breakdown
    let payment_methods = sqlx::query!(
        "SELECT 
            invoice_type,
            COALESCE(SUM(total), 0) as total
         FROM invoices 
         WHERE date BETWEEN $1 AND $2 AND status = 'paid'
         GROUP BY invoice_type",
        start_date,
        end_date
    )
    .fetch_all(database.get_pool())
    .await?;

    let mut cash_total = rust_decimal::Decimal::ZERO;
    let mut mpesa_total = rust_decimal::Decimal::ZERO;
    let mut sha_total = rust_decimal::Decimal::ZERO;

    for pm in payment_methods {
        match pm.invoice_type.as_str() {
            "cash" => cash_total = pm.total.unwrap_or_default(),
            "mpesa" => mpesa_total = pm.total.unwrap_or_default(),
            "sha" => sha_total = pm.total.unwrap_or_default(),
            _ => {}
        }
    }

    let report = FinancialReport {
        period: format!("{} to {}", query.start_date, query.end_date),
        total_revenue: revenue_data.total_revenue.unwrap_or_default(),
        total_tax: revenue_data.total_tax.unwrap_or_default(),
        invoice_count: revenue_data.invoice_count.unwrap_or(0),
        payment_methods: PaymentMethodSummary {
            cash_total,
            mpesa_total,
            sha_total,
        },
    };

    Ok(HttpResponse::Ok().json(report))
}

pub async fn get_medical_report(
    query: web::Query<ReportQuery>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let start_date = chrono::NaiveDate::parse_from_str(&query.start_date, "%Y-%m-%d")?;
    let end_date = chrono::NaiveDate::parse_from_str(&query.end_date, "%Y-%m-%d")?;
    
    // Get appointment statistics
    let appointment_stats = sqlx::query!(
        "SELECT 
            COUNT(*) as total_appointments,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_appointments,
            COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_show_appointments
         FROM appointments 
         WHERE date BETWEEN $1 AND $2",
        start_date,
        end_date
    )
    .fetch_one(database.get_pool())
    .await?;

    // Get unique patients count
    let patient_count = sqlx::query!(
        "SELECT COUNT(DISTINCT patient_id) as total_patients
         FROM appointments 
         WHERE date BETWEEN $1 AND $2",
        start_date,
        end_date
    )
    .fetch_one(database.get_pool())
    .await?;

    let report = MedicalReport {
        period: format!("{} to {}", query.start_date, query.end_date),
        total_patients: patient_count.total_patients.unwrap_or(0),
        total_appointments: appointment_stats.total_appointments.unwrap_or(0),
        completed_appointments: appointment_stats.completed_appointments.unwrap_or(0),
        cancelled_appointments: appointment_stats.cancelled_appointments.unwrap_or(0),
        no_show_appointments: appointment_stats.no_show_appointments.unwrap_or(0),
    };

    Ok(HttpResponse::Ok().json(report))
}

pub async fn get_operational_report(
    query: web::Query<ReportQuery>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let start_date = chrono::NaiveDate::parse_from_str(&query.start_date, "%Y-%m-%d")?;
    let end_date = chrono::NaiveDate::parse_from_str(&query.end_date, "%Y-%m-%d")?;
    
    // Get active users count
    let active_users = sqlx::query!(
        "SELECT COUNT(*) as active_users
         FROM users 
         WHERE is_active = true AND last_login >= $1",
        start_date
    )
    .fetch_one(database.get_pool())
    .await?;

    // Get low stock medications
    let low_stock = sqlx::query!(
        "SELECT COUNT(*) as low_stock_medications
         FROM medications 
         WHERE quantity <= reorder_level"
    )
    .fetch_one(database.get_pool())
    .await?;

    // Get expiring medications
    let expiring = sqlx::query!(
        "SELECT COUNT(*) as expiring_medications
         FROM medications 
         WHERE expiry_date <= $1",
        end_date
    )
    .fetch_one(database.get_pool())
    .await?;

    // Get pending invoices
    let pending_invoices = sqlx::query!(
        "SELECT COUNT(*) as pending_invoices
         FROM invoices 
         WHERE status = 'pending' AND date BETWEEN $1 AND $2",
        start_date,
        end_date
    )
    .fetch_one(database.get_pool())
    .await?;

    let report = OperationalReport {
        period: format!("{} to {}", query.start_date, query.end_date),
        active_users: active_users.active_users.unwrap_or(0),
        low_stock_medications: low_stock.low_stock_medications.unwrap_or(0),
        expiring_medications: expiring.expiring_medications.unwrap_or(0),
        pending_invoices: pending_invoices.pending_invoices.unwrap_or(0),
    };

    Ok(HttpResponse::Ok().json(report))
}

pub async fn get_invoice_report(
    path: web::Path<String>,
    query: web::Query<ReportQuery>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let period = path.into_inner();
    let start_date = chrono::NaiveDate::parse_from_str(&query.start_date, "%Y-%m-%d")?;
    let end_date = chrono::NaiveDate::parse_from_str(&query.end_date, "%Y-%m-%d")?;
    
    // Get invoices for the period
    let invoices = sqlx::query_as!(
        crate::models::Invoice,
        "SELECT * FROM invoices 
         WHERE date BETWEEN $1 AND $2 
         ORDER BY date DESC",
        start_date,
        end_date
    )
    .fetch_all(database.get_pool())
    .await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "period": period,
        "start_date": query.start_date,
        "end_date": query.end_date,
        "invoices": invoices
    })))
}

#[derive(serde::Deserialize)]
pub struct ReportQuery {
    pub start_date: String,
    pub end_date: String,
}
