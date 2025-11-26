use actix_web::{web, HttpResponse, Result, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use chrono::{Utc, Datelike};

use crate::models::{
    Patient, CreatePatient, UpdatePatient, PatientImport, ApiResponse, PaginatedResponse
};
use crate::AppState;
use crate::middleware::auth::get_current_user;
use crate::error::Validate;

pub async fn get_patients(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    let page = query.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
    let per_page = query.get("per_page").and_then(|v| v.as_i64()).unwrap_or(20);
    let search = query.get("search").and_then(|v| v.as_str());
    let offset = (page - 1) * per_page;

    let mut query_builder = sqlx::QueryBuilder::new("SELECT * FROM patients WHERE 1=1");
    let mut count_builder = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM patients WHERE 1=1");

    if let Some(search_term) = search {
        query_builder.push(" AND (first_name ILIKE ");
        query_builder.push_bind(format!("%{}%", search_term));
        query_builder.push(" OR last_name ILIKE ");
        query_builder.push_bind(format!("%{}%", search_term));
        query_builder.push(" OR patient_number ILIKE ");
        query_builder.push_bind(format!("%{}%", search_term));
        query_builder.push(" OR phone ILIKE ");
        query_builder.push_bind(format!("%{}%", search_term));
        query_builder.push(")");

        count_builder.push(" AND (first_name ILIKE ");
        count_builder.push_bind(format!("%{}%", search_term));
        count_builder.push(" OR last_name ILIKE ");
        count_builder.push_bind(format!("%{}%", search_term));
        count_builder.push(" OR patient_number ILIKE ");
        count_builder.push_bind(format!("%{}%", search_term));
        count_builder.push(" OR phone ILIKE ");
        count_builder.push_bind(format!("%{}%", search_term));
        count_builder.push(")");
    }

    query_builder.push(" ORDER BY created_at DESC LIMIT ");
    query_builder.push_bind(per_page);
    query_builder.push(" OFFSET ");
    query_builder.push_bind(offset);

    let patients: Vec<Patient> = query_builder
        .build_query_as::<Patient>()
        .fetch_all(&data.db_pool)
        .await
        .map_err(|e| {
            eprintln!("Error fetching patients: {}", e);
            actix_web::error::ErrorInternalServerError(e)
        })?;

    let total: i64 = count_builder
        .build_query_scalar()
        .fetch_one(&data.db_pool)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i32;

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(PaginatedResponse {
            data: patients,
            total,
            page: page as i32,
            per_page: per_page as i32,
            total_pages,
        }),
        message: None,
        error: None,
    }))
}

pub async fn create_patient(
    req: web::Json<CreatePatient>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let patient_data = req.into_inner();
    
    // Validate patient data
    if let Err(validation_errors) = patient_data.validate() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<serde_json::Value> {
            success: false,
            data: None,
            message: Some("Validation failed".to_string()),
            error: Some(validation_errors.to_api_error().message),
        }));
    }
    
    // Generate patient number
    let patient_number = format!("PAT-{}-{}", 
        Utc::now().format("%Y"),
        format!("{:04}", rand::random::<u16>())
    );

    let patient_id = Uuid::new_v4();
    let now = Utc::now();

    let result = sqlx::query(
        r#"
        INSERT INTO patients (
            id, patient_number, first_name, last_name, age, date_of_birth, gender,
            phone, location, emergency_contact, emergency_phone,
            blood_type, allergies, medical_history, insurance_type, insurance_number,
            created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        )
        "#
    )
    .bind(patient_id)
    .bind(&patient_number)
    .bind(&patient_data.first_name)
    .bind(&patient_data.last_name)
    .bind(&patient_data.age)
    .bind(&patient_data.date_of_birth)
    .bind(&patient_data.gender)
    .bind(&patient_data.phone)
    .bind(&patient_data.location)
    .bind(&patient_data.emergency_contact)
    .bind(&patient_data.emergency_phone)
    .bind(&patient_data.blood_type)
    .bind(&patient_data.allergies.unwrap_or_default())
    .bind(&patient_data.medical_history)
    .bind(&patient_data.insurance_type)
    .bind(&patient_data.insurance_number)
    .bind(now)
    .bind(now)
    .execute(&data.db_pool)
    .await;

    match result {
        Ok(_) => {
            // Log the action
            let _ = sqlx::query(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6)"
            )
            .bind(Uuid::parse_str(&claims.sub).unwrap())
            .bind("CREATE")
            .bind("patient")
            .bind(patient_id)
            .bind(json!({
                "patient_number": patient_number,
                "first_name": patient_data.first_name,
                "last_name": patient_data.last_name
            }))
            .bind(now)
            .execute(&data.db_pool)
            .await;

            Ok(HttpResponse::Created().json(ApiResponse {
                success: true,
                data: Some(json!({
                    "id": patient_id,
                    "patient_number": patient_number
                })),
                message: Some("Patient created successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
              Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to create patient: {}", e)),
            }))
        }
    }
}

pub async fn get_patient(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();

    let patient_result = sqlx::query_as::<_, Patient>(
        "SELECT * FROM patients WHERE id = $1"
    )
    .bind(patient_id)
    .fetch_one(&data.db_pool)
    .await;

    match patient_result {
        Ok(patient) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(patient),
                message: None,
                error: None,
            }))
        }
        Err(_) => {
            Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Patient not found".to_string()),
            }))
        }
    }
}

pub async fn update_patient(
    path: web::Path<Uuid>,
    req: web::Json<UpdatePatient>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let patient_id = path.into_inner();
    let update_data = req.into_inner();
    
    // Validate update data
    if let Err(validation_errors) = update_data.validate() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<serde_json::Value> {
            success: false,
            data: None,
            message: Some("Validation failed".to_string()),
            error: Some(validation_errors.to_api_error().message),
        }));
    }
    
    let now = Utc::now();

    // Get current patient data for audit log
    let current_patient = sqlx::query_as::<_, Patient>(
        "SELECT * FROM patients WHERE id = $1"
    )
    .bind(patient_id)
    .fetch_one(&data.db_pool)
    .await;

    if current_patient.is_err() {
        return Ok(HttpResponse::NotFound().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Patient not found".to_string()),
        }));
    }

    let current = current_patient.unwrap();

    // Build dynamic update query
    let mut query_builder = sqlx::QueryBuilder::new("UPDATE patients SET ");
    let mut first = true;

    if let Some(ref first_name) = update_data.first_name {
        if !first { query_builder.push(", "); }
        query_builder.push("first_name = ");
        query_builder.push_bind(first_name);
        first = false;
    }
    if let Some(ref last_name) = update_data.last_name {
        if !first { query_builder.push(", "); }
        query_builder.push("last_name = ");
        query_builder.push_bind(last_name);
        first = false;
    }
    if let Some(ref age) = update_data.age {
        if !first { query_builder.push(", "); }
        query_builder.push("age = ");
        query_builder.push_bind(age);
        first = false;
    }
    if let Some(ref date_of_birth) = update_data.date_of_birth {
        if !first { query_builder.push(", "); }
        query_builder.push("date_of_birth = ");
        query_builder.push_bind(date_of_birth);
        first = false;
    }
    if let Some(ref gender) = update_data.gender {
        if !first { query_builder.push(", "); }
        query_builder.push("gender = ");
        query_builder.push_bind(gender);
        first = false;
    }
    if let Some(ref phone) = update_data.phone {
        if !first { query_builder.push(", "); }
        query_builder.push("phone = ");
        query_builder.push_bind(phone);
        first = false;
    }
    if let Some(ref location) = update_data.location {
        if !first { query_builder.push(", "); }
        query_builder.push("location = ");
        query_builder.push_bind(location);
        first = false;
    }
    if let Some(ref emergency_contact) = update_data.emergency_contact {
        if !first { query_builder.push(", "); }
        query_builder.push("emergency_contact = ");
        query_builder.push_bind(emergency_contact);
        first = false;
    }
    if let Some(ref emergency_phone) = update_data.emergency_phone {
        if !first { query_builder.push(", "); }
        query_builder.push("emergency_phone = ");
        query_builder.push_bind(emergency_phone);
        first = false;
    }
    if let Some(ref blood_type) = update_data.blood_type {
        if !first { query_builder.push(", "); }
        query_builder.push("blood_type = ");
        query_builder.push_bind(blood_type);
        first = false;
    }
    if let Some(ref allergies) = update_data.allergies {
        if !first { query_builder.push(", "); }
        query_builder.push("allergies = ");
        query_builder.push_bind(allergies);
        first = false;
    }
    if let Some(ref medical_history) = update_data.medical_history {
        if !first { query_builder.push(", "); }
        query_builder.push("medical_history = ");
        query_builder.push_bind(medical_history);
        first = false;
    }
    if let Some(ref insurance_type) = update_data.insurance_type {
        if !first { query_builder.push(", "); }
        query_builder.push("insurance_type = ");
        query_builder.push_bind(insurance_type);
        first = false;
    }
    if let Some(ref insurance_number) = update_data.insurance_number {
        if !first { query_builder.push(", "); }
        query_builder.push("insurance_number = ");
        query_builder.push_bind(insurance_number);
        first = false;
    }

    if first {
          return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("No fields to update".to_string()),
        }));
    }

    query_builder.push(", updated_at = ");
    query_builder.push_bind(now);
    query_builder.push(" WHERE id = ");
    query_builder.push_bind(patient_id);

    let result = query_builder
        .build()
        .execute(&data.db_pool)
        .await;

    match result {
        Ok(_) => {
            // Log the action
            let _ = sqlx::query(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)"
            )
            .bind(Uuid::parse_str(&claims.sub).unwrap())
            .bind("UPDATE")
            .bind("patient")
            .bind(patient_id)
            .bind(json!({
                "patient_number": current.patient_number,
                "first_name": current.first_name,
                "last_name": current.last_name
            }))
            .bind(json!({
                "patient_number": current.patient_number,
                "first_name": update_data.first_name.unwrap_or(current.first_name),
                "last_name": update_data.last_name.unwrap_or(current.last_name)
            }))
            .bind(now)
            .execute(&data.db_pool)
            .await;

              Ok(HttpResponse::Ok().json(ApiResponse::<()> {
                success: true,
                data: None,
                message: Some("Patient updated successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
              Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to update patient: {}", e)),
            }))
        }
    }
}

pub async fn delete_patient(
    path: web::Path<Uuid>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let patient_id = path.into_inner();

    // Check if patient has any related records
    let has_consultations = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM consultations WHERE patient_id = $1"
    )
    .bind(patient_id)
    .fetch_one(&data.db_pool)
    .await
    .unwrap_or(0);

    if has_consultations > 0 {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Cannot delete patient with existing consultations".to_string()),
        }));
    }

    let result = sqlx::query("DELETE FROM patients WHERE id = $1")
        .bind(patient_id)
        .execute(&data.db_pool)
        .await;

    match result {
        Ok(_) => {
            // Log the action
            let _ = sqlx::query(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, created_at)
                 VALUES ($1, $2, $3, $4, $5)"
            )
            .bind(Uuid::parse_str(&claims.sub).unwrap())
            .bind("DELETE")
            .bind("patient")
            .bind(patient_id)
            .bind(Utc::now())
            .execute(&data.db_pool)
            .await;

              Ok(HttpResponse::Ok().json(ApiResponse::<()> {
                success: true,
                data: None,
                message: Some("Patient deleted successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
              Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to delete patient: {}", e)),
            }))
        }
    }
}

pub async fn import_patients(
    req: web::Json<Vec<PatientImport>>,
    data: web::Data<AppState>,
    http_req: HttpRequest,
) -> Result<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    let import_data = req.into_inner();
    let mut imported_count = 0;
    let mut errors = Vec::new();

    for (index, patient_import) in import_data.iter().enumerate() {
        // Calculate date of birth from age
        let current_year = Utc::now().year();
        let birth_year = current_year - patient_import.age;
        let date_of_birth = chrono::NaiveDate::from_ymd_opt(birth_year, 1, 1)
            .unwrap_or_else(|| chrono::NaiveDate::from_ymd_opt(1990, 1, 1).unwrap())
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();

        // Generate patient number
        let patient_number = if patient_import.op_number.contains('/') {
            // Handle OP numbers like "789/06"
            let parts: Vec<&str> = patient_import.op_number.split('/').collect();
            if parts.len() == 2 {
                format!("OP-{}-{}", parts[1], parts[0])
            } else {
                format!("OP-{}", patient_import.op_number)
            }
        } else {
            format!("OP-{}", patient_import.op_number)
        };

        let patient_id = Uuid::new_v4();
        let now = Utc::now();

        let result = sqlx::query(
            r#"
            INSERT INTO patients (
                id, patient_number, first_name, last_name, date_of_birth, gender,
                phone, location, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            )
            "#
        )
        .bind(patient_id)
        .bind(&patient_number)
        .bind(&patient_import.name)
        .bind("") // Last name not provided
        .bind(date_of_birth)
        .bind("other") // Default gender
        .bind(&patient_import.phone)
        .bind(&patient_import.location)
        .bind(now)
        .bind(now)
        .execute(&data.db_pool)
        .await;

        match result {
            Ok(_) => {
                imported_count += 1;
            }
            Err(e) => {
                errors.push(format!("Row {}: {}", index + 1, e));
            }
        }
    }

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(json!({
            "imported_count": imported_count,
            "total_count": import_data.len(),
            "errors": errors
        })),
        message: Some(format!("Imported {} out of {} patients", imported_count, import_data.len())),
        error: None,
    }))
}

pub async fn search_patients(
    query: web::Query<serde_json::Value>,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
    let search_term = query.get("q")
        .and_then(|v| v.as_str())
        .ok_or_else(|| actix_web::error::ErrorBadRequest("Search term required"))?;

    let patients: Vec<Patient> = sqlx::query_as::<_, Patient>(
        r#"
        SELECT * FROM patients 
        WHERE first_name ILIKE $1 
           OR last_name ILIKE $1 
           OR patient_number ILIKE $1 
           OR phone ILIKE $1
        ORDER BY first_name, last_name
        LIMIT 20
        "#
    )
    .bind(format!("%{}%", search_term))
    .fetch_all(&data.db_pool)
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(patients),
        message: None,
        error: None,
    }))
}
