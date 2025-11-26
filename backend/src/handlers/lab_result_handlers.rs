use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde::Deserialize;
use uuid::Uuid;
use chrono::Utc;
use sqlx::Row;
use tracing::{info, error};

use crate::models::{LabTestResult, CreateLabTestResult, UpdateLabTestResult, ApiResponse};
use crate::AppState;
use crate::middleware::auth::get_current_user;

// Generate lab test result number
fn generate_result_number() -> String {
    let now = Utc::now();
    let date_str = now.format("%Y%m%d").to_string();
    let random = rand::random::<u16>() % 10000;
    format!("RES-{}-{:04}", date_str, random)
}

// Create lab test result
pub async fn create_lab_result(
    req: web::Json<CreateLabTestResult>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let result_data = req.into_inner();
    let result_id = Uuid::new_v4();
    let result_number = generate_result_number();
    let now = Utc::now();
    let user_id = Uuid::parse_str(&claims.sub).ok();

    // Verify that the order exists and is not cancelled
    let order_check: Option<(String,)> = sqlx::query_as(
        "SELECT status FROM lab_test_orders WHERE id = $1"
    )
    .bind(result_data.order_id)
    .fetch_optional(&data.db_pool)
    .await
    .unwrap_or(None);

    if let Some((status,)) = order_check {
        if status == "cancelled" {
            return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Cannot create result for cancelled order".to_string()),
            }));
        }
    } else {
        return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Lab test order not found".to_string()),
        }));
    }

    match sqlx::query(
        r#"
        INSERT INTO lab_test_results (
            id, order_id, result_number, test_type, test_code, test_name,
            test_values, reference_ranges, abnormal_flags, result_date,
            notes, attachments, status, created_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id, order_id, result_number, test_type, test_code, test_name,
                  test_values, reference_ranges, abnormal_flags, result_date,
                  verified_by, verified_at, reviewed_by, reviewed_at, notes,
                  attachments, status, created_by, created_at, updated_at
        "#
    )
    .bind(result_id)
    .bind(result_data.order_id)
    .bind(&result_number)
    .bind(&result_data.test_type)
    .bind(&result_data.test_code)
    .bind(&result_data.test_name)
    .bind(&result_data.test_values)
    .bind(&result_data.reference_ranges)
    .bind(&result_data.abnormal_flags)
    .bind(now)
    .bind(&result_data.notes)
    .bind(&result_data.attachments)
    .bind("pending")
    .bind(user_id)
    .bind(now)
    .bind(now)
    .fetch_one(&data.db_pool)
    .await
    {
        Ok(row) => {
            // Update order status to completed
            let _ = sqlx::query(
                "UPDATE lab_test_orders SET status = 'completed', completed_at = NOW() WHERE id = $1"
            )
            .bind(result_data.order_id)
            .execute(&data.db_pool)
            .await;

            let result = LabTestResult {
                id: row.get("id"),
                order_id: row.get("order_id"),
                result_number: row.get("result_number"),
                test_type: row.get("test_type"),
                test_code: row.get("test_code"),
                test_name: row.get("test_name"),
                test_values: row.get("test_values"),
                reference_ranges: row.get("reference_ranges"),
                abnormal_flags: row.get("abnormal_flags"),
                result_date: row.get("result_date"),
                verified_by: row.get("verified_by"),
                verified_at: row.get("verified_at"),
                reviewed_by: row.get("reviewed_by"),
                reviewed_at: row.get("reviewed_at"),
                notes: row.get("notes"),
                attachments: row.get("attachments"),
                status: row.get("status"),
                created_by: row.get("created_by"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            };

            info!("Lab test result created: {}", result_number);

            Ok(HttpResponse::Created().json(ApiResponse {
                success: true,
                data: Some(result),
                message: Some("Lab test result created successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
            error!("Failed to create lab test result: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to create lab test result".to_string()),
            }))
        }
    }
}

// Get all lab test results
pub async fn get_lab_results(
    data: web::Data<AppState>,
    query: web::Query<LabResultQueryParams>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let params = query.into_inner();
    let mut query_builder = sqlx::QueryBuilder::new(
        "SELECT id, order_id, result_number, test_type, test_code, test_name,
                test_values, reference_ranges, abnormal_flags, result_date,
                verified_by, verified_at, reviewed_by, reviewed_at, notes,
                attachments, status, created_by, created_at, updated_at
         FROM lab_test_results WHERE 1=1"
    );

    if let Some(order_id) = params.order_id {
        query_builder.push(" AND order_id = ");
        query_builder.push_bind(order_id);
    }

    if let Some(patient_id) = params.patient_id {
        query_builder.push(" AND order_id IN (SELECT id FROM lab_test_orders WHERE patient_id = ");
        query_builder.push_bind(patient_id);
        query_builder.push(")");
    }

    if let Some(status) = params.status {
        query_builder.push(" AND status = ");
        query_builder.push_bind(status);
    }

    if let Some(test_type) = params.test_type {
        query_builder.push(" AND test_type = ");
        query_builder.push_bind(test_type);
    }

    query_builder.push(" ORDER BY result_date DESC");

    if let Some(limit) = params.limit {
        query_builder.push(" LIMIT ");
        query_builder.push_bind(limit);
    } else {
        query_builder.push(" LIMIT 100");
    }

    match query_builder.build_query_as::<_, LabTestResult>().fetch_all(&**pool).await {
        Ok(results) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(results),
                message: Some("Lab test results retrieved successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
            error!("Failed to get lab test results: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to retrieve lab test results".to_string()),
            }))
        }
    }
}

// Get specific lab test result
pub async fn get_lab_result(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let result_id = path.into_inner();

    match sqlx::query_as::<_, LabTestResult>(
        r#"
        SELECT id, order_id, result_number, test_type, test_code, test_name,
               test_values, reference_ranges, abnormal_flags, result_date,
               verified_by, verified_at, reviewed_by, reviewed_at, notes,
               attachments, status, created_by, created_at, updated_at
        FROM lab_test_results
        WHERE id = $1
        "#
    )
    .bind(result_id)
    .fetch_optional(&data.db_pool)
    .await
    {
        Ok(Some(result)) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(result),
                message: Some("Lab test result retrieved successfully".to_string()),
                error: None,
            }))
        }
        Ok(None) => {
            Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Lab test result not found".to_string()),
            }))
        }
        Err(e) => {
            error!("Failed to get lab test result: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to retrieve lab test result".to_string()),
            }))
        }
    }
}

// Update lab test result
pub async fn update_lab_result(
    path: web::Path<Uuid>,
    req: web::Json<UpdateLabTestResult>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let result_id = path.into_inner();
    let update_data = req.into_inner();

    match sqlx::query(
        r#"
        UPDATE lab_test_results
        SET 
            test_values = COALESCE($1, test_values),
            reference_ranges = COALESCE($2, reference_ranges),
            abnormal_flags = COALESCE($3, abnormal_flags),
            notes = COALESCE($4, notes),
            attachments = COALESCE($5, attachments),
            status = COALESCE($6, status),
            updated_at = NOW()
        WHERE id = $7
        RETURNING id, order_id, result_number, test_type, test_code, test_name,
                  test_values, reference_ranges, abnormal_flags, result_date,
                  verified_by, verified_at, reviewed_by, reviewed_at, notes,
                  attachments, status, created_by, created_at, updated_at
        "#
    )
    .bind(&update_data.test_values)
    .bind(&update_data.reference_ranges)
    .bind(&update_data.abnormal_flags)
    .bind(&update_data.notes)
    .bind(&update_data.attachments)
    .bind(&update_data.status)
    .bind(result_id)
    .fetch_optional(&data.db_pool)
    .await
    {
        Ok(Some(row)) => {
            let result = LabTestResult {
                id: row.get("id"),
                order_id: row.get("order_id"),
                result_number: row.get("result_number"),
                test_type: row.get("test_type"),
                test_code: row.get("test_code"),
                test_name: row.get("test_name"),
                test_values: row.get("test_values"),
                reference_ranges: row.get("reference_ranges"),
                abnormal_flags: row.get("abnormal_flags"),
                result_date: row.get("result_date"),
                verified_by: row.get("verified_by"),
                verified_at: row.get("verified_at"),
                reviewed_by: row.get("reviewed_by"),
                reviewed_at: row.get("reviewed_at"),
                notes: row.get("notes"),
                attachments: row.get("attachments"),
                status: row.get("status"),
                created_by: row.get("created_by"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            };

            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(result),
                message: Some("Lab test result updated successfully".to_string()),
                error: None,
            }))
        }
        Ok(None) => {
            Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Lab test result not found".to_string()),
            }))
        }
        Err(e) => {
            error!("Failed to update lab test result: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to update lab test result".to_string()),
            }))
        }
    }
}

// Get patient's lab test results
pub async fn get_patient_lab_results(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let patient_id = path.into_inner();

    match sqlx::query_as::<_, LabTestResult>(
        r#"
        SELECT r.id, r.order_id, r.result_number, r.test_type, r.test_code, r.test_name,
               r.test_values, r.reference_ranges, r.abnormal_flags, r.result_date,
               r.verified_by, r.verified_at, r.reviewed_by, r.reviewed_at, r.notes,
               r.attachments, r.status, r.created_by, r.created_at, r.updated_at
        FROM lab_test_results r
        INNER JOIN lab_test_orders o ON r.order_id = o.id
        WHERE o.patient_id = $1
        ORDER BY r.result_date DESC
        "#
    )
    .bind(patient_id)
    .fetch_all(&data.db_pool)
    .await
    {
        Ok(results) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(results),
                message: Some("Patient lab test results retrieved successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
            error!("Failed to get patient lab test results: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to retrieve patient lab test results".to_string()),
            }))
        }
    }
}

// Get results for specific order
pub async fn get_order_lab_results(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let order_id = path.into_inner();

    match sqlx::query_as::<_, LabTestResult>(
        r#"
        SELECT id, order_id, result_number, test_type, test_code, test_name,
               test_values, reference_ranges, abnormal_flags, result_date,
               verified_by, verified_at, reviewed_by, reviewed_at, notes,
               attachments, status, created_by, created_at, updated_at
        FROM lab_test_results
        WHERE order_id = $1
        ORDER BY result_date DESC
        "#
    )
    .bind(order_id)
    .fetch_all(&data.db_pool)
    .await
    {
        Ok(results) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(results),
                message: Some("Order lab test results retrieved successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
            error!("Failed to get order lab test results: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to retrieve order lab test results".to_string()),
            }))
        }
    }
}

// Verify lab test result (by lab technician)
pub async fn verify_lab_result(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let result_id = path.into_inner();
    let user_id = Uuid::parse_str(&claims.sub).ok();
    let now = Utc::now();

    match sqlx::query(
        r#"
        UPDATE lab_test_results
        SET status = 'verified', verified_by = $1, verified_at = $2, updated_at = NOW()
        WHERE id = $3 AND status = 'pending'
        RETURNING id, order_id, result_number, test_type, test_code, test_name,
                  test_values, reference_ranges, abnormal_flags, result_date,
                  verified_by, verified_at, reviewed_by, reviewed_at, notes,
                  attachments, status, created_by, created_at, updated_at
        "#
    )
    .bind(user_id)
    .bind(now)
    .bind(result_id)
    .fetch_optional(&data.db_pool)
    .await
    {
        Ok(Some(row)) => {
            let result = LabTestResult {
                id: row.get("id"),
                order_id: row.get("order_id"),
                result_number: row.get("result_number"),
                test_type: row.get("test_type"),
                test_code: row.get("test_code"),
                test_name: row.get("test_name"),
                test_values: row.get("test_values"),
                reference_ranges: row.get("reference_ranges"),
                abnormal_flags: row.get("abnormal_flags"),
                result_date: row.get("result_date"),
                verified_by: row.get("verified_by"),
                verified_at: row.get("verified_at"),
                reviewed_by: row.get("reviewed_by"),
                reviewed_at: row.get("reviewed_at"),
                notes: row.get("notes"),
                attachments: row.get("attachments"),
                status: row.get("status"),
                created_by: row.get("created_by"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            };

            info!("Lab test result verified: {}", result_id);

            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(result),
                message: Some("Lab test result verified successfully".to_string()),
                error: None,
            }))
        }
        Ok(None) => {
            Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Lab test result not found or already verified".to_string()),
            }))
        }
        Err(e) => {
            error!("Failed to verify lab test result: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to verify lab test result".to_string()),
            }))
        }
    }
}

// Review lab test result (by clinician)
pub async fn review_lab_result(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let result_id = path.into_inner();
    let user_id = Uuid::parse_str(&claims.sub).ok();
    let now = Utc::now();

    match sqlx::query(
        r#"
        UPDATE lab_test_results
        SET status = 'reviewed', reviewed_by = $1, reviewed_at = $2, updated_at = NOW()
        WHERE id = $3 AND status = 'verified'
        RETURNING id, order_id, result_number, test_type, test_code, test_name,
                  test_values, reference_ranges, abnormal_flags, result_date,
                  verified_by, verified_at, reviewed_by, reviewed_at, notes,
                  attachments, status, created_by, created_at, updated_at
        "#
    )
    .bind(user_id)
    .bind(now)
    .bind(result_id)
    .fetch_optional(&data.db_pool)
    .await
    {
        Ok(Some(row)) => {
            let result = LabTestResult {
                id: row.get("id"),
                order_id: row.get("order_id"),
                result_number: row.get("result_number"),
                test_type: row.get("test_type"),
                test_code: row.get("test_code"),
                test_name: row.get("test_name"),
                test_values: row.get("test_values"),
                reference_ranges: row.get("reference_ranges"),
                abnormal_flags: row.get("abnormal_flags"),
                result_date: row.get("result_date"),
                verified_by: row.get("verified_by"),
                verified_at: row.get("verified_at"),
                reviewed_by: row.get("reviewed_by"),
                reviewed_at: row.get("reviewed_at"),
                notes: row.get("notes"),
                attachments: row.get("attachments"),
                status: row.get("status"),
                created_by: row.get("created_by"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            };

            info!("Lab test result reviewed: {}", result_id);

            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(result),
                message: Some("Lab test result reviewed successfully".to_string()),
                error: None,
            }))
        }
        Ok(None) => {
            Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Lab test result not found or not verified yet".to_string()),
            }))
        }
        Err(e) => {
            error!("Failed to review lab test result: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to review lab test result".to_string()),
            }))
        }
    }
}

// Query parameters
#[derive(Debug, Deserialize)]
pub struct LabResultQueryParams {
    pub order_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub status: Option<String>,
    pub test_type: Option<String>,
    pub limit: Option<i64>,
}

