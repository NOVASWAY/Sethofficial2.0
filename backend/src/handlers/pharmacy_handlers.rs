use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use chrono::{Utc, NaiveDate};
use sqlx::Row;

use crate::models::{Prescription, CreatePrescription, Medicine, CreateMedicine, ApiResponse, PaginatedResponse};
use crate::AppState;
use crate::middleware::auth::get_current_user;
use crate::error::Validate;

pub async fn get_prescriptions(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let limit = query.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);
    let patient_id = query.get("patient_id").and_then(|v| v.as_str());
    let status = query.get("status").and_then(|v| v.as_str());

    let offset = (page - 1) * limit;

    let mut where_clause = String::new();
    let mut param_count = 0;

    if let Some(patient_uuid) = patient_id.and_then(|s| Uuid::parse_str(s).ok()) {
        param_count += 1;
        where_clause.push_str(&format!(" AND p.patient_id = ${}", param_count));
    }

    if let Some(status_filter) = status {
        param_count += 1;
        where_clause.push_str(&format!(" AND p.status = ${}", param_count));
    }

    let prescriptions_query = format!(
        "SELECT p.id, p.patient_id, p.doctor_id, p.consultation_id, p.medicines, 
                p.instructions, p.status, p.created_at, p.updated_at,
                pt.first_name, pt.last_name, pt.phone,
                u.name as doctor_name
         FROM prescriptions p
         LEFT JOIN patients pt ON p.patient_id = pt.id
         LEFT JOIN users u ON p.doctor_id = u.id
         WHERE 1=1 {}
         ORDER BY p.created_at DESC 
         LIMIT {} OFFSET {}",
        where_clause, limit, offset
    );

    let count_query = format!(
        "SELECT COUNT(*) FROM prescriptions p WHERE 1=1 {}",
        where_clause
    );

    let prescriptions_result = sqlx::query(&prescriptions_query)
        .fetch_all(&data.db_pool)
        .await;

    let count_result = sqlx::query_scalar::<_, i64>(&count_query)
        .fetch_one(&data.db_pool)
        .await;

    match (prescriptions_result, count_result) {
        (Ok(rows), Ok(total)) => {
            let prescriptions: Vec<serde_json::Value> = rows.iter().map(|row| {
                json!({
                    "id": row.get::<Uuid, _>("id"),
                    "patient_id": row.get::<Uuid, _>("patient_id"),
                    "doctor_id": row.get::<Uuid, _>("doctor_id"),
                    "consultation_id": row.get::<Option<Uuid>, _>("consultation_id"),
                    "medicines": row.get::<serde_json::Value, _>("medicines"),
                    "instructions": row.get::<String, _>("instructions"),
                    "status": row.get::<String, _>("status"),
                    "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at"),
                    "patient_name": format!("{} {}", 
                        row.get::<Option<String>, _>("first_name").unwrap_or_default(),
                        row.get::<Option<String>, _>("last_name").unwrap_or_default()
                    ),
                    "patient_phone": row.get::<Option<String>, _>("phone"),
                    "doctor_name": row.get::<Option<String>, _>("doctor_name").unwrap_or_default()
                })
            }).collect();

            let paginated_response = PaginatedResponse {
                data: prescriptions,
                total,
                page: page as i32,
                per_page: limit as i32,
                total_pages: ((total as f64) / (limit as f64)).ceil() as i32,
            };

            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(json!(paginated_response)),
                message: None,
                error: None,
            }))
        }
        (Err(e), _) | (_, Err(e)) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to fetch prescriptions: {}", e)),
            }))
        }
    }
}

pub async fn dispense_prescription(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let prescription_id = path.into_inner();
    let now = Utc::now();

    // Start a transaction
    let mut tx = data.db_pool.begin().await
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Failed to start transaction: {}", e)))?;

    // Get the prescription with medicines
    let prescription_result = sqlx::query(
        "SELECT medicines, status FROM prescriptions WHERE id = $1"
    )
    .bind(prescription_id)
    .fetch_optional(&mut *tx)
    .await;

    match prescription_result {
        Ok(Some(row)) => {
            let medicines: serde_json::Value = row.get("medicines");
            let status: String = row.get("status");

            if status != "active" {
                tx.rollback().await
                    .map_err(|_| actix_web::error::ErrorInternalServerError("Failed to rollback transaction"))?;

                return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: None,
                    error: Some("Prescription is not active".to_string()),
                }));
            }

            // Check if all medicines are available in stock
            if let Some(medicines_array) = medicines.as_array() {
                for medicine in medicines_array {
                    if let Some(medicine_id) = medicine.get("medicine_id").and_then(|v| v.as_str()) {
                        if let Ok(med_id) = Uuid::parse_str(medicine_id) {
                            let required_quantity = medicine.get("quantity").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                            
                            let stock_result = sqlx::query_scalar::<_, i32>(
                                "SELECT current_stock FROM medicines WHERE id = $1"
                            )
                            .bind(med_id)
                            .fetch_optional(&mut *tx)
                            .await;

                            match stock_result {
                                Ok(Some(current_stock)) => {
                                    if current_stock < required_quantity {
                                        tx.rollback().await
                                            .map_err(|_| actix_web::error::ErrorInternalServerError("Failed to rollback transaction"))?;

                                        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
                                            success: false,
                                            data: None,
                                            message: None,
                                            error: Some("Insufficient stock for one or more medicines".to_string()),
                                        }));
                                    }
                                }
                                Ok(None) => {
                                    tx.rollback().await
                                        .map_err(|_| actix_web::error::ErrorInternalServerError("Failed to rollback transaction"))?;

                                    return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                                        success: false,
                                        data: None,
                                        message: None,
                                        error: Some("One or more medicines not found".to_string()),
                                    }));
                                }
                                Err(e) => {
                                    tx.rollback().await
                                        .map_err(|_| actix_web::error::ErrorInternalServerError("Failed to rollback transaction"))?;

                                    return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                                        success: false,
                                        data: None,
                                        message: None,
                                        error: Some(format!("Failed to check stock: {}", e)),
                                    }));
                                }
                            }
                        }
                    }
                }

                // Deduct stock for each medicine
                for medicine in medicines_array {
                    if let Some(medicine_id) = medicine.get("medicine_id").and_then(|v| v.as_str()) {
                        if let Ok(med_id) = Uuid::parse_str(medicine_id) {
                            let quantity = medicine.get("quantity").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                            
                            let update_result = sqlx::query(
                                "UPDATE medicines SET current_stock = current_stock - $1, updated_at = $2 WHERE id = $3"
                            )
                            .bind(quantity)
                            .bind(now)
                            .bind(med_id)
                            .execute(&mut *tx)
                            .await;

                            if let Err(e) = update_result {
                                tx.rollback().await
                                    .map_err(|_| actix_web::error::ErrorInternalServerError("Failed to rollback transaction"))?;

                                return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                                    success: false,
                                    data: None,
                                    message: None,
                                    error: Some(format!("Failed to update stock: {}", e)),
                                }));
                            }
                        }
                    }
                }
            }

            // Update prescription status to dispensed
            let update_prescription_result = sqlx::query(
                "UPDATE prescriptions SET status = 'dispensed', updated_at = $1 WHERE id = $2"
            )
            .bind(now)
            .bind(prescription_id)
            .execute(&mut *tx)
            .await;

            match update_prescription_result {
                Ok(_) => {
                    // Commit the transaction
                    tx.commit().await
                        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Failed to commit transaction: {}", e)))?;

                    Ok(HttpResponse::Ok().json(ApiResponse::<()> {
                        success: true,
                        data: None,
                        message: Some("Prescription dispensed successfully".to_string()),
                        error: None,
                    }))
                }
                Err(e) => {
                    tx.rollback().await
                        .map_err(|_| actix_web::error::ErrorInternalServerError("Failed to rollback transaction"))?;

                    Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                        success: false,
                        data: None,
                        message: None,
                        error: Some(format!("Failed to update prescription: {}", e)),
                    }))
                }
            }
        }
        Ok(None) => {
            tx.rollback().await
                .map_err(|_| actix_web::error::ErrorInternalServerError("Failed to rollback transaction"))?;

            Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Prescription not found".to_string()),
            }))
        }
        Err(e) => {
            tx.rollback().await
                .map_err(|_| actix_web::error::ErrorInternalServerError("Failed to rollback transaction"))?;

            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to fetch prescription: {}", e)),
            }))
        }
    }
}

pub async fn get_medicines(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let limit = query.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);
    let search = query.get("search").and_then(|v| v.as_str());
    let low_stock_only = query.get("low_stock_only").and_then(|v| v.as_bool()).unwrap_or(false);

    let offset = (page - 1) * limit;

    let mut where_clause = String::new();
    let mut params: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync + 'static>> = Vec::new();
    let mut param_count = 0;

    if let Some(search_term) = search {
        param_count += 1;
        where_clause.push_str(&format!(" AND (name ILIKE ${} OR generic_name ILIKE ${})", param_count, param_count));
        params.push(Box::new(format!("%{}%", search_term)));
    }

    if low_stock_only {
        param_count += 1;
        where_clause.push_str(&format!(" AND current_stock <= minimum_stock"));
    }

    let medicines_query = format!(
        "SELECT id, name, generic_name, dosage_form, strength, manufacturer, 
                batch_number, expiry_date, current_stock, minimum_stock, unit_price, 
                created_at, updated_at
         FROM medicines 
         WHERE 1=1 {}
         ORDER BY name 
         LIMIT {} OFFSET {}",
        where_clause, limit, offset
    );

    let count_query = format!(
        "SELECT COUNT(*) FROM medicines WHERE 1=1 {}",
        where_clause
    );

    let medicines_result = sqlx::query(&medicines_query)
        .fetch_all(&data.db_pool)
        .await;

    let count_result = sqlx::query_scalar::<_, i64>(&count_query)
        .fetch_one(&data.db_pool)
        .await;

    match (medicines_result, count_result) {
        (Ok(rows), Ok(total)) => {
            let medicines: Vec<serde_json::Value> = rows.iter().map(|row| {
                json!({
                    "id": row.get::<Uuid, _>("id"),
                    "name": row.get::<String, _>("name"),
                    "generic_name": row.get::<String, _>("generic_name"),
                    "dosage_form": row.get::<String, _>("dosage_form"),
                    "strength": row.get::<String, _>("strength"),
                    "manufacturer": row.get::<String, _>("manufacturer"),
                    "batch_number": row.get::<Option<String>, _>("batch_number"),
                    "expiry_date": row.get::<Option<NaiveDate>, _>("expiry_date"),
                    "current_stock": row.get::<i32, _>("current_stock"),
                    "minimum_stock": row.get::<i32, _>("minimum_stock"),
                    "unit_price": row.get::<f64, _>("unit_price"),
                    "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at")
                })
            }).collect();

            let paginated_response = PaginatedResponse {
                data: medicines,
                total,
                page: page as i32,
                per_page: limit as i32,
                total_pages: ((total as f64) / (limit as f64)).ceil() as i32,
            };

            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(json!(paginated_response)),
                message: None,
                error: None,
            }))
        }
        (Err(e), _) | (_, Err(e)) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to fetch medicines: {}", e)),
            }))
        }
    }
}

pub async fn add_medicine(
    req: web::Json<CreateMedicine>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let medicine_data = req.into_inner();
    
    // Validate medicine data
    if let Err(validation_errors) = medicine_data.validate() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<serde_json::Value> {
            success: false,
            data: None,
            message: Some("Validation failed".to_string()),
            error: Some(validation_errors.to_api_error().message),
        }));
    }
    
    let medicine_id = Uuid::new_v4();
    let now = Utc::now();

    let result = sqlx::query(
        r#"
        INSERT INTO medicines (
            id, name, generic_name, dosage_form, strength, manufacturer,
            current_stock, minimum_stock, unit_price, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
        "#
    )
    .bind(medicine_id)
    .bind(&medicine_data.name)
    .bind(&medicine_data.generic_name)
    .bind(&medicine_data.dosage_form)
    .bind(&medicine_data.strength)
    .bind(&medicine_data.manufacturer)
    .bind(medicine_data.stock_quantity)
    .bind(medicine_data.minimum_stock)
    .bind(medicine_data.unit_price)
    .bind(now)
    .bind(now)
    .execute(&data.db_pool)
    .await;

    match result {
        Ok(_) => {
            Ok(HttpResponse::Created().json(ApiResponse {
                success: true,
                data: Some(json!({"id": medicine_id})),
                message: Some("Medicine added successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to add medicine: {}", e)),
            }))
        }
    }
}

pub async fn update_medicine(
    path: web::Path<Uuid>,
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let medicine_id = path.into_inner();
    let update_data = req.into_inner();
    let now = Utc::now();

    // Build dynamic update query based on provided fields
    let mut set_clauses = Vec::new();
    let mut param_count = 0;
    let mut params: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync + 'static>> = Vec::new();

    if let Some(name) = update_data.get("name").and_then(|v| v.as_str()) {
        param_count += 1;
        set_clauses.push(format!("name = ${}", param_count));
        params.push(Box::new(name.to_string()));
    }

    if let Some(generic_name) = update_data.get("generic_name").and_then(|v| v.as_str()) {
        param_count += 1;
        set_clauses.push(format!("generic_name = ${}", param_count));
        params.push(Box::new(generic_name.to_string()));
    }

    if let Some(dosage_form) = update_data.get("dosage_form").and_then(|v| v.as_str()) {
        param_count += 1;
        set_clauses.push(format!("dosage_form = ${}", param_count));
        params.push(Box::new(dosage_form.to_string()));
    }

    if let Some(strength) = update_data.get("strength").and_then(|v| v.as_str()) {
        param_count += 1;
        set_clauses.push(format!("strength = ${}", param_count));
        params.push(Box::new(strength.to_string()));
    }

    if let Some(manufacturer) = update_data.get("manufacturer").and_then(|v| v.as_str()) {
        param_count += 1;
        set_clauses.push(format!("manufacturer = ${}", param_count));
        params.push(Box::new(manufacturer.to_string()));
    }

    if let Some(current_stock) = update_data.get("current_stock").and_then(|v| v.as_i64()) {
        param_count += 1;
        set_clauses.push(format!("current_stock = ${}", param_count));
        params.push(Box::new(current_stock as i32));
    }

    if let Some(minimum_stock) = update_data.get("minimum_stock").and_then(|v| v.as_i64()) {
        param_count += 1;
        set_clauses.push(format!("minimum_stock = ${}", param_count));
        params.push(Box::new(minimum_stock as i32));
    }

    if let Some(unit_price) = update_data.get("unit_price").and_then(|v| v.as_f64()) {
        param_count += 1;
        set_clauses.push(format!("unit_price = ${}", param_count));
        params.push(Box::new(unit_price));
    }

    if set_clauses.is_empty() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("No fields to update".to_string()),
        }));
    }

    param_count += 1;
    set_clauses.push(format!("updated_at = ${}", param_count));
    params.push(Box::new(now));

    param_count += 1;
    let update_query = format!(
        "UPDATE medicines SET {} WHERE id = ${}",
        set_clauses.join(", "),
        param_count
    );
    params.push(Box::new(medicine_id));

    let result = sqlx::query(&update_query)
        .execute(&data.db_pool)
        .await;

    match result {
        Ok(result) => {
            if result.rows_affected() > 0 {
                Ok(HttpResponse::Ok().json(ApiResponse::<()> {
                    success: true,
                    data: None,
                    message: Some("Medicine updated successfully".to_string()),
                    error: None,
                }))
            } else {
                Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: None,
                    error: Some("Medicine not found".to_string()),
                }))
            }
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to update medicine: {}", e)),
            }))
        }
    }
}

pub async fn get_stock(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    let low_stock_only = query.get("low_stock_only").and_then(|v| v.as_bool()).unwrap_or(false);
    let expiring_soon = query.get("expiring_soon").and_then(|v| v.as_bool()).unwrap_or(false);

    let mut where_clause = String::new();
    
    if low_stock_only {
        where_clause.push_str(" WHERE current_stock <= minimum_stock");
    }
    
    if expiring_soon {
        if where_clause.is_empty() {
            where_clause.push_str(" WHERE expiry_date <= CURRENT_DATE + INTERVAL '30 days'");
        } else {
            where_clause.push_str(" AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'");
        }
    }

    let stock_query = format!(
        "SELECT id, name, generic_name, dosage_form, strength, manufacturer,
                batch_number, expiry_date, current_stock, minimum_stock, unit_price,
                CASE 
                    WHEN current_stock <= minimum_stock THEN 'low_stock'
                    WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
                    ELSE 'normal'
                END as stock_status
         FROM medicines {}
         ORDER BY 
             CASE 
                 WHEN current_stock <= minimum_stock THEN 1
                 WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 2
                 ELSE 3
             END,
             name",
        where_clause
    );

    let result = sqlx::query(&stock_query)
        .fetch_all(&data.db_pool)
        .await;

    match result {
        Ok(rows) => {
            let stock_items: Vec<serde_json::Value> = rows.iter().map(|row| {
                json!({
                    "id": row.get::<Uuid, _>("id"),
                    "name": row.get::<String, _>("name"),
                    "generic_name": row.get::<String, _>("generic_name"),
                    "dosage_form": row.get::<String, _>("dosage_form"),
                    "strength": row.get::<String, _>("strength"),
                    "manufacturer": row.get::<String, _>("manufacturer"),
                    "batch_number": row.get::<Option<String>, _>("batch_number"),
                    "expiry_date": row.get::<Option<NaiveDate>, _>("expiry_date"),
                    "current_stock": row.get::<i32, _>("current_stock"),
                    "minimum_stock": row.get::<i32, _>("minimum_stock"),
                    "unit_price": row.get::<f64, _>("unit_price"),
                    "stock_status": row.get::<String, _>("stock_status")
                })
            }).collect();

            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(json!(stock_items)),
                message: None,
                error: None,
            }))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to fetch stock: {}", e)),
            }))
        }
    }
}

pub async fn receive_stock(
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let stock_data = req.into_inner();
    let now = Utc::now();

    let medicine_id = stock_data.get("medicine_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| actix_web::error::ErrorBadRequest("Invalid medicine_id"))?;

    let quantity = stock_data.get("quantity")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| actix_web::error::ErrorBadRequest("Invalid quantity"))? as i32;

    let batch_number = stock_data.get("batch_number").and_then(|v| v.as_str());
    let expiry_date = stock_data.get("expiry_date")
        .and_then(|v| v.as_str())
        .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    // Start a transaction
    let mut tx = data.db_pool.begin().await
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Failed to start transaction: {}", e)))?;

    // Update the medicine stock
    let update_result = sqlx::query(
        r#"
        UPDATE medicines 
        SET current_stock = current_stock + $1,
            batch_number = COALESCE($2, batch_number),
            expiry_date = COALESCE($3, expiry_date),
            updated_at = $4
        WHERE id = $5
        "#
    )
    .bind(quantity)
    .bind(batch_number)
    .bind(expiry_date)
    .bind(now)
    .bind(medicine_id)
    .execute(&mut *tx)
    .await;

    match update_result {
        Ok(result) => {
            if result.rows_affected() > 0 {
                // Commit the transaction
                tx.commit().await
                    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Failed to commit transaction: {}", e)))?;

                Ok(HttpResponse::Ok().json(ApiResponse::<()> {
                    success: true,
                    data: None,
                    message: Some("Stock received successfully".to_string()),
                    error: None,
                }))
            } else {
                // Rollback the transaction
                tx.rollback().await
                    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Failed to rollback transaction: {}", e)))?;

                Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: None,
                    error: Some("Medicine not found".to_string()),
                }))
            }
        }
        Err(e) => {
            // Rollback the transaction
            tx.rollback().await
                .map_err(|_| actix_web::error::ErrorInternalServerError("Failed to rollback transaction"))?;

            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to receive stock: {}", e)),
            }))
        }
    }
}
