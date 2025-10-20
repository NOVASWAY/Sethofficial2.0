use actix_web::{web, HttpResponse, Result};
use uuid::Uuid;

use crate::models::Medication;
use crate::database::Database;

pub async fn get_medications(
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let medications = sqlx::query_as!(
        Medication,
        "SELECT * FROM medications ORDER BY name"
    )
    .fetch_all(database.get_pool())
    .await?;

    Ok(HttpResponse::Ok().json(medications))
}

pub async fn get_medication(
    path: web::Path<Uuid>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let medication_id = path.into_inner();
    
    let medication = sqlx::query_as!(
        Medication,
        "SELECT * FROM medications WHERE id = $1",
        medication_id
    )
    .fetch_optional(database.get_pool())
    .await?
    .ok_or_else(|| actix_web::error::ErrorNotFound("Medication not found"))?;

    Ok(HttpResponse::Ok().json(medication))
}

pub async fn create_medication(
    req: web::Json<crate::models::CreateMedicationRequest>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let medication = sqlx::query_as!(
        Medication,
        "INSERT INTO medications (
            name, generic_name, category, manufacturer, batch_number,
            expiry_date, quantity, unit_price, reorder_level, location,
            description, side_effects, dosage_form, strength
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *",
        req.name,
        req.generic_name,
        req.category,
        req.manufacturer,
        req.batch_number,
        req.expiry_date,
        req.quantity,
        req.unit_price,
        req.reorder_level,
        req.location,
        req.description,
        req.side_effects,
        req.dosage_form,
        req.strength
    )
    .fetch_one(database.get_pool())
    .await?;

    Ok(HttpResponse::Created().json(medication))
}

pub async fn update_medication(
    path: web::Path<Uuid>,
    req: web::Json<crate::models::CreateMedicationRequest>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let medication_id = path.into_inner();
    
    let medication = sqlx::query_as!(
        Medication,
        "UPDATE medications SET
            name = $2, generic_name = $3, category = $4, manufacturer = $5,
            batch_number = $6, expiry_date = $7, quantity = $8, unit_price = $9,
            reorder_level = $10, location = $11, description = $12,
            side_effects = $13, dosage_form = $14, strength = $15
         WHERE id = $1
         RETURNING *",
        medication_id,
        req.name,
        req.generic_name,
        req.category,
        req.manufacturer,
        req.batch_number,
        req.expiry_date,
        req.quantity,
        req.unit_price,
        req.reorder_level,
        req.location,
        req.description,
        req.side_effects,
        req.dosage_form,
        req.strength
    )
    .fetch_optional(database.get_pool())
    .await?
    .ok_or_else(|| actix_web::error::ErrorNotFound("Medication not found"))?;

    Ok(HttpResponse::Ok().json(medication))
}

pub async fn delete_medication(
    path: web::Path<Uuid>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let medication_id = path.into_inner();
    
    sqlx::query!(
        "DELETE FROM medications WHERE id = $1",
        medication_id
    )
    .execute(database.get_pool())
    .await?;

    Ok(HttpResponse::NoContent().finish())
}

pub async fn get_low_stock(
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let medications = sqlx::query_as!(
        Medication,
        "SELECT * FROM medications WHERE quantity <= reorder_level ORDER BY quantity ASC"
    )
    .fetch_all(database.get_pool())
    .await?;

    Ok(HttpResponse::Ok().json(medications))
}

pub async fn get_expiring(
    query: web::Query<ExpiringQuery>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let days = query.days.unwrap_or(30);
    let cutoff_date = chrono::Utc::now().date_naive() + chrono::Duration::days(days);
    
    let medications = sqlx::query_as!(
        Medication,
        "SELECT * FROM medications WHERE expiry_date <= $1 ORDER BY expiry_date ASC",
        cutoff_date
    )
    .fetch_all(database.get_pool())
    .await?;

    Ok(HttpResponse::Ok().json(medications))
}

pub async fn search_medications(
    query: web::Query<MedicationSearchQuery>,
    database: web::Data<Database>,
) -> Result<HttpResponse> {
    let search_term = format!("%{}%", query.q);
    
    let medications = sqlx::query_as!(
        Medication,
        "SELECT * FROM medications 
         WHERE name ILIKE $1 
            OR generic_name ILIKE $1 
            OR category ILIKE $1
         ORDER BY name
         LIMIT $2",
        search_term,
        query.limit.unwrap_or(50)
    )
    .fetch_all(database.get_pool())
    .await?;

    Ok(HttpResponse::Ok().json(medications))
}

#[derive(serde::Deserialize)]
pub struct ExpiringQuery {
    pub days: Option<i64>,
}

#[derive(serde::Deserialize)]
pub struct MedicationSearchQuery {
    pub q: String,
    pub limit: Option<i64>,
}
