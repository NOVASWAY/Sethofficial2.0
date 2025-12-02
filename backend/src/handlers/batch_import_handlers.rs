use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use sqlx::PgPool;
use chrono::Utc;
use uuid::Uuid;
use sqlx::FromRow;
use rust_decimal::Decimal;
use sqlx::types::BigDecimal;
use std::str::FromStr;

use crate::AppState;
use crate::middleware::auth::get_current_user;
use crate::simple_handlers::create_patient;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, FromRow)]
struct ImportSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub file_name: String,
    pub file_size: Option<i64>,
    pub total_records: i32,
    pub imported_count: i32,
    pub failed_count: i32,
    pub duplicate_count: i32,
    pub status: String,
    pub batch_size: i32,
    pub total_batches: i32,
    pub current_batch: i32,
    pub progress_percentage: Option<BigDecimal>,
    pub started_at: Option<chrono::DateTime<Utc>>,
    pub completed_at: Option<chrono::DateTime<Utc>>,
    pub error_summary: Option<serde_json::Value>,
    pub batch_results: Option<serde_json::Value>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

// Batch import configuration
const BATCH_SIZE: usize = 100;
const MAX_BATCH_SIZE: usize = 500;

// POST /api/patients/import/batch - Batch import with progress tracking
pub async fn batch_import_patients(
    import_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;
    let user_id = claims.sub;

    let patients_array = match import_data.get("patients").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "patients array is required",
            "message": "Invalid request"
        })))
    };

    let batch_size = import_data
        .get("batch_size")
        .and_then(|v| v.as_u64())
        .map(|v| v as usize)
        .unwrap_or(BATCH_SIZE)
        .min(MAX_BATCH_SIZE);

    let total_records = patients_array.len();
    let total_batches = (total_records + batch_size - 1) / batch_size;

    // Get file name from metadata or use default
    let file_name = import_data
        .get("file_name")
        .and_then(|v| v.as_str())
        .unwrap_or("patient_import.csv")
        .to_string();

    // Create import session
    let session_id = Uuid::new_v4();
    let started_at = Utc::now();

    let create_session_result = sqlx::query(
        r#"
        INSERT INTO import_sessions (
            id, user_id, file_name, total_records, batch_size, total_batches,
            status, started_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'in_progress', $7, $7, $7)
        RETURNING id
        "#
    )
    .bind(session_id)
    .bind(user_id)
    .bind(&file_name)
    .bind(total_records as i32)
    .bind(batch_size as i32)
    .bind(total_batches as i32)
    .bind(started_at)
    .fetch_one(&state.db_pool)
    .await;

    if let Err(e) = create_session_result {
        eprintln!("Failed to create import session: {}", e);
        // Continue with import even if session creation fails
    }

    let mut all_imported = 0;
    let mut all_errors = Vec::new();
    let mut batch_results = Vec::new();
    let mut duplicate_count = 0;

    // Process in batches
    for batch_num in 0..total_batches {
        let start_idx = batch_num * batch_size;
        let end_idx = (start_idx + batch_size).min(total_records);
        let batch = &patients_array[start_idx..end_idx];

        let mut batch_imported = 0;
        let mut batch_errors = Vec::new();

        // Process each patient in the batch
        for (local_idx, patient_data) in batch.iter().enumerate() {
            let global_idx = start_idx + local_idx;
            let mut processed_patient = patient_data.clone();

            // Validate required fields
            if !processed_patient.get("first_name").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false) {
                batch_errors.push(json!({
                    "row": global_idx + 1,
                    "error": "first_name is required"
                }));
                continue;
            }

            if !processed_patient.get("last_name").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false) {
                batch_errors.push(json!({
                    "row": global_idx + 1,
                    "error": "last_name is required"
                }));
                continue;
            }

            // Set defaults - ensure age is provided
            if processed_patient.get("age").is_none() {
                // Check if date_of_birth is provided (for backward compatibility)
                if let Some(dob_str) = processed_patient.get("date_of_birth").and_then(|v| v.as_str()) {
                    // Calculate age from date_of_birth
                    if let Ok(dob) = chrono::NaiveDate::parse_from_str(dob_str, "%Y-%m-%d") {
                        let age = chrono::Utc::now().date_naive().year() - dob.year();
                        processed_patient["age"] = json!(age);
                    } else {
                        // Invalid date, use default age
                        processed_patient["age"] = json!(0);
                    }
                } else {
                    // No age or date_of_birth provided, use default
                    processed_patient["age"] = json!(0);
                }
            }

            if !processed_patient.get("gender").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false) {
                processed_patient["gender"] = json!("Unknown");
            }

            let phone = processed_patient.get("phone").and_then(|v| v.as_str()).unwrap_or("");
            if phone.is_empty() || phone == "Not provided" {
                processed_patient["phone"] = json!("0000000000");
            }

            // Remove status field
            processed_patient.as_object_mut().and_then(|obj| obj.remove("status"));

            // Create patient
            match create_patient(web::Json(processed_patient), state.clone()).await {
                Ok(_) => batch_imported += 1,
                Err(e) => {
                    batch_errors.push(json!({
                        "row": global_idx + 1,
                        "error": format!("Failed to import: {}", e)
                    }));
                }
            }
        }

        all_imported += batch_imported;
        all_errors.extend(batch_errors.clone());

        batch_results.push(json!({
            "batch_number": batch_num + 1,
            "total_batches": total_batches,
            "start_index": start_idx + 1,
            "end_index": end_idx,
            "imported": batch_imported,
            "failed": batch_errors.len(),
            "errors": if batch_errors.len() > 5 {
                batch_errors.iter().take(5).cloned().collect::<Vec<_>>()
            } else {
                batch_errors
            }
        }));

        // Update session progress
        let progress = ((batch_num + 1) as f64 / total_batches as f64 * 100.0) as f64;
        let _ = sqlx::query(
            r#"
            UPDATE import_sessions
            SET current_batch = $1,
                imported_count = $2,
                failed_count = $3,
                progress_percentage = $4,
                updated_at = $5
            WHERE id = $6
            "#
        )
        .bind((batch_num + 1) as i32)
        .bind(all_imported as i32)
        .bind(all_errors.len() as i32)
        .bind(BigDecimal::from_str(&progress.to_string()).unwrap_or(BigDecimal::from(0)))
        .bind(Utc::now())
        .bind(session_id)
        .execute(&state.db_pool)
        .await;
    }

    // Finalize import session
    let completed_at = Utc::now();
    let status = if all_errors.len() == 0 {
        "completed"
    } else if all_imported == 0 {
        "failed"
    } else {
        "partial"
    };

    let final_progress = if total_records > 0 {
        ((all_imported + all_errors.len()) as f64 / total_records as f64 * 100.0) as f64
    } else {
        100.0
    };

    let _ = sqlx::query(
        r#"
        UPDATE import_sessions
        SET status = $1,
            imported_count = $2,
            failed_count = $3,
            duplicate_count = $4,
            progress_percentage = $5,
            completed_at = $6,
            batch_results = $7,
            error_summary = $8,
            updated_at = $9
        WHERE id = $10
        "#
    )
    .bind(status)
    .bind(all_imported as i32)
    .bind(all_errors.len() as i32)
    .bind(duplicate_count as i32)
    .bind(BigDecimal::from_str(&final_progress.to_string()).unwrap_or(BigDecimal::from(0)))
    .bind(completed_at)
    .bind(json!(batch_results))
    .bind(json!({
        "total_errors": all_errors.len(),
        "sample_errors": if all_errors.len() > 10 {
            all_errors.iter().take(10).cloned().collect::<Vec<_>>()
        } else {
            all_errors.clone()
        }
    }))
    .bind(Utc::now())
    .bind(session_id)
    .execute(&state.db_pool)
    .await;

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "data": {
            "session_id": session_id,
            "total_records": total_records,
            "total_batches": total_batches,
            "batch_size": batch_size,
            "imported": all_imported,
            "failed": all_errors.len(),
            "duplicate_count": duplicate_count,
            "errors": if all_errors.len() > 20 {
                all_errors.iter().take(20).cloned().collect::<Vec<_>>()
            } else {
                all_errors
            },
            "batch_results": batch_results
        },
        "message": format!("Imported {} of {} patients", all_imported, total_records)
    })))
}

// GET /api/patients/import/status/{session_id} - Get import status
pub async fn get_import_status(
    path: web::Path<String>,
    state: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;
    let user_id = claims.sub;

    let session_id_str = path.into_inner();
    let session_id = match Uuid::parse_str(&session_id_str) {
        Ok(id) => id,
        Err(_) => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Invalid session ID format"
        })))
    };

    // Get import session from database
    let session_result = sqlx::query_as::<_, ImportSession>(
        r#"
        SELECT * FROM import_sessions
        WHERE id = $1 AND user_id = $2
        "#
    )
    .bind(session_id)
    .bind(user_id)
    .fetch_optional(&state.db_pool)
    .await;

    match session_result {
        Ok(Some(session)) => {
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": {
                    "session_id": session.id,
                    "file_name": session.file_name,
                    "status": session.status,
                    "total_records": session.total_records,
                    "imported_count": session.imported_count,
                    "failed_count": session.failed_count,
                    "duplicate_count": session.duplicate_count,
                    "progress_percentage": session.progress_percentage,
                    "current_batch": session.current_batch,
                    "total_batches": session.total_batches,
                    "started_at": session.started_at,
                    "completed_at": session.completed_at,
                    "batch_results": session.batch_results,
                    "error_summary": session.error_summary
                }
            })))
        },
        Ok(None) => Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Import session not found"
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch import session: {}", e)
        })))
    }
}

// GET /api/patients/import/history - Get import history for user
pub async fn get_import_history(
    query: web::Query<serde_json::Value>,
    state: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;
    let user_id = claims.sub;

    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let per_page = query.get("per_page").and_then(|v| v.as_i64()).unwrap_or(20);
    let offset = (page - 1) * per_page;

    // Get total count
    let total_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM import_sessions WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    // Get sessions
    let sessions_result = sqlx::query_as::<_, ImportSession>(
        r#"
        SELECT * FROM import_sessions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        "#
    )
    .bind(user_id)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db_pool)
    .await;

    match sessions_result {
        Ok(sessions) => {
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "data": {
                    "sessions": sessions,
                    "pagination": {
                        "page": page,
                        "per_page": per_page,
                        "total": total_count,
                        "total_pages": (total_count + per_page - 1) / per_page
                    }
                }
            })))
        },
        Err(e) => Ok(HttpResponse::InternalServerError().json(json!({
            "success": false,
            "error": format!("Failed to fetch import history: {}", e)
        })))
    }
}

// POST /api/patients/import/resume/{session_id} - Resume failed/interrupted import
pub async fn resume_import(
    path: web::Path<Uuid>,
    import_data: web::Json<serde_json::Value>,
    state: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;
    let user_id = claims.sub;

    let session_id = path.into_inner();

    // Get the import session
    let session = sqlx::query_as::<_, ImportSession>(
        r#"
        SELECT * FROM import_sessions
        WHERE id = $1 AND user_id = $2
        "#
    )
    .bind(session_id)
    .bind(user_id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Database error: {}", e)))?;

    let session = match session {
        Some(s) => s,
        None => return Ok(HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "Import session not found"
        })))
    };

    // Check if session can be resumed
    if session.status != "failed" && session.status != "partial" && session.status != "in_progress" {
        return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": format!("Cannot resume import with status: {}", session.status)
        })))
    }

    // Get remaining patients to import
    let patients_array = match import_data.get("patients").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "patients array is required"
        })))
    };

    // Calculate which batches to process (skip already processed)
    let start_batch = session.current_batch as usize;
    let total_records = patients_array.len();
    let batch_size = session.batch_size as usize;
    let total_batches = (total_records + batch_size - 1) / batch_size;

    if start_batch >= total_batches {
        return Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "All batches have already been processed"
        })))
    }

    // Update session status to in_progress
    let _ = sqlx::query(
        r#"
        UPDATE import_sessions
        SET status = 'in_progress', updated_at = $1
        WHERE id = $2
        "#
    )
    .bind(Utc::now())
    .bind(session_id)
    .execute(&state.db_pool)
    .await;

    let mut all_imported = session.imported_count as usize;
    let mut all_failed = session.failed_count as usize;
    let mut all_errors: Vec<serde_json::Value> = vec![];
    let mut batch_results = Vec::new();

    // Process remaining batches
    for batch_num in start_batch..total_batches {
        let start_idx = batch_num * batch_size;
        let end_idx = (start_idx + batch_size).min(total_records);
        let batch = &patients_array[start_idx..end_idx];

        let mut batch_imported = 0;
        let mut batch_failed = 0;
        let mut batch_errors = Vec::new();

        for (local_idx, patient_data) in batch.iter().enumerate() {
            let global_idx = start_idx + local_idx;

            // Validate required fields
            if !patient_data.get("first_name").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false) {
                batch_errors.push(json!({
                    "row": global_idx + 1,
                    "error": "first_name is required"
                }));
                batch_failed += 1;
                continue;
            }

            if !patient_data.get("last_name").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false) {
                batch_errors.push(json!({
                    "row": global_idx + 1,
                    "error": "last_name is required"
                }));
                batch_failed += 1;
                continue;
            }

            // Set defaults - ensure age is provided
            let mut processed_patient = patient_data.clone();
            if processed_patient.get("age").is_none() {
                // Check if date_of_birth is provided (for backward compatibility)
                if let Some(dob_str) = processed_patient.get("date_of_birth").and_then(|v| v.as_str()) {
                    // Calculate age from date_of_birth
                    if let Ok(dob) = chrono::NaiveDate::parse_from_str(dob_str, "%Y-%m-%d") {
                        let age = chrono::Utc::now().date_naive().year() - dob.year();
                        processed_patient["age"] = json!(age);
                    } else {
                        // Invalid date, use default age
                        processed_patient["age"] = json!(0);
                    }
                } else {
                    // No age or date_of_birth provided, use default
                    processed_patient["age"] = json!(0);
                }
            }
            if !processed_patient.get("gender").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false) {
                processed_patient["gender"] = json!("Unknown");
            }
            let phone = processed_patient.get("phone").and_then(|v| v.as_str()).unwrap_or("");
            if phone.is_empty() || phone == "Not provided" {
                processed_patient["phone"] = json!("0000000000");
            }
            processed_patient.as_object_mut().and_then(|obj| obj.remove("status"));

            // Create patient
            match create_patient(web::Json(processed_patient), state.clone()).await {
                Ok(_) => batch_imported += 1,
                Err(e) => {
                    batch_errors.push(json!({
                        "row": global_idx + 1,
                        "error": format!("Failed to import: {}", e)
                    }));
                    batch_failed += 1;
                }
            }
        }

        all_imported += batch_imported;
        all_failed += batch_failed;
        all_errors.extend(batch_errors.clone());

        batch_results.push(json!({
            "batch_number": batch_num + 1,
            "start_index": start_idx + 1,
            "end_index": end_idx,
            "imported": batch_imported,
            "failed": batch_failed,
            "errors": batch_errors
        }));

        // Update session progress
        let progress = ((batch_num + 1) as f64 / total_batches as f64 * 100.0) as f64;
        let _ = sqlx::query(
            r#"
            UPDATE import_sessions
            SET current_batch = $1,
                imported_count = $2,
                failed_count = $3,
                progress_percentage = $4,
                updated_at = $5
            WHERE id = $6
            "#
        )
        .bind((batch_num + 1) as i32)
        .bind(all_imported as i32)
        .bind(all_failed as i32)
        .bind(BigDecimal::from_str(&progress.to_string()).unwrap_or(BigDecimal::from(0)))
        .bind(Utc::now())
        .bind(session_id)
        .execute(&state.db_pool)
        .await;
    }

    // Finalize import session
    let completed_at = Utc::now();
    let status = if all_errors.len() == 0 {
        "completed"
    } else if all_imported == 0 {
        "failed"
    } else {
        "partial"
    };

    let final_progress = if total_records > 0 {
        ((all_imported + all_failed) as f64 / total_records as f64 * 100.0) as f64
    } else {
        100.0
    };

    let _ = sqlx::query(
        r#"
        UPDATE import_sessions
        SET status = $1,
            imported_count = $2,
            failed_count = $3,
            progress_percentage = $4,
            completed_at = $5,
            batch_results = $6,
            error_summary = $7,
            updated_at = $8
        WHERE id = $9
        "#
    )
    .bind(status)
    .bind(all_imported as i32)
    .bind(all_failed as i32)
    .bind(BigDecimal::from_str(&final_progress.to_string()).unwrap_or(BigDecimal::from(0)))
    .bind(completed_at)
    .bind(json!(batch_results))
    .bind(json!({
        "total_errors": all_errors.len(),
        "sample_errors": if all_errors.len() > 10 {
            all_errors.iter().take(10).cloned().collect::<Vec<_>>()
        } else {
            all_errors.clone()
        }
    }))
    .bind(Utc::now())
    .bind(session_id)
    .execute(&state.db_pool)
    .await;

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "data": {
            "session_id": session_id,
            "total_records": total_records,
            "imported": all_imported,
            "failed": all_failed,
            "errors": if all_errors.len() > 20 {
                all_errors.iter().take(20).cloned().collect::<Vec<_>>()
            } else {
                all_errors
            },
            "batch_results": batch_results
        },
        "message": format!("Resumed import: {} records imported, {} failed", all_imported, all_failed)
    })))
}

