use actix_web::{web, HttpResponse, Result};
use uuid::Uuid;

use crate::models::Invoice;
use crate::database::Database;

pub async fn get_invoices(
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let invoices = sqlx::query_as!(
        Invoice,
        "SELECT * FROM invoices ORDER BY created_at DESC"
    )
    .fetch_all(database.get_pool())
    .await?;

    Ok(HttpResponse::Ok().json(invoices))
}

pub async fn get_invoice(
    path: web::Path<Uuid>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let invoice_id = path.into_inner();
    
    let invoice = sqlx::query_as!(
        Invoice,
        "SELECT * FROM invoices WHERE id = $1",
        invoice_id
    )
    .fetch_optional(database.get_pool())
    .await?
    .ok_or_else(|| actix_web::error::ErrorNotFound("Invoice not found"))?;

    Ok(HttpResponse::Ok().json(invoice))
}

pub async fn create_invoice(
    req: web::Json<crate::models::CreateInvoiceRequest>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    // Generate invoice number
    let invoice_number = format!("INV{:06}", chrono::Utc::now().timestamp() % 1000000);
    
    // Calculate totals
    let subtotal: rust_decimal::Decimal = req.services.iter()
        .map(|s| s.unit_price * rust_decimal::Decimal::from(s.quantity))
        .sum();
    let tax = subtotal * rust_decimal::Decimal::from_str("0.16").unwrap(); // 16% VAT
    let total = subtotal + tax;
    
    let invoice = sqlx::query_as!(
        Invoice,
        "INSERT INTO invoices (
            invoice_number, patient_id, date, invoice_type,
            subtotal, tax, total, status, notes, sha_details, payment_details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *",
        invoice_number,
        req.patient_id,
        chrono::Utc::now().date_naive(),
        req.invoice_type as _,
        subtotal,
        tax,
        total,
        crate::models::InvoiceStatus::Pending as _,
        req.notes,
        req.sha_details,
        req.payment_details
    )
    .fetch_one(database.get_pool())
    .await?;

    // Insert invoice services
    for service in &req.services {
        sqlx::query!(
            "INSERT INTO invoice_services (invoice_id, description, quantity, unit_price, total_price)
             VALUES ($1, $2, $3, $4, $5)",
            invoice.id,
            service.description,
            service.quantity,
            service.unit_price,
            service.unit_price * rust_decimal::Decimal::from(service.quantity)
        )
        .execute(database.get_pool())
        .await?;
    }

    Ok(HttpResponse::Created().json(invoice))
}

pub async fn update_invoice(
    path: web::Path<Uuid>,
    req: web::Json<crate::models::CreateInvoiceRequest>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let invoice_id = path.into_inner();
    
    // Calculate totals
    let subtotal: rust_decimal::Decimal = req.services.iter()
        .map(|s| s.unit_price * rust_decimal::Decimal::from(s.quantity))
        .sum();
    let tax = subtotal * rust_decimal::Decimal::from_str("0.16").unwrap(); // 16% VAT
    let total = subtotal + tax;
    
    let invoice = sqlx::query_as!(
        Invoice,
        "UPDATE invoices SET
            patient_id = $2, invoice_type = $3, subtotal = $4,
            tax = $5, total = $6, notes = $7, sha_details = $8, payment_details = $9
         WHERE id = $1
         RETURNING *",
        invoice_id,
        req.patient_id,
        req.invoice_type as _,
        subtotal,
        tax,
        total,
        req.notes,
        req.sha_details,
        req.payment_details
    )
    .fetch_optional(database.get_pool())
    .await?
    .ok_or_else(|| actix_web::error::ErrorNotFound("Invoice not found"))?;

    // Update invoice services
    sqlx::query!(
        "DELETE FROM invoice_services WHERE invoice_id = $1",
        invoice_id
    )
    .execute(database.get_pool())
    .await?;

    for service in &req.services {
        sqlx::query!(
            "INSERT INTO invoice_services (invoice_id, description, quantity, unit_price, total_price)
             VALUES ($1, $2, $3, $4, $5)",
            invoice_id,
            service.description,
            service.quantity,
            service.unit_price,
            service.unit_price * rust_decimal::Decimal::from(service.quantity)
        )
        .execute(database.get_pool())
        .await?;
    }

    Ok(HttpResponse::Ok().json(invoice))
}

pub async fn delete_invoice(
    path: web::Path<Uuid>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let invoice_id = path.into_inner();
    
    sqlx::query!(
        "DELETE FROM invoices WHERE id = $1",
        invoice_id
    )
    .execute(database.get_pool())
    .await?;

    Ok(HttpResponse::NoContent().finish())
}

pub async fn get_invoices_by_patient(
    path: web::Path<Uuid>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();
    
    let invoices = sqlx::query_as!(
        Invoice,
        "SELECT * FROM invoices WHERE patient_id = $1 ORDER BY created_at DESC",
        patient_id
    )
    .fetch_all(database.get_pool())
    .await?;

    Ok(HttpResponse::Ok().json(invoices))
}

pub async fn get_invoices_by_date_range(
    query: web::Query<DateRangeQuery>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let start_date = chrono::NaiveDate::parse_from_str(&query.start_date, "%Y-%m-%d")?;
    let end_date = chrono::NaiveDate::parse_from_str(&query.end_date, "%Y-%m-%d")?;
    
    let invoices = sqlx::query_as!(
        Invoice,
        "SELECT * FROM invoices WHERE date BETWEEN $1 AND $2 ORDER BY date DESC",
        start_date,
        end_date
    )
    .fetch_all(database.get_pool())
    .await?;

    Ok(HttpResponse::Ok().json(invoices))
}

pub async fn get_invoices_by_type(
    path: web::Path<String>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let invoice_type = path.into_inner();
    
    let invoices = sqlx::query_as!(
        Invoice,
        "SELECT * FROM invoices WHERE invoice_type = $1 ORDER BY created_at DESC",
        invoice_type as crate::models::InvoiceType
    )
    .fetch_all(database.get_pool())
    .await?;

    Ok(HttpResponse::Ok().json(invoices))
}

#[derive(serde::Deserialize)]
pub struct DateRangeQuery {
    pub start_date: String,
    pub end_date: String,
}
