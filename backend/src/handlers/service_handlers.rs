use actix_web::{web, HttpResponse, Result as ActixResult};
use uuid::Uuid;
use chrono::Utc;
use serde_json::json;
use rust_decimal::Decimal;
use crate::models_enhanced::{Service, CreateService};
use crate::simple_handlers::get_current_user;
use crate::ApiResponse;

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
    let cash_price = service_data.cash_price.unwrap_or(service_data.unit_price);
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
    .bind(service_data.unit_price)
    .bind(cash_price)
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

    let cash_price = update_data.get("cash_price")
        .and_then(|v| v.as_f64())
        .map(Decimal::from);
    let nhif_price = update_data.get("nhif_price")
        .and_then(|v| v.as_f64())
        .map(Decimal::from);
    let sha_price = update_data.get("sha_price")
        .and_then(|v| v.as_f64())
        .map(Decimal::from);


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
            Ok(HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                data: None,
                message: None,
                error: Some(format!("Failed to update service: {}", e)),
            }))
        }
    }
}

