use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use uuid::Uuid;

use crate::models::{Consultation, CreateConsultation, ApiResponse, PaginatedResponse};
use crate::AppState;
use crate::middleware::auth::get_current_user;

pub async fn get_consultations(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let per_page = query.get("per_page").and_then(|v| v.as_i64()).unwrap_or(20);
    let patient_id = query.get("patient_id").and_then(|v| v.as_str());
    let offset = (page - 1) * per_page;

    let mut query_builder = sqlx::QueryBuilder::new("SELECT * FROM consultations WHERE 1=1");
    let mut count_builder = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM consultations WHERE 1=1");

    if let Some(pid) = patient_id {
        if let Ok(patient_uuid) = Uuid::parse_str(pid) {
            query_builder.push(" AND patient_id = ");
            query_builder.push_bind(patient_uuid);
            count_builder.push(" AND patient_id = ");
            count_builder.push_bind(patient_uuid);
        }
    }

    query_builder.push(" ORDER BY created_at DESC LIMIT ");
    query_builder.push_bind(per_page);
    query_builder.push(" OFFSET ");
    query_builder.push_bind(offset);

    let consultations: Vec<Consultation> = query_builder
        .build_query_as()
        .fetch_all(&data.database.pool)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    let total: i64 = count_builder
        .build_query_scalar()
        .fetch_one(&data.database.pool)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i32;

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(PaginatedResponse {
            data: consultations,
            total,
            page: page as i32,
            per_page: per_page as i32,
            total_pages,
        }),
        message: None,
        error: None,
    }))
}

pub async fn create_consultation(
    req: web::Json<CreateConsultation>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let consultation_data = req.into_inner();
    let consultation_id = Uuid::new_v4();
    let now = chrono::Utc::now();

    let result = sqlx::query(
        r#"
        INSERT INTO consultations (
            id, patient_id, doctor_id, date, time, chief_complaint,
            diagnosis, treatment_plan, notes, status, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
        "#
    )
    .bind(consultation_id)
    .bind(consultation_data.patient_id)
    .bind(consultation_data.doctor_id)
    .bind(consultation_data.date)
    .bind(consultation_data.time)
    .bind(&consultation_data.chief_complaint)
    .bind(&consultation_data.diagnosis)
    .bind(&consultation_data.treatment_plan)
    .bind(&consultation_data.notes)
    .bind("completed")
    .bind(now)
    .bind(now)
    .execute(&data.database.pool)
    .await;

    match result {
        Ok(_) => {
            Ok(HttpResponse::Created().json(ApiResponse {
                success: true,
                data: Some(json!({
                    "id": consultation_id
                })),
                message: Some("Consultation created successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
              Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to create consultation: {}", e)),
            }))
        }
    }
}

pub async fn get_consultation(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    let consultation_id = path.into_inner();

    let consultation_result = sqlx::query_as::<_, Consultation>(
        "SELECT * FROM consultations WHERE id = $1"
    )
    .bind(consultation_id)
    .fetch_one(&data.database.pool)
    .await;

    match consultation_result {
        Ok(consultation) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(consultation),
                message: None,
                error: None,
            }))
        }
        Err(_) => {
              Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Consultation not found".to_string()),
            }))
        }
    }
}

pub async fn update_consultation(
    path: web::Path<Uuid>,
    req: web::Json<CreateConsultation>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let consultation_id = path.into_inner();
    let update_data = req.into_inner();
    let now = chrono::Utc::now();

    let result = sqlx::query(
        r#"
        UPDATE consultations SET
            chief_complaint = $1,
            diagnosis = $2,
            treatment_plan = $3,
            notes = $4,
            updated_at = $5
        WHERE id = $6
        "#
    )
    .bind(&update_data.chief_complaint)
    .bind(&update_data.diagnosis)
    .bind(&update_data.treatment_plan)
    .bind(&update_data.notes)
    .bind(now)
    .bind(consultation_id)
    .execute(&data.database.pool)
    .await;

    match result {
        Ok(_) => {
              Ok(HttpResponse::Ok().json(ApiResponse::<()> {
                success: true,
                data: None,
                message: Some("Consultation updated successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
              Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to update consultation: {}", e)),
            }))
        }
    }
}

pub async fn add_prescription(
    path: web::Path<Uuid>,
    req: web::Json<crate::models::CreatePrescription>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let consultation_id = path.into_inner();
    let prescription_data = req.into_inner();
    let prescription_id = Uuid::new_v4();
    let now = chrono::Utc::now();

    let result = sqlx::query(
        r#"
        INSERT INTO prescriptions (
            id, patient_id, doctor_id, consultation_id, medicines, instructions, status, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
        "#
    )
    .bind(prescription_id)
    .bind(prescription_data.patient_id)
    .bind(prescription_data.doctor_id)
    .bind(consultation_id)
    .bind(&prescription_data.medicines)
    .bind(&prescription_data.instructions)
    .bind("active")
    .bind(now)
    .bind(now)
    .execute(&data.database.pool)
    .await;

    match result {
        Ok(_) => {
            Ok(HttpResponse::Created().json(ApiResponse {
                success: true,
                data: Some(json!({
                    "id": prescription_id
                })),
                message: Some("Prescription added successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
              Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to add prescription: {}", e)),
            }))
        }
    }
}
