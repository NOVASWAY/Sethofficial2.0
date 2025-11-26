use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::Utc;
use sqlx::Row;
use tracing::{info, error};

use crate::models::{LabTestOrder, CreateLabTestOrder, UpdateLabTestOrder, ApiResponse};
use crate::AppState;
use crate::middleware::auth::get_current_user;

// Generate lab test order number
fn generate_order_number() -> String {
    let now = Utc::now();
    let date_str = now.format("%Y%m%d").to_string();
    let random = rand::random::<u16>() % 10000;
    format!("LAB-{}-{:04}", date_str, random)
}

// Create lab test order
pub async fn create_lab_order(
    req: web::Json<CreateLabTestOrder>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let order_data = req.into_inner();
    let order_id = Uuid::new_v4();
    let order_number = generate_order_number();
    let now = Utc::now();

    // Validate priority
    let priority = order_data.priority.unwrap_or_else(|| "routine".to_string());
    if !["routine", "urgent", "stat"].contains(&priority.as_str()) {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Invalid priority. Must be: routine, urgent, or stat".to_string()),
        }));
    }

    match sqlx::query(
        r#"
        INSERT INTO lab_test_orders (
            id, order_number, patient_id, consultation_id, ordering_clinician_id,
            test_type, test_code, test_name, priority, clinical_indication,
            sample_type, status, ordered_at, created_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id, order_number, patient_id, consultation_id, ordering_clinician_id,
                  test_type, test_code, test_name, priority, clinical_indication,
                  sample_type, sample_collection_date, status, notes, ordered_at,
                  collected_at, completed_at, created_by, created_at, updated_at
        "#
    )
    .bind(order_id)
    .bind(&order_number)
    .bind(order_data.patient_id)
    .bind(order_data.consultation_id)
    .bind(order_data.ordering_clinician_id)
    .bind(&order_data.test_type)
    .bind(&order_data.test_code)
    .bind(&order_data.test_name)
    .bind(&priority)
    .bind(&order_data.clinical_indication)
    .bind(&order_data.sample_type)
    .bind("pending")
    .bind(now)
    .bind(now)
    .bind(Uuid::parse_str(&claims.sub).ok())
    .bind(now)
    .bind(now)
    .fetch_one(&data.db_pool)
    .await
    {
        Ok(row) => {
            let order = LabTestOrder {
                id: row.get("id"),
                order_number: row.get("order_number"),
                patient_id: row.get("patient_id"),
                consultation_id: row.get("consultation_id"),
                ordering_clinician_id: row.get("ordering_clinician_id"),
                test_type: row.get("test_type"),
                test_code: row.get("test_code"),
                test_name: row.get("test_name"),
                priority: row.get("priority"),
                clinical_indication: row.get("clinical_indication"),
                sample_type: row.get("sample_type"),
                sample_collection_date: row.get("sample_collection_date"),
                status: row.get("status"),
                notes: row.get("notes"),
                ordered_at: row.get("ordered_at"),
                collected_at: row.get("collected_at"),
                completed_at: row.get("completed_at"),
                created_by: row.get("created_by"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            };

            info!("Lab test order created: {}", order_number);

            Ok(HttpResponse::Created().json(ApiResponse {
                success: true,
                data: Some(order),
                message: Some("Lab test order created successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
            error!("Failed to create lab test order: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to create lab test order".to_string()),
            }))
        }
    }
}

// Get all lab test orders
pub async fn get_lab_orders(
    data: web::Data<AppState>,
    query: web::Query<LabOrderQueryParams>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let params = query.into_inner();
    let mut query_builder = sqlx::QueryBuilder::new(
        "SELECT id, order_number, patient_id, consultation_id, ordering_clinician_id,
                test_type, test_code, test_name, priority, clinical_indication,
                sample_type, sample_collection_date, status, notes, ordered_at,
                collected_at, completed_at, created_by, created_at, updated_at
         FROM lab_test_orders WHERE 1=1"
    );

    if let Some(patient_id) = params.patient_id {
        query_builder.push(" AND patient_id = ");
        query_builder.push_bind(patient_id);
    }

    if let Some(status) = params.status {
        query_builder.push(" AND status = ");
        query_builder.push_bind(status);
    }

    if let Some(test_type) = params.test_type {
        query_builder.push(" AND test_type = ");
        query_builder.push_bind(test_type);
    }

    if let Some(priority) = params.priority {
        query_builder.push(" AND priority = ");
        query_builder.push_bind(priority);
    }

    query_builder.push(" ORDER BY ordered_at DESC");

    if let Some(limit) = params.limit {
        query_builder.push(" LIMIT ");
        query_builder.push_bind(limit);
    } else {
        query_builder.push(" LIMIT 100");
    }

    match query_builder.build_query_as::<_, LabTestOrder>().fetch_all(&**pool).await {
        Ok(orders) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(orders),
                message: Some("Lab test orders retrieved successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
            error!("Failed to get lab test orders: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to retrieve lab test orders".to_string()),
            }))
        }
    }
}

// Get specific lab test order
pub async fn get_lab_order(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let order_id = path.into_inner();

    match sqlx::query_as::<_, LabTestOrder>(
        r#"
        SELECT id, order_number, patient_id, consultation_id, ordering_clinician_id,
               test_type, test_code, test_name, priority, clinical_indication,
               sample_type, sample_collection_date, status, notes, ordered_at,
               collected_at, completed_at, created_by, created_at, updated_at
        FROM lab_test_orders
        WHERE id = $1
        "#
    )
    .bind(order_id)
    .fetch_optional(&data.db_pool)
    .await
    {
        Ok(Some(order)) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(order),
                message: Some("Lab test order retrieved successfully".to_string()),
                error: None,
            }))
        }
        Ok(None) => {
            Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Lab test order not found".to_string()),
            }))
        }
        Err(e) => {
            error!("Failed to get lab test order: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to retrieve lab test order".to_string()),
            }))
        }
    }
}

// Update lab test order
pub async fn update_lab_order(
    path: web::Path<Uuid>,
    req: web::Json<UpdateLabTestOrder>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let order_id = path.into_inner();
    let update_data = req.into_inner();

    // Build update query using conditional updates
    match sqlx::query(
        r#"
        UPDATE lab_test_orders
        SET 
            status = COALESCE($1, status),
            sample_collection_date = COALESCE($2, sample_collection_date),
            collected_at = COALESCE($3, collected_at),
            completed_at = COALESCE($4, completed_at),
            notes = COALESCE($5, notes),
            updated_at = NOW()
        WHERE id = $6
        RETURNING id, order_number, patient_id, consultation_id, ordering_clinician_id,
                  test_type, test_code, test_name, priority, clinical_indication,
                  sample_type, sample_collection_date, status, notes, ordered_at,
                  collected_at, completed_at, created_by, created_at, updated_at
        "#
    )
    .bind(&update_data.status)
    .bind(&update_data.sample_collection_date)
    .bind(&update_data.collected_at)
    .bind(&update_data.completed_at)
    .bind(&update_data.notes)
    .bind(order_id)
    .fetch_optional(&data.db_pool)
    .await
    {
        Ok(Some(row)) => {
            let order = LabTestOrder {
                id: row.get("id"),
                order_number: row.get("order_number"),
                patient_id: row.get("patient_id"),
                consultation_id: row.get("consultation_id"),
                ordering_clinician_id: row.get("ordering_clinician_id"),
                test_type: row.get("test_type"),
                test_code: row.get("test_code"),
                test_name: row.get("test_name"),
                priority: row.get("priority"),
                clinical_indication: row.get("clinical_indication"),
                sample_type: row.get("sample_type"),
                sample_collection_date: row.get("sample_collection_date"),
                status: row.get("status"),
                notes: row.get("notes"),
                ordered_at: row.get("ordered_at"),
                collected_at: row.get("collected_at"),
                completed_at: row.get("completed_at"),
                created_by: row.get("created_by"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            };

            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(order),
                message: Some("Lab test order updated successfully".to_string()),
                error: None,
            }))
        }
        Ok(None) => {
            Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Lab test order not found".to_string()),
            }))
        }
        Err(e) => {
            error!("Failed to update lab test order: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to update lab test order".to_string()),
            }))
        }
    }
}

// Get pending lab test orders (for lab technician queue)
pub async fn get_pending_lab_orders(
    data: web::Data<AppState>,
    query: web::Query<PendingOrderQueryParams>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let params = query.into_inner();
    let mut query_builder = sqlx::QueryBuilder::new(
        "SELECT id, order_number, patient_id, consultation_id, ordering_clinician_id,
                test_type, test_code, test_name, priority, clinical_indication,
                sample_type, sample_collection_date, status, notes, ordered_at,
                collected_at, completed_at, created_by, created_at, updated_at
         FROM lab_test_orders
         WHERE status IN ('pending', 'collected', 'in_progress')"
    );

    if let Some(priority) = params.priority {
        query_builder.push(" AND priority = ");
        query_builder.push_bind(priority);
    }

    if let Some(test_type) = params.test_type {
        query_builder.push(" AND test_type = ");
        query_builder.push_bind(test_type);
    }

    query_builder.push(" ORDER BY 
        CASE priority 
            WHEN 'stat' THEN 1 
            WHEN 'urgent' THEN 2 
            WHEN 'routine' THEN 3 
        END,
        ordered_at ASC");

    if let Some(limit) = params.limit {
        query_builder.push(" LIMIT ");
        query_builder.push_bind(limit);
    } else {
        query_builder.push(" LIMIT 50");
    }

    match query_builder.build_query_as::<_, LabTestOrder>().fetch_all(&**pool).await {
        Ok(orders) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(orders),
                message: Some("Pending lab test orders retrieved successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
            error!("Failed to get pending lab test orders: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to retrieve pending lab test orders".to_string()),
            }))
        }
    }
}

// Cancel lab test order
pub async fn cancel_lab_order(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let order_id = path.into_inner();

    match sqlx::query(
        r#"
        UPDATE lab_test_orders
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1 AND status != 'completed'
        RETURNING id
        "#
    )
    .bind(order_id)
    .fetch_optional(&data.db_pool)
    .await
    {
        Ok(Some(_)) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: None,
                message: Some("Lab test order cancelled successfully".to_string()),
                error: None,
            }))
        }
        Ok(None) => {
            Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Lab test order not found or cannot be cancelled".to_string()),
            }))
        }
        Err(e) => {
            error!("Failed to cancel lab test order: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to cancel lab test order".to_string()),
            }))
        }
    }
}

// Query parameters
#[derive(Debug, Deserialize)]
pub struct LabOrderQueryParams {
    pub patient_id: Option<Uuid>,
    pub status: Option<String>,
    pub test_type: Option<String>,
    pub priority: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct PendingOrderQueryParams {
    pub priority: Option<String>,
    pub test_type: Option<String>,
    pub limit: Option<i64>,
}

