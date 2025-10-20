use actix_web::{web, HttpResponse, Result};
use uuid::Uuid;

use crate::models::Appointment;
use crate::database::Database;

pub async fn get_appointments(
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let appointments = sqlx::query_as!(
        Appointment,
        "SELECT * FROM appointments ORDER BY date DESC, time DESC"
    )
    .fetch_all(database.get_pool())
    .await?;

    Ok(HttpResponse::Ok().json(appointments))
}

pub async fn get_appointment(
    path: web::Path<Uuid>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let appointment_id = path.into_inner();
    
    let appointment = sqlx::query_as!(
        Appointment,
        "SELECT * FROM appointments WHERE id = $1",
        appointment_id
    )
    .fetch_optional(database.get_pool())
    .await?
    .ok_or_else(|| actix_web::error::ErrorNotFound("Appointment not found"))?;

    Ok(HttpResponse::Ok().json(appointment))
}

pub async fn create_appointment(
    req: web::Json<crate::models::CreateAppointmentRequest>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let appointment = sqlx::query_as!(
        Appointment,
        "INSERT INTO appointments (patient_id, clinician_id, date, time, appointment_type, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *",
        req.patient_id,
        req.clinician_id,
        req.date,
        req.time,
        req.appointment_type,
        req.notes
    )
    .fetch_one(database.get_pool())
    .await?;

    Ok(HttpResponse::Created().json(appointment))
}

pub async fn update_appointment(
    path: web::Path<Uuid>,
    req: web::Json<crate::models::CreateAppointmentRequest>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let appointment_id = path.into_inner();
    
    let appointment = sqlx::query_as!(
        Appointment,
        "UPDATE appointments SET
            patient_id = $2, clinician_id = $3, date = $4, time = $5,
            appointment_type = $6, notes = $7
         WHERE id = $1
         RETURNING *",
        appointment_id,
        req.patient_id,
        req.clinician_id,
        req.date,
        req.time,
        req.appointment_type,
        req.notes
    )
    .fetch_optional(database.get_pool())
    .await?
    .ok_or_else(|| actix_web::error::ErrorNotFound("Appointment not found"))?;

    Ok(HttpResponse::Ok().json(appointment))
}

pub async fn delete_appointment(
    path: web::Path<Uuid>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let appointment_id = path.into_inner();
    
    sqlx::query!(
        "DELETE FROM appointments WHERE id = $1",
        appointment_id
    )
    .execute(database.get_pool())
    .await?;

    Ok(HttpResponse::NoContent().finish())
}

pub async fn get_appointments_by_date(
    path: web::Path<String>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let date = path.into_inner();
    let parsed_date = chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d")?;
    
    let appointments = sqlx::query_as!(
        Appointment,
        "SELECT * FROM appointments WHERE date = $1 ORDER BY time",
        parsed_date
    )
    .fetch_all(database.get_pool())
    .await?;

    Ok(HttpResponse::Ok().json(appointments))
}

pub async fn get_appointments_by_patient(
    path: web::Path<Uuid>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let patient_id = path.into_inner();
    
    let appointments = sqlx::query_as!(
        Appointment,
        "SELECT * FROM appointments WHERE patient_id = $1 ORDER BY date DESC, time DESC",
        patient_id
    )
    .fetch_all(database.get_pool())
    .await?;

    Ok(HttpResponse::Ok().json(appointments))
}
