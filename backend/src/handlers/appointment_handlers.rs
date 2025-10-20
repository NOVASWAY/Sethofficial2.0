use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use chrono::{Utc, NaiveDate, NaiveTime};
use sqlx::Row;

use crate::models::{Appointment, CreateAppointment, QueueItem, CheckInRequest, ApiResponse, PaginatedResponse};
use crate::AppState;
use crate::middleware::auth::get_current_user;
use crate::error::Validate;

pub async fn get_appointments(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let limit = query.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);
    let patient_id = query.get("patient_id").and_then(|v| v.as_str());
    let doctor_id = query.get("doctor_id").and_then(|v| v.as_str());
    let date = query.get("date").and_then(|v| v.as_str());
    let status = query.get("status").and_then(|v| v.as_str());

    let offset = (page - 1) * limit;

    let mut where_clause = String::new();
    let mut param_count = 0;

    if let Some(patient_uuid) = patient_id.and_then(|s| Uuid::parse_str(s).ok()) {
        param_count += 1;
        where_clause.push_str(&format!(" AND a.patient_id = ${}", param_count));
    }

    if let Some(doctor_uuid) = doctor_id.and_then(|s| Uuid::parse_str(s).ok()) {
        param_count += 1;
        where_clause.push_str(&format!(" AND a.doctor_id = ${}", param_count));
    }

    if let Some(date_str) = date.and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()) {
        param_count += 1;
        where_clause.push_str(&format!(" AND a.date = ${}", param_count));
    }

    if let Some(status_filter) = status {
        param_count += 1;
        where_clause.push_str(&format!(" AND a.status = ${}", param_count));
    }

    let appointments_query = format!(
        "SELECT a.id, a.patient_id, a.doctor_id, a.date, a.time, a.duration, 
                a.status, a.notes, a.created_at, a.updated_at,
                pt.first_name, pt.last_name, pt.phone,
                u.name as doctor_name
         FROM appointments a
         LEFT JOIN patients pt ON a.patient_id = pt.id
         LEFT JOIN users u ON a.doctor_id = u.id
         WHERE 1=1 {}
         ORDER BY a.date, a.time 
         LIMIT {} OFFSET {}",
        where_clause, limit, offset
    );

    let count_query = format!(
        "SELECT COUNT(*) FROM appointments a WHERE 1=1 {}",
        where_clause
    );

    let appointments_result = sqlx::query(&appointments_query)
        .fetch_all(&data.database.pool)
        .await;

    let count_result = sqlx::query_scalar::<_, i64>(&count_query)
        .fetch_one(&data.database.pool)
        .await;

    match (appointments_result, count_result) {
        (Ok(rows), Ok(total)) => {
            let appointments: Vec<serde_json::Value> = rows.iter().map(|row| {
                json!({
                    "id": row.get::<Uuid, _>("id"),
                    "patient_id": row.get::<Uuid, _>("patient_id"),
                    "doctor_id": row.get::<Uuid, _>("doctor_id"),
                    "date": row.get::<NaiveDate, _>("date"),
                    "time": row.get::<NaiveTime, _>("time"),
                    "duration": row.get::<i32, _>("duration"),
                    "status": row.get::<String, _>("status"),
                    "notes": row.get::<Option<String>, _>("notes"),
                    "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                    "updated_at": row.get::<chrono::DateTime<Utc>, _>("updated_at"),
                    "patient_name": format!("{} {}", 
                        row.get::<Option<String>, _>("first_name").unwrap_or_default(),
                        row.get::<Option<String>, _>("last_name").unwrap_or_default()
                    ),
                    "patient_phone": row.get::<Option<String>, _>("phone"),
                    "doctor_name": row.get::<Option<String>, _>("doctor_name")
                })
            }).collect();

            let paginated_response = PaginatedResponse {
                data: appointments,
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
                error: Some(format!("Failed to fetch appointments: {}", e)),
            }))
        }
    }
}

pub async fn create_appointment(
    req: web::Json<CreateAppointment>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let appointment_data = req.into_inner();
    
    // Validate appointment data
    if let Err(validation_errors) = appointment_data.validate() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<serde_json::Value> {
            success: false,
            data: None,
            message: Some("Validation failed".to_string()),
            error: Some(validation_errors.to_api_error().message),
        }));
    }
    
    let appointment_id = Uuid::new_v4();
    let now = Utc::now();

    // Check for conflicting appointments
    let conflict_check = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*) FROM appointments 
        WHERE doctor_id = $1 
        AND date = $2 
        AND status IN ('scheduled', 'confirmed')
        AND (
            (time <= $3 AND time + INTERVAL '1 minute' * duration > $3) OR
            ($3 < time + INTERVAL '1 minute' * duration AND $3 + INTERVAL '1 minute' * $4 > time)
        )
        "#
    )
    .bind(&appointment_data.doctor_id)
    .bind(&appointment_data.appointment_date)
    .bind(&appointment_data.appointment_time)
    .bind(30) // Default duration of 30 minutes
    .fetch_one(&data.database.pool)
    .await;

    match conflict_check {
        Ok(count) => {
            if count > 0 {
                return Ok(HttpResponse::Conflict().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: None,
                    error: Some("Appointment time conflicts with existing appointment".to_string()),
                }));
            }
        }
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to check for conflicts: {}", e)),
            }));
        }
    }

    let result = sqlx::query(
        r#"
        INSERT INTO appointments (
            id, patient_id, doctor_id, date, time, duration, status, notes, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
        "#
    )
    .bind(appointment_id)
    .bind(&appointment_data.patient_id)
    .bind(&appointment_data.doctor_id)
    .bind(&appointment_data.appointment_date)
    .bind(&appointment_data.appointment_time)
    .bind(30) // Default duration of 30 minutes
    .bind("scheduled")
    .bind(&appointment_data.notes)
    .bind(now)
    .bind(now)
    .execute(&data.database.pool)
    .await;

    match result {
        Ok(_) => {
            Ok(HttpResponse::Created().json(ApiResponse {
                success: true,
                data: Some(json!({"id": appointment_id})),
                message: Some("Appointment created successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to create appointment: {}", e)),
            }))
        }
    }
}

pub async fn update_appointment(
    path: web::Path<Uuid>,
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let appointment_id = path.into_inner();
    let update_data = req.into_inner();
    let now = Utc::now();

    // Build dynamic update query based on provided fields
    let mut set_clauses = Vec::new();
    let mut param_count = 0;
    let mut params: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync + 'static>> = Vec::new();

    if let Some(patient_id) = update_data.get("patient_id").and_then(|v| v.as_str()) {
        if let Ok(patient_uuid) = Uuid::parse_str(patient_id) {
            param_count += 1;
            set_clauses.push(format!("patient_id = ${}", param_count));
            params.push(Box::new(patient_uuid));
        }
    }

    if let Some(doctor_id) = update_data.get("doctor_id").and_then(|v| v.as_str()) {
        if let Ok(doctor_uuid) = Uuid::parse_str(doctor_id) {
            param_count += 1;
            set_clauses.push(format!("doctor_id = ${}", param_count));
            params.push(Box::new(doctor_uuid));
        }
    }

    if let Some(date) = update_data.get("date").and_then(|v| v.as_str()) {
        if let Ok(date_parsed) = NaiveDate::parse_from_str(date, "%Y-%m-%d") {
            param_count += 1;
            set_clauses.push(format!("date = ${}", param_count));
            params.push(Box::new(date_parsed));
        }
    }

    if let Some(time) = update_data.get("time").and_then(|v| v.as_str()) {
        if let Ok(time_parsed) = NaiveTime::parse_from_str(time, "%H:%M") {
            param_count += 1;
            set_clauses.push(format!("time = ${}", param_count));
            params.push(Box::new(time_parsed));
        }
    }

    if let Some(duration) = update_data.get("duration").and_then(|v| v.as_i64()) {
        param_count += 1;
        set_clauses.push(format!("duration = ${}", param_count));
        params.push(Box::new(duration as i32));
    }

    if let Some(status) = update_data.get("status").and_then(|v| v.as_str()) {
        param_count += 1;
        set_clauses.push(format!("status = ${}", param_count));
        params.push(Box::new(status.to_string()));
    }

    if let Some(notes) = update_data.get("notes").and_then(|v| v.as_str()) {
        param_count += 1;
        set_clauses.push(format!("notes = ${}", param_count));
        params.push(Box::new(notes.to_string()));
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
        "UPDATE appointments SET {} WHERE id = ${}",
        set_clauses.join(", "),
        param_count
    );
    params.push(Box::new(appointment_id));

    let result = sqlx::query(&update_query)
        .execute(&data.database.pool)
        .await;

    match result {
        Ok(result) => {
            if result.rows_affected() > 0 {
                Ok(HttpResponse::Ok().json(ApiResponse::<()> {
                    success: true,
                    data: None,
                    message: Some("Appointment updated successfully".to_string()),
                    error: None,
                }))
            } else {
                Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: None,
                    error: Some("Appointment not found".to_string()),
                }))
            }
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to update appointment: {}", e)),
            }))
        }
    }
}

pub async fn cancel_appointment(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let appointment_id = path.into_inner();
    let now = Utc::now();

    let result = sqlx::query(
        "UPDATE appointments SET status = 'cancelled', updated_at = $1 WHERE id = $2"
    )
    .bind(now)
    .bind(appointment_id)
    .execute(&data.database.pool)
    .await;

    match result {
        Ok(result) => {
            if result.rows_affected() > 0 {
                Ok(HttpResponse::Ok().json(ApiResponse::<()> {
                    success: true,
                    data: None,
                    message: Some("Appointment cancelled successfully".to_string()),
                    error: None,
                }))
            } else {
                Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: None,
                    error: Some("Appointment not found".to_string()),
                }))
            }
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to cancel appointment: {}", e)),
            }))
        }
    }
}

pub async fn get_queue(
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    let today = Utc::now().date_naive();

    let queue_query = format!(
        "SELECT a.id, a.patient_id, a.doctor_id, a.date, a.time, a.duration, 
                a.status, a.notes, a.created_at,
                pt.first_name, pt.last_name, pt.phone,
                u.name as doctor_name,
                ROW_NUMBER() OVER (PARTITION BY a.doctor_id ORDER BY a.time) as queue_position
         FROM appointments a
         LEFT JOIN patients pt ON a.patient_id = pt.id
         LEFT JOIN users u ON a.doctor_id = u.id
         WHERE a.date = '{}' 
         AND a.status IN ('scheduled', 'confirmed', 'checked_in')
         ORDER BY a.doctor_id, a.time",
        today
    );

    let result = sqlx::query(&queue_query)
        .fetch_all(&data.database.pool)
        .await;

    match result {
        Ok(rows) => {
            let queue_items: Vec<serde_json::Value> = rows.iter().map(|row| {
                json!({
                    "id": row.get::<Uuid, _>("id"),
                    "patient_id": row.get::<Uuid, _>("patient_id"),
                    "doctor_id": row.get::<Uuid, _>("doctor_id"),
                    "date": row.get::<NaiveDate, _>("date"),
                    "time": row.get::<NaiveTime, _>("time"),
                    "duration": row.get::<i32, _>("duration"),
                    "status": row.get::<String, _>("status"),
                    "notes": row.get::<Option<String>, _>("notes"),
                    "created_at": row.get::<chrono::DateTime<Utc>, _>("created_at"),
                    "patient_name": format!("{} {}", 
                        row.get::<Option<String>, _>("first_name").unwrap_or_default(),
                        row.get::<Option<String>, _>("last_name").unwrap_or_default()
                    ),
                    "patient_phone": row.get::<Option<String>, _>("phone"),
                    "doctor_name": row.get::<Option<String>, _>("doctor_name"),
                    "queue_position": row.get::<i64, _>("queue_position")
                })
            }).collect();

            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(json!(queue_items)),
                message: None,
                error: None,
            }))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to fetch queue: {}", e)),
            }))
        }
    }
}

pub async fn checkin_patient(
    req: web::Json<serde_json::Value>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let checkin_data = req.into_inner();
    let now = Utc::now();

    let appointment_id = checkin_data.get("appointment_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| actix_web::error::ErrorBadRequest("Invalid appointment_id"))?;

    // Check if appointment exists and is in a valid state for check-in
    let appointment_check = sqlx::query_scalar::<_, String>(
        "SELECT status FROM appointments WHERE id = $1"
    )
    .bind(appointment_id)
    .fetch_optional(&data.database.pool)
    .await;

    match appointment_check {
        Ok(Some(status)) => {
            if status != "scheduled" && status != "confirmed" {
                return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
                    success: false,
                    data: None,
                    message: None,
                    error: Some("Appointment is not in a valid state for check-in".to_string()),
                }));
            }
        }
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Appointment not found".to_string()),
            }));
        }
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to check appointment status: {}", e)),
            }));
        }
    }

    // Update appointment status to checked_in
    let result = sqlx::query(
        "UPDATE appointments SET status = 'checked_in', updated_at = $1 WHERE id = $2"
    )
    .bind(now)
    .bind(appointment_id)
    .execute(&data.database.pool)
    .await;

    match result {
        Ok(_) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(json!({"appointment_id": appointment_id})),
                message: Some("Patient checked in successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to check in patient: {}", e)),
            }))
        }
    }
}

pub async fn call_next_patient(
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let _claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let today = Utc::now().date_naive();

    // Find the next patient in queue (checked_in status, earliest time)
    let next_patient_query = format!(
        "SELECT a.id, a.patient_id, a.doctor_id, a.time,
                pt.first_name, pt.last_name, pt.phone,
                u.name as doctor_name
         FROM appointments a
         LEFT JOIN patients pt ON a.patient_id = pt.id
         LEFT JOIN users u ON a.doctor_id = u.id
         WHERE a.date = '{}' 
         AND a.status = 'checked_in'
         ORDER BY a.time
         LIMIT 1",
        today
    );

    let next_patient_result = sqlx::query(&next_patient_query)
        .fetch_optional(&data.database.pool)
        .await;

    match next_patient_result {
        Ok(Some(row)) => {
            let appointment_id: Uuid = row.get("id");
            let patient_name = format!("{} {}", 
                row.get::<Option<String>, _>("first_name").unwrap_or_default(),
                row.get::<Option<String>, _>("last_name").unwrap_or_default()
            );
            let doctor_name = row.get::<Option<String>, _>("doctor_name");

            // Update appointment status to 'in_progress'
            let update_result = sqlx::query(
                "UPDATE appointments SET status = 'in_progress', updated_at = $1 WHERE id = $2"
            )
            .bind(Utc::now())
            .bind(appointment_id)
            .execute(&data.database.pool)
            .await;

            match update_result {
                Ok(_) => {
                    Ok(HttpResponse::Ok().json(ApiResponse {
                        success: true,
                        data: Some(json!({
                            "appointment_id": appointment_id,
                            "patient_name": patient_name,
                            "doctor_name": doctor_name,
                            "status": "in_progress"
                        })),
                        message: Some(format!("Next patient called: {}", patient_name)),
                        error: None,
                    }))
                }
                Err(e) => {
                    Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                        success: false,
                        data: None,
                        message: None,
                        error: Some(format!("Failed to update appointment status: {}", e)),
                    }))
                }
            }
        }
        Ok(None) => {
            Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("No patients in queue".to_string()),
            }))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to fetch next patient: {}", e)),
            }))
        }
    }
}
