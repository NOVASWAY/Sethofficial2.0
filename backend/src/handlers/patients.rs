use actix_web::{web, HttpResponse, Result};
use uuid::Uuid;

use crate::models::{CreatePatientRequest, Patient};
use crate::database::Database;

pub async fn get_patients(
    database: web::Data<Database>,
    query: web::Query<PatientQuery>,
) -> Result<HttpResponse> {
    let patients = sqlx::query_as!(
        Patient,
        "SELECT * FROM patients ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        query.limit.unwrap_or(50),
        query.offset.unwrap_or(0)
    )
    .fetch_all(database.get_pool())
    .await?;

    Ok(HttpResponse::Ok().json(patients))
}

pub async fn get_patient(
    path: web::Path<Uuid>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();
    
    let patient = sqlx::query_as!(
        Patient,
        "SELECT * FROM patients WHERE id = $1",
        patient_id
    )
    .fetch_optional(database.get_pool())
    .await?
    .ok_or_else(|| actix_web::error::ErrorNotFound("Patient not found"))?;

    Ok(HttpResponse::Ok().json(patient))
}

pub async fn create_patient(
    req: web::Json<CreatePatientRequest>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    // Generate patient number
    let patient_number = format!("P{:06}", chrono::Utc::now().timestamp() % 1000000);
    
    let patient = sqlx::query_as!(
        Patient,
        "INSERT INTO patients (
            patient_number, first_name, last_name, date_of_birth, gender,
            phone, email, address, emergency_contact, emergency_phone,
            blood_type, allergies, medical_history, insurance_provider, insurance_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *",
        patient_number,
        req.first_name,
        req.last_name,
        req.date_of_birth,
        req.gender as _,
        req.phone,
        req.email,
        req.address,
        req.emergency_contact,
        req.emergency_phone,
        req.blood_type,
        req.allergies,
        req.medical_history,
        req.insurance_provider,
        req.insurance_number
    )
    .fetch_one(database.get_pool())
    .await?;

    Ok(HttpResponse::Created().json(patient))
}

pub async fn update_patient(
    path: web::Path<Uuid>,
    req: web::Json<CreatePatientRequest>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();
    
    let patient = sqlx::query_as!(
        Patient,
        "UPDATE patients SET
            first_name = $2, last_name = $3, date_of_birth = $4, gender = $5,
            phone = $6, email = $7, address = $8, emergency_contact = $9,
            emergency_phone = $10, blood_type = $11, allergies = $12,
            medical_history = $13, insurance_provider = $14, insurance_number = $15
        WHERE id = $1
        RETURNING *",
        patient_id,
        req.first_name,
        req.last_name,
        req.date_of_birth,
        req.gender as _,
        req.phone,
        req.email,
        req.address,
        req.emergency_contact,
        req.emergency_phone,
        req.blood_type,
        req.allergies,
        req.medical_history,
        req.insurance_provider,
        req.insurance_number
    )
    .fetch_optional(database.get_pool())
    .await?
    .ok_or_else(|| actix_web::error::ErrorNotFound("Patient not found"))?;

    Ok(HttpResponse::Ok().json(patient))
}

pub async fn delete_patient(
    path: web::Path<Uuid>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();
    
    sqlx::query!(
        "DELETE FROM patients WHERE id = $1",
        patient_id
    )
    .execute(database.get_pool())
    .await?;

    Ok(HttpResponse::NoContent().finish())
}

pub async fn search_patients(
    query: web::Query<PatientSearchQuery>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let search_term = format!("%{}%", query.q);
    
    let patients = sqlx::query_as!(
        Patient,
        "SELECT * FROM patients 
         WHERE first_name ILIKE $1 
            OR last_name ILIKE $1 
            OR patient_number ILIKE $1 
            OR phone ILIKE $1
         ORDER BY created_at DESC
         LIMIT $2",
        search_term,
        query.limit.unwrap_or(50)
    )
    .fetch_all(database.get_pool())
    .await?;

    Ok(HttpResponse::Ok().json(patients))
}

#[derive(serde::Deserialize)]
pub struct PatientQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(serde::Deserialize)]
pub struct PatientSearchQuery {
    pub q: String,
    pub limit: Option<i64>,
}
