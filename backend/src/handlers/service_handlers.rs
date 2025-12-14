use actix_web::{web, HttpResponse, Result as ActixResult};
use uuid::Uuid;
use chrono::Utc;
use serde_json::json;
use rust_decimal::{Decimal, prelude::*};
use crate::models_enhanced::{Service, CreateService};
use crate::middleware::auth::get_current_user;
use crate::models::ApiResponse;

/// Create a new service (Admin only)
pub async fn create_service(
    req: web::Json<CreateService>,
    data: web::Data<crate::AppState>,
    http_req: actix_web::HttpRequest,
) -> ActixResult<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    // Check if user is admin
    if claims.role != "admin" {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Only admins can create services".to_string()),
        }));
    }

    let service_data = req.into_inner();
    let service_id = Uuid::new_v4();
    let now = Utc::now();

    // Use cash_price from unit_price if cash_price not provided
    let unit_price_f64 = service_data.unit_price;
    let cash_price = service_data.cash_price.or(Some(unit_price_f64));
    let nhif_price = service_data.nhif_price;
    let sha_price = service_data.sha_price;

    match sqlx::query_as::<_, Service>(
        r#"
        INSERT INTO services (
            id, service_code, service_name, category, description,
            unit_price, cash_price, nhif_price, sha_price,
            sha_approved, is_active, requires_prescription,
            created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
        RETURNING id, service_code, service_name, category, description,
                  unit_price, cash_price, nhif_price, sha_price,
                  sha_approved, is_active, requires_prescription,
                  created_at, updated_at
        "#
    )
    .bind(service_id)
    .bind(&service_data.service_code)
    .bind(&service_data.service_name)
    .bind(&service_data.category)
    .bind(&service_data.description)
    .bind(unit_price_f64)
    .bind(cash_price.unwrap_or(0.0))
    .bind(nhif_price)
    .bind(sha_price)
    .bind(service_data.sha_approved)
    .bind(true) // is_active
    .bind(service_data.requires_prescription.unwrap_or(false))
    .bind(now)
    .bind(now)
    .fetch_one(&data.db_pool)
    .await
    {
        Ok(service) => {
            Ok(HttpResponse::Created().json(ApiResponse {
                success: true,
                data: Some(json!(service)),
                message: Some("Service created successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
            eprintln!("Error creating service: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to create service: {}", e)),
            }))
        }
    }
}

/// Get all services
pub async fn get_services(
    data: web::Data<crate::AppState>,
) -> ActixResult<HttpResponse> {
    match sqlx::query_as::<_, Service>(
        r#"
        SELECT id, service_code, service_name, category, description,
               unit_price, cash_price, nhif_price, sha_price,
               sha_approved, is_active, requires_prescription,
               created_at, updated_at
        FROM services
        WHERE is_active = true
        ORDER BY category, service_name
        "#
    )
    .fetch_all(&data.db_pool)
    .await
    {
        Ok(services) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(json!({ "services": services })),
                message: None,
                error: None,
            }))
        }
        Err(e) => {
            eprintln!("Error fetching services: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to fetch services".to_string()),
            }))
        }
    }
}

/// Get all services for admin (including inactive)
pub async fn get_services_for_admin(
    data: web::Data<crate::AppState>,
    http_req: actix_web::HttpRequest,
) -> ActixResult<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    if claims.role != "admin" {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Only admins can access this endpoint".to_string()),
        }));
    }

    match sqlx::query_as::<_, Service>(
        r#"
        SELECT id, service_code, service_name, category, description,
               unit_price, cash_price, nhif_price, sha_price,
               sha_approved, is_active, requires_prescription,
               created_at, updated_at
        FROM services
        ORDER BY category, service_name
        "#
    )
    .fetch_all(&data.db_pool)
    .await
    {
        Ok(services) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(json!({ "services": services })),
                message: None,
                error: None,
            }))
        }
        Err(e) => {
            eprintln!("Error fetching services: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some("Failed to fetch services".to_string()),
            }))
        }
    }
}

/// Update service prices (Admin only)
pub async fn update_service_prices(
    path: web::Path<Uuid>,
    req: web::Json<serde_json::Value>,
    data: web::Data<crate::AppState>,
    http_req: actix_web::HttpRequest,
) -> ActixResult<HttpResponse> {
    let claims = get_current_user(&http_req)
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("User not authenticated"))?;

    if claims.role != "admin" {
        return Ok(HttpResponse::Forbidden().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("Only admins can update services".to_string()),
        }));
    }

    let service_id = path.into_inner();
    let update_data = req.into_inner();
    let now = Utc::now();

    // Extract and validate prices (keep as f64)
    let cash_price: Option<f64> = update_data.get("cash_price")
        .and_then(|v| v.as_f64());
    let nhif_price: Option<f64> = update_data.get("nhif_price")
        .and_then(|v| v.as_f64());
    let sha_price: Option<f64> = update_data.get("sha_price")
        .and_then(|v| v.as_f64());

    // Validate that at least one price is provided
    if cash_price.is_none() && nhif_price.is_none() && sha_price.is_none() {
        return Ok(HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            message: None,
            error: Some("At least one price (cash_price, nhif_price, or sha_price) must be provided".to_string()),
        }));
    }


    match sqlx::query_as::<_, Service>(
        r#"
        UPDATE services 
        SET cash_price = COALESCE($2, cash_price),
            nhif_price = COALESCE($3, nhif_price),
            sha_price = COALESCE($4, sha_price),
            updated_at = $5
        WHERE id = $1
        RETURNING id, service_code, service_name, category, description,
                  unit_price, cash_price, nhif_price, sha_price,
                  sha_approved, is_active, requires_prescription,
                  created_at, updated_at
        "#
    )
    .bind(service_id)
    .bind(cash_price)
    .bind(nhif_price)
    .bind(sha_price)
    .bind(now)
    .fetch_one(&data.db_pool)
    .await
    {
        Ok(service) => {
            Ok(HttpResponse::Ok().json(ApiResponse {
                success: true,
                data: Some(json!(service)),
                message: Some("Service prices updated successfully".to_string()),
                error: None,
            }))
        }
        Err(e) => {
            eprintln!("Error updating service: {}", e);
            
            // Check if service not found
            let error_msg = if e.to_string().contains("no rows returned") {
                "Service not found".to_string()
            } else {
                format!("Failed to update service: {}", e)
            };
            
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(error_msg),
            }))
        }
    }
}

