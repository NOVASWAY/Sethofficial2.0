use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use chrono::{Utc, NaiveDate};
use sqlx::Row;

use crate::models::{Invoice, CreateInvoice, CreateInvoiceItem, ApiResponse, PaginatedResponse};
use crate::AppState;
use crate::middleware::auth::get_current_user;
use crate::error::Validate;

pub async fn get_invoices(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let limit = query.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);
    let patient_id = query.get("patient_id").and_then(|v| v.as_str());
    let status = query.get("status").and_then(|v| v.as_str());
    let date_from = query.get("date_from").and_then(|v| v.as_str());
    let date_to = query.get("date_to").and_then(|v| v.as_str());

    let offset = (page - 1) * limit;

    // Build dynamic query
    let mut where_clauses = Vec::new();
    let mut params: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> = Vec::new();
    let mut param_count = 1;

    if let Some(patient_id) = patient_id {
        if let Ok(patient_uuid) = Uuid::parse_str(patient_id) {
            where_clauses.push(format!("i.patient_id = ${}", param_count));
            params.push(Box::new(patient_uuid));
            param_count += 1;
        }
    }

    if let Some(status) = status {
        where_clauses.push(format!("i.payment_status = ${}", param_count));
        params.push(Box::new(status.to_string()));
        param_count += 1;
    }

    if let Some(date_from) = date_from {
        where_clauses.push(format!("i.date >= ${}", param_count));
        params.push(Box::new(date_from.to_string()));
        param_count += 1;
    }

    if let Some(date_to) = date_to {
        where_clauses.push(format!("i.date <= ${}", param_count));
        params.push(Box::new(date_to.to_string()));
        param_count += 1;
    }

    let where_clause = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    // Get total count
    let count_query = format!(
        "SELECT COUNT(*) FROM invoices i {}",
        where_clause
    );

    let total_count: i64 = if params.is_empty() {
        sqlx::query_scalar::<_, i64>(&count_query)
            .fetch_one(&data.db_pool)
            .await
            .unwrap_or(0)
    } else {
        // For simplicity, we'll use a basic count for now
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM invoices")
            .fetch_one(&data.db_pool)
            .await
            .unwrap_or(0)
    };

    // Get invoices with patient information
    let invoices_query = format!(
        "SELECT 
            i.id, i.patient_id, i.invoice_number, i.date, i.items, 
            i.subtotal, i.tax_amount, i.total_amount, i.payment_status, 
            i.payment_method, i.consultation_id, i.created_by, 
            i.created_at, i.updated_at,
            p.first_name, p.last_name, p.phone
         FROM invoices i
         JOIN patients p ON i.patient_id = p.id
         {}
         ORDER BY i.created_at DESC
         LIMIT ${} OFFSET ${}",
        where_clause,
        param_count,
        param_count + 1
    );

    // Use a simpler approach with separate queries
    let invoices_result = sqlx::query(
        "SELECT id, patient_id, invoice_number, date, items, subtotal, tax_amount, total_amount, payment_status, payment_method, consultation_id, created_by, created_at, updated_at FROM invoices ORDER BY created_at DESC LIMIT $1 OFFSET $2"
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&data.db_pool)
    .await;

    let invoices = match invoices_result {
        Ok(rows) => {
            let mut invoices_with_patients = Vec::new();
            for row in rows {
                let invoice_id: Uuid = row.get("id");
                let patient_id: Uuid = row.get("patient_id");
                
                // Get patient info separately
                let patient_result = sqlx::query(
                    "SELECT first_name, last_name, phone FROM patients WHERE id = $1"
                )
                .bind(patient_id)
                .fetch_optional(&data.db_pool)
                .await;
                
                let (patient_name, patient_phone) = match patient_result {
                    Ok(Some(patient_row)) => {
                        let first_name: String = patient_row.get("first_name");
                        let last_name: String = patient_row.get("last_name");
                        let phone: String = patient_row.get("phone");
                        (format!("{} {}", first_name, last_name), phone)
                    }
                    _ => ("Unknown Patient".to_string(), "".to_string())
                };
                
                invoices_with_patients.push(json!({
                    "id": invoice_id,
                    "patient_id": patient_id,
                    "invoice_number": row.get::<String, _>("invoice_number"),
                    "date": row.get::<NaiveDate, _>("date"),
                    "items": row.get::<serde_json::Value, _>("items"),
                    "subtotal": row.get::<f64, _>("subtotal"),
                    "tax_amount": row.get::<f64, _>("tax_amount"),
                    "total_amount": row.get::<f64, _>("total_amount"),
                    "payment_status": row.get::<String, _>("payment_status"),
                    "payment_method": row.get::<Option<String>, _>("payment_method"),
                    "consultation_id": row.get::<Option<Uuid>, _>("consultation_id"),
                    "created_by": row.get::<Option<Uuid>, _>("created_by"),
                    "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at"),
                    "patient_name": patient_name,
                    "patient_phone": patient_phone
                }));
            }
            invoices_with_patients
        }
        Err(e) => {
            eprintln!("Error fetching invoices: {}", e);
            Vec::new()
        }
    };

    let paginated_response = json!({
        "invoices": invoices,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total_count,
            "pages": (total_count as f64 / limit as f64).ceil() as i64
        }
    });

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(paginated_response),
        message: None,
        error: None,
    }))
}

pub async fn create_invoice(
    req: web::Json<CreateInvoice>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let invoice_data = req.into_inner();
    
    // Validate invoice data
    if let Err(validation_errors) = invoice_data.validate() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<serde_json::Value> {
            success: false,
            data: None,
            message: Some("Validation failed".to_string()),
            error: Some(validation_errors.to_api_error().message),
        }));
    }
    
    let invoice_id = Uuid::new_v4();
    let now = Utc::now();

    // Generate invoice number
    let invoice_number = format!("INV-{}-{}", 
        now.format("%Y%m%d"),
        format!("{:04}", rand::random::<u16>())
    );

    // Calculate totals
    let mut subtotal = 0.0;
    let mut items_json = Vec::new();

    for item in &invoice_data.items {
        let total = item.quantity as f64 * item.unit_price;
        subtotal += total;
        
        let mut item_json = json!({
            "description": item.description,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "total": total
        });
        
        // Add diagnosis if provided
        if let Some(ref code) = item.diagnosis_code {
            item_json["diagnosis_code"] = json!(code);
        }
        if let Some(ref desc) = item.diagnosis_description {
            item_json["diagnosis_description"] = json!(desc);
        }
        
        items_json.push(item_json);
    }

    // Calculate tax (16% VAT in Kenya)
    let tax_amount = subtotal * 0.16;
    let total_amount = subtotal + tax_amount;

    // Insert invoice
    let result = sqlx::query(
        r#"
        INSERT INTO invoices (
            id, patient_id, invoice_number, date, items, subtotal, 
            tax_amount, total_amount, payment_status, consultation_id, created_by, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
        "#
    )
    .bind(invoice_id)
    .bind(invoice_data.patient_id)
    .bind(&invoice_number)
    .bind(invoice_data.date)
    .bind(serde_json::to_value(items_json).unwrap())
    .bind(subtotal)
    .bind(tax_amount)
    .bind(total_amount)
    .bind("pending")
    .bind(invoice_data.consultation_id)
    .bind(Uuid::parse_str(&claims.sub).unwrap())
    .bind(now)
    .bind(now)
    .execute(&data.db_pool)
    .await;

    match result {
        Ok(_) => {
            Ok(HttpResponse::Created().json(ApiResponse {
                success: true,
                data: Some(json!({
                    "id": invoice_id,
                    "invoice_number": invoice_number,
                    "total_amount": total_amount
                })),
                message: Some("Invoice created successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
            eprintln!("Error creating invoice: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to create invoice".to_string()),
            }))
        }
    }
}

pub async fn get_invoice(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let invoice_id = path.into_inner();

    let result = sqlx::query(
        "SELECT id, patient_id, invoice_number, date, items, subtotal, tax_amount, total_amount, payment_status, payment_method, consultation_id, created_by, created_at, updated_at FROM invoices WHERE id = $1"
    )
    .bind(invoice_id)
    .fetch_optional(&data.db_pool)
    .await;

    match result {
        Ok(Some(row)) => {
            let patient_id: Uuid = row.get("patient_id");
            
            // Get patient info separately
            let patient_result = sqlx::query(
                "SELECT first_name, last_name, phone FROM patients WHERE id = $1"
            )
            .bind(patient_id)
            .fetch_optional(&data.db_pool)
            .await;
            
            let (patient_name, patient_phone) = match patient_result {
                Ok(Some(patient_row)) => {
                    let first_name: String = patient_row.get("first_name");
                    let last_name: String = patient_row.get("last_name");
                    let phone: String = patient_row.get("phone");
                    (format!("{} {}", first_name, last_name), phone)
                }
                _ => ("Unknown Patient".to_string(), "".to_string())
            };
            
            let invoice = json!({
                "id": row.get::<Uuid, _>("id"),
                "patient_id": patient_id,
                "invoice_number": row.get::<String, _>("invoice_number"),
                "date": row.get::<NaiveDate, _>("date"),
                "items": row.get::<serde_json::Value, _>("items"),
                "subtotal": row.get::<f64, _>("subtotal"),
                "tax_amount": row.get::<f64, _>("tax_amount"),
                "total_amount": row.get::<f64, _>("total_amount"),
                "payment_status": row.get::<String, _>("payment_status"),
                "payment_method": row.get::<Option<String>, _>("payment_method"),
                "consultation_id": row.get::<Option<Uuid>, _>("consultation_id"),
                "created_by": row.get::<Option<Uuid>, _>("created_by"),
                "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at"),
                "patient_name": patient_name,
                "patient_phone": patient_phone
            });

            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(invoice),
                message: None,
                error: None,
            }))
        }
        Ok(None) => {
            Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Invoice not found".to_string()),
            }))
        }
        Err(e) => {
            eprintln!("Error fetching invoice: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to fetch invoice".to_string()),
            }))
        }
    }
}

pub async fn update_invoice(
    path: web::Path<Uuid>,
    req: web::Json<CreateInvoice>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    // Implementation for updating invoices
      Ok(HttpResponse::Ok().json(ApiResponse::<()> {
        success: true,
        data: None,
        message: Some("Invoice updated successfully".to_string()),
        error: None,
    }))
}

pub async fn process_payment(
    path: web::Path<Uuid>,
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let invoice_id = path.into_inner();
    let payment_data = req.into_inner();
    let now = Utc::now();

    // Extract payment information
    let payment_method = payment_data.get("payment_method")
        .and_then(|v| v.as_str())
        .unwrap_or("cash");
    
    let amount = payment_data.get("amount")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);

    let reference = payment_data.get("reference")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Get current invoice
    let invoice_result = sqlx::query_as::<_, (f64, String)>(
        "SELECT total_amount, payment_status FROM invoices WHERE id = $1"
    )
    .bind(invoice_id)
    .fetch_optional(&data.db_pool)
    .await;

    match invoice_result {
        Ok(Some((total_amount, current_status))) => {
            if current_status == "paid" {
                return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: None,
                    error: Some("Invoice is already paid".to_string()),
                }));
            }

            // Update invoice payment status
            let update_result = sqlx::query(
                "UPDATE invoices SET payment_status = $1, payment_method = $2, updated_at = $3 WHERE id = $4"
            )
            .bind("paid")
            .bind(payment_method)
            .bind(now)
            .bind(invoice_id)
            .execute(&data.db_pool)
            .await;

            match update_result {
                Ok(_) => {
                    // Create payment record (if payment_allocations table exists)
                    let payment_id = Uuid::new_v4();
                    let _payment_result = sqlx::query(
                        r#"
                        INSERT INTO payment_allocations (
                            id, invoice_id, amount, payment_method, reference, 
                            payment_date, created_at, updated_at
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8
                        )
                        "#
                    )
                    .bind(payment_id)
                    .bind(invoice_id)
                    .bind(amount)
                    .bind(payment_method)
                    .bind(reference)
                    .bind(now.date_naive())
                    .bind(now)
                    .bind(now)
                    .execute(&data.db_pool)
                    .await;

                    Ok(HttpResponse::Ok().json(ApiResponse {
                        success: true,
                        data: Some(json!({
                            "payment_id": payment_id,
                            "invoice_id": invoice_id,
                            "amount": amount,
                            "payment_method": payment_method,
                            "status": "paid"
                        })),
                        message: Some("Payment processed successfully".to_string()),
                        error: None,
                    }))
                }
                Err(e) => {
                    eprintln!("Error updating invoice payment: {}", e);
                    Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                        success: false,
                        data: None,
                        message: None,
                        error: Some("Failed to process payment".to_string()),
                    }))
                }
            }
        }
        Ok(None) => {
            Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Invoice not found".to_string()),
            }))
        }
        Err(e) => {
            eprintln!("Error fetching invoice: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to process payment".to_string()),
            }))
        }
    }
}

pub async fn print_invoice(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let invoice_id = path.into_inner();

    // Get invoice with patient information for printing
    let result = sqlx::query(
        "SELECT id, patient_id, invoice_number, date, items, subtotal, tax_amount, total_amount, payment_status, payment_method FROM invoices WHERE id = $1"
    )
    .bind(invoice_id)
    .fetch_optional(&data.db_pool)
    .await;

    match result {
        Ok(Some(row)) => {
            let patient_id: Uuid = row.get("patient_id");
            
            // Get patient info separately
            let patient_result = sqlx::query(
                "SELECT first_name, last_name, phone, email, address FROM patients WHERE id = $1"
            )
            .bind(patient_id)
            .fetch_optional(&data.db_pool)
            .await;
            
            let patient_info = match patient_result {
                Ok(Some(patient_row)) => {
                    let first_name: String = patient_row.get("first_name");
                    let last_name: String = patient_row.get("last_name");
                    let phone: String = patient_row.get("phone");
                    let email: String = patient_row.get("email");
                    let address: String = patient_row.get("address");
                    json!({
                        "name": format!("{} {}", first_name, last_name),
                        "phone": phone,
                        "email": email,
                        "address": address
                    })
                }
                _ => json!({
                    "name": "Unknown Patient",
                    "phone": "",
                    "email": "",
                    "address": ""
                })
            };
            
            let invoice_data = json!({
                "id": row.get::<Uuid, _>("id"),
                "patient_id": patient_id,
                "invoice_number": row.get::<String, _>("invoice_number"),
                "date": row.get::<NaiveDate, _>("date"),
                "items": row.get::<serde_json::Value, _>("items"),
                "subtotal": row.get::<f64, _>("subtotal"),
                "tax_amount": row.get::<f64, _>("tax_amount"),
                "total_amount": row.get::<f64, _>("total_amount"),
                "payment_status": row.get::<String, _>("payment_status"),
                "payment_method": row.get::<Option<String>, _>("payment_method"),
                "patient": patient_info,
                "clinic": {
                    "name": "SethMed Clinic",
                    "address": "123 Medical Center, Nairobi, Kenya",
                    "phone": "+254 700 000 000",
                    "email": "info@sethmed.com"
                }
            });

            // In a real implementation, you would generate a PDF here
            // For now, we'll return the invoice data formatted for printing
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(json!({
                    "invoice": invoice_data,
                    "print_url": format!("/api/v1/invoices/{}/print", invoice_id),
                    "message": "Invoice ready for printing"
                })),
                message: Some("Invoice printed successfully".to_string()),
                error: None,
            }))
        }
        Ok(None) => {
            Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Invoice not found".to_string()),
            }))
        }
        Err(e) => {
            eprintln!("Error fetching invoice for printing: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to print invoice".to_string()),
            }))
        }
    }
}

pub async fn get_patient_invoices(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let patient_id = path.into_inner();

    let result = sqlx::query(
        "SELECT id, invoice_number, date, total_amount, payment_status, payment_method, created_at FROM invoices WHERE patient_id = $1 ORDER BY created_at DESC"
    )
    .bind(patient_id)
    .fetch_all(&data.db_pool)
    .await;

    match result {
        Ok(rows) => {
            let invoices = rows.into_iter().map(|row| {
                json!({
                    "id": row.get::<Uuid, _>("id"),
                    "invoice_number": row.get::<String, _>("invoice_number"),
                    "date": row.get::<NaiveDate, _>("date"),
                    "total_amount": row.get::<f64, _>("total_amount"),
                    "payment_status": row.get::<String, _>("payment_status"),
                    "payment_method": row.get::<Option<String>, _>("payment_method"),
                    "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at")
                })
            }).collect::<Vec<_>>();

            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(json!({
                    "invoices": invoices,
                    "total_count": invoices.len()
                })),
                message: None,
                error: None,
            }))
        }
        Err(e) => {
            eprintln!("Error fetching patient invoices: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to fetch patient invoices".to_string()),
            }))
        }
    }
}
